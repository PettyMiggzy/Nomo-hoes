import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { createOwnPost } from "@/lib/marketplace";
import { isVerifiedCreator } from "@/lib/verification";
import { isCategory } from "@/lib/categories";
import { makeTeaser } from "@/lib/teaser";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_COVER_BYTES = 4 * 1024 * 1024;
const MAX_PHOTO_FETCH = 30 * 1024 * 1024;

// multipart: mediaUrl (from /api/creator/media-upload), title, category,
// description, price, attest=yes, cover (a still from the video; optional
// for photos). Goes to the owner's review queue like every creator post.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await isVerifiedCreator(session.wallet))) {
    return NextResponse.json({ error: "Only verified creators can post their own content" }, { status: 403 });
  }

  const form = await request.formData();
  if (form.get("attest") !== "yes") {
    return NextResponse.json({ error: "You must confirm everyone shown is a consenting adult" }, { status: 400 });
  }
  const title = String(form.get("title") ?? "").trim().slice(0, 60);
  const description = String(form.get("description") ?? "").trim().slice(0, 300);
  const category = form.get("category");
  const price = Number(form.get("price"));
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!isCategory(category)) return NextResponse.json({ error: "Pick a category" }, { status: 400 });
  if (!Number.isFinite(price) || price < PRICING.creatorMinPriceNomo) {
    return NextResponse.json({ error: `Price must be at least ${PRICING.creatorMinPriceNomo} NOMO` }, { status: 400 });
  }

  // The media must be this creator's own upload from media-upload.
  let media: URL;
  try {
    media = new URL(String(form.get("mediaUrl")));
  } catch {
    return NextResponse.json({ error: "Missing upload" }, { status: 400 });
  }
  if (
    media.protocol !== "https:" ||
    !media.hostname.endsWith(".public.blob.vercel-storage.com") ||
    !media.pathname.startsWith(`/creator-media/${session.wallet.toLowerCase()}/`)
  ) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const kind = /\.(mp4|webm|mov)$/i.test(media.pathname) ? "clip" : "photo";

  let coverBytes: Buffer;
  const cover = form.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (!cover.type.startsWith("image/") || cover.size > MAX_COVER_BYTES) {
      return NextResponse.json({ error: "Cover must be an image under 4MB" }, { status: 400 });
    }
    coverBytes = Buffer.from(await cover.arrayBuffer());
  } else if (kind === "photo") {
    const res = await fetch(media);
    if (!res.ok || Number(res.headers.get("content-length") ?? 0) > MAX_PHOTO_FETCH) {
      return NextResponse.json({ error: "Couldn't read your photo" }, { status: 400 });
    }
    coverBytes = Buffer.from(await res.arrayBuffer());
  } else {
    return NextResponse.json({ error: "Videos need a cover image" }, { status: 400 });
  }

  let teaserUrl: string;
  try {
    const teaser = await makeTeaser(coverBytes);
    teaserUrl = (
      await put(`creator-teasers/own.jpg`, teaser, { access: "public", addRandomSuffix: true, contentType: "image/jpeg" })
    ).url;
  } catch {
    return NextResponse.json({ error: "Couldn't read the cover image" }, { status: 400 });
  }

  const post = await createOwnPost(session.wallet, kind, title, category, description, media.toString(), teaserUrl, price);
  return NextResponse.json({ post: { ...post, imageUrl: undefined } });
}
