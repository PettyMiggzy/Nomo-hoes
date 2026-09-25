import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isVerifiedCreator } from "@/lib/verification";

export const runtime = "nodejs";

const OWN_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 200 * 1024 * 1024;

// Client-side upload tokens for a verified creator's own photos/videos
// (too big to pass through a function). Uploads are confined to the
// creator's own folder so /api/creator/own-posts can check ownership.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await isVerifiedCreator(session.wallet))) {
    return NextResponse.json({ error: "Only verified creators can upload" }, { status: 403 });
  }
  const prefix = `creator-media/${session.wallet.toLowerCase()}/`;

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(prefix)) throw new Error("Invalid upload path");
        return { allowedContentTypes: OWN_MEDIA_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
