// Every price is an env var so it can be retuned in Vercel (then redeploy)
// as the NOMO / NOHOES prices move. No database or secrets here, so both
// server pages and API routes can import it.

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const PRICING = {
  guestFreeMessages: num(process.env.GUEST_FREE_MESSAGES, 5),
  walletFreeMessages: num(process.env.WALLET_FREE_MESSAGES, 10),
  vipFreeMessages: num(process.env.VIP_FREE_MESSAGES, 50),
  messagesPerBatch: num(process.env.MESSAGES_PER_BATCH, 10),
  nomoPerBatch: num(process.env.NOMO_PER_BATCH, 0.025),
  nomoPerImage: num(process.env.NOMO_PER_IMAGE, 0.05),
  vipPriceNomo: num(process.env.VIP_PRICE_NOMO, 1),
  vipPriceNohoes: num(process.env.VIP_PRICE_NOHOES, 0.069),
  vipDays: num(process.env.VIP_DAYS, 30),
  packs: [
    { name: "Gardener", nomo: num(process.env.PACK_GARDENER_NOMO, 0.5) },
    { name: "Hollow Lord", nomo: num(process.env.PACK_LORD_NOMO, 2) },
  ],
  adPriceNomo: num(process.env.AD_PRICE_NOMO, 5),
  adDays: num(process.env.AD_DAYS, 7),
  platformCutBps: num(process.env.PLATFORM_CUT_BPS, 2000),
  creatorMinPriceNomo: num(process.env.CREATOR_MIN_PRICE_NOMO, 0.02),
  // Defaults for new premium uploads; each item's own price is editable
  // afterwards from /owner/premium.
  premiumPhotoNomo: num(process.env.PREMIUM_PHOTO_NOMO, 0.1),
  premiumClipNomo: num(process.env.PREMIUM_CLIP_NOMO, 0.3),
};

// Splits a marketplace sale so the two amounts always sum exactly to
// `price` (the remainder after rounding goes to the platform cut).
export function splitSale(price: number): { creatorCut: number; platformCut: number } {
  const creatorCut = Math.round(((price * (10000 - PRICING.platformCutBps)) / 10000) * 1e6) / 1e6;
  const platformCut = Math.round((price - creatorCut) * 1e6) / 1e6;
  return { creatorCut, platformCut };
}

export function packPerks(nomo: number) {
  const messages = Math.floor((nomo / PRICING.nomoPerBatch) * PRICING.messagesPerBatch + 1e-9);
  const pics = Math.floor(nomo / PRICING.nomoPerImage + 1e-9);
  return { messages, pics };
}

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
