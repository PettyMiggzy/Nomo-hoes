"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  freeMessages: number;
  paidMessages: number;
  freeImages: number;
  paidImages: number;
  costUsd: number;
  nomoRevenue: number;
  usdRevenue: number;
  vipActivations: number;
  venice: { usd: number | null; diem: number | null } | null;
};

const LOW_BALANCE_USD = 5;

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OwnerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/stats");
    if (res.status === 403) {
      setError("Not signed in as owner.");
      return;
    }
    if (!res.ok) {
      setError("Couldn't load stats.");
      return;
    }
    setStats(await res.json());
    setUpdatedAt(new Date());
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const profit = stats ? stats.usdRevenue - stats.costUsd : 0;
  const totalMessages = stats ? stats.freeMessages + stats.paidMessages : 0;
  const totalImages = stats ? stats.freeImages + stats.paidImages : 0;

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Profit Dashboard</h1>
            <p className="text-xs text-neutral-500">Today (UTC), updates every 30s</p>
          </div>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

        {stats && (
          <div className="flex flex-col gap-4">
            <div
              className={`rounded-2xl border p-6 text-center ${
                profit >= 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Revenue − Venice Cost
              </p>
              <p className={`mt-1 text-4xl font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {profit >= 0 ? "+" : ""}
                {usd(profit)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-pink-400">Revenue</p>
                <p className="mt-1 text-2xl font-black text-white">{usd(stats.usdRevenue)}</p>
                <p className="text-xs text-neutral-500">
                  {stats.nomoRevenue.toLocaleString("en-US", { maximumFractionDigits: 4 })} NOMO ·{" "}
                  {stats.vipActivations} VIP
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Venice Cost</p>
                <p className="mt-1 text-2xl font-black text-white">{usd(stats.costUsd)}</p>
                <p className="text-xs text-neutral-500">chat + images, actual spend</p>
              </div>
            </div>

            {stats.venice && (stats.venice.usd !== null || stats.venice.diem !== null) && (
              <div
                className={`rounded-2xl border p-5 ${
                  stats.venice.usd !== null && stats.venice.usd < LOW_BALANCE_USD
                    ? "border-red-500/40 bg-red-500/10"
                    : "border-white/10 bg-neutral-900/60"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Venice Balance</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {stats.venice.usd !== null ? usd(stats.venice.usd) : "—"}
                </p>
                <p className="text-xs text-neutral-500">
                  {stats.venice.diem !== null ? `+ ${stats.venice.diem.toFixed(2)} DIEM today` : "USD credits"}
                </p>
                {stats.venice.usd !== null && stats.venice.usd < LOW_BALANCE_USD && (
                  <p className="mt-2 text-xs font-bold text-red-300">Running low — top up at venice.ai/settings/api</p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-400">Usage split</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-400">Messages</p>
                  <p className="font-bold text-white">{totalMessages} total</p>
                  <p className="text-xs text-neutral-500">
                    {stats.freeMessages} free · {stats.paidMessages} paid
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Images</p>
                  <p className="font-bold text-white">{totalImages} total</p>
                  <p className="text-xs text-neutral-500">
                    {stats.freeImages} free · {stats.paidImages} paid
                  </p>
                </div>
              </div>
            </div>

            {updatedAt && (
              <p className="text-center text-[11px] text-neutral-600">
                Last updated {updatedAt.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {!stats && !error && <p className="text-center text-neutral-500">Loading...</p>}
      </div>
    </div>
  );
}
