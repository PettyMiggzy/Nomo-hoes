import { decodeEventLog, erc20Abi, formatUnits, isAddress, type Hash } from "viem";
import { publicClient } from "@/lib/auth";

const MIN_CONFIRMATIONS = BigInt(process.env.PAYMENT_MIN_CONFIRMATIONS ?? 2);

export class PaymentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function paymentConfig() {
  const treasury = process.env.TREASURY_ADDRESS;
  const token = process.env.NOMO_CONTRACT;
  return {
    treasury: treasury && isAddress(treasury) ? treasury : null,
    token: token && isAddress(token) ? token : null,
  };
}

// Confirms `txHash` is a successful, confirmed NOMO transfer from `wallet` to
// the treasury and returns the amount sent in whole NOMO.
export async function verifyNomoPayment(txHash: Hash, wallet: string): Promise<number> {
  const { treasury, token } = paymentConfig();
  if (!treasury || !token) throw new PaymentError("Payments are not configured yet", 503);

  const client = publicClient();
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    throw new PaymentError("Transaction not found or not mined yet", 409);
  }

  if (receipt.status !== "success") throw new PaymentError("Transaction failed on chain", 400);

  const latest = await client.getBlockNumber();
  if (latest - receipt.blockNumber + BigInt(1) < MIN_CONFIRMATIONS) {
    throw new PaymentError("Waiting for confirmations", 409);
  }

  let total = BigInt(0);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (
        ev.eventName === "Transfer" &&
        ev.args.from.toLowerCase() === wallet.toLowerCase() &&
        ev.args.to.toLowerCase() === treasury.toLowerCase()
      ) {
        total += ev.args.value;
      }
    } catch {
      // not a Transfer event
    }
  }

  if (total === BigInt(0)) {
    throw new PaymentError("No NOMO transfer from your wallet to the treasury in that transaction", 400);
  }

  const decimals = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  return Number(formatUnits(total, decimals));
}
