import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { PRICING } from "@/lib/pricing";

export const GUEST_FREE_MESSAGES = PRICING.guestFreeMessages;
const { messagesPerBatch: MESSAGES_PER_BATCH, nomoPerBatch: NOMO_PER_BATCH } = PRICING;

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

export async function vipUntil(wallet: string): Promise<Date | null> {
  const rows = await db()`
    SELECT expires_at FROM vip_passes WHERE wallet = ${addr(wallet)} AND expires_at > now()`;
  return rows.length ? new Date(rows[0].expires_at) : null;
}

// Starts or extends a VIP pass paid by txHash. The tx is recorded in the same
// ledger as credit purchases, so one transfer can only ever be redeemed once,
// for either credits or VIP. Returns null if it was already redeemed.
export async function activateVip(wallet: string, reason: string, txHash: string): Promise<Date | null> {
  const days = PRICING.vipDays;
  const rows = await db()`
    WITH l AS (
      INSERT INTO credit_ledger (wallet, delta, reason, tx_hash)
      VALUES (${addr(wallet)}, 0, ${reason}, ${txHash.toLowerCase()})
      ON CONFLICT (tx_hash) DO NOTHING
      RETURNING wallet
    )
    INSERT INTO vip_passes (wallet, expires_at)
    SELECT wallet, now() + make_interval(days => ${days}) FROM l
    ON CONFLICT (wallet) DO UPDATE
      SET expires_at = GREATEST(vip_passes.expires_at, now()) + make_interval(days => ${days}),
          updated_at = now()
    RETURNING expires_at`;
  return rows.length ? new Date(rows[0].expires_at) : null;
}

async function freeLimit(wallet: string): Promise<number> {
  return (await vipUntil(wallet)) ? PRICING.vipFreeMessages : PRICING.walletFreeMessages;
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
  const [used, free] = await Promise.all([messagesUsed(wallet, gnomeId), freeLimit(wallet)]);
  if (used < free) return { ok: true };
  const nextIsNewBatch = (used - free) % MESSAGES_PER_BATCH === 0;
  if (!nextIsNewBatch) return { ok: true };
  if ((await creditBalance(wallet)) >= NOMO_PER_BATCH) return { ok: true };
  return {
    ok: false,
    reason: `Free messages used up. ${NOMO_PER_BATCH} NOMO in credits buys the next ${MESSAGES_PER_BATCH} messages — or grab a VIP Pass for ${PRICING.vipFreeMessages} free a day.`,
  };
}

// Counts the message and charges a batch when it starts a new paid block of
// MESSAGES_PER_BATCH. Returns false if that charge couldn't be covered.
export async function recordMessage(wallet: string, gnomeId: string): Promise<boolean> {
  const free = await freeLimit(wallet);
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
  if (used > free && (used - free - 1) % MESSAGES_PER_BATCH === 0) {
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
  const [used, balance, vip] = await Promise.all([
    messagesUsed(wallet, gnomeId),
    creditBalance(wallet),
    vipUntil(wallet),
  ]);
  const free = vip ? PRICING.vipFreeMessages : PRICING.walletFreeMessages;
  return {
    messagesUsed: used,
    freeMessagesRemaining: Math.max(0, free - used),
    creditsAvailable: balance,
    vipUntil: vip?.toISOString() ?? null,
    chargePerBatch: NOMO_PER_BATCH,
    messagesPerBatch: MESSAGES_PER_BATCH,
  };
}
