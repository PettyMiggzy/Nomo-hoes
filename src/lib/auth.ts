import { createPublicClient, http, defineChain, verifyMessage, formatUnits, erc20Abi } from "viem";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "nomo_session";
export const OWNER_WALLET = "owner";

export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 4663);

const nomoChain = defineChain({
  id: CHAIN_ID,
  name: "NOMO Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ROBINHOOD_RPC ?? ""] } },
});

export function publicClient() {
  if (!process.env.ROBINHOOD_RPC) throw new Error("ROBINHOOD_RPC is not configured");
  return createPublicClient({ chain: nomoChain, transport: http(process.env.ROBINHOOD_RPC) });
}

export async function nomoBalance(addr: `0x${string}`): Promise<number> {
  const nomo = process.env.NOMO_CONTRACT as `0x${string}`;
  const client = publicClient();
  const [raw, dec] = await Promise.all([
    client.readContract({ address: nomo, abi: erc20Abi, functionName: "balanceOf", args: [addr] }),
    client.readContract({ address: nomo, abi: erc20Abi, functionName: "decimals" }),
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

export type Session = { wallet: string; owner: boolean };

export function signSession(wallet: string, owner = false): string {
  return jwt.sign({ wallet: wallet.toLowerCase(), owner }, jwtSecret(), { expiresIn: "24h" });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret()) as { wallet: string; owner?: boolean };
    return { wallet: decoded.wallet, owner: decoded.owner === true };
  } catch {
    return null;
  }
}

// Constant-time compare against OWNER_PASSWORD. Disabled when it's unset.
export function checkOwnerPassword(input: string): boolean {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected || expected.length < 8) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24,
  path: "/",
};
