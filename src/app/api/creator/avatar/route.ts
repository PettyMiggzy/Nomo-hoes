import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { getCreator, setCreatorAvatar } from "@/lib/marketplace";
import { makeAvatar } from "@/lib/teaser";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

// multipart: avatar (image). Resized to a 256px square before storing.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await getCreator(session.wallet))) return NextResponse.json({ error: "Create your creator profile first" }, { status: 400 });

  const file = (await request.formData()).get("avatar");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Upload an image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 });

  let avatar: Buffer;
  try {
    avatar = await makeAvatar(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Couldn't read that image" }, { status: 400 });
  }
  const blob = await put(`creator-avatars/${session.wallet.toLowerCase()}.webp`, avatar, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/webp",
  });
  await setCreatorAvatar(session.wallet, blob.url);
  return NextResponse.json({ avatarUrl: blob.url });
}
