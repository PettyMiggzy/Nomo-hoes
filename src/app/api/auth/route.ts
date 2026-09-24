import { NextResponse } from "next/server";
import {
  verifyWalletSignature,
  nomoBalance,
  signSession,
  getSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  return NextResponse.json(session ?? { wallet: null, owner: false });
}

export async function POST(request: Request) {
  let body: { address?: string; signature?: string; nonce?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { address, signature, nonce } = body;
  if (!address || !signature || !nonce) {
    return NextResponse.json({ error: "Missing address, signature, or nonce" }, { status: 400 });
  }

  const addr = address as `0x${string}`;
  const validSig = await verifyWalletSignature(addr, signature as `0x${string}`, nonce);
  if (!validSig) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const minNomo = Number(process.env.MIN_NOMO ?? 1000);
  let balance: number;
  try {
    balance = await nomoBalance(addr);
  } catch (e) {
    console.error("nomoBalance error", e);
    return NextResponse.json({ error: "Could not read NOMO balance" }, { status: 502 });
  }

  if (balance < minNomo) {
    return NextResponse.json({ error: "Insufficient NOMO", balance, required: minNomo }, { status: 403 });
  }

  const res = NextResponse.json({ wallet: addr.toLowerCase(), balance });
  res.cookies.set(SESSION_COOKIE, signSession(addr), sessionCookieOptions);
  return res;
}
