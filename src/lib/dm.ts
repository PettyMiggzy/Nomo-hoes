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
      // Per-creator DM settings live on the creators table (marketplace.ts owns
      // it; created here too in case DMs are touched before the marketplace).
      await sql`
        CREATE TABLE IF NOT EXISTS creators (
          wallet TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          bio TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
      await sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS dm_enabled BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS dm_price_nomo NUMERIC`;
      await sql`
        CREATE TABLE IF NOT EXISTS dm_threads (
          creator_wallet TEXT NOT NULL,
          fan_wallet TEXT NOT NULL,
          messages_left INT NOT NULL DEFAULT 0,
          last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          creator_read_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
          fan_read_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
          PRIMARY KEY (creator_wallet, fan_wallet)
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS dm_messages (
          id BIGSERIAL PRIMARY KEY,
          creator_wallet TEXT NOT NULL,
          fan_wallet TEXT NOT NULL,
          from_creator BOOLEAN NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS dm_messages_thread ON dm_messages (creator_wallet, fan_wallet, id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS dm_purchases (
          id BIGSERIAL PRIMARY KEY,
          creator_wallet TEXT NOT NULL,
          fan_wallet TEXT NOT NULL,
          messages INT NOT NULL,
          creator_amount_nomo NUMERIC NOT NULL,
          creator_tx_hash TEXT UNIQUE NOT NULL,
          treasury_tx_hash TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

export type DmSettings = { enabled: boolean; priceNomo: number | null };

export async function getDmSettings(creatorWallet: string): Promise<DmSettings | null> {
  await ensureSchema();
  const rows = await db()`SELECT dm_enabled, dm_price_nomo FROM creators WHERE wallet = ${addr(creatorWallet)}`;
  if (!rows.length) return null;
  const r = rows[0] as { dm_enabled: boolean; dm_price_nomo: string | null };
  return { enabled: r.dm_enabled, priceNomo: r.dm_price_nomo === null ? null : Number(r.dm_price_nomo) };
}

export async function setDmSettings(creatorWallet: string, enabled: boolean, priceNomo: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE creators SET dm_enabled = ${enabled}, dm_price_nomo = ${priceNomo}
    WHERE wallet = ${addr(creatorWallet)} RETURNING wallet`;
  return rows.length > 0;
}

export type Thread = {
  creatorWallet: string;
  fanWallet: string;
  messagesLeft: number;
  lastMessageAt: string;
  unread: number;
  peerName: string | null;
  peerAvatar: string | null;
  lastBody: string | null;
};

type ThreadRow = {
  creator_wallet: string;
  fan_wallet: string;
  messages_left: number;
  last_message_at: string;
  unread: string | number;
  peer_name: string | null;
  peer_avatar: string | null;
  last_body: string | null;
};

const mapThread = (r: ThreadRow): Thread => ({
  creatorWallet: r.creator_wallet,
  fanWallet: r.fan_wallet,
  messagesLeft: r.messages_left,
  lastMessageAt: new Date(r.last_message_at).toISOString(),
  unread: Number(r.unread),
  peerName: r.peer_name,
  peerAvatar: r.peer_avatar,
  lastBody: r.last_body,
});

// Threads where `wallet` is the creator (their inbox) and where they're the
// fan (conversations they bought), newest first, with unread counts.
export async function listThreads(wallet: string): Promise<{ asCreator: Thread[]; asFan: Thread[] }> {
  await ensureSchema();
  const w = addr(wallet);
  const sql = db();
  const [asCreator, asFan] = await Promise.all([
    sql`
      SELECT t.creator_wallet, t.fan_wallet, t.messages_left, t.last_message_at,
             (SELECT count(*) FROM dm_messages m WHERE m.creator_wallet = t.creator_wallet AND m.fan_wallet = t.fan_wallet
                AND NOT m.from_creator AND m.created_at > t.creator_read_at) AS unread,
             (SELECT c.display_name FROM creators c WHERE c.wallet = t.fan_wallet) AS peer_name,
             (SELECT c.avatar_url FROM creators c WHERE c.wallet = t.fan_wallet) AS peer_avatar,
             (SELECT m.body FROM dm_messages m WHERE m.creator_wallet = t.creator_wallet AND m.fan_wallet = t.fan_wallet
                ORDER BY m.id DESC LIMIT 1) AS last_body
      FROM dm_threads t WHERE t.creator_wallet = ${w} ORDER BY t.last_message_at DESC LIMIT 200`,
    sql`
      SELECT t.creator_wallet, t.fan_wallet, t.messages_left, t.last_message_at,
             (SELECT count(*) FROM dm_messages m WHERE m.creator_wallet = t.creator_wallet AND m.fan_wallet = t.fan_wallet
                AND m.from_creator AND m.created_at > t.fan_read_at) AS unread,
             c.display_name AS peer_name, c.avatar_url AS peer_avatar,
             (SELECT m.body FROM dm_messages m WHERE m.creator_wallet = t.creator_wallet AND m.fan_wallet = t.fan_wallet
                ORDER BY m.id DESC LIMIT 1) AS last_body
      FROM dm_threads t LEFT JOIN creators c ON c.wallet = t.creator_wallet
      WHERE t.fan_wallet = ${w} ORDER BY t.last_message_at DESC LIMIT 200`,
  ]);
  return {
    asCreator: (asCreator as unknown as ThreadRow[]).map(mapThread),
    asFan: (asFan as unknown as ThreadRow[]).map(mapThread),
  };
}

