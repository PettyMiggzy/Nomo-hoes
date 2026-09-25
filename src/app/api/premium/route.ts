import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { itemsForGnome, unlockedIds } from "@/lib/premium";
import { vipUntil } from "@/lib/credits";

export const runtime = "nodejs";

// Public list of a gnome's premium items. Only ever exposes the blurred
// teaser -- the real media URL comes from /api/premium/:id, and only to
// whoever unlocked it, active VIPs, or the owner.
export async function GET(request: Request) {
  const gnome = new URL(request.url).searchParams.get("gnome");
  if (!gnome) return NextResponse.json({ error: "Missing gnome" }, { status: 400 });

  const [items, session] = await Promise.all([itemsForGnome(gnome), getSession()]);
  const owned = session && !session.owner ? new Set(await unlockedIds(session.wallet)) : new Set<number>();
  const vip = session && !session.owner ? Boolean(await vipUntil(session.wallet)) : false;

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      teaserUrl: i.teaserUrl,
      priceNomo: i.priceNomo,
      unlocked: Boolean(session?.owner) || vip || owned.has(i.id),
    })),
  });
}
