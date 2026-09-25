import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession } from "@/lib/auth";
import { getItem, hasUnlocked, recordUnlock } from "@/lib/premium";
import { txAlreadyRedeemed } from "@/lib/txGuard";
import { vipUntil } from "@/lib/credits";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";

export const runtime = "nodejs";

// Body: { itemId, txHash } -- the buyer already sent the item's price in
// NOMO to the treasury. Verifies it on chain, then unlocks the item.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Connect a wallet first" }, { status: 401 });

  let body: { itemId?: number; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const itemId = Number(body.itemId);
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  if (!body.txHash || !isHash(body.txHash)) return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });

  const item = await getItem(itemId);
  if (!item || !item.active) return NextResponse.json({ error: "Item not available" }, { status: 404 });
  if ((await hasUnlocked(itemId, session.wallet)) || (await vipUntil(session.wallet))) {
    return NextResponse.json({ success: true });
  }

  const { treasury, token } = paymentConfig();
  if (!treasury || !token) return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });

  if (await txAlreadyRedeemed(body.txHash)) {
    return NextResponse.json({ error: "That transaction was already redeemed" }, { status: 400 });
  }

  let amount: number;
  try {
    amount = await verifyTokenTransfer(body.txHash, session.wallet, token, treasury);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }
  if (amount < item.priceNomo - 1e-6) {
    return NextResponse.json({ error: `Payment was short (${amount} of ${item.priceNomo} NOMO)` }, { status: 400 });
  }

  const recorded = await recordUnlock(itemId, session.wallet, body.txHash, amount);
  if (!recorded) return NextResponse.json({ error: "This payment was already redeemed" }, { status: 400 });
  return NextResponse.json({ success: true });
}
