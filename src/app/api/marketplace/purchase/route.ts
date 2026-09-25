import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPost, recordPurchase, hasPurchased } from "@/lib/marketplace";
import { chargeCreatorSale, creditRef } from "@/lib/earnings";
import { splitSale } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { postId } -- spends the post's price in credits: the creator's cut
// (80%) goes to their cash-out balance, the platform's cut stays in the pool.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Connect a wallet first" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { postId?: number };
  const postId = Number(body.postId);
  if (!Number.isInteger(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  const post = await getPost(postId);
  if (!post || post.status !== "approved") return NextResponse.json({ error: "Post not available" }, { status: 404 });
  if (post.creatorWallet === session.wallet.toLowerCase()) {
    return NextResponse.json({ error: "You can't buy your own post" }, { status: 400 });
  }
  if (await hasPurchased(postId, session.wallet)) return NextResponse.json({ success: true, imageUrl: post.imageUrl });

  const { creatorCut } = splitSale(post.priceNomo);
  const result = await chargeCreatorSale(session.wallet, post.creatorWallet, post.priceNomo, `post:${postId}`, () =>
    recordPurchase(postId, post.creatorWallet, session.wallet, creditRef(), creditRef(), creatorCut),
  );
  if (result === "insufficient") {
    return NextResponse.json({ error: "insufficient_credits", required: post.priceNomo }, { status: 402 });
  }
  return NextResponse.json({ success: true, imageUrl: post.imageUrl });
}
