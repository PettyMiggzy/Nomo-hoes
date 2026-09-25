import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSession } from "@/lib/auth";
import { getDmSettings, recordBundle } from "@/lib/dm";
import { chargeCreatorSale, creditRef } from "@/lib/earnings";
import { PRICING, splitSale } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { creator, messages } -- buys a bundle of `messages` at the
// creator's per-message price with credits: the creator's cut (80%) goes to
// their cash-out balance, the platform's cut stays in the pool.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { creator?: string; messages?: number };
  const creator = body.creator;
  const messages = Number(body.messages);
  if (!creator || !isAddress(creator)) return NextResponse.json({ error: "Invalid creator" }, { status: 400 });
  if (!PRICING.dmBundles.includes(messages)) return NextResponse.json({ error: "Invalid bundle" }, { status: 400 });
  if (creator.toLowerCase() === session.wallet.toLowerCase()) {
    return NextResponse.json({ error: "You can't message yourself" }, { status: 400 });
  }

  const dm = await getDmSettings(creator);
  if (!dm?.enabled || !dm.priceNomo) return NextResponse.json({ error: "This creator isn't taking messages" }, { status: 404 });

  const total = Math.round(dm.priceNomo * messages * 1e6) / 1e6;
  const { creatorCut } = splitSale(total);
  const result = await chargeCreatorSale(session.wallet, creator, total, `dm:${creator.toLowerCase()}`, () =>
    recordBundle(creator, session.wallet, messages, creatorCut, creditRef(), creditRef()),
  );
  if (result === "insufficient") return NextResponse.json({ error: "insufficient_credits", required: total }, { status: 402 });
  if (result !== "ok") return NextResponse.json({ error: "Couldn't complete that purchase" }, { status: 500 });
  return NextResponse.json({ success: true });
}
