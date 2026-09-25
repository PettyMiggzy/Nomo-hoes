import { neon } from "@neondatabase/serverless";
import { PRICING } from "@/lib/pricing";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

// Lazily creates the table on first use so no separate migration step is
// needed; CREATE TABLE IF NOT EXISTS is idempotent across cold starts.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db()`
      CREATE TABLE IF NOT EXISTS ad_slots (
        id BIGSERIAL PRIMARY KEY,
        wallet TEXT NOT NULL,
        media_url TEXT NOT NULL,
        media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
        link_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        tx_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export type AdMediaType = "image" | "video";
export type AdStatus = "pending" | "approved" | "rejected";

export type AdSlot = {
  id: number;
  wallet: string;
  mediaUrl: string;
  mediaType: AdMediaType;
  linkUrl: string | null;
  status: AdStatus;
  createdAt: string;
  expiresAt: string;
};

type AdRow = {
  id: string | number;
  wallet: string;
  media_url: string;
  media_type: AdMediaType;
  link_url: string | null;
  status: AdStatus;
  created_at: string;
  expires_at: string;
};

const addr = (wallet: string) => wallet.toLowerCase();

function mapRow(r: AdRow): AdSlot {
  return {
    id: Number(r.id),
    wallet: r.wallet,
    mediaUrl: r.media_url,
    mediaType: r.media_type,
    linkUrl: r.link_url,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
  };
}

// Records a paid ad submission for owner review. Idempotent on txHash, so a
// double-submitted payment can never create two ad slots.
export async function submitAd(
  wallet: string,
  mediaUrl: string,
  mediaType: AdMediaType,
  linkUrl: string | null,
  txHash: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO ad_slots (wallet, media_url, media_type, link_url, tx_hash, expires_at)
    VALUES (
      ${addr(wallet)}, ${mediaUrl}, ${mediaType}, ${linkUrl}, ${txHash.toLowerCase()},
      now() + make_interval(days => ${PRICING.adDays})
    )
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

export async function activeAds(limit = 12): Promise<AdSlot[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, wallet, media_url, media_type, link_url, status, created_at, expires_at
    FROM ad_slots
    WHERE status = 'approved' AND expires_at > now()
    ORDER BY random()
    LIMIT ${limit}`;
  return (rows as unknown as AdRow[]).map(mapRow);
}

export async function pendingAds(): Promise<AdSlot[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, wallet, media_url, media_type, link_url, status, created_at, expires_at
    FROM ad_slots
    WHERE status = 'pending'
    ORDER BY created_at ASC`;
  return (rows as unknown as AdRow[]).map(mapRow);
}

// Returns false if the ad was already reviewed (or doesn't exist).
export async function reviewAd(id: number, approve: boolean): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE ad_slots SET status = ${approve ? "approved" : "rejected"}
    WHERE id = ${id} AND status = 'pending'
    RETURNING id`;
  return rows.length > 0;
}
