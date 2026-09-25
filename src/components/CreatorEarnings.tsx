"use client";

import { useCallback, useEffect, useState } from "react";
import { usd } from "@/lib/money";

type Payout = { id: number; amount: number; payoutWallet: string; status: "pending" | "paid" | "rejected"; txHash: string | null; note: string | null; createdAt: string };
type Earnings = { balance: number; lifetime: number; payoutWallet: string; payouts: Payout[]; minCashout: number };

const short = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;

// Creator studio: earned credits (their 80% of every sale), where cash-outs
// go, and the cash-out button. Requesting takes the credits off the balance
// immediately; the owner then sends the USDG.
export default function CreatorEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/creator/earnings");
    if (!res.ok) return;
    const d: Earnings = await res.json();
    setData(d);
    setWallet(d.payoutWallet);
    setAmount(String(Math.floor(d.balance * 100) / 100));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const post = async (url: string, body: object, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      setMsg(res.ok ? done : (d.error ?? "Something went wrong"));
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const canCashOut = data.balance >= data.minCashout;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 text-left">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Earnings &amp; cash out</p>
      <div className="flex gap-6">
        <div>
          <p className="text-2xl font-black text-white">{usd(data.balance)}</p>
          <p className="text-[11px] text-neutral-500">Available to cash out</p>
        </div>
        <div>
          <p className="text-2xl font-black text-neutral-300">{usd(data.lifetime)}</p>
          <p className="text-[11px] text-neutral-500">Earned all-time</p>
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        You keep 80% of every sale and DM bundle. Cash out 1:1 in USDG on Robinhood Chain (minimum {usd(data.minCashout)}) —
        the amount is set aside the moment you request it and sent to your payout wallet, usually within a day or two.
      </p>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Payout wallet
        <div className="flex gap-2">
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <button
            disabled={busy || wallet.toLowerCase() === data.payoutWallet.toLowerCase()}
            onClick={() => post("/api/creator/earnings", { payoutWallet: wallet }, "Payout wallet saved.")}
            className="rounded-full border border-emerald-400/50 px-3 py-1 text-xs font-bold text-emerald-300 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-400">$</span>
        <input
          type="number"
          min={data.minCashout}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          disabled={busy || !canCashOut || !(Number(amount) >= data.minCashout) || Number(amount) > data.balance + 1e-9}
          onClick={() => post("/api/creator/cashout", { amount: Number(amount) }, "Cash-out requested — the credits are set aside for your payout.")}
          className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
        >
          Cash out
        </button>
      </div>
      {!canCashOut && <p className="text-[11px] text-neutral-500">You can cash out once you&apos;ve earned {usd(data.minCashout)}.</p>}
      {msg && <p className="text-xs text-neutral-300">{msg}</p>}

      {data.payouts.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Cash-outs</p>
          {data.payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">
                {usd(p.amount)} → {short(p.payoutWallet)}
              </span>
              <span
                className={
                  p.status === "paid" ? "text-emerald-300" : p.status === "rejected" ? "text-red-300" : "text-amber-300"
                }
              >
                {p.status === "paid" && p.txHash ? (
                  <a href={`https://robinhoodchain.blockscout.com/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                    paid
                  </a>
                ) : p.status === "rejected" ? (
                  `returned${p.note ? ` — ${p.note}` : ""}`
                ) : (
                  "pending"
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
