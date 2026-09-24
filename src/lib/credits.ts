import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

export const GUEST_FREE_MESSAGES = Number(process.env.GUEST_FREE_MESSAGES ?? 5);
export const FREE_MESSAGES = Number(process.env.FREE_MESSAGES ?? 10);
const MESSAGES_PER_BATCH = Number(process.env.MESSAGES_PER_NOMO ?? 20);
export const NOMO_PER_BATCH = Number(process.env.NOMO_PER_BATCH ?? 0.2);

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

const addr = (wallet: string) => wallet.toLowerCase();

export async function creditBalance(wallet: string): Promise<number> {
  const rows = await db()`SELECT balance FROM credit_balances WHERE wallet = ${addr(wallet)}`;
  return rows.length ? Number(rows[0].balance) : 0;
}

// Returns false (and changes nothing) if the balance is too low.
export async function debitCredits(wallet: string, amount: number, reason: string): Promise<boolean> {
  const rows = await db()`
    WITH d AS (
      UPDATE credit_balances
      SET balance = balance - ${amount}, updated_at = now()
      WHERE wallet = ${addr(wallet)} AND balance >= ${amount}
      RETURNING wallet
    )
    INSERT INTO credit_ledger (wallet, delta, reason)
    SELECT wallet, ${-amount}, ${reason} FROM d
    RETURNING id`;
  return rows.length > 0;
}

// Credits an account. When txHash is given it can only ever be applied once;
// returns null if that tx was already redeemed.
export async function grantCredits(
  wallet: string,
  amount: number,
  reason: string,
  txHash?: string,
): Promise<number | null> {
  const rows = await db()`
    WITH l AS (
      INSERT INTO credit_ledger (wallet, delta, reason, tx_hash)
      VALUES (${addr(wallet)}, ${amount}, ${reason}, ${txHash?.toLowerCase() ?? null})
      ON CONFLICT (tx_hash) DO NOTHING
      RETURNING wallet, delta
    )
    INSERT INTO credit_balances (wallet, balance)
    SELECT wallet, delta FROM l
    ON CONFLICT (wallet) DO UPDATE
      SET balance = credit_balances.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance`;
  return rows.length ? Number(rows[0].balance) : null;
}

async function messagesUsed(wallet: string, gnomeId: string): Promise<number> {
  const rows = await db()`
    SELECT messages_used FROM message_usage
    WHERE wallet = ${addr(wallet)} AND gnome_id = ${gnomeId}
      AND window_start >= now() - interval '24 hours'`;
  return rows.length ? Number(rows[0].messages_used) : 0;
}

export async function canSendMessage(
  wallet: string,
  gnomeId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const used = await messagesUsed(wallet, gnomeId);
  if (used < FREE_MESSAGES) return { ok: true };
  const nextIsNewBatch = (used - FREE_MESSAGES) % MESSAGES_PER_BATCH === 0;
  if (!nextIsNewBatch) return { ok: true };
  if ((await creditBalance(wallet)) >= NOMO_PER_BATCH) return { ok: true };
  return {
    ok: false,
    reason: `Free messages used up. Need ${NOMO_PER_BATCH} NOMO credits for the next ${MESSAGES_PER_BATCH} messages.`,
  };
}

// Counts the message and charges a batch when it starts a new paid block of
// MESSAGES_PER_BATCH. Returns false if that charge couldn't be covered.
export async function recordMessage(wallet: string, gnomeId: string): Promise<boolean> {
  const rows = await db()`
    INSERT INTO message_usage (wallet, gnome_id, window_start, messages_used)
    VALUES (${addr(wallet)}, ${gnomeId}, now(), 1)
    ON CONFLICT (wallet, gnome_id) DO UPDATE SET
      messages_used = CASE WHEN message_usage.window_start < now() - interval '24 hours'
                           THEN 1 ELSE message_usage.messages_used + 1 END,
      window_start  = CASE WHEN message_usage.window_start < now() - interval '24 hours'
                           THEN now() ELSE message_usage.window_start END
    RETURNING messages_used`;
  const used = Number(rows[0].messages_used);
  if (used > FREE_MESSAGES && (used - FREE_MESSAGES - 1) % MESSAGES_PER_BATCH === 0) {
    return debitCredits(wallet, NOMO_PER_BATCH, `chat:${gnomeId}`);
  }
  return true;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${process.env.JWT_SECRET ?? ""}:${ip}`).digest("hex");
}

// Reserves one guest message for this IP (shared across all gnomes, 24h
// window). Returns how many remain, or -1 if the limit was already hit.
export async function consumeGuestMessage(ip: string): Promise<number> {
  const rows = await db()`
    INSERT INTO guest_usage (ip_hash, window_start, messages_used)
    VALUES (${hashIp(ip)}, now(), 1)
    ON CONFLICT (ip_hash) DO UPDATE SET
      messages_used = CASE WHEN guest_usage.window_start < now() - interval '24 hours'
                           THEN 1 ELSE guest_usage.messages_used + 1 END,
      window_start  = CASE WHEN guest_usage.window_start < now() - interval '24 hours'
                           THEN now() ELSE guest_usage.window_start END
    RETURNING messages_used`;
  const used = Number(rows[0].messages_used);
  return used > GUEST_FREE_MESSAGES ? -1 : GUEST_FREE_MESSAGES - used;
}

// Gives a reserved message back (e.g. when the AI call failed).
export async function refundGuestMessage(ip: string): Promise<void> {
  await db()`
    UPDATE guest_usage SET messages_used = GREATEST(messages_used - 1, 0)
    WHERE ip_hash = ${hashIp(ip)}`;
}

export async function usageStats(wallet: string, gnomeId: string) {
  const [used, balance] = await Promise.all([messagesUsed(wallet, gnomeId), creditBalance(wallet)]);
  return {
    messagesUsed: used,
    freeMessagesRemaining: Math.max(0, FREE_MESSAGES - used),
    creditsAvailable: balance,
    chargePerBatch: NOMO_PER_BATCH,
    messagesPerBatch: MESSAGES_PER_BATCH,
  };
}
