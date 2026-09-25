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
        CREATE TABLE IF NOT EXISTS creators (
          wallet TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          bio TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS creator_posts (
          id BIGSERIAL PRIMARY KEY,
          creator_wallet TEXT NOT NULL,
          gnome_id TEXT NOT NULL,
          title TEXT NOT NULL,
          scene TEXT NOT NULL,
          image_url TEXT NOT NULL,
          price_nomo NUMERIC NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS creator_purchases (
          id BIGSERIAL PRIMARY KEY,
          post_id BIGINT NOT NULL,
          creator_wallet TEXT NOT NULL,
          buyer_wallet TEXT NOT NULL,
          creator_tx_hash TEXT UNIQUE NOT NULL,
          treasury_tx_hash TEXT UNIQUE NOT NULL,
          amount_nomo NUMERIC NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (post_id, buyer_wallet)
        )`;
      // Added after launch: a blurred preview for listings and a creator pfp.
      await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS teaser_url TEXT`;
      await sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
      await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS category TEXT`;
      await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'photo'`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

export type Creator = { wallet: string; displayName: string; bio: string | null; avatarUrl: string | null; createdAt: string };

type CreatorRow = { wallet: string; display_name: string; bio: string | null; avatar_url: string | null; created_at: string };
const mapCreator = (r: CreatorRow): Creator => ({
  wallet: r.wallet,
  displayName: r.display_name,
  bio: r.bio,
  avatarUrl: r.avatar_url,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function upsertCreator(wallet: string, displayName: string, bio: string | null): Promise<Creator> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO creators (wallet, display_name, bio)
    VALUES (${addr(wallet)}, ${displayName}, ${bio})
    ON CONFLICT (wallet) DO UPDATE SET display_name = EXCLUDED.display_name, bio = EXCLUDED.bio
    RETURNING wallet, display_name, bio, avatar_url, created_at`;
  return mapCreator(rows[0] as unknown as CreatorRow);
}

export async function setCreatorAvatar(wallet: string, avatarUrl: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`UPDATE creators SET avatar_url = ${avatarUrl} WHERE wallet = ${addr(wallet)} RETURNING wallet`;
  return rows.length > 0;
}

export async function getCreator(wallet: string): Promise<Creator | null> {
  await ensureSchema();
  const rows = await db()`SELECT wallet, display_name, bio, avatar_url, created_at FROM creators WHERE wallet = ${addr(wallet)}`;
  return rows.length ? mapCreator(rows[0] as unknown as CreatorRow) : null;
}

export type PostStatus = "pending" | "approved" | "rejected";

export type CreatorPost = {
  id: number;
  creatorWallet: string;
  gnomeId: string;
  title: string;
  category: string | null;
  kind: "photo" | "clip";
  scene: string;
  imageUrl: string;
  teaserUrl: string | null;
  priceNomo: number;
  status: PostStatus;
  createdAt: string;
};

type PostRow = {
  id: string | number;
  creator_wallet: string;
  gnome_id: string;
  title: string;
  category: string | null;
  kind: "photo" | "clip";
  scene: string;
  image_url: string;
  teaser_url: string | null;
  price_nomo: string | number;
  status: PostStatus;
  created_at: string;
};

function mapPost(r: PostRow): CreatorPost {
  return {
    id: Number(r.id),
    creatorWallet: r.creator_wallet,
    gnomeId: r.gnome_id,
    title: r.title,
    category: r.category,
    kind: r.kind,
    scene: r.scene,
    imageUrl: r.image_url,
    teaserUrl: r.teaser_url,
    priceNomo: Number(r.price_nomo),
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function createPendingPost(
  creatorWallet: string,
  gnomeId: string,
  title: string,
  category: string,
  scene: string,
  imageUrl: string,
  teaserUrl: string,
  priceNomo: number,
): Promise<CreatorPost> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO creator_posts (creator_wallet, gnome_id, title, category, scene, image_url, teaser_url, price_nomo)
    VALUES (${addr(creatorWallet)}, ${gnomeId}, ${title}, ${category}, ${scene}, ${imageUrl}, ${teaserUrl}, ${priceNomo})
    RETURNING id, creator_wallet, gnome_id, title, category, kind, scene, image_url, teaser_url, price_nomo, status, created_at`;
  return mapPost(rows[0] as unknown as PostRow);
}

// Takes a post down (owner action on a report). Buyers keep no access.
export async function takeDownPost(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`UPDATE creator_posts SET status = 'rejected' WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// Takes down every post by a creator (owner action on a report about them).
export async function takeDownCreatorPosts(creatorWallet: string): Promise<number> {
  await ensureSchema();
  const rows = await db()`
    UPDATE creator_posts SET status = 'rejected' WHERE creator_wallet = ${addr(creatorWallet)} AND status <> 'rejected'
    RETURNING id`;
  return rows.length;
}

export async function myPosts(creatorWallet: string): Promise<CreatorPost[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, creator_wallet, gnome_id, title, category, kind, scene, image_url, teaser_url, price_nomo, status, created_at
    FROM creator_posts WHERE creator_wallet = ${addr(creatorWallet)} ORDER BY created_at DESC`;
  return (rows as unknown as PostRow[]).map(mapPost);
}

export async function pendingPosts(): Promise<CreatorPost[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, creator_wallet, gnome_id, title, category, kind, scene, image_url, teaser_url, price_nomo, status, created_at
    FROM creator_posts WHERE status = 'pending' ORDER BY created_at ASC`;
  return (rows as unknown as PostRow[]).map(mapPost);
}

export async function reviewPost(id: number, approve: boolean): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE creator_posts SET status = ${approve ? "approved" : "rejected"}
    WHERE id = ${id} AND status = 'pending'
    RETURNING id`;
  return rows.length > 0;
}

export type MarketplaceListing = CreatorPost & { creatorName: string; creatorAvatar: string | null };

export async function activeListings(limit = 60): Promise<MarketplaceListing[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT p.id, p.creator_wallet, p.gnome_id, p.title, p.category, p.kind, p.scene, p.image_url, p.teaser_url, p.price_nomo, p.status, p.created_at,
           c.display_name AS creator_name, c.avatar_url AS creator_avatar
    FROM creator_posts p
    JOIN creators c ON c.wallet = p.creator_wallet
    WHERE p.status = 'approved'
    ORDER BY p.created_at DESC
    LIMIT ${limit}`;
  return (rows as unknown as (PostRow & { creator_name: string; creator_avatar: string | null })[]).map((r) => ({
    ...mapPost(r),
    creatorName: r.creator_name,
    creatorAvatar: r.creator_avatar,
  }));
}

export async function getPost(id: number): Promise<CreatorPost | null> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, creator_wallet, gnome_id, title, category, kind, scene, image_url, teaser_url, price_nomo, status, created_at
    FROM creator_posts WHERE id = ${id}`;
  return rows.length ? mapPost(rows[0] as unknown as PostRow) : null;
}

export async function hasPurchased(postId: number, buyerWallet: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    SELECT 1 FROM creator_purchases WHERE post_id = ${postId} AND buyer_wallet = ${addr(buyerWallet)}`;
  return rows.length > 0;
}

// Idempotent on both tx hashes and on (post, buyer) -- a resubmitted or
// double-clicked purchase can never be recorded twice.
export async function recordPurchase(
  postId: number,
  creatorWallet: string,
  buyerWallet: string,
  creatorTxHash: string,
  treasuryTxHash: string,
  amountNomo: number,
): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO creator_purchases (post_id, creator_wallet, buyer_wallet, creator_tx_hash, treasury_tx_hash, amount_nomo)
    VALUES (${postId}, ${addr(creatorWallet)}, ${addr(buyerWallet)}, ${creatorTxHash.toLowerCase()}, ${treasuryTxHash.toLowerCase()}, ${amountNomo})
    ON CONFLICT DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

export async function myPurchasedPostIds(buyerWallet: string): Promise<number[]> {
  await ensureSchema();
  const rows = await db()`SELECT post_id FROM creator_purchases WHERE buyer_wallet = ${addr(buyerWallet)}`;
  return (rows as unknown as { post_id: string | number }[]).map((r) => Number(r.post_id));
}

export async function creatorEarnings(creatorWallet: string): Promise<{ sales: number; earnedNomo: number }> {
  await ensureSchema();
  const rows = await db()`
    SELECT count(*) AS n, coalesce(sum(amount_nomo), 0) AS total
    FROM creator_purchases WHERE creator_wallet = ${addr(creatorWallet)}`;
  const r = rows[0] as unknown as { n: string; total: string };
  return { sales: Number(r.n), earnedNomo: Number(r.total) };
}
