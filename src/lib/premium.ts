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
        CREATE TABLE IF NOT EXISTS premium_items (
          id BIGSERIAL PRIMARY KEY,
          gnome_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('photo', 'clip')),
          title TEXT NOT NULL,
          media_url TEXT NOT NULL,
          teaser_url TEXT NOT NULL,
          price_nomo NUMERIC NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS premium_purchases (
          id BIGSERIAL PRIMARY KEY,
          item_id BIGINT NOT NULL,
          buyer_wallet TEXT NOT NULL,
          tx_hash TEXT UNIQUE NOT NULL,
          amount_nomo NUMERIC NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (item_id, buyer_wallet)
        )`;
      await sql`ALTER TABLE premium_items ADD COLUMN IF NOT EXISTS category TEXT`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

export type PremiumKind = "photo" | "clip";

export type PremiumItem = {
  id: number;
  gnomeId: string;
  kind: PremiumKind;
  title: string;
  category: string | null;
  mediaUrl: string;
  teaserUrl: string;
  priceNomo: number;
  active: boolean;
  createdAt: string;
};

type ItemRow = {
  id: string | number;
  gnome_id: string;
  kind: PremiumKind;
  title: string;
  category: string | null;
  media_url: string;
  teaser_url: string;
  price_nomo: string | number;
  active: boolean;
  created_at: string;
};

const mapItem = (r: ItemRow): PremiumItem => ({
  id: Number(r.id),
  gnomeId: r.gnome_id,
  kind: r.kind,
  title: r.title,
  category: r.category,
  mediaUrl: r.media_url,
  teaserUrl: r.teaser_url,
  priceNomo: Number(r.price_nomo),
  active: r.active,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function createItem(
  gnomeId: string,
  kind: PremiumKind,
  title: string,
  category: string | null,
  mediaUrl: string,
  teaserUrl: string,
  priceNomo: number,
): Promise<PremiumItem> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO premium_items (gnome_id, kind, title, category, media_url, teaser_url, price_nomo)
    VALUES (${gnomeId}, ${kind}, ${title}, ${category}, ${mediaUrl}, ${teaserUrl}, ${priceNomo})
    RETURNING *`;
  return mapItem(rows[0] as unknown as ItemRow);
}

export async function itemsForGnome(gnomeId: string): Promise<PremiumItem[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT * FROM premium_items WHERE gnome_id = ${gnomeId} AND active ORDER BY kind DESC, created_at ASC`;
  return (rows as unknown as ItemRow[]).map(mapItem);
}

export async function activeItems(): Promise<PremiumItem[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM premium_items WHERE active ORDER BY created_at DESC`;
  return (rows as unknown as ItemRow[]).map(mapItem);
}

export async function allItems(): Promise<PremiumItem[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM premium_items ORDER BY gnome_id, created_at`;
  return (rows as unknown as ItemRow[]).map(mapItem);
}

export async function getItem(id: number): Promise<PremiumItem | null> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM premium_items WHERE id = ${id}`;
  return rows.length ? mapItem(rows[0] as unknown as ItemRow) : null;
}

export async function updateItem(
  id: number,
  patch: { priceNomo?: number; active?: boolean; category?: string },
): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE premium_items
    SET price_nomo = coalesce(${patch.priceNomo ?? null}::numeric, price_nomo),
        active = coalesce(${patch.active ?? null}::boolean, active),
        category = coalesce(${patch.category ?? null}::text, category)
    WHERE id = ${id}
    RETURNING id`;
  return rows.length > 0;
}

export async function unlockedIds(buyerWallet: string): Promise<number[]> {
  await ensureSchema();
  const rows = await db()`SELECT item_id FROM premium_purchases WHERE buyer_wallet = ${addr(buyerWallet)}`;
  return (rows as unknown as { item_id: string | number }[]).map((r) => Number(r.item_id));
}

export async function hasUnlocked(itemId: number, buyerWallet: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    SELECT 1 FROM premium_purchases WHERE item_id = ${itemId} AND buyer_wallet = ${addr(buyerWallet)}`;
  return rows.length > 0;
}

// Idempotent on the tx hash and on (item, buyer).
export async function recordUnlock(itemId: number, buyerWallet: string, txHash: string, amountNomo: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO premium_purchases (item_id, buyer_wallet, tx_hash, amount_nomo)
    VALUES (${itemId}, ${addr(buyerWallet)}, ${txHash.toLowerCase()}, ${amountNomo})
    ON CONFLICT DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

export async function premiumRevenue(): Promise<{ sales: number; nomo: number }> {
  await ensureSchema();
  const rows = await db()`SELECT count(*) AS n, coalesce(sum(amount_nomo), 0) AS total FROM premium_purchases`;
  const r = rows[0] as unknown as { n: string; total: string };
  return { sales: Number(r.n), nomo: Number(r.total) };
}
