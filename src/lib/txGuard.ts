import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db()`
        CREATE TABLE IF NOT EXISTS redeemed_txs (
          tx_hash TEXT PRIMARY KEY,
          purpose TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })();
  }
  return schemaReady;
}

// True if any of the hashes was already redeemed for anything -- the shared
// ledger, plus each feature's own table (covers redemptions made before the
// shared ledger existed). Missing tables just count as "not used".
export async function txAlreadyRedeemed(...txHashes: string[]): Promise<boolean> {
  await ensureSchema();
  const sql = db();
  const hs = txHashes.map((h) => h.toLowerCase());
  const checks = await Promise.all([
    sql`SELECT 1 FROM redeemed_txs WHERE tx_hash = ANY(${hs}) LIMIT 1`,
    sql`SELECT 1 FROM credit_ledger WHERE lower(tx_hash) = ANY(${hs}) LIMIT 1`.catch(() => []),
    sql`SELECT 1 FROM ad_slots WHERE lower(tx_hash) = ANY(${hs}) LIMIT 1`.catch(() => []),
    sql`SELECT 1 FROM creator_purchases
        WHERE lower(treasury_tx_hash) = ANY(${hs}) OR lower(creator_tx_hash) = ANY(${hs}) LIMIT 1`.catch(() => []),
    sql`SELECT 1 FROM premium_purchases WHERE lower(tx_hash) = ANY(${hs}) LIMIT 1`.catch(() => []),
    sql`SELECT 1 FROM dm_purchases
        WHERE lower(treasury_tx_hash) = ANY(${hs}) OR lower(creator_tx_hash) = ANY(${hs}) LIMIT 1`.catch(() => []),
  ]);
  return checks.some((rows) => rows.length > 0);
}

// Atomically claims verified payment tx hashes for one purpose, so the same
// transfer can never pay for two things -- not even from two requests racing
// each other. Call it after verifying on chain and before granting anything;
// false means some hash was already redeemed. If granting then fails, call
// releaseTxs so the buyer can retry.
export async function claimTxs(purpose: string, ...txHashes: string[]): Promise<boolean> {
  if (await txAlreadyRedeemed(...txHashes)) return false;
  const hs = [...new Set(txHashes.map((h) => h.toLowerCase()))];
  const rows = await db()`
    INSERT INTO redeemed_txs (tx_hash, purpose)
    SELECT h, ${purpose} FROM unnest(${hs}::text[]) AS h
    ON CONFLICT DO NOTHING
    RETURNING tx_hash`;
  if (rows.length === hs.length) return true;
  await releaseTxs(...rows.map((r) => String(r.tx_hash)));
  return false;
}

export async function releaseTxs(...txHashes: string[]): Promise<void> {
  if (!txHashes.length) return;
  const hs = txHashes.map((h) => h.toLowerCase());
  await db()`DELETE FROM redeemed_txs WHERE tx_hash = ANY(${hs})`;
}
