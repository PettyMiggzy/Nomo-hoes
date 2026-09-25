import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession, CHAIN_ID } from "@/lib/auth";
import { creditBalance, grantCredits, vipUntil } from "@/lib/credits";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { PRICING } from "@/lib/pricing";
import { claimTxs, releaseTxs } from "@/lib/txGuard";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const cfg = paymentConfig();
  const [balance, vip] = session.owner
    ? [null, null]
    : await Promise.all([creditBalance(session.wallet), vipUntil(session.wallet)]);
  return NextResponse.json({
    creditsAvailable: balance,
    vipUntil: vip?.toISOString() ?? null,
    owner: session.owner,
    treasury: cfg.treasury,
    token: cfg.token,
    nohoesToken: cfg.nohoesToken,
    burnAddress: cfg.burnAddress,
    chainId: CHAIN_ID,
    chainName: "Robinhood Chain",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    pricing: {
      packs: PRICING.packs,
      vipPriceNomo: PRICING.vipPriceNomo,
      vipPriceNohoes: PRICING.vipPriceNohoes,
      vipDays: PRICING.vipDays,
      vipFreeMessages: PRICING.vipFreeMessages,
      nomoPerBatch: PRICING.nomoPerBatch,
      messagesPerBatch: PRICING.messagesPerBatch,
      nomoPerImage: PRICING.nomoPerImage,
      adPriceNomo: PRICING.adPriceNomo,
      adDays: PRICING.adDays,
      platformCutBps: PRICING.platformCutBps,
      creatorMinPriceNomo: PRICING.creatorMinPriceNomo,
    },
  });
}

// Body: { txHash } — a NOMO transfer the signed-in wallet already sent to the
// treasury. Credits exactly the amount transferred, once per transaction.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.owner) {
    return NextResponse.json({ error: "Owner account doesn't need credits" }, { status: 400 });
  }

  let body: { txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.txHash || !isHash(body.txHash)) {
    return NextResponse.json({ error: "Missing or invalid txHash" }, { status: 400 });
  }

  const { treasury, token } = paymentConfig();
  if (!treasury || !token) {
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  let amount: number;
  try {
    amount = await verifyTokenTransfer(body.txHash, session.wallet, token, treasury);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("verifyTokenTransfer error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }

  if (!(await claimTxs("credits", body.txHash))) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  let balance: number | null;
  try {
    balance = await grantCredits(session.wallet, amount, "purchase", body.txHash);
  } catch (e) {
    await releaseTxs(body.txHash);
    throw e;
  }
  if (balance === null) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }
  return NextResponse.json({ success: true, credited: amount, creditsAvailable: balance });
}
