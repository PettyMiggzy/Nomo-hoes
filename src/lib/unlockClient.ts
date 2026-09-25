"use client";

import { ensureChain, sendTokenTransfer, type EthProvider } from "@/lib/walletTx";

export type PayConfig = {
  treasury: `0x${string}` | null;
  token: `0x${string}` | null;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  pricing: { platformCutBps: number };
};

type Status = (msg: string | null) => void;

// Polls a purchase endpoint until the payment has enough confirmations
// (the server answers 409 until then). Returns the final JSON, or throws.
async function confirm(url: string, body: object, setStatus: Status): Promise<{ imageUrl?: string }> {
  setStatus("Waiting for your payment to confirm on chain...");
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok || data.imageUrl) return data;
    if (res.status !== 409) throw new Error(data.error ?? "Something went wrong");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Still not confirmed. Your payment is safe — refresh and try again shortly.");
}

function ready(config: PayConfig | null): asserts config is PayConfig & { treasury: `0x${string}`; token: `0x${string}` } {
  if (!config?.treasury || !config.token) throw new Error("Payments aren't configured yet.");
}

// Official premium item: one transfer of the full price to the treasury.
export async function unlockPremium(
  eth: EthProvider,
  wallet: string,
  config: PayConfig | null,
  item: { id: number; priceNomo: number },
  setStatus: Status,
): Promise<void> {
  ready(config);
  await ensureChain(eth, config.chainId, config.chainName, config.explorerUrl);
  setStatus("Confirm the payment in your wallet...");
  const txHash = await sendTokenTransfer(eth, wallet as `0x${string}`, config.token, config.treasury, item.priceNomo);
  await confirm("/api/premium/purchase", { itemId: item.id, txHash }, setStatus);
}

// Creator post: the creator's cut straight to them, the platform cut to the
// treasury. Mirrors src/lib/pricing.ts's splitSale() using the live bps.
export async function buyCreatorPost(
  eth: EthProvider,
  wallet: string,
  config: PayConfig | null,
  post: { id: number; priceNomo: number; creatorWallet: `0x${string}` },
  setStatus: Status,
): Promise<string | undefined> {
  ready(config);
  const bps = config.pricing.platformCutBps;
  const creatorCut = Math.round(((post.priceNomo * (10000 - bps)) / 10000) * 1e6) / 1e6;
  const platformCut = Math.round((post.priceNomo - creatorCut) * 1e6) / 1e6;

  await ensureChain(eth, config.chainId, config.chainName, config.explorerUrl);
  setStatus("Confirm the creator's payment in your wallet...");
  const creatorTxHash = await sendTokenTransfer(eth, wallet as `0x${string}`, config.token, post.creatorWallet, creatorCut);
  setStatus("Confirm the platform's payment in your wallet...");
  const treasuryTxHash = await sendTokenTransfer(eth, wallet as `0x${string}`, config.token, config.treasury, platformCut);
  const data = await confirm("/api/marketplace/purchase", { postId: post.id, creatorTxHash, treasuryTxHash }, setStatus);
  return data.imageUrl;
}

// DM bundle: `messages` at the creator's per-message price, split like a
// marketplace sale (creator's cut to them, platform cut to the treasury).
export async function buyDmBundle(
  eth: EthProvider,
  wallet: string,
  config: PayConfig | null,
  creatorWallet: `0x${string}`,
  priceNomo: number,
  messages: number,
  setStatus: Status,
): Promise<void> {
  ready(config);
  const total = Math.round(priceNomo * messages * 1e6) / 1e6;
  const bps = config.pricing.platformCutBps;
  const creatorCut = Math.round(((total * (10000 - bps)) / 10000) * 1e6) / 1e6;
  const platformCut = Math.round((total - creatorCut) * 1e6) / 1e6;

  await ensureChain(eth, config.chainId, config.chainName, config.explorerUrl);
  setStatus("Confirm the creator's payment in your wallet...");
  const creatorTxHash = await sendTokenTransfer(eth, wallet as `0x${string}`, config.token, creatorWallet, creatorCut);
  setStatus("Confirm the platform's payment in your wallet...");
  const treasuryTxHash = await sendTokenTransfer(eth, wallet as `0x${string}`, config.token, config.treasury, platformCut);
  await confirm("/api/dm/purchase", { creator: creatorWallet, messages, creatorTxHash, treasuryTxHash }, setStatus);
}
