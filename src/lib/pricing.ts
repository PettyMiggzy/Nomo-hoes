// Every price on the site is in credits, and 1 credit = 1 USDG = $1. Users
// top up with USDG (sent to the treasury pool); everything else spends
// credits. Each price is an env var so it can be retuned in Vercel (then
// redeploy). No database or secrets here, so both server pages and API
// routes can import it.

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const PRICING = {
  guestFreeMessages: num(process.env.GUEST_FREE_MESSAGES, 5),
  walletFreeMessages: num(process.env.WALLET_FREE_MESSAGES, 10),
  vipFreeMessages: num(process.env.VIP_FREE_MESSAGES, 50),
  messagesPerBatch: num(process.env.MESSAGES_PER_BATCH, 10),
  creditsPerBatch: num(process.env.CREDITS_PER_BATCH, 0.25),
  creditsPerImage: num(process.env.CREDITS_PER_IMAGE, 0.1),
  vipPriceCredits: num(process.env.VIP_PRICE_CREDITS, 9.99),
  vipPriceNohoes: num(process.env.VIP_PRICE_NOHOES, 0.069),
  vipDays: num(process.env.VIP_DAYS, 30),
  // Suggested top-ups; any USDG amount works.
  packs: [
    { name: "Taster", usd: num(process.env.PACK_TASTER_USD, 5) },
    { name: "Gardener", usd: num(process.env.PACK_GARDENER_USD, 20) },
    { name: "Hollow Lord", usd: num(process.env.PACK_LORD_USD, 50) },
  ],
  adPriceCredits: num(process.env.AD_PRICE_CREDITS, 25),
  adDays: num(process.env.AD_DAYS, 7),
  // The platform's share of every creator sale (2000 = 20%); the rest goes
  // to the creator's cash-out balance.
  platformCutBps: num(process.env.PLATFORM_CUT_BPS, 2000),
  creatorMinPrice: num(process.env.CREATOR_MIN_PRICE, 0.5),
  // Defaults for new premium uploads; each item's own price is editable
  // afterwards from /owner/premium.
  premiumPhotoPrice: num(process.env.PREMIUM_PHOTO_PRICE, 1),
  premiumClipPrice: num(process.env.PREMIUM_CLIP_PRICE, 3),
  // Creator DMs: each creator sets their own per-message price (at least the
  // minimum); fans buy message bundles with credits.
  dmMinPrice: num(process.env.DM_MIN_PRICE, 0.05),
  dmBundles: [5, 10, 25],
  // Smallest creator cash-out, in credits (= USDG).
  minCashout: num(process.env.MIN_CASHOUT, 10),
};

// Splits a creator sale so the two amounts always sum exactly to `price`
// (the remainder after rounding goes to the platform cut). USDG has 6
// decimals, so everything is kept to 6 places.
export function splitSale(price: number): { creatorCut: number; platformCut: number } {
  const creatorCut = Math.round(((price * (10000 - PRICING.platformCutBps)) / 10000) * 1e6) / 1e6;
  const platformCut = Math.round((price - creatorCut) * 1e6) / 1e6;
  return { creatorCut, platformCut };
}

export function packPerks(usd: number) {
  const messages = Math.floor((usd / PRICING.creditsPerBatch) * PRICING.messagesPerBatch + 1e-9);
  const pics = Math.floor(usd / PRICING.creditsPerImage + 1e-9);
  return { messages, pics };
}

export { usd as fmt } from "@/lib/money";
