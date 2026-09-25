import { NextResponse } from "next/server";
import { activeAds } from "@/lib/ads";

export const runtime = "nodejs";

export async function GET() {
  const ads = await activeAds();
  return NextResponse.json({
    ads: ads.map((a) => ({ id: a.id, mediaUrl: a.mediaUrl, mediaType: a.mediaType, linkUrl: a.linkUrl })),
  });
}
