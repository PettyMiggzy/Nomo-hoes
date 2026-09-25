"use client";

import { usd } from "@/lib/money";

// Everything on the site is bought with credits (1 credit = $1 USDG, topped
// up on /credits), so a purchase is one server call -- no wallet pop-ups.

export class NeedCredits extends Error {
  constructor(public required: number) {
    super(`You need ${usd(required)} in credits for that — top up on the Credits page.`);
  }
}

async function spend(url: string, body: object): Promise<{ imageUrl?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 402 && data.error === "insufficient_credits") throw new NeedCredits(Number(data.required));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

// House premium content: the full price stays in the pool.
export async function unlockPremium(item: { id: number }): Promise<void> {
  await spend("/api/premium/purchase", { itemId: item.id });
}

// Creator post: 80% to the creator's earnings, 20% platform.
export async function buyCreatorPost(post: { id: number }): Promise<string | undefined> {
  return (await spend("/api/marketplace/purchase", { postId: post.id })).imageUrl;
}

// DM bundle at the creator's per-message price, split the same way.
export async function buyDmBundle(creatorWallet: string, messages: number): Promise<void> {
  await spend("/api/dm/purchase", { creator: creatorWallet, messages });
}
