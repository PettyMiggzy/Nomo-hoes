import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getSession, CHAIN_ID } from "@/lib/auth";
import { creditBalance, grantCredits } from "@/lib/credits";
import { paymentConfig, verifyNomoPayment, PaymentError } from "@/lib/payments";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { treasury, token } = paymentConfig();
  return NextResponse.json({
    creditsAvailable: session.owner ? null : await creditBalance(session.wallet),
    owner: session.owner,
    treasury,
    token,
    chainId: CHAIN_ID,
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

  let amount: number;
  try {
    amount = await verifyNomoPayment(body.txHash, session.wallet);
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("verifyNomoPayment error", e);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }

  const balance = await grantCredits(session.wallet, amount, "purchase", body.txHash);
  if (balance === null) {
    return NextResponse.json({ error: "This transaction was already redeemed" }, { status: 409 });
  }

  return NextResponse.json({ success: true, credited: amount, creditsAvailable: balance });
}
