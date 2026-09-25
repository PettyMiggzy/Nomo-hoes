import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { veniceGenerateImage, veniceRemoveBackground } from "@/lib/venice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LEN = 500;

// Clamp to the model's supported range, snapped to a multiple of 8.
const dim = (n?: number) =>
  Number.isFinite(n) ? Math.min(1280, Math.max(256, Math.round(Number(n) / 8) * 8)) : undefined;

// Owner-only raw image generation for one-off assets (stickers, marketing,
// banners) that don't fit the per-gnome explicit-scene pipeline in /api/image.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  let body: {
    prompt?: string;
    seed?: number;
    transparent?: boolean;
    model?: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    aspect_ratio?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const prompt = body.prompt?.trim().slice(0, MAX_PROMPT_LEN);
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : Math.floor(Math.random() * 1000000);

  try {
    let image = await veniceGenerateImage(prompt, seed, {
      model: body.model,
      negativePrompt: body.negative_prompt?.slice(0, MAX_PROMPT_LEN),
      width: dim(body.width),
      height: dim(body.height),
      aspectRatio: /^\d{1,2}:\d{1,2}$/.test(body.aspect_ratio ?? "") ? body.aspect_ratio : undefined,
    });
    let contentType = "image/webp";
    if (body.transparent) {
      image = await veniceRemoveBackground(image);
      contentType = "image/png";
    }
    return new NextResponse(new Blob([Uint8Array.from(image)]), {
      headers: { "Content-Type": contentType },
    });
  } catch (e) {
    console.error("owner generate error", e);
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }
}
