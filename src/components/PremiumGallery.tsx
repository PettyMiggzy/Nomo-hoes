"use client";

import { useCallback, useEffect, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { unlockPremium, type PayConfig } from "@/lib/unlockClient";

type Item = { id: number; kind: "photo" | "clip"; title: string; teaserUrl: string; priceNomo: number; unlocked: boolean };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

export default function PremiumGallery({ gnomeId, gnomeName }: { gnomeId: string; gnomeName: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [media, setMedia] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Item | null>(null);

  const load = useCallback(() => {
    fetch(`/api/premium?gnome=${gnomeId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, [gnomeId]);

  useEffect(load, [load]);

  // Fetch real media for anything this wallet has unlocked.
  useEffect(() => {
    for (const i of items) {
      if (!i.unlocked || media[i.id]) continue;
      fetch(`/api/premium/${i.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.mediaUrl && setMedia((m) => ({ ...m, [i.id]: d.mediaUrl })))
        .catch(() => {});
    }
  }, [items, media]);

  const onConnected = (s: SessionInfo) => {
    setSession(s);
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setConfig(c))
      .catch(() => {});
    load();
  };

  const unlock = async (item: Item) => {
    const eth = window.ethereum;
    if (!session || !eth) return;
    setBusy(item.id);
    setStatus(null);
    try {
      await unlockPremium(eth, session.wallet, config, item, setStatus);
      setItems((all) => all.map((i) => (i.id === item.id ? { ...i, unlocked: true } : i)));
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="mt-12 w-full text-left">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">
            {gnomeName}&apos;s Premium <span className="text-pink-400">🔥</span>
          </h2>
          <p className="text-xs text-neutral-500">Her most explicit photos and clips. Unlock once, keep forever.</p>
        </div>
        {!session && <WalletConnect compact onConnected={onConnected} />}
      </div>
      {status && <p className="mb-3 break-all text-xs text-neutral-300">{status}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const url = media[item.id];
          return (
            <div key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
              <button
                className="relative block aspect-square w-full"
                onClick={() => url && setViewing(item)}
                disabled={!url}
                aria-label={url ? `Open ${item.title}` : item.title}
              >
                {url && item.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={item.title} className="h-full w-full object-cover" />
                ) : url ? (
                  <video src={url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.teaserUrl} alt="" className="h-full w-full scale-110 object-cover blur-md" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
                      <span className="text-2xl">🔒</span>
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        {item.kind === "clip" ? "▶ Clip" : "Photo"} · 18+
                      </span>
                    </div>
                  </>
                )}
              </button>
              <div className="flex flex-col gap-1 p-3">
                <p className="truncate text-sm font-bold text-white">{item.title}</p>
                {!item.unlocked && (
                  <button
                    disabled={!session || session.owner || !config || busy === item.id}
                    onClick={() => unlock(item)}
                    className="mt-1 rounded-full bg-pink-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === item.id ? "Processing..." : session ? `Unlock — ${fmt(item.priceNomo)} NOMO` : `${fmt(item.priceNomo)} NOMO`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewing && media[viewing.id] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewing(null)}
          role="dialog"
        >
          {viewing.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media[viewing.id]} alt={viewing.title} className="max-h-full max-w-full rounded-lg" />
          ) : (
            <video src={media[viewing.id]} className="max-h-full max-w-full rounded-lg" controls autoPlay loop playsInline />
          )}
        </div>
      )}
    </section>
  );
}
