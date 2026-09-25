import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCreator } from "@/lib/marketplace";
import { getPayoutWallet, requestPayout } from "@/lib/earnings";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { amount } -- requests a USDG cash-out of earned credits (1:1). The
// credits leave the creator's balance right away and are held until the
// owner pays (or rejects, which returns them).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await getCreator(session.wallet))) return NextResponse.json({ error: "Not a creator" }, { status: 404 });

  const b = (await request.json().catch(() => ({}))) as { amount?: number };
  const amount = Math.floor(Number(b.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < PRICING.minCashout) {
    return NextResponse.json({ error: `Minimum cash-out is $${PRICING.minCashout}` }, { status: 400 });
  }
  const payout = await requestPayout(session.wallet, amount, await getPayoutWallet(session.wallet));
  if (!payout) return NextResponse.json({ error: "You don't have that much in earnings" }, { status: 400 });
  return NextResponse.json({ payout });
}
