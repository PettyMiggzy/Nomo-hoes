import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession } from "@/lib/auth";
import { activateVip } from "@/lib/credits";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { claimTxs, releaseTxs } from "@/lib/txGuard";
import { PRICING } from "@/lib/pricing";
import { chargeHouseSale, creditRef } from "@/lib/earnings";

export const runtime = "nodejs";

// Body: { method: "credits" } -- spends VIP_PRICE_CREDITS credits, or
//       { method: "burn", txHash } -- the tx burned >= VIP_PRICE_NOHOES NOHOES.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.owner) {
    return NextResponse.json({ error: "Owner account already has full access" }, { status: 400 });
  }

  let body: { txHash?: string; method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.method === "credits") {
    let until: Date | null = null;
    const result = await chargeHouseSale(session.wallet, PRICING.vipPriceCredits, "vip:credits", async () => {
      until = await activateVip(session.wallet, "vip:credits", creditRef());
      return until !== null;
    });
    if (result === "insufficient") {
      return NextResponse.json({ error: "insufficient_credits", required: PRICING.vipPriceCredits }, { status: 402 });
    }
    if (!until) return NextResponse.json({ error: "Couldn't activate VIP" }, { status: 500 });
    return NextResponse.json({ success: true, vipUntil: (until as Date).toISOString() });
  }

  if (body.method !== "burn") return NextResponse.json({ error: "method must be credits or burn" }, { status: 400 });
  if (!body.txHash || !isHash(body.txHash)) {
    return NextResponse.json({ error: "Missing or invalid txHash" }, { status: 400 });
  }
  const cfg = paymentConfig();
  if (!cfg.nohoesToken) return NextResponse.json({ error: "NOHOES VIP payments are not open yet" }, { status: 503 });

  let amount: number;
  try {
    amount = await verifyTokenTransfer(body.txHash, session.wallet, cfg.nohoesToken, cfg.burnAddress);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }
  if (amount < PRICING.vipPriceNohoes) {
    return NextResponse.json(
      { error: `VIP needs ${PRICING.vipPriceNohoes} NOHOES burned; that transaction burned ${amount}` },
      { status: 400 },
    );
  }

  if (!(await claimTxs("vip:burn", body.txHash))) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  let until: Date | null;
  try {
    until = await activateVip(session.wallet, "vip:burn", body.txHash);
  } catch (e) {
    await releaseTxs(body.txHash);
    throw e;
  }
  if (!until) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  return NextResponse.json({ success: true, vipUntil: until.toISOString() });
}
