import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getItem, hasUnlocked, recordUnlock } from "@/lib/premium";
import { vipUntil } from "@/lib/credits";
import { chargeHouseSale, creditRef } from "@/lib/earnings";

export const runtime = "nodejs";

// Body: { itemId } -- spends the item's price in credits (house content, so
// it all stays in the pool) and unlocks it.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Connect a wallet first" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { itemId?: number };
  const itemId = Number(body.itemId);
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: "Invalid item id" }, { status: 400 });

  const item = await getItem(itemId);
  if (!item || !item.active) return NextResponse.json({ error: "Item not available" }, { status: 404 });
  if ((await hasUnlocked(itemId, session.wallet)) || (await vipUntil(session.wallet))) {
    return NextResponse.json({ success: true });
  }

  const result = await chargeHouseSale(session.wallet, item.priceNomo, `premium:${itemId}`, () =>
    recordUnlock(itemId, session.wallet, creditRef(), item.priceNomo),
  );
  if (result === "insufficient") {
    return NextResponse.json({ error: "insufficient_credits", required: item.priceNomo }, { status: 402 });
  }
  // "duplicate" means a parallel request already unlocked it (and this one was refunded).
  return NextResponse.json({ success: true });
}
