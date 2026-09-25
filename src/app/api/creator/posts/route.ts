import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { getGnome } from "@/data/gnomes";
import { getCreator, createPendingPost } from "@/lib/marketplace";
import { debitCredits, grantCredits, creditBalance } from "@/lib/credits";
import { veniceGenerateImage, IMAGE_COST_USD } from "@/lib/venice";
import { PRICING } from "@/lib/pricing";
import { logUsage } from "@/lib/usage";
import { makeTeaser } from "@/lib/teaser";
import { isCategory } from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SCENE_LEN = 300;
const MAX_TITLE_LEN = 60;
const GENERATE_COST = PRICING.nomoPerImage;

// Body: { gnomeId, title, scene, priceNomo } -- generates one image (the
// creator pays the same per-image cost as any private generation), stores it
// privately in Blob storage, and submits it for owner review. Nothing here
// ever returns the blob URL publicly -- only /api/marketplace/posts/:id/image
// does, and only to a verified buyer, the creator, or the owner.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.owner) return NextResponse.json({ error: "Owner accounts can't sell content" }, { status: 400 });

  const creator = await getCreator(session.wallet);
  if (!creator) return NextResponse.json({ error: "Sign up as a creator first" }, { status: 400 });

  let body: { gnomeId?: string; title?: string; scene?: string; category?: string; priceNomo?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const gnome = body.gnomeId ? getGnome(body.gnomeId) : undefined;
  const title = body.title?.trim().slice(0, MAX_TITLE_LEN);
  const scene = body.scene?.trim().slice(0, MAX_SCENE_LEN);
  const price = Number(body.priceNomo);
  if (!gnome || !title || !scene) {
    return NextResponse.json({ error: "Missing gnomeId, title, or scene" }, { status: 400 });
  }
  const category = body.category;
  if (!isCategory(category)) return NextResponse.json({ error: "Pick a category" }, { status: 400 });
  if (!Number.isFinite(price) || price < PRICING.creatorMinPriceNomo) {
    return NextResponse.json({ error: `Price must be at least ${PRICING.creatorMinPriceNomo} NOMO` }, { status: 400 });
  }

  const paid = await debitCredits(session.wallet, GENERATE_COST, `creator-post:${gnome.id}`);
  if (!paid) {
    return NextResponse.json(
      { error: "insufficient_credits", required: GENERATE_COST, available: await creditBalance(session.wallet) },
      { status: 403 },
    );
  }

  try {
    const prompt = `masterpiece, highly detailed, ${gnome.scenePrompt}, mature adult woman proportions, ${scene}, explicit, nsfw, soft lighting, fantasy illustration`;
    const image = await veniceGenerateImage(prompt, gnome.seed + Math.floor(Math.random() * 100000));
    await logUsage(session.wallet, "image", true, IMAGE_COST_USD);

    const blob = await put(`creator-posts/${session.wallet.toLowerCase()}-${Date.now()}.webp`, image, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });

    const teaser = await put(`creator-teasers/${gnome.id}.jpg`, await makeTeaser(image), {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/jpeg",
    });

    const post = await createPendingPost(session.wallet, gnome.id, title, category, scene, blob.url, teaser.url, price);
    return NextResponse.json({ post: { ...post, imageUrl: undefined } });
  } catch (e) {
    console.error("creator post generation error", e);
    await grantCredits(session.wallet, GENERATE_COST, `refund:creator-post:${gnome.id}`);
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }
}
