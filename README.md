# NOMO HOES

18+ fictional AI gnome companions on Robinhood Chain, paid for in $NOMO. Part of the NOMO ecosystem (nomosupply.com).

## Live token

$NOHOES is live on Robinhood Chain: `0xfa4934809128c5C0C40a6906Da006246Aad8Bebe` (69 supply, symbol NOHOES).

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres for credits, usage, and the payment ledger
- Venice AI for gnome chat and image generation
- viem for wallet auth and on-chain payment verification

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## Key routes

- `/gnomes` — the roster; `/gnomes/[id]` — chat with a gnome (free messages, then credits or VIP)
- `/credits` — buy credit packs or a VIP Pass (pay in NOMO, or burn $NOHOES for VIP)
- `/advertise` — pay NOMO to run your own image/video ad in the gnome-chat sidebar; `/owner/ads` reviews submissions
- `/creator` — sign up and sell AI-generated gnome scenes; `/marketplace` — buy them. Each sale splits on chain
  straight from the buyer's wallet (80% creator / 20% platform by default), no custodial payouts. `/owner/marketplace`
  reviews submissions before they go live
- `/owner` — password login for unlimited use with no wallet; `/owner/dashboard` — live revenue vs. Venice cost

## Pricing

Every price (free-message limits, pack sizes, VIP cost, batch rates) is an env var — see `.env.example` — so it can be retuned without a code change. `src/lib/pricing.ts` is the single source of truth the UI and API routes both read from.
