// Every price is an env var so it can be retuned in Vercel (then redeploy)
// as the NOMO / NOHOES prices move. No database or secrets here, so both
// server pages and API routes can import it.

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const PRICING = {
  guestFreeMessages: num(process.env.GUEST_FREE_MESSAGES, 5),
  walletFreeMessages: num(process.env.WALLET_FREE_MESSAGES, 5),
  vipFreeMessages: num(process.env.VIP_FREE_MESSAGES, 10),
  messagesPerBatch: num(process.env.MESSAGES_PER_BATCH, 20),
  nomoPerBatch: num(process.env.NOMO_PER_BATCH, 0.04),
  nomoPerImage: num(process.env.NOMO_PER_IMAGE, 0.1),
  vipPriceNomo: num(process.env.VIP_PRICE_NOMO, 1),
  vipPriceNohoes: num(process.env.VIP_PRICE_NOHOES, 0.069),
  vipDays: num(process.env.VIP_DAYS, 30),
  packs: [
    { name: "Gardener", nomo: num(process.env.PACK_GARDENER_NOMO, 1) },
    { name: "Hollow Lord", nomo: num(process.env.PACK_LORD_NOMO, 5) },
  ],
};

export function packPerks(nomo: number) {
  const messages = Math.floor((nomo / PRICING.nomoPerBatch) * PRICING.messagesPerBatch);
  const pics = Math.floor(nomo / PRICING.nomoPerImage);
  return { messages, pics };
}

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
