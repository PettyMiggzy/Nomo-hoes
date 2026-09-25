import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { getGnome } from "@/data/gnomes";
import { allItems, createItem, premiumRevenue, updateItem, type PremiumKind } from "@/lib/premium";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEDIA_TYPES: Record<PremiumKind, string[]> = {
  photo: ["image/webp", "image/jpeg", "image/png"],
  clip: ["video/mp4", "video/webm"],
};

async function requireOwner() {
  const session = await getSession();
  return session?.owner ? session : null;
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const [items, revenue] = await Promise.all([allItems(), premiumRevenue()]);
  return NextResponse.json({ items, revenue, defaults: { photo: PRICING.premiumPhotoNomo, clip: PRICING.premiumClipNomo } });
}

// multipart: gnomeId, kind (photo|clip), title, price (optional), media, teaser.
// The teaser is a pre-blurred still made before upload; it's the only thing
// non-buyers ever see.
export async function POST(request: Request) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const form = await request.formData();
  const gnome = getGnome(String(form.get("gnomeId") ?? ""));
  const kind = String(form.get("kind")) as PremiumKind;
  const title = String(form.get("title") ?? "").trim().slice(0, 80);
  const media = form.get("media");
  const teaser = form.get("teaser");
  if (!gnome) return NextResponse.json({ error: "Unknown gnome" }, { status: 400 });
  if (kind !== "photo" && kind !== "clip") return NextResponse.json({ error: "kind must be photo or clip" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!(media instanceof File) || !MEDIA_TYPES[kind].includes(media.type)) {
    return NextResponse.json({ error: `media must be one of ${MEDIA_TYPES[kind].join(", ")}` }, { status: 400 });
  }
  if (!(teaser instanceof File) || !MEDIA_TYPES.photo.includes(teaser.type)) {
    return NextResponse.json({ error: "teaser must be an image" }, { status: 400 });
  }
  const priceIn = Number(form.get("price"));
  const price = Number.isFinite(priceIn) && priceIn > 0 ? priceIn : kind === "photo" ? PRICING.premiumPhotoNomo : PRICING.premiumClipNomo;

  const ext = (f: File) => f.type.split("/")[1];
  const [mediaBlob, teaserBlob] = await Promise.all([
    put(`premium/${gnome.id}-${kind}.${ext(media)}`, media, { access: "public", addRandomSuffix: true, contentType: media.type }),
    put(`premium-teasers/${gnome.id}.${ext(teaser)}`, teaser, { access: "public", addRandomSuffix: true, contentType: teaser.type }),
  ]);
  const item = await createItem(gnome.id, kind, title, mediaBlob.url, teaserBlob.url, price);
  return NextResponse.json({ item });
}

// Body: { id, priceNomo?, active? }
export async function PATCH(request: Request) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { id?: number; priceNomo?: number; active?: boolean };
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const priceNomo = body.priceNomo !== undefined && Number(body.priceNomo) > 0 ? Number(body.priceNomo) : undefined;
  const active = typeof body.active === "boolean" ? body.active : undefined;
  const ok = await updateItem(id, { priceNomo, active });
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
