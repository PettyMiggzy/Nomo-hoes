import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { submitAd } from "@/lib/ads";
import { chargeHouseSale, creditRef } from "@/lib/earnings";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { mediaUrl, mediaType, linkUrl? } -- a blob already uploaded via
// /api/ads/upload. Spends AD_PRICE_CREDITS credits and submits the ad for
// owner review.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.owner) {
    return NextResponse.json({ error: "Owner account can't run ads" }, { status: 400 });
  }

  let body: { mediaUrl?: string; mediaType?: string; linkUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.mediaUrl || !body.mediaUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Missing uploaded media" }, { status: 400 });
  }
  if (body.mediaType !== "image" && body.mediaType !== "video") {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }
  let linkUrl: string | null = null;
  if (body.linkUrl) {
    try {
      const u = new URL(body.linkUrl);
      if (u.protocol !== "https:") throw new Error();
      linkUrl = u.toString();
    } catch {
      return NextResponse.json({ error: "Link must be a valid https URL" }, { status: 400 });
    }
  }

  const result = await chargeHouseSale(session.wallet, PRICING.adPriceCredits, "ad", async () =>
    Boolean(await submitAd(session.wallet, body.mediaUrl!, body.mediaType as "image" | "video", linkUrl, creditRef())),
  );
  if (result === "insufficient") {
    return NextResponse.json({ error: "insufficient_credits", required: PRICING.adPriceCredits }, { status: 402 });
  }
  if (result !== "ok") return NextResponse.json({ error: "Couldn't submit your ad" }, { status: 500 });
  return NextResponse.json({ success: true, reviewDays: "usually within a day" });
}
