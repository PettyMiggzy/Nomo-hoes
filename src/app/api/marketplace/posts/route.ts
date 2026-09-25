import { NextResponse } from "next/server";
import { activeListings, myPurchasedPostIds } from "@/lib/marketplace";
import { getGnome } from "@/data/gnomes";
import { getSession } from "@/lib/auth";
import { vipUntil } from "@/lib/credits";

export const runtime = "nodejs";

// Public listing. Deliberately omits imageUrl -- only a server-blurred teaser
// is public; the paid image is only ever served by
// /api/marketplace/posts/:id/image, to buyers, VIPs, the creator and the owner.
export async function GET() {
  const [listings, session] = await Promise.all([activeListings(), getSession()]);
  const wallet = session && !session.owner ? session.wallet.toLowerCase() : null;
  const [bought, vip] = wallet
    ? await Promise.all([myPurchasedPostIds(wallet), vipUntil(wallet)])
    : [[] as number[], null];
  const owned = new Set(bought);

  return NextResponse.json({
    vip: Boolean(vip),
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      category: l.category,
      gnomeId: l.gnomeId,
      gnomeName: getGnome(l.gnomeId)?.name ?? l.gnomeId,
      kind: l.kind,
      creatorName: l.creatorName,
      creatorAvatar: l.creatorAvatar,
      creatorWallet: l.creatorWallet,
      teaserUrl: l.teaserUrl,
      priceNomo: l.priceNomo,
      createdAt: l.createdAt,
      unlocked: Boolean(session?.owner) || Boolean(vip) || owned.has(l.id) || l.creatorWallet === wallet,
    })),
  });
}
