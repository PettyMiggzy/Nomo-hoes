"use client";

import Link from "next/link";
import { useState } from "react";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

// Creator studio card: turn paid DMs on/off, set the per-message price, and
// see what DMs have earned. The 80/20 split happens on chain at purchase.
export default function CreatorDmSettings({
  wallet,
  initial,
  earnings,
  cutPercent,
}: {
  wallet: string;
  initial: { enabled: boolean; priceNomo: number | null } | null;
  earnings: { bundles: number; earnedNomo: number } | null;
  cutPercent: number;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [price, setPrice] = useState(String(initial?.priceNomo ?? 0.01));
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (nextEnabled = enabled) => {
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch("/api/creator/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, priceNomo: Number(price) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaved(data.error ?? "Couldn't save");
        return;
      }
      setEnabled(nextEnabled);
      setSaved("Saved");
    } finally {
      setBusy(false);
    }
  };

  const perMsg = Number(price) || 0;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Paid messages</p>
        <Link href="/messages" className="text-xs font-bold text-pink-400 hover:text-pink-300">
          Open inbox →
        </Link>
      </div>
      <p className="text-sm text-neutral-400">
        Fans pay per message to DM you, and you reply yourself. You keep {100 - cutPercent}% — it lands in your wallet the
        moment they pay. Replies are free for you.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => save(e.target.checked)}
            className="h-4 w-4 accent-pink-500"
          />
          Accept paid DMs
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="number"
            min={0}
            step={0.001}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded-lg bg-white/5 px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          NOMO / message
        </label>
        <button
          disabled={busy || !(perMsg > 0)}
          onClick={() => save()}
          className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-black text-black disabled:opacity-40"
        >
          Save price
        </button>
        {saved && <span className="text-xs text-neutral-400">{saved}</span>}
      </div>
      {perMsg > 0 && (
        <p className="text-xs text-neutral-500">
          You earn {fmt(perMsg * (1 - cutPercent / 100))} NOMO per message.
          {earnings && ` So far: ${earnings.bundles} bundles sold, ${fmt(earnings.earnedNomo)} NOMO earned from DMs.`}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Your public page:{" "}
        <Link href={`/creators/${wallet}`} className="text-pink-400 underline">
          /creators/{wallet.slice(0, 6)}…{wallet.slice(-4)}
        </Link>
      </p>
    </section>
  );
}
