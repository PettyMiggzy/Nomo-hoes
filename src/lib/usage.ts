import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export type UsageKind = "chat" | "image";

// wallet is null for guests. billed=false means it cost nothing (free-tier
// message or owner use) — pure Venice spend with no matching revenue.
export async function logUsage(
  wallet: string | null,
  kind: UsageKind,
  billed: boolean,
  costUsd: number,
): Promise<void> {
  await db()`
    INSERT INTO usage_log (wallet, kind, billed, cost_usd)
    VALUES (${wallet?.toLowerCase() ?? null}, ${kind}, ${billed}, ${costUsd})`;
}

export type DayStats = {
  freeMessages: number;
  paidMessages: number;
  freeImages: number;
  paidImages: number;
  costUsd: number;
  nomoRevenue: number;
  usdRevenue: number;
  vipActivations: number;
};

// Stats since UTC midnight today.
export async function getTodayStats(): Promise<DayStats> {
  const sql = db();
  const [usage, revenue, vip] = await Promise.all([
    sql`
      SELECT kind, billed, count(*) AS n, coalesce(sum(cost_usd), 0) AS cost
      FROM usage_log
      WHERE created_at >= date_trunc('day', now())
      GROUP BY kind, billed`,
    sql`
      SELECT coalesce(sum(delta), 0) AS nomo
      FROM credit_ledger
      WHERE reason = 'purchase' AND delta > 0 AND created_at >= date_trunc('day', now())`,
    sql`
      SELECT count(*) AS n
      FROM credit_ledger
      WHERE reason LIKE 'vip:%' AND created_at >= date_trunc('day', now())`,
  ]);

  const stats: DayStats = {
    freeMessages: 0,
    paidMessages: 0,
    freeImages: 0,
    paidImages: 0,
    costUsd: 0,
    nomoRevenue: Number(revenue[0]?.nomo ?? 0),
    usdRevenue: 0,
    vipActivations: Number(vip[0]?.n ?? 0),
  };
  for (const row of usage as unknown as { kind: string; billed: boolean; n: string; cost: string }[]) {
    stats.costUsd += Number(row.cost);
    if (row.kind === "chat") {
      if (row.billed) stats.paidMessages += Number(row.n);
      else stats.freeMessages += Number(row.n);
    } else if (row.kind === "image") {
      if (row.billed) stats.paidImages += Number(row.n);
      else stats.freeImages += Number(row.n);
    }
  }
  // Credits are bought 1:1 with USDG, so top-ups are already dollars.
  stats.usdRevenue = stats.nomoRevenue;
  return stats;
}
