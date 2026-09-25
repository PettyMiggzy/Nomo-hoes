import { NextResponse } from "next/server";
import { activeListings } from "@/lib/marketplace";
import { getGnome } from "@/data/gnomes";

export const runtime = "nodejs";

// Public listing. Deliberately omits imageUrl -- the paid image is only ever
// served by /api/marketplace/posts/:id/image, and only to whoever bought it.
export async function GET() {
  const listings = await activeListings();
  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      gnomeId: l.gnomeId,
      gnomeName: getGnome(l.gnomeId)?.name ?? l.gnomeId,
      creatorName: l.creatorName,
      creatorWallet: l.creatorWallet,
      priceNomo: l.priceNomo,
      createdAt: l.createdAt,
    })),
  });
}
