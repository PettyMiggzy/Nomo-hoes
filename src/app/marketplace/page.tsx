"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { buyCreatorPost, unlockPremium, type PayConfig } from "@/lib/unlockClient";

// One grid mixes the house's own premium content with creator posts.
type Entry = {
  key: string;
  source: "official" | "creator";
  id: number;
  kind: "photo" | "clip";
  title: string;
  category: string | null;
  gnomeId: string;
  gnomeName: string;
  teaserUrl: string | null;
  priceNomo: number;
  createdAt: string;
  unlocked: boolean;
  creatorName: string;
  creatorAvatar: string | null;
  creatorWallet?: `0x${string}`;
};

type PremiumRow = {
  id: number;
  gnomeId: string;
  gnomeName: string;
  kind: "photo" | "clip";
  title: string;
  category: string | null;
  teaserUrl: string;
  priceNomo: number;
  createdAt: string;
  unlocked: boolean;
};

type ListingRow = {
  id: number;
  title: string;
  category: string | null;
  gnomeId: string;
  gnomeName: string;
  creatorName: string;
  creatorAvatar: string | null;
  creatorWallet: `0x${string}`;
  teaserUrl: string | null;
  priceNomo: number;
  createdAt: string;
  unlocked: boolean;
};

type Sort = "new" | "price-asc" | "price-desc";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

