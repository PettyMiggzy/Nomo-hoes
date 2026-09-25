import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { claimTxs, releaseTxs, txAlreadyRedeemed } from "@/lib/txGuard";
import { paymentConfig } from "@/lib/payments";
import { PRICING, splitSale } from "@/lib/pricing";

export const runtime = "nodejs";

// Owner-only health check for the payment plumbing that can't be exercised
// without spending real tokens: config, the 80/20 split, and the shared
// replay ledger (using throwaway hashes that are cleaned up afterwards).
export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const results: { check: string; ok: boolean; detail?: string }[] = [];
  const add = (check: string, ok: boolean, detail?: string) => results.push({ check, ok, detail });

  const cfg = paymentConfig();
  add("treasury wallet configured", Boolean(cfg.treasury), cfg.treasury ?? "missing TREASURY_ADDRESS");
  add("NOMO token configured", Boolean(cfg.token), cfg.token ?? "missing NOMO_CONTRACT");
  add("platform cut is 20%", PRICING.platformCutBps === 2000, `${PRICING.platformCutBps / 100}%`);
  const s = splitSale(1);
  add("1 NOMO sale splits 0.8 creator / 0.2 platform", s.creatorCut === 0.8 && s.platformCut === 0.2, JSON.stringify(s));

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

  return NextResponse.json({ allPassed: results.every((r) => r.ok), results });
}
