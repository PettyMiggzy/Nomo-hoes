import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCreator } from "@/lib/marketplace";
import { setDmSettings } from "@/lib/dm";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { enabled, priceNomo } -- the creator's own DM switch and per-message price.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await getCreator(session.wallet))) return NextResponse.json({ error: "Sign up as a creator first" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean; priceNomo?: number };
  const price = Number(body.priceNomo);
  if (!Number.isFinite(price) || price < PRICING.dmMinPriceNomo) {
    return NextResponse.json({ error: `Price must be at least ${PRICING.dmMinPriceNomo} NOMO per message` }, { status: 400 });
  }
  await setDmSettings(session.wallet, Boolean(body.enabled), Math.round(price * 1e6) / 1e6);
  return NextResponse.json({ success: true });
}
