import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSession } from "@/lib/auth";
import { getCreator } from "@/lib/marketplace";
import { earningsBalance, getPayoutWallet, myPayouts, setPayoutWallet } from "@/lib/earnings";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await getCreator(session.wallet))) return NextResponse.json({ error: "Not a creator" }, { status: 404 });
  const [bal, payoutWallet, payouts] = await Promise.all([
    earningsBalance(session.wallet),
    getPayoutWallet(session.wallet),
    myPayouts(session.wallet),
  ]);
  return NextResponse.json({ ...bal, payoutWallet, payouts, minCashout: PRICING.minCashout });
}

// Body: { payoutWallet } -- where cash-outs are sent (defaults to the login wallet).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { payoutWallet?: string };
  if (!b.payoutWallet || !isAddress(b.payoutWallet)) return NextResponse.json({ error: "Enter a valid wallet address" }, { status: 400 });
  const ok = await setPayoutWallet(session.wallet, b.payoutWallet);
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not a creator" }, { status: 404 });
}
