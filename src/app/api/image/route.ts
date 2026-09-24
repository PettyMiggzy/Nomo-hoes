import { NextResponse } from "next/server";
import { getGnome } from "@/data/gnomes";
import { getSession } from "@/lib/auth";
import { debitCredits, grantCredits, creditBalance } from "@/lib/credits";
import { veniceGenerateImage } from "@/lib/venice";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOMO_PER_IMAGE = PRICING.nomoPerImage;
const MAX_SCENE_LEN = 300;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { gnomeId?: string; scene?: string; variant?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const gnome = body.gnomeId ? getGnome(body.gnomeId) : undefined;
  if (!gnome || !body.scene) {
    return NextResponse.json({ error: "Missing gnomeId or scene" }, { status: 400 });
  }

  // Charge up front so concurrent requests can't overspend; refund on failure.
  if (!session.owner) {
    const paid = await debitCredits(session.wallet, NOMO_PER_IMAGE, `image:${gnome.id}`);
    if (!paid) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          required: NOMO_PER_IMAGE,
          available: await creditBalance(session.wallet),
        },
        { status: 403 },
      );
    }
  }

  const scene = body.scene.slice(0, MAX_SCENE_LEN);
  const variant = Number.isFinite(body.variant) ? Number(body.variant) : 0;
  const prompt = `masterpiece, highly detailed, ${gnome.scenePrompt}, mature adult woman proportions, ${scene}, explicit, nsfw, soft lighting, fantasy illustration`;

  try {
    const image = await veniceGenerateImage(prompt, gnome.seed + variant);
    return new NextResponse(new Blob([Uint8Array.from(image)]), {
      headers: { "Content-Type": "image/webp" },
    });
  } catch (e) {
    console.error("Venice image error", e);
    if (!session.owner) {
      await grantCredits(session.wallet, NOMO_PER_IMAGE, `refund:image:${gnome.id}`);
    }
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }
}
