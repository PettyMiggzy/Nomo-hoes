"use client";

import Link from "next/link";
import { useState } from "react";
import WalletConnect from "@/components/WalletConnect";

export default function CreditsPage() {
  const [connected, setConnected] = useState(false);
  const [amount, setAmount] = useState(5);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const buy = async () => {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomoAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Purchase failed");
        return;
      }
      setStatus(`Success! You now have ${data.creditsAvailable.toFixed(2)} NOMO credits.`);
    } catch {
      setStatus("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← All Gnomes
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
          Credits
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Buy NOMO Credits</h1>
        <p className="mx-auto mt-3 max-w-sm text-balance text-neutral-400">
          10 free messages per gnome, per day. After that: 0.2 NOMO per 20
          messages, or 0.5 NOMO per unlocked image.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
          {!connected ? (
            <>
              <p className="text-sm text-neutral-400">Connect your wallet to buy credits.</p>
              <WalletConnect onConnected={() => setConnected(true)} />
            </>
          ) : (
            <>
              <label className="flex w-full flex-col gap-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Amount (NOMO)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className="rounded-lg bg-white/5 px-4 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </label>
              <button
                onClick={buy}
                disabled={pending}
                className="w-full rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Processing..." : `Buy ${amount} NOMO Credits`}
              </button>
              {status && <p className="text-xs text-neutral-300">{status}</p>}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>18+ only. NOMO credits are non-refundable and have no cash value outside this platform.</p>
        </div>
      </footer>
    </div>
  );
}
