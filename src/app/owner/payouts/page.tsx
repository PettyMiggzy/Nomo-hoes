"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usd } from "@/lib/money";

type Payout = {
  id: number;
  wallet: string;
  amount: number;
  payoutWallet: string;
  status: "pending" | "paid" | "rejected";
  txHash: string | null;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
type Pool = {
  treasury: string | null;
  usdgInPool: number | null;
  creatorsOwed: number;
  creatorEarnings: number;
  pendingPayouts: number;
  paidOut: number;
  platformShare: number | null;
};

const EXPLORER = "https://robinhoodchain.blockscout.com";

export default function OwnerPayoutsPage() {
  const [data, setData] = useState<{ pending: Payout[]; recent: Payout[]; pool: Pool } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/payouts");
    if (res.status === 403) return setError("Not signed in as owner.");
    if (!res.ok) return setError("Couldn't load payouts.");
    setData(await res.json());
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const act = async (p: Payout, action: "paid" | "reject") => {
    let note: string | null = null;
    if (action === "reject") {
      note = prompt("Reason (shown to the creator; their credits are returned):", "");
      if (note === null) return;
    }
    setBusy(p.id);
    setMsg((m) => ({ ...m, [p.id]: "" }));
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, action, txHash: tx[p.id]?.trim(), note }),
      });
      const d = await res.json();
      if (!res.ok) setMsg((m) => ({ ...m, [p.id]: d.error ?? "Failed" }));
      else await load();
    } finally {
      setBusy(null);
    }
  };

  const pool = data?.pool;

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">Pool &amp; Payouts</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

        {pool && (
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "USDG in pool", value: pool.usdgInPool === null ? "—" : usd(pool.usdgInPool), tone: "text-white" },
              { label: "Owed to creators", value: usd(pool.creatorsOwed), tone: "text-amber-300" },
              { label: "Yours to spend", value: pool.platformShare === null ? "—" : usd(pool.platformShare), tone: "text-emerald-300" },
              { label: "Paid out so far", value: usd(pool.paidOut), tone: "text-neutral-300" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{c.label}</p>
                <p className={`mt-1 text-xl font-black ${c.tone}`}>{c.value}</p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
              &quot;Owed to creators&quot; is their unpaid earnings ({usd(pool.creatorEarnings)}) plus pending cash-outs (
              {usd(pool.pendingPayouts)}). Only spend &quot;Yours to spend&quot; on buybacks — the rest belongs to creators.
              {pool.treasury && (
                <>
                  {" "}
                  Pool wallet:{" "}
                  <a href={`${EXPLORER}/address/${pool.treasury}`} target="_blank" rel="noopener noreferrer" className="underline">
                    {pool.treasury}
                  </a>
                </>
              )}
            </p>
          </section>
        )}

        <h2 className="mb-3 text-lg font-black">Pending cash-outs</h2>
        <p className="mb-4 text-sm text-neutral-400">
          Send the exact USDG amount to the payout wallet from any wallet you like, then paste the transaction hash — it&apos;s
          checked on chain before the payout is marked paid. The creator&apos;s credits were already taken off their balance
          when they requested it.
        </p>
        {data && data.pending.length === 0 && <p className="text-center text-neutral-500">No pending cash-outs.</p>}
        <div className="flex flex-col gap-3">
          {data?.pending.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 text-left text-sm">
              <p className="text-lg font-black text-white">{usd(p.amount)} USDG</p>
              <p className="text-neutral-400">
                Send to <span className="font-mono text-xs text-white">{p.payoutWallet}</span>
              </p>
              <p className="text-xs text-neutral-500">
                Creator{" "}
                <Link href={`/creators/${p.wallet}`} className="underline">
                  {p.wallet}
                </Link>{" "}
                · requested {new Date(p.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={tx[p.id] ?? ""}
                  onChange={(e) => setTx((t) => ({ ...t, [p.id]: e.target.value }))}
                  placeholder="0x… payout transaction hash"
                  className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white focus:outline-none"
                />
                <button
                  disabled={busy === p.id || !tx[p.id]?.trim()}
                  onClick={() => act(p, "paid")}
                  className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black disabled:opacity-40"
                >
                  Mark paid
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => act(p, "reject")}
                  className="rounded-full border border-red-500/50 px-4 py-1.5 text-xs font-bold text-red-300 disabled:opacity-40"
                >
                  Reject &amp; refund
                </button>
              </div>
              {msg[p.id] && <p className="mt-2 text-xs text-red-300">{msg[p.id]}</p>}
            </div>
          ))}
        </div>

        {data && data.recent.length > 0 && (
          <>
            <h2 className="mb-3 mt-10 text-lg font-black">History</h2>
            <div className="flex flex-col gap-1 text-xs">
              {data.recent.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-neutral-900/60 px-3 py-2">
                  <span className="text-neutral-300">
                    {usd(p.amount)} → <span className="font-mono">{p.payoutWallet.slice(0, 10)}…</span>
                  </span>
                  {p.status === "paid" && p.txHash ? (
                    <a href={`${EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline">
                      paid
                    </a>
                  ) : (
                    <span className="text-red-300">rejected{p.note ? ` — ${p.note}` : ""}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
