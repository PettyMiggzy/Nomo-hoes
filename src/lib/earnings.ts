import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { debitCredits, grantCredits } from "@/lib/credits";
import { splitSale } from "@/lib/pricing";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

// Creator earnings are kept apart from spendable credits: bought credits can
// only be spent on the site, earned credits are what creators cash out as
// USDG (1:1). A cash-out request takes the credits off the balance
// immediately (held as a pending payout), so nothing can be spent or
// requested twice; a rejected payout gives them back.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS creator_balances (
          wallet TEXT PRIMARY KEY,
          balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
          lifetime NUMERIC NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS creator_ledger (
          id BIGSERIAL PRIMARY KEY,
          wallet TEXT NOT NULL,
          delta NUMERIC NOT NULL,
          reason TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS payouts (
          id BIGSERIAL PRIMARY KEY,
          wallet TEXT NOT NULL,
          amount NUMERIC NOT NULL CHECK (amount > 0),
          payout_wallet TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
          tx_hash TEXT UNIQUE,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          resolved_at TIMESTAMPTZ
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS creators (
          wallet TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          bio TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS payout_wallet TEXT`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

// A unique stand-in for the tx-hash columns of purchases paid with credits.
export const creditRef = () => `credits:${randomUUID()}`;

export async function earningsBalance(wallet: string): Promise<{ balance: number; lifetime: number }> {
  await ensureSchema();
  const rows = await db()`SELECT balance, lifetime FROM creator_balances WHERE wallet = ${addr(wallet)}`;
  return rows.length ? { balance: Number(rows[0].balance), lifetime: Number(rows[0].lifetime) } : { balance: 0, lifetime: 0 };
}

export async function creditEarnings(wallet: string, amount: number, reason: string): Promise<void> {
  await ensureSchema();
  await db()`
    WITH l AS (
      INSERT INTO creator_ledger (wallet, delta, reason) VALUES (${addr(wallet)}, ${amount}, ${reason}) RETURNING wallet
    )
    INSERT INTO creator_balances (wallet, balance, lifetime)
    SELECT wallet, ${amount}, ${amount} FROM l
    ON CONFLICT (wallet) DO UPDATE SET
      balance = creator_balances.balance + EXCLUDED.balance,
      lifetime = creator_balances.lifetime + EXCLUDED.lifetime,
      updated_at = now()`;
}

export type SaleResult = "ok" | "insufficient" | "duplicate";

// Charges the buyer's credits for a creator sale, records it via `record`
// (which returns false if it was already recorded), then pays the creator
// their cut into earnings. The platform's cut simply stays in the pool.
export async function chargeCreatorSale(
  buyer: string,
  creator: string,
  price: number,
  reason: string,
  record: () => Promise<boolean>,
): Promise<SaleResult> {
  if (!(await debitCredits(buyer, price, reason))) return "insufficient";
  let recorded = false;
  try {
    recorded = await record();
  } finally {
    if (!recorded) await grantCredits(buyer, price, `refund:${reason}`);
  }
  if (!recorded) return "duplicate";
  const { creatorCut } = splitSale(price);
  try {
    await creditEarnings(creator, creatorCut, reason);
  } catch (e) {
    // The buyer has what they paid for; flag loudly so the owner can credit
    // the creator by hand.
    console.error(`EARNINGS NOT CREDITED: ${creator} ${creatorCut} for ${reason}`, e);
  }
  return "ok";
}

// Charges the buyer's credits for something the house sells (100% to the
// pool); refunds if `record` reports it was already bought.
export async function chargeHouseSale(buyer: string, price: number, reason: string, record: () => Promise<boolean>): Promise<SaleResult> {
  if (!(await debitCredits(buyer, price, reason))) return "insufficient";
  let recorded = false;
  try {
    recorded = await record();
  } finally {
    if (!recorded) await grantCredits(buyer, price, `refund:${reason}`);
  }
  return recorded ? "ok" : "duplicate";
}

export async function getPayoutWallet(wallet: string): Promise<string> {
  await ensureSchema();
  const rows = await db()`SELECT payout_wallet FROM creators WHERE wallet = ${addr(wallet)}`;
  return (rows[0]?.payout_wallet as string | null) ?? addr(wallet);
}

export async function setPayoutWallet(wallet: string, payoutWallet: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`UPDATE creators SET payout_wallet = ${addr(payoutWallet)} WHERE wallet = ${addr(wallet)} RETURNING wallet`;
  return rows.length > 0;
}

export type Payout = {
  id: number;
  wallet: string;
  amount: number;
  payoutWallet: string;
  status: "pending" | "paid" | "rejected";
  txHash: string | null;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type PayoutRow = {
  id: string;
  wallet: string;
  amount: string;
  payout_wallet: string;
  status: Payout["status"];
  tx_hash: string | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const mapPayout = (r: PayoutRow): Payout => ({
  id: Number(r.id),
  wallet: r.wallet,
  amount: Number(r.amount),
  payoutWallet: r.payout_wallet,
  status: r.status,
  txHash: r.tx_hash,
  note: r.note,
  createdAt: new Date(r.created_at).toISOString(),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
});

// Takes `amount` off the creator's earnings and opens a pending payout in
// one statement -- the balance can't go negative, so a double click or two
// tabs can never request the same credits twice. Null if the balance is short.
export async function requestPayout(wallet: string, amount: number, payoutWallet: string): Promise<Payout | null> {
  await ensureSchema();
  const w = addr(wallet);
  const rows = await db()`
    WITH d AS (
      UPDATE creator_balances SET balance = balance - ${amount}, updated_at = now()
      WHERE wallet = ${w} AND balance >= ${amount}
      RETURNING wallet
    ),
    l AS (
      INSERT INTO creator_ledger (wallet, delta, reason) SELECT wallet, ${-amount}, 'cashout:requested' FROM d
    )
    INSERT INTO payouts (wallet, amount, payout_wallet)
    SELECT wallet, ${amount}, ${addr(payoutWallet)} FROM d
    RETURNING *`;
  return rows.length ? mapPayout(rows[0] as unknown as PayoutRow) : null;
}

export async function myPayouts(wallet: string): Promise<Payout[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM payouts WHERE wallet = ${addr(wallet)} ORDER BY created_at DESC LIMIT 50`;
  return (rows as unknown as PayoutRow[]).map(mapPayout);
}

export async function getPayout(id: number): Promise<Payout | null> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM payouts WHERE id = ${id}`;
  return rows.length ? mapPayout(rows[0] as unknown as PayoutRow) : null;
}

export async function pendingPayouts(): Promise<Payout[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM payouts WHERE status = 'pending' ORDER BY created_at ASC`;
  return (rows as unknown as PayoutRow[]).map(mapPayout);
}

export async function recentPayouts(limit = 30): Promise<Payout[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM payouts WHERE status <> 'pending' ORDER BY resolved_at DESC LIMIT ${limit}`;
  return (rows as unknown as PayoutRow[]).map(mapPayout);
}

export async function markPayoutPaid(id: number, txHash: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE payouts SET status = 'paid', tx_hash = ${txHash.toLowerCase()}, resolved_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING id`;
  return rows.length > 0;
}

// Rejecting gives the held credits back to the creator's earnings.
export async function rejectPayout(id: number, note: string | null): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    WITH p AS (
      UPDATE payouts SET status = 'rejected', note = ${note}, resolved_at = now()
      WHERE id = ${id} AND status = 'pending'
      RETURNING wallet, amount
    ),
    l AS (
      INSERT INTO creator_ledger (wallet, delta, reason) SELECT wallet, amount, 'cashout:rejected' FROM p
    )
    UPDATE creator_balances b SET balance = b.balance + p.amount, updated_at = now()
    FROM p WHERE b.wallet = p.wallet
    RETURNING b.wallet`;
  return rows.length > 0;
}

// What the pool owes creators: unpaid earnings plus cash-outs still pending.
export async function creatorLiabilities(): Promise<{ earnings: number; pendingPayouts: number; paidOut: number }> {
  await ensureSchema();
  const sql = db();
  const [a, b] = await Promise.all([
    sql`SELECT coalesce(sum(balance), 0) AS total FROM creator_balances`,
    sql`SELECT coalesce(sum(amount) FILTER (WHERE status = 'pending'), 0) AS pending,
               coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0) AS paid FROM payouts`,
  ]);
  return { earnings: Number(a[0].total), pendingPayouts: Number(b[0].pending), paidOut: Number(b[0].paid) };
}
