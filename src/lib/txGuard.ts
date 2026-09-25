import { neon } from "@neondatabase/serverless";

// Every paid feature records the tx hashes it redeemed in its own table.
// This checks all of them, so a transfer redeemed for one thing (credits, an
// ad, a marketplace sale, premium, DM bundles) can't be replayed for another.
// Missing tables (feature never used yet) just count as "not used".
export async function txAlreadyRedeemed(...txHashes: string[]): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const sql = neon(url);
  const hs = txHashes.map((h) => h.toLowerCase());
  const checks = await Promise.all([
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
