-- Base tables for NOMO HOES that the app does NOT create on its own.
--
-- These were set up by hand in the production Neon database; this file
-- records them (reconstructed from the queries in src/lib/credits.ts and
-- src/lib/usage.ts) so a fresh database can be brought up with:
--
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Every other table (ads, marketplace, premium, DMs, creator earnings and
-- payouts, reports, the shared payment ledger) is created automatically by
-- its module in src/lib on first use -- see each file's ensureSchema().
--
-- Amounts are credits, and 1 credit = 1 USDG = $1.

-- Spendable credit balance per wallet (topped up with USDG, spent on the site).
CREATE TABLE IF NOT EXISTS credit_balances (
  wallet     TEXT PRIMARY KEY,
  balance    NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every credit movement. tx_hash is set for on-chain top-ups (and VIP
-- purchases) and is unique, so one transfer can only ever be redeemed once.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         BIGSERIAL PRIMARY KEY,
  wallet     TEXT NOT NULL,
  delta      NUMERIC NOT NULL,
  reason     TEXT NOT NULL,
  tx_hash    TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active VIP passes; buying again extends expires_at.
CREATE TABLE IF NOT EXISTS vip_passes (
  wallet     TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily message counts per wallet (gnome_id is '_all' -- one bucket across
-- every gnome), used for free allowances and paid batches.
CREATE TABLE IF NOT EXISTS message_usage (
  wallet        TEXT NOT NULL,
  gnome_id      TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  messages_used INT NOT NULL,
  PRIMARY KEY (wallet, gnome_id)
);

-- Daily free messages for visitors without a wallet, keyed by a salted IP hash.
CREATE TABLE IF NOT EXISTS guest_usage (
  ip_hash       TEXT PRIMARY KEY,
  window_start  TIMESTAMPTZ NOT NULL,
  messages_used INT NOT NULL
);

-- One row per AI chat reply / image, for the owner dashboard's cost vs. revenue.
CREATE TABLE IF NOT EXISTS usage_log (
  id         BIGSERIAL PRIMARY KEY,
  wallet     TEXT,
  kind       TEXT NOT NULL,
  billed     BOOLEAN NOT NULL,
  cost_usd   NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
