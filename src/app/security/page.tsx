"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Check = { label: string; ok: boolean; detail: string };
type Summary = {
  address: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  totalSupply: string | null;
  holderCount: number | null;
  buyTax: number | null;
  sellTax: number | null;
  checks: Check[];
  reportUrl: string;
};
type TokenResult = { label: string; summary?: Summary; error?: string };

function TokenCard({ result }: { result: TokenResult }) {
  if (result.error || !result.summary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
        <p className="text-sm font-bold text-white">{result.label}</p>
        <p className="mt-1 text-xs text-red-400">{result.error ?? "Couldn't load a report."}</p>
      </div>
    );
  }
  const s = result.summary;
  const failed = s.checks.filter((c) => !c.ok);
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">
          {s.tokenName ?? result.label} <span className="text-neutral-500">({s.tokenSymbol ?? "?"})</span>
        </p>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
            failed.length === 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-400/20 text-amber-300"
          }`}
        >
          {failed.length === 0 ? "All clear" : `${failed.length} flag${failed.length > 1 ? "s" : ""}`}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-neutral-500">{s.address}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {s.checks.map((c) => (
          <div key={c.label} className="flex items-start gap-1.5" title={c.detail}>
            <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✓" : "✕"}</span>
            <span className={c.ok ? "text-neutral-300" : "text-red-300"}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        {s.holderCount !== null && <span>{s.holderCount} holders</span>}
        {s.totalSupply && <span>{s.totalSupply} supply</span>}
        {s.buyTax !== null && <span>{s.buyTax}% buy tax</span>}
        {s.sellTax !== null && <span>{s.sellTax}% sell tax</span>}
      </div>
      <a
        href={s.reportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-bold text-pink-400 hover:underline"
      >
        Full GoPlus report →
      </a>
    </div>
  );
}

export default function SecurityPage() {
  const [tokens, setTokens] = useState<TokenResult[] | null>(null);
  const [address, setAddress] = useState("");
  const [customResult, setCustomResult] = useState<TokenResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch("/api/security")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => setTokens([]));
  }, []);

  const checkCustom = async () => {
    if (!address.trim()) return;
    setChecking(true);
    setCustomResult(null);
    try {
      const res = await fetch(`/api/security?address=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setCustomResult({ label: "Token", error: data.error ?? "Lookup failed" });
      } else {
        setCustomResult(data.tokens[0]);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← All Gnomes
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-6 pb-24 pt-4 text-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
            Token Security
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Verify Before You Trust</h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm text-neutral-400">
            Live scans from GoPlus Security, the same scanner nomosupply.com links for its own tokens. Checked
            fresh on every visit, not a cached badge.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {tokens === null && <p className="text-neutral-500">Checking...</p>}
          {tokens?.map((t) => (
            <TokenCard key={t.label} result={t} />
          ))}
        </div>

        <section className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Check any Robinhood Chain token</p>
          <div className="flex gap-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-lg bg-white/5 px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              onClick={checkCustom}
              disabled={checking || !address.trim()}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? "Checking..." : "Check"}
            </button>
          </div>
          {customResult && <TokenCard result={customResult} />}
        </section>

        <p className="max-w-md text-[11px] text-neutral-500">
          These are automated contract scans, not financial advice or an independent audit. Green checks mean no
          flags were found by the scanner, not a guarantee of anything.
        </p>
      </main>
    </div>
  );
}