export async function getThread(creatorWallet: string, fanWallet: string): Promise<{ messagesLeft: number } | null> {
  await ensureSchema();
  const rows = await db()`
    SELECT messages_left FROM dm_threads WHERE creator_wallet = ${addr(creatorWallet)} AND fan_wallet = ${addr(fanWallet)}`;
  return rows.length ? { messagesLeft: Number(rows[0].messages_left) } : null;
}

export type DmMessage = { id: number; fromCreator: boolean; body: string; createdAt: string };

export async function getMessages(creatorWallet: string, fanWallet: string, afterId = 0): Promise<DmMessage[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, from_creator, body, created_at FROM dm_messages
    WHERE creator_wallet = ${addr(creatorWallet)} AND fan_wallet = ${addr(fanWallet)} AND id > ${afterId}
    ORDER BY id ASC LIMIT 500`;
  return (rows as unknown as { id: string; from_creator: boolean; body: string; created_at: string }[]).map((r) => ({
    id: Number(r.id),
    fromCreator: r.from_creator,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function markRead(creatorWallet: string, fanWallet: string, asCreator: boolean): Promise<void> {
  await ensureSchema();
  const c = addr(creatorWallet);
  const f = addr(fanWallet);
  if (asCreator) await db()`UPDATE dm_threads SET creator_read_at = now() WHERE creator_wallet = ${c} AND fan_wallet = ${f}`;
  else await db()`UPDATE dm_threads SET fan_read_at = now() WHERE creator_wallet = ${c} AND fan_wallet = ${f}`;
}

// A fan's message costs one prepaid message; the decrement and the insert
// happen in one statement so two tabs can't overspend the bundle.
export async function sendFanMessage(creatorWallet: string, fanWallet: string, body: string): Promise<DmMessage | null> {
  await ensureSchema();
  const c = addr(creatorWallet);
  const f = addr(fanWallet);
  const rows = await db()`
    WITH spent AS (
      UPDATE dm_threads SET messages_left = messages_left - 1, last_message_at = now(), fan_read_at = now()
      WHERE creator_wallet = ${c} AND fan_wallet = ${f} AND messages_left > 0
      RETURNING creator_wallet, fan_wallet
    )
    INSERT INTO dm_messages (creator_wallet, fan_wallet, from_creator, body)
    SELECT creator_wallet, fan_wallet, false, ${body} FROM spent
    RETURNING id, created_at`;
  if (!rows.length) return null;
  return { id: Number(rows[0].id), fromCreator: false, body, createdAt: new Date(rows[0].created_at).toISOString() };
}

// Creators reply for free, but only inside a thread a fan opened by paying.
export async function sendCreatorReply(creatorWallet: string, fanWallet: string, body: string): Promise<DmMessage | null> {
  await ensureSchema();
  const c = addr(creatorWallet);
  const f = addr(fanWallet);
  const rows = await db()`
    WITH t AS (
      UPDATE dm_threads SET last_message_at = now(), creator_read_at = now()
      WHERE creator_wallet = ${c} AND fan_wallet = ${f}
      RETURNING creator_wallet, fan_wallet
    )
    INSERT INTO dm_messages (creator_wallet, fan_wallet, from_creator, body)
    SELECT creator_wallet, fan_wallet, true, ${body} FROM t
    RETURNING id, created_at`;
  if (!rows.length) return null;
  return { id: Number(rows[0].id), fromCreator: true, body, createdAt: new Date(rows[0].created_at).toISOString() };
}

// Records a verified bundle purchase and credits the thread in one statement;
// the unique tx hashes make a resubmitted purchase a no-op.
export async function recordBundle(
  creatorWallet: string,
  fanWallet: string,
  messages: number,
  creatorAmount: number,
  creatorTxHash: string,
  treasuryTxHash: string,
): Promise<boolean> {
  await ensureSchema();
  const c = addr(creatorWallet);
  const f = addr(fanWallet);
  const rows = await db()`
    WITH p AS (
      INSERT INTO dm_purchases (creator_wallet, fan_wallet, messages, creator_amount_nomo, creator_tx_hash, treasury_tx_hash)
      VALUES (${c}, ${f}, ${messages}, ${creatorAmount}, ${creatorTxHash.toLowerCase()}, ${treasuryTxHash.toLowerCase()})
      ON CONFLICT DO NOTHING
      RETURNING messages
    )
    INSERT INTO dm_threads (creator_wallet, fan_wallet, messages_left)
    SELECT ${c}, ${f}, messages FROM p
    ON CONFLICT (creator_wallet, fan_wallet) DO UPDATE SET messages_left = dm_threads.messages_left + EXCLUDED.messages_left
    RETURNING messages_left`;
  return rows.length > 0;
}

export async function dmEarnings(creatorWallet: string): Promise<{ bundles: number; earnedNomo: number }> {
  await ensureSchema();
  const rows = await db()`
    SELECT count(*) AS n, coalesce(sum(creator_amount_nomo), 0) AS total FROM dm_purchases WHERE creator_wallet = ${addr(creatorWallet)}`;
  const r = rows[0] as unknown as { n: string; total: string };
  return { bundles: Number(r.n), earnedNomo: Number(r.total) };
}

export async function dmPlatformStats(): Promise<{ bundles: number; creatorNomo: number }> {
  await ensureSchema();
  const rows = await db()`SELECT count(*) AS n, coalesce(sum(creator_amount_nomo), 0) AS total FROM dm_purchases`;
  const r = rows[0] as unknown as { n: string; total: string };
  return { bundles: Number(r.n), creatorNomo: Number(r.total) };
}
