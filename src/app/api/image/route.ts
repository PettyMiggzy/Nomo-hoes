import { NextResponse } from "next/server";
import { getGnome } from "@/data/gnomes";
import { getSessionWallet } from "@/lib/auth";
import { creditBalance, addCredits } from "@/lib/credits";
import { veniceGenerateImage } from "@/lib/venice";

export const runtime = "nodejs";

const NOMO_PER_IMAGE = Number(process.env.NOMO_PER_IMAGE ?? 0.5);
const MAX_SCENE_LEN = 300;

export async function POST(request: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) {
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

  if (creditBalance(wallet) < NOMO_PER_IMAGE) {
    return NextResponse.json(
      { error: "insufficient_credits", required: NOMO_PER_IMAGE, available: creditBalance(wallet) },
      { status: 403 },
    );
  }

  if (!process.env.VENICE_API_KEY) {
    return NextResponse.json({ error: "Image generation not configured" }, { status: 503 });
  }

  const scene = body.scene.slice(0, MAX_SCENE_LEN);
  const variant = Number.isFinite(body.variant) ? Number(body.variant) : 0;
  const prompt = `masterpiece, highly detailed, ${gnome.scenePrompt}, mature adult woman proportions, ${scene}, explicit, nsfw, soft lighting, fantasy illustration`;

  let image: Buffer;
  try {
    image = await veniceGenerateImage(prompt, gnome.seed + variant);
  } catch (e) {
    console.error("Venice image error", e);
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }

  addCredits(wallet, -NOMO_PER_IMAGE);

  return new NextResponse(new Blob([Uint8Array.from(image)]), {
    headers: { "Content-Type": "image/webp" },
  });
}
