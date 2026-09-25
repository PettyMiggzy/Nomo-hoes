import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { veniceGenerateImage } from "@/lib/venice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LEN = 500;

// Owner-only raw image generation for one-off assets (stickers, marketing,
// banners) that don't fit the per-gnome explicit-scene pipeline in /api/image.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  let body: { prompt?: string; seed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const prompt = body.prompt?.trim().slice(0, MAX_PROMPT_LEN);
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : Math.floor(Math.random() * 1000000);

  try {
    const image = await veniceGenerateImage(prompt, seed);
    return new NextResponse(new Blob([Uint8Array.from(image)]), {
      headers: { "Content-Type": "image/webp" },
    });
  } catch (e) {
    console.error("owner generate error", e);
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }
}
