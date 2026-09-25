import { NextResponse } from "next/server";
import { erc20Abi, formatUnits, isHash } from "viem";
import { getSession, publicClient } from "@/lib/auth";
import { creatorLiabilities, getPayout, markPayoutPaid, pendingPayouts, recentPayouts, rejectPayout } from "@/lib/earnings";
import { paymentConfig, verifyTokenTransfer, PaymentError } from "@/lib/payments";
import { claimTxs, releaseTxs } from "@/lib/txGuard";

export const runtime = "nodejs";

async function treasuryUsdg(): Promise<number | null> {
  const { treasury, token } = paymentConfig();
  if (!treasury) return null;
  try {
    const client = publicClient();
    const addr = token as `0x${string}`;
    const [raw, decimals] = await Promise.all([
      client.readContract({ address: addr, abi: erc20Abi, functionName: "balanceOf", args: [treasury as `0x${string}`] }),
      client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return Number(formatUnits(raw, decimals));
  } catch (e) {
    console.error("treasury balance error", e);
    return null;
  }
}

// Pool overview + the cash-out queue.
export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const [pending, recent, owed, pool] = await Promise.all([pendingPayouts(), recentPayouts(), creatorLiabilities(), treasuryUsdg()]);
  const owedTotal = owed.earnings + owed.pendingPayouts;
  return NextResponse.json({
    pending,
    recent,
    pool: {
      treasury: paymentConfig().treasury,
      usdgInPool: pool,
      creatorsOwed: owedTotal,
      creatorEarnings: owed.earnings,
      pendingPayouts: owed.pendingPayouts,
      paidOut: owed.paidOut,
      // What's safely yours to spend (e.g. on NOMO buybacks).
      platformShare: pool === null ? null : Math.max(0, Math.round((pool - owedTotal) * 100) / 100),
    },
  });
}

// Body: { id, action: "paid", txHash } -- after sending the USDG, marks it
// paid; the transfer is checked on chain (right token, right wallet, enough).
//       { id, action: "reject", note? } -- returns the credits to the creator.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { id?: number; action?: string; txHash?: string; note?: string };
  const id = Number(b.id);
  const payout = Number.isInteger(id) ? await getPayout(id) : null;
  if (!payout || payout.status !== "pending") return NextResponse.json({ error: "Not a pending payout" }, { status: 404 });

  if (b.action === "reject") {
    const ok = await rejectPayout(id, b.note?.slice(0, 200) || null);
    return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Couldn't reject" }, { status: 409 });
  }
  if (b.action !== "paid") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!b.txHash || !isHash(b.txHash)) return NextResponse.json({ error: "Paste the payout transaction hash" }, { status: 400 });

  let sent: number;
  try {
    sent = await verifyTokenTransfer(b.txHash, null, paymentConfig().token, payout.payoutWallet);
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: `${e.message} (USDG to ${payout.payoutWallet})` }, { status: e.status });
    }
    return NextResponse.json({ error: "Could not verify the transfer" }, { status: 502 });
  }
  if (sent < payout.amount - 1e-6) {
    return NextResponse.json({ error: `That transfer sent ${sent} USDG; this payout is ${payout.amount}` }, { status: 400 });
  }
  if (!(await claimTxs(`payout:${id}`, b.txHash))) {
    return NextResponse.json({ error: "That transaction was already used" }, { status: 400 });
  }
  try {
    if (!(await markPayoutPaid(id, b.txHash))) {
      await releaseTxs(b.txHash);
      return NextResponse.json({ error: "Payout was already resolved" }, { status: 409 });
    }
  } catch (e) {
    await releaseTxs(b.txHash);
    throw e;
  }
  return NextResponse.json({ success: true });
}
