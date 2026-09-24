import { NextResponse } from "next/server";
import { getSessionWallet, nomoBalance } from "@/lib/auth";
import { creditBalance, addCredits } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET() {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ creditsAvailable: creditBalance(wallet) });
}

export async function POST(request: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { nomoAmount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.nomoAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  let walletBalance: number;
  try {
    walletBalance = await nomoBalance(wallet as `0x${string}`);
  } catch (e) {
    console.error("nomoBalance error", e);
    return NextResponse.json({ error: "Could not read NOMO balance" }, { status: 502 });
  }

  if (walletBalance < amount) {
    return NextResponse.json(
      { error: "Insufficient NOMO in wallet", balance: walletBalance, requested: amount },
      { status: 403 },
    );
  }

  // NOTE: this only credits the account internally — it does not move any
  // tokens on chain. Wire up an actual on-chain transfer/burn confirmation
  // here before accepting real payments.
  const creditsAvailable = addCredits(wallet, amount);
  return NextResponse.json({ success: true, creditsAvailable });
}
