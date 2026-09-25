import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

// Lazily creates tables on first use -- see src/lib/ads.ts for why.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS content_reports (
          id BIGSERIAL PRIMARY KEY,
          target TEXT NOT NULL CHECK (target IN ('post', 'premium', 'creator')),
          target_id TEXT NOT NULL,
          reporter_wallet TEXT,
          reason TEXT NOT NULL,
          details TEXT,
          resolved BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

export type Report = {
  id: number;
  target: "post" | "premium" | "creator";
  targetId: string;
  reporterWallet: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

export async function fileReport(
  target: Report["target"],
  targetId: string,
  reporterWallet: string | null,
  reason: string,
  details: string | null,
): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO content_reports (target, target_id, reporter_wallet, reason, details)
    VALUES (${target}, ${targetId}, ${reporterWallet ? addr(reporterWallet) : null}, ${reason}, ${details})`;
}

export async function openReports(): Promise<Report[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM content_reports WHERE NOT resolved ORDER BY created_at ASC LIMIT 200`;
  return (
    rows as unknown as {
      id: string;
      target: Report["target"];
      target_id: string;
      reporter_wallet: string | null;
      reason: string;
      details: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: Number(r.id),
    target: r.target,
    targetId: r.target_id,
    reporterWallet: r.reporter_wallet,
    reason: r.reason,
    details: r.details,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function resolveReport(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`UPDATE content_reports SET resolved = true WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
