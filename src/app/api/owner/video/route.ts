import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE = "https://api.venice.ai/api/v1/video";

type Body = {
  action?: "quote" | "queue" | "retrieve";
  model?: string;
  prompt?: string;
  negative_prompt?: string;
  image?: string;
  duration?: string;
  resolution?: string;
  aspect_ratio?: string;
  queue_id?: string;
};

function veniceHeaders() {
  const key = process.env.VENICE_API_KEY;
  if (!key) throw new Error("VENICE_API_KEY is not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// Owner-only image-to-video for animated assets (stickers, promo clips).
// quote -> queue -> poll retrieve until it returns the MP4.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.model) return NextResponse.json({ error: "Missing model" }, { status: 400 });

  const optional = {
    ...(body.resolution && { resolution: body.resolution }),
    ...(body.aspect_ratio && { aspect_ratio: body.aspect_ratio }),
  };

  if (body.action === "quote") {
    const res = await fetch(`${BASE}/quote`, {
      method: "POST",
      headers: veniceHeaders(),
      body: JSON.stringify({ model: body.model, duration: body.duration, ...optional }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  if (body.action === "queue") {
    if (!body.prompt || !body.image || !body.duration) {
      return NextResponse.json({ error: "Missing prompt, image, or duration" }, { status: 400 });
    }
    const res = await fetch(`${BASE}/queue`, {
      method: "POST",
      headers: veniceHeaders(),
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        image_url: body.image,
        duration: body.duration,
        ...(body.negative_prompt && { negative_prompt: body.negative_prompt }),
        ...optional,
      }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  if (body.action === "retrieve") {
    if (!body.queue_id) return NextResponse.json({ error: "Missing queue_id" }, { status: 400 });
    const res = await fetch(`${BASE}/retrieve`, {
      method: "POST",
      headers: veniceHeaders(),
      body: JSON.stringify({ model: body.model, queue_id: body.queue_id }),
    });
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("video/")) {
      return new NextResponse(await res.arrayBuffer(), { headers: { "Content-Type": "video/mp4" } });
    }
    const data = await res.json();
    if (data.status === "COMPLETED" && data.download_url) {
      const video = await fetch(data.download_url);
      return new NextResponse(await video.arrayBuffer(), { headers: { "Content-Type": "video/mp4" } });
    }
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
