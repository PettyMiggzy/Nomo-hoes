import { createPublicClient, http, defineChain, verifyMessage, formatUnits } from "viem";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "nomo_session";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ROBINHOOD_RPC ?? ""] } },
});

const ERC20 = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

function client() {
  return createPublicClient({ chain: robinhoodChain, transport: http() });
}

export async function nomoBalance(addr: `0x${string}`): Promise<number> {
  const nomo = process.env.NOMO_CONTRACT as `0x${string}`;
  const [raw, dec] = await Promise.all([
    client().readContract({ address: nomo, abi: ERC20, functionName: "balanceOf", args: [addr] }),
    client().readContract({ address: nomo, abi: ERC20, functionName: "decimals" }),
  ]);
  return Number(formatUnits(raw, dec));
}

export async function verifyWalletSignature(
  address: `0x${string}`,
  signature: `0x${string}`,
  nonce: string,
): Promise<boolean> {
  const message = `Sign in to NOMO HOES\nNonce: ${nonce}`;
  return verifyMessage({ address, message, signature });
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function signSession(wallet: string): string {
  return jwt.sign({ wallet: wallet.toLowerCase() }, jwtSecret(), { expiresIn: "24h" });
}

export async function getSessionWallet(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret()) as { wallet: string };
    return decoded.wallet;
  } catch {
    return null;
  }
}
