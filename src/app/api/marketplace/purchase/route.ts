import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession } from "@/lib/auth";
import { getPost, recordPurchase, hasPurchased } from "@/lib/marketplace";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { splitSale } from "@/lib/pricing";

export const runtime = "nodejs";

// Body: { postId, creatorTxHash, treasuryTxHash } -- the buyer already sent
// two direct transfers (creator's cut straight to their wallet, platform's
// cut to the treasury). Verifies both on chain, then unlocks the post.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { postId?: number; creatorTxHash?: string; treasuryTxHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const postId = Number(body.postId);
  if (!Number.isInteger(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  if (!body.creatorTxHash || !isHash(body.creatorTxHash) || !body.treasuryTxHash || !isHash(body.treasuryTxHash)) {
    return NextResponse.json({ error: "Missing or invalid transaction hashes" }, { status: 400 });
  }

  const post = await getPost(postId);
  if (!post || post.status !== "approved") return NextResponse.json({ error: "Post not available" }, { status: 404 });
  if (post.creatorWallet === session.wallet.toLowerCase()) {
    return NextResponse.json({ error: "You can't buy your own post" }, { status: 400 });
  }
  if (await hasPurchased(postId, session.wallet)) {
    return NextResponse.json({ error: "Already unlocked", imageUrl: post.imageUrl });
  }

  const { treasury, token } = paymentConfig();
  if (!treasury || !token) return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });

  const { creatorCut, platformCut } = splitSale(post.priceNomo);

  let creatorAmount: number;
  let treasuryAmount: number;
  try {
    [creatorAmount, treasuryAmount] = await Promise.all([
      verifyTokenTransfer(body.creatorTxHash, session.wallet, token, post.creatorWallet),
      verifyTokenTransfer(body.treasuryTxHash, session.wallet, token, treasury),
    ]);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }

  if (creatorAmount < creatorCut - 1e-6) {
    return NextResponse.json({ error: `The creator payment was short (${creatorAmount} of ${creatorCut} NOMO)` }, { status: 400 });
  }
  if (treasuryAmount < platformCut - 1e-6) {
    return NextResponse.json({ error: `The platform payment was short (${treasuryAmount} of ${platformCut} NOMO)` }, { status: 400 });
  }

  const recorded = await recordPurchase(
    postId,
    post.creatorWallet,
    session.wallet,
    body.creatorTxHash,
    body.treasuryTxHash,
    creatorAmount,
  );
  if (!recorded) {
    return NextResponse.json({ error: "This purchase was already redeemed", imageUrl: post.imageUrl });
  }
  return NextResponse.json({ success: true, imageUrl: post.imageUrl });
}
