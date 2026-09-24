import { NextResponse } from "next/server";
import { verifyWalletSignature, nomoBalance, signSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

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
  const sig = signature as `0x${string}`;

  const validSig = await verifyWalletSignature(addr, sig, nonce);
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
    return NextResponse.json(
      { error: "Insufficient NOMO", balance, required: minNomo },
      { status: 403 },
    );
  }

  const token = signSession(addr);
  const res = NextResponse.json({ wallet: addr.toLowerCase(), balance });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
