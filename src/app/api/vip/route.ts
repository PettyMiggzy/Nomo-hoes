import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession } from "@/lib/auth";
import { activateVip } from "@/lib/credits";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { claimTxs, releaseTxs } from "@/lib/txGuard";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { txHash, method: "nomo" | "burn" }
//   nomo: the tx sent >= VIP_PRICE_NOMO NOMO to the treasury
//   burn: the tx sent >= VIP_PRICE_NOHOES NOHOES to the burn address
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
  if (!body.txHash || !isHash(body.txHash)) {
    return NextResponse.json({ error: "Missing or invalid txHash" }, { status: 400 });
  }

  const cfg = paymentConfig();
  const route =
    body.method === "nomo"
      ? { token: cfg.token, to: cfg.treasury, price: PRICING.vipPriceNomo, symbol: "NOMO" }
      : body.method === "burn"
        ? { token: cfg.nohoesToken, to: cfg.burnAddress, price: PRICING.vipPriceNohoes, symbol: "NOHOES" }
        : null;
  if (!route) return NextResponse.json({ error: "method must be nomo or burn" }, { status: 400 });
  if (!route.token || !route.to) {
    return NextResponse.json({ error: `${route.symbol} VIP payments are not open yet` }, { status: 503 });
  }

  let amount: number;
  try {
    amount = await verifyTokenTransfer(body.txHash, session.wallet, route.token, route.to);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }

  if (amount < route.price) {
    return NextResponse.json(
      { error: `VIP needs ${route.price} ${route.symbol}; that transaction sent ${amount}` },
      { status: 400 },
    );
  }

  if (!(await claimTxs(`vip:${body.method}`, body.txHash))) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  let until: Date | null;
  try {
    until = await activateVip(session.wallet, `vip:${body.method}`, body.txHash);
  } catch (e) {
    await releaseTxs(body.txHash);
    throw e;
  }
  if (!until) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  return NextResponse.json({ success: true, vipUntil: until.toISOString() });
}