export default function MarketplacePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [vip, setVip] = useState(false);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [category, setCategory] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "photo" | "clip">("all");
  const [source, setSource] = useState<"all" | "official" | "creator">("all");
  const [gnome, setGnome] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      fetch("/api/premium").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/marketplace/posts").then((r) => (r.ok ? r.json() : { listings: [] })),
    ]);
    setVip(Boolean(p.vip || m.vip));
    setEntries([
      ...(p.items as PremiumRow[]).map(
        (i): Entry => ({
          ...i,
          key: `o${i.id}`,
          source: "official",
          creatorName: "NOMO HOES",
          creatorAvatar: "/icon.png",
        }),
      ),
      ...(m.listings as ListingRow[]).map((l): Entry => ({ ...l, key: `c${l.id}`, source: "creator", kind: "photo" })),
    ]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Real media only for what the server says this wallet can see.
  useEffect(() => {
    for (const e of entries) {
      if (!e.unlocked || media[e.key]) continue;
      const url = e.source === "official" ? `/api/premium/${e.id}` : `/api/marketplace/posts/${e.id}/image`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const src = d?.mediaUrl ?? d?.imageUrl;
          if (src) setMedia((m) => ({ ...m, [e.key]: src }));
        })
        .catch(() => {});
    }
  }, [entries, media]);

  const onConnected = (s: SessionInfo) => {
    setSession(s);
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setConfig(c))
      .catch(() => {});
    load();
  };

  const buy = async (e: Entry) => {
    const eth = window.ethereum;
    if (!session || !eth) return;
    setBusy(e.key);
    setStatus(null);
    try {
      if (e.source === "official") {
        await unlockPremium(eth, session.wallet, config, e, setStatus);
      } else if (e.creatorWallet) {
        const url = await buyCreatorPost(eth, session.wallet, config, { ...e, creatorWallet: e.creatorWallet }, setStatus);
        if (url) setMedia((m) => ({ ...m, [e.key]: url }));
      }
      setEntries((all) => all.map((x) => (x.key === e.key ? { ...x, unlocked: true } : x)));
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  // Counts ignore the category filter itself so the sidebar shows what each
  // category would give you with everything else applied.
  const base = useMemo(
    () =>
      entries.filter(
        (e) =>
          (kind === "all" || e.kind === kind) &&
          (source === "all" || e.source === source) &&
          (!gnome || e.gnomeId === gnome),
      ),
    [entries, kind, source, gnome],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of base) c[e.category ?? "other"] = (c[e.category ?? "other"] ?? 0) + 1;
    return c;
  }, [base]);
  const shown = useMemo(() => {
    const list = base.filter((e) => !category || e.category === category);
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.priceNomo - b.priceNomo);
    else if (sort === "price-desc") sorted.sort((a, b) => b.priceNomo - a.priceNomo);
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [base, category, sort]);

  const gnomes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) seen.set(e.gnomeId, e.gnomeName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const pill = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition ${
      active ? "bg-pink-500 font-bold text-black" : "text-neutral-300 hover:bg-white/5"
    }`;

  const sidebar = (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-neutral-500">Categories</p>
        <button className={pill(!category)} onClick={() => setCategory(null)}>
          <span>All</span>
          <span className="text-xs opacity-70">{base.length}</span>
        </button>
        {CATEGORIES.filter((c) => counts[c.id]).map((c) => (
          <button key={c.id} className={pill(category === c.id)} onClick={() => setCategory(c.id)}>
            <span>{c.label}</span>
            <span className="text-xs opacity-70">{counts[c.id]}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-neutral-500">Type</p>
        {(["all", "clip", "photo"] as const).map((k) => (
          <button key={k} className={pill(kind === k)} onClick={() => setKind(k)}>
            {k === "all" ? "Everything" : k === "clip" ? "▶ Clips" : "Photos"}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-neutral-500">From</p>
        {(["all", "official", "creator"] as const).map((s) => (
          <button key={s} className={pill(source === s)} onClick={() => setSource(s)}>
            {s === "all" ? "Everyone" : s === "official" ? "NOMO HOES Official" : "Creators"}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-neutral-500">Girls</p>
        <select
          value={gnome ?? ""}
          onChange={(e) => setGnome(e.target.value || null)}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-400"
        >
          <option value="">All girls</option>
          {gnomes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/creator" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            Become a Creator
          </Link>
          <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
            ← All Gnomes
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-24 pt-2 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Marketplace</h1>
          <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">
            Explicit photos and clips of every gnome, from us and from creators. Unlock with NOMO, keep forever.
          </p>
          {!session && (
            <div className="mt-6">
              <WalletConnect onConnected={onConnected} />
            </div>
          )}
          {vip && (
            <p className="mt-4 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-300">
              👑 VIP: everything here is unlocked for you
            </p>
          )}
          {status && <p className="mt-4 max-w-md break-all text-xs text-neutral-300">{status}</p>}
        </div>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-56 lg:shrink-0">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className="mb-3 w-full rounded-full border border-white/10 px-4 py-2 text-sm font-bold lg:hidden"
            >
              {filtersOpen ? "Hide filters" : `Filters${category ? ` · ${categoryLabel(category)}` : ""}`}
            </button>
            <div className={`${filtersOpen ? "block" : "hidden"} lg:sticky lg:top-6 lg:block`}>{sidebar}</div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-400">
                {shown.length} {shown.length === 1 ? "item" : "items"}
                {category ? ` in ${categoryLabel(category)}` : ""}
              </p>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="new">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((e) => {
                const src = media[e.key];
                return (
                  <div key={e.key} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
                    <button
                      className="relative aspect-square w-full overflow-hidden"
                      onClick={() => src && setViewing(e)}
                      disabled={!src}
                      aria-label={src ? `Open ${e.title}` : e.title}
                    >
                      {src && e.kind === "clip" ? (
                        <video src={src} className="h-full w-full object-cover" muted loop autoPlay playsInline />
                      ) : src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- paid blob URL
                        <img src={src} alt={e.title} className="h-full w-full object-cover" />
                      ) : (
                        <>
                          {/* Server-blurred teaser: the real file never reaches the browser until it's unlocked. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={e.teaserUrl ?? `/gnomes/${e.gnomeId}.webp`}
                            alt=""
                            className="h-full w-full scale-110 object-cover blur-md"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
                            <span className="text-2xl">🔒</span>
                          </div>
                        </>
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                        {e.kind === "clip" ? "▶ Clip" : "Photo"}
                      </span>
                      {e.category && (
                        <span className="absolute right-2 top-2 rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                          {categoryLabel(e.category)}
                        </span>
                      )}
                    </button>
                    <div className="flex flex-1 flex-col gap-1.5 p-3 text-left">
                      <p className="truncate text-sm font-bold text-white">
                        {e.gnomeName} · <span className="font-normal text-neutral-300">{e.title}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        {e.creatorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.creatorAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/30 text-[9px] font-black text-pink-200">
                            {e.creatorName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        {e.source === "creator" && e.creatorWallet ? (
                          <Link
                            href={`/creators/${e.creatorWallet}`}
                            className="truncate text-[11px] text-neutral-400 underline-offset-2 hover:text-pink-300 hover:underline"
                          >
                            {e.creatorName} · 💬
                          </Link>
                        ) : (
                          <p className="truncate text-[11px] text-neutral-400">{e.creatorName}</p>
                        )}
                      </div>
                      {e.unlocked ? (
                        <button
                          onClick={() => src && setViewing(e)}
                          className="mt-auto rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black"
                        >
                          View
                        </button>
                      ) : (
                        <button
                          disabled={!session || session.owner || !config || busy === e.key}
                          onClick={() => buy(e)}
                          className="mt-auto rounded-full bg-pink-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === e.key ? "Processing..." : `${session ? "Unlock — " : ""}${fmt(e.priceNomo)} NOMO`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {entries.length > 0 && shown.length === 0 && (
              <p className="mt-16 text-center text-neutral-500">Nothing matches those filters.</p>
            )}
            {entries.length === 0 && <p className="mt-16 text-center text-neutral-500">Loading...</p>}
          </section>
        </div>

        {viewing && media[viewing.key] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setViewing(null)}
            role="dialog"
          >
            {viewing.kind === "clip" ? (
              <video src={media[viewing.key]} className="max-h-full max-w-full rounded-lg" controls autoPlay loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media[viewing.key]} alt={viewing.title} className="max-h-full max-w-full rounded-lg" />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>18+ only. Fictional AI-generated adult characters. Purchases are non-refundable.</p>
        </div>
      </footer>
    </div>
  );
}
