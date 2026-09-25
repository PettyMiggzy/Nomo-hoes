import { decodeEventLog, erc20Abi, formatUnits, isAddress, type Hash } from "viem";
import { publicClient } from "@/lib/auth";

const MIN_CONFIRMATIONS = BigInt(process.env.PAYMENT_MIN_CONFIRMATIONS ?? 2);

export const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export class PaymentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const envAddress = (v: string | undefined) => (v && isAddress(v) ? v : null);

// USDG (Global Dollar, 6 decimals) on Robinhood Chain -- per Paxos and
// Robinhood Chain docs, confirmed on chain. Top-ups are paid in it and
// creator cash-outs are sent in it.
export const USDG_MAINNET = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export function paymentConfig() {
  return {
    treasury: envAddress(process.env.TREASURY_ADDRESS),
    token: envAddress(process.env.USDG_CONTRACT) ?? USDG_MAINNET,
    nomoToken: envAddress(process.env.NOMO_CONTRACT),
    nohoesToken: envAddress(process.env.NOHOES_CONTRACT),
    burnAddress: BURN_ADDRESS,
  };
}

// Confirms `txHash` is a successful, confirmed transfer of `token` from
// `wallet` (or from anyone, when `wallet` is null -- e.g. a payout the owner
// sent from whichever wallet) to `to`, and returns the total amount moved in
// whole tokens.
export async function verifyTokenTransfer(
  txHash: Hash,
  wallet: string | null,
  token: string,
  to: string,
): Promise<number> {
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
        (wallet === null || ev.args.from.toLowerCase() === wallet.toLowerCase()) &&
        ev.args.to.toLowerCase() === to.toLowerCase()
      ) {
        total += ev.args.value;
      }
    } catch {
      // not a Transfer event
    }
  }

  if (total === BigInt(0)) {
    throw new PaymentError("No matching transfer from your wallet in that transaction", 400);
  }

  const decimals = await client.readContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return Number(formatUnits(total, decimals));
}
