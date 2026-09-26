# NOMO HOES

18+ fictional AI gnome companions on Robinhood Chain. Everything on the site is paid for with credits, topped up in
USDG (1 credit = 1 USDG = $1). Part of the NOMO ecosystem (nomosupply.com).

## Live token

$NOHOES is live on Robinhood Chain: `0xfa4934809128c5C0C40a6906Da006246Aad8Bebe` (69 supply, symbol NOHOES).

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres for credits, usage, creator earnings and the payment ledger
- Venice AI for gnome chat and image generation
- viem for wallet auth and on-chain payment verification (USDG top-ups, creator payouts)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
psql "$DATABASE_URL" -f db/schema.sql   # base tables; everything else is created on first use
npm run dev
```

## Key routes

- `/gnomes` — the roster; `/gnomes/[id]` — chat with a gnome (free messages, then credits or VIP)
- `/credits` — top up credits with USDG (sent to the treasury pool), buy VIP with credits or by burning $NOHOES
- `/marketplace` — premium gnome photos/clips and creators' posts, filterable by category; unlocked with credits
- `/advertise` — spend credits on your own image/video ad in the gnome-chat sidebar; `/owner/ads` reviews submissions
- `/creator` — sign up (18+, AI content only) to sell AI gnome scenes and paid DMs (`/messages`). Creator sales
  split 80% to the creator's earnings / 20% platform; creators cash out earnings 1:1 in USDG
- `/owner/payouts` — the pool (USDG held vs. owed to creators vs. yours) and the cash-out queue; marking a payout
  paid checks the USDG transfer on chain. `/owner/marketplace`, `/owner/premium`, `/owner/reports` for moderation
- `/api/admin/payments-selftest` — owner-only health check of the payment plumbing
- `/owner` — password login for unlimited use with no wallet; `/owner/dashboard` — live revenue vs. Venice cost

## Pricing

Every price (free-message limits, pack sizes, VIP cost, batch rates) is an env var — see `.env.example` — so it can be retuned without a code change. `src/lib/pricing.ts` is the single source of truth the UI and API routes both read from.
