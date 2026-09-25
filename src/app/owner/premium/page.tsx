"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";

type Item = {
  id: number;
  gnomeId: string;
  kind: "photo" | "clip";
  title: string;
  category: string | null;
  mediaUrl: string;
  teaserUrl: string;
  priceNomo: number;
  active: boolean;
};

export default function OwnerPremiumPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [revenue, setRevenue] = useState<{ sales: number; nomo: number } | null>(null);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch("/api/owner/premium");
    if (res.status === 403) {
      setError("Not signed in as owner.");
      return;
    }
    if (!res.ok) {
      setError("Couldn't load premium items.");
      return;
    }
    const data = await res.json();
    setItems(data.items);
    setRevenue(data.revenue);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const patch = async (id: number, body: { priceNomo?: number; active?: boolean; category?: string }) => {
    setBusy(id);
    try {
      await fetch("/api/owner/premium", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">Premium Content</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {revenue && (
          <p className="mb-6 text-sm text-neutral-400">
            {revenue.sales} unlocks · <span className="font-bold text-emerald-400">${revenue.nomo.toFixed(2)}</span> earned
          </p>
        )}
        {items && items.length === 0 && <p className="text-center text-neutral-500">No premium items yet.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          {items?.map((i) => (
            <div
              key={i.id}
              className={`flex gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-3 ${i.active ? "" : "opacity-50"}`}
            >
              <a href={i.mediaUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.teaserUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              </a>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-left text-xs">
                <p className="truncate text-sm font-bold text-white">{i.title}</p>
                <p className="text-neutral-500">
                  {i.gnomeId} · {i.kind}
                </p>
                <select
                  value={i.category ?? ""}
                  disabled={busy === i.id}
                  onChange={(e) => patch(i.id, { category: e.target.value })}
                  className="rounded border border-white/10 bg-black px-2 py-1 text-white"
                >
                  <option value="" disabled>
                    Category...
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    value={prices[i.id] ?? String(i.priceNomo)}
                    onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
                    className="w-20 rounded border border-white/10 bg-black px-2 py-1 text-white"
                    inputMode="decimal"
                  />
                  <span className="text-neutral-500">$</span>
                  <button
                    disabled={busy === i.id || !(Number(prices[i.id]) > 0)}
                    onClick={() => patch(i.id, { priceNomo: Number(prices[i.id]) })}
                    className="rounded-full bg-emerald-400 px-3 py-1 font-bold text-black disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <button
                  disabled={busy === i.id}
                  onClick={() => patch(i.id, { active: !i.active })}
                  className="self-start text-neutral-400 underline hover:text-white"
                >
                  {i.active ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
