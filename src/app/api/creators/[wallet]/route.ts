import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getCreator, activeListings } from "@/lib/marketplace";
import { getDmSettings } from "@/lib/dm";
import { getGnome } from "@/data/gnomes";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Public creator profile: name, pfp, bio, DM price, and their live listings
// (teasers only -- same rules as /api/marketplace/posts).
export async function GET(_request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  const creator = await getCreator(wallet);
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [dm, listings] = await Promise.all([getDmSettings(wallet), activeListings(200)]);

  return NextResponse.json({
    creator: { wallet: creator.wallet, displayName: creator.displayName, bio: creator.bio, avatarUrl: creator.avatarUrl },
    dm: dm?.enabled && dm.priceNomo ? { priceNomo: dm.priceNomo, bundles: PRICING.dmBundles } : null,
    posts: listings
      .filter((l) => l.creatorWallet === creator.wallet)
      .map((l) => ({
        id: l.id,
        title: l.title,
        category: l.category,
        gnomeName: getGnome(l.gnomeId)?.name ?? l.gnomeId,
        teaserUrl: l.teaserUrl,
        priceNomo: l.priceNomo,
      })),
  });
}
