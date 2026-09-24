// In-memory store. Resets on every serverless cold start / redeploy —
// fine for local dev and demos, NOT durable in production on Vercel.
// Swap for a real database (Postgres, Redis) before launch.

type Usage = { messagesUsed: number; windowStart: number };

const usage = new Map<string, Usage>();
const credits = new Map<string, number>();

const FREE_MESSAGES = Number(process.env.FREE_MESSAGES ?? 10);
const MESSAGES_PER_BATCH = Number(process.env.MESSAGES_PER_NOMO ?? 20);
const NOMO_PER_BATCH = Number(process.env.NOMO_PER_BATCH ?? 0.2);
const WINDOW_MS = 24 * 60 * 60 * 1000;

function key(wallet: string, gnomeId: string) {
  return `${wallet.toLowerCase()}:${gnomeId}`;
}

function currentUsage(wallet: string, gnomeId: string): Usage {
  const k = key(wallet, gnomeId);
  let u = usage.get(k);
  const now = Date.now();
  if (!u || now - u.windowStart > WINDOW_MS) {
    u = { messagesUsed: 0, windowStart: now };
    usage.set(k, u);
  }
  return u;
}

export function creditBalance(wallet: string): number {
  return credits.get(wallet.toLowerCase()) ?? 0;
}

export function addCredits(wallet: string, amount: number): number {
  const addr = wallet.toLowerCase();
  const next = (credits.get(addr) ?? 0) + amount;
  credits.set(addr, next);
  return next;
}

export function canSendMessage(wallet: string, gnomeId: string): { ok: boolean; reason?: string } {
  const u = currentUsage(wallet, gnomeId);
  if (u.messagesUsed < FREE_MESSAGES) return { ok: true };
  if (creditBalance(wallet) >= NOMO_PER_BATCH) return { ok: true };
  return {
    ok: false,
    reason: `Free messages used up. Need ${NOMO_PER_BATCH} NOMO credits for the next ${MESSAGES_PER_BATCH} messages.`,
  };
}

export function recordMessage(wallet: string, gnomeId: string): void {
  const u = currentUsage(wallet, gnomeId);
  u.messagesUsed++;
  if (u.messagesUsed > FREE_MESSAGES) {
    const overFree = u.messagesUsed - FREE_MESSAGES;
    if ((overFree - 1) % MESSAGES_PER_BATCH === 0) {
      const addr = wallet.toLowerCase();
      credits.set(addr, (credits.get(addr) ?? 0) - NOMO_PER_BATCH);
    }
  }
}

export function usageStats(wallet: string, gnomeId: string) {
  const u = currentUsage(wallet, gnomeId);
  return {
    messagesUsed: u.messagesUsed,
    freeMessagesRemaining: Math.max(0, FREE_MESSAGES - u.messagesUsed),
    creditsAvailable: creditBalance(wallet),
    chargePerBatch: NOMO_PER_BATCH,
    messagesPerBatch: MESSAGES_PER_BATCH,
  };
}
