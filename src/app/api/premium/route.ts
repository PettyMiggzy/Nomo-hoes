import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { activeItems, itemsForGnome, unlockedIds } from "@/lib/premium";
import { vipUntil } from "@/lib/credits";
import { getGnome } from "@/data/gnomes";

export const runtime = "nodejs";

// Public list of premium items -- one gnome's (?gnome=id) or the whole
// catalog for the marketplace. Only ever exposes the blurred teaser -- the
// real media URL comes from /api/premium/:id, and only to whoever unlocked
// it, active VIPs, or the owner.
export async function GET(request: Request) {
  const gnome = new URL(request.url).searchParams.get("gnome");

  const [items, session] = await Promise.all([gnome ? itemsForGnome(gnome) : activeItems(), getSession()]);
  const owned = session && !session.owner ? new Set(await unlockedIds(session.wallet)) : new Set<number>();
  const vip = session && !session.owner ? Boolean(await vipUntil(session.wallet)) : false;

  return NextResponse.json({
    vip,
    items: items.map((i) => ({
      id: i.id,
      gnomeId: i.gnomeId,
      gnomeName: getGnome(i.gnomeId)?.name ?? i.gnomeId,
      kind: i.kind,
      title: i.title,
      category: i.category,
      teaserUrl: i.teaserUrl,
      priceNomo: i.priceNomo,
      createdAt: i.createdAt,
      unlocked: Boolean(session?.owner) || vip || owned.has(i.id),
    })),
  });
}
