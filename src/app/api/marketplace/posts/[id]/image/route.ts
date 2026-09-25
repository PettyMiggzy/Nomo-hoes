import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPost, hasPurchased } from "@/lib/marketplace";
import { vipUntil } from "@/lib/credits";

export const runtime = "nodejs";

// The only endpoint that ever hands out a post's real image URL -- gated to
// the buyer, the creator, an active VIP, or the owner. Everyone else gets 403, even for a
// pending/rejected post's creator-only preview.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  const post = await getPost(postId);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCreator = post.creatorWallet === session.wallet.toLowerCase();
  const authorized =
    session.owner || isCreator || (await hasPurchased(postId, session.wallet)) || Boolean(await vipUntil(session.wallet));
  if (!authorized) return NextResponse.json({ error: "Buy this post to view it" }, { status: 403 });

  return NextResponse.json({ imageUrl: post.imageUrl });
}
