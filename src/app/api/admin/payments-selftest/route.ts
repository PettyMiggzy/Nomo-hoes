import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { claimTxs, releaseTxs, txAlreadyRedeemed } from "@/lib/txGuard";
import { paymentConfig } from "@/lib/payments";
import { PRICING, splitSale } from "@/lib/pricing";
import { neon } from "@neondatabase/serverless";
import { creditBalance, grantCredits } from "@/lib/credits";
import { chargeCreatorSale, earningsBalance, getPayout, rejectPayout, requestPayout } from "@/lib/earnings";

export const runtime = "nodejs";

// Owner-only health check for the payment plumbing that can't be exercised
// without spending real tokens: config, the 80/20 split, the shared replay
// ledger, and the credits economy (a sale, creator earnings, cash-out holds
// and refunds) -- all with throwaway wallets/hashes cleaned up afterwards.
export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const results: { check: string; ok: boolean; detail?: string }[] = [];
  const add = (check: string, ok: boolean, detail?: string) => results.push({ check, ok, detail });

  const cfg = paymentConfig();
  add("treasury wallet configured", Boolean(cfg.treasury), cfg.treasury ?? "missing TREASURY_ADDRESS");
  add("USDG token configured", Boolean(cfg.token), cfg.token ?? "missing");
  add("platform cut is 20%", PRICING.platformCutBps === 2000, `${PRICING.platformCutBps / 100}%`);
  const s = splitSale(1);
  add("$1 sale splits $0.80 creator / $0.20 platform", s.creatorCut === 0.8 && s.platformCut === 0.2, JSON.stringify(s));

  const fake = () => `0x${randomBytes(32).toString("hex")}`;
  const [a, b, c] = [fake(), fake(), fake()];
  try {
    add("fresh payment can be claimed", await claimTxs("selftest", a));
    add("same payment can't be claimed twice", !(await claimTxs("selftest", a)));
    add("claimed payment shows as redeemed everywhere", await txAlreadyRedeemed(a));
    add("two-transfer purchase can't reuse a spent transfer", !(await claimTxs("selftest", b, a)));
    add("…and leaves its other transfer unclaimed", !(await txAlreadyRedeemed(b)));
    add("two fresh transfers claim together", await claimTxs("selftest", b, c));
    await releaseTxs(a, b, c);
    add("released payments are free again", !(await txAlreadyRedeemed(a, b, c)));
  } catch (e) {
    add("replay ledger reachable", false, e instanceof Error ? e.message : String(e));
    await releaseTxs(a, b, c).catch(() => {});
  }

  // Credits economy with two throwaway wallets.
  const buyer = `0x${randomBytes(20).toString("hex")}`;
  const creator = `0x${randomBytes(20).toString("hex")}`;
  try {
    await grantCredits(buyer, 5, "selftest");
    add("top-up credits land in the buyer's balance", (await creditBalance(buyer)) === 5);
    const sale = await chargeCreatorSale(buyer, creator, 2, "selftest:sale", async () => true);
    add("$2 creator sale charges the buyer $2", sale === "ok" && (await creditBalance(buyer)) === 3);
    add("…and pays the creator $1.60 (80%)", (await earningsBalance(creator)).balance === 1.6);
    const dup = await chargeCreatorSale(buyer, creator, 2, "selftest:dup", async () => false);
    add("a duplicate purchase is refunded", dup === "duplicate" && (await creditBalance(buyer)) === 3);
    const broke = await chargeCreatorSale(buyer, creator, 50, "selftest:broke", async () => true);
    add("can't buy with too few credits", broke === "insufficient" && (await creditBalance(buyer)) === 3);
    const p1 = await requestPayout(creator, 1, creator);
    add("cash-out takes the credits off right away", p1 !== null && (await earningsBalance(creator)).balance === 0.6);
    add("can't cash out more than is left", (await requestPayout(creator, 1, creator)) === null);
    add("rejecting a cash-out returns the credits", Boolean(p1) && (await rejectPayout(p1!.id, "selftest")) && (await earningsBalance(creator)).balance === 1.6);
    add("…and the payout can't be resolved again", Boolean(p1) && (await getPayout(p1!.id))?.status === "rejected" && !(await rejectPayout(p1!.id, "x")));
  } catch (e) {
    add("credits economy reachable", false, e instanceof Error ? e.message : String(e));
  } finally {
    const sql = neon(process.env.DATABASE_URL!);
    await Promise.all([
      sql`DELETE FROM credit_ledger WHERE wallet = ${buyer}`,
      sql`DELETE FROM credit_balances WHERE wallet = ${buyer}`,
      sql`DELETE FROM creator_ledger WHERE wallet = ${creator}`,
      sql`DELETE FROM creator_balances WHERE wallet = ${creator}`,
      sql`DELETE FROM payouts WHERE wallet = ${creator}`,
    ]).catch(() => {});
  }

  return NextResponse.json({ allPassed: results.every((r) => r.ok), results });
}
