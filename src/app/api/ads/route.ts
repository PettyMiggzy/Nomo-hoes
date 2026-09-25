import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession } from "@/lib/auth";
import { submitAd } from "@/lib/ads";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { txHash, mediaUrl, mediaType, linkUrl? } -- a NOMO payment the
// signed-in wallet already sent to the treasury, plus a blob already
// uploaded via /api/ads/upload. Submits the ad for owner review.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.owner) {
    return NextResponse.json({ error: "Owner account can't run ads" }, { status: 400 });
  }

  let body: { txHash?: string; mediaUrl?: string; mediaType?: string; linkUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.txHash || !isHash(body.txHash)) {
    return NextResponse.json({ error: "Missing or invalid txHash" }, { status: 400 });
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

  const { treasury, token } = paymentConfig();
  if (!treasury || !token) {
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  let amount: number;
  try {
    amount = await verifyTokenTransfer(body.txHash, session.wallet, token, treasury);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }

  if (amount < PRICING.adPriceNomo) {
    return NextResponse.json(
      { error: `That transfer was only ${amount} NOMO -- ads cost ${PRICING.adPriceNomo} NOMO` },
      { status: 400 },
    );
  }

  const created = await submitAd(session.wallet, body.mediaUrl, body.mediaType, linkUrl, body.txHash);
  if (!created) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  return NextResponse.json({ success: true, reviewDays: "usually within a day" });
}
