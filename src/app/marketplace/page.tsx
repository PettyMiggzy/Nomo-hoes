"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { ensureChain, sendTokenTransfer } from "@/lib/walletTx";

type Listing = {
  id: number;
  title: string;
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

type Config = {
  treasury: `0x${string}` | null;
  token: `0x${string}` | null;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  pricing: { platformCutBps: number };
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

export default function MarketplacePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [unlocked, setUnlocked] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [vip, setVip] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const loadListings = () =>
    fetch("/api/marketplace/posts")
      .then((r) => r.json())
      .then((d) => {
        setListings(d.listings ?? []);
        setVip(Boolean(d.vip));
      })
      .catch(() => {});

  useEffect(() => {
    loadListings();
  }, []);

  // Pull the real image for anything this wallet can already see (bought,
  // VIP, own post) -- the server decides; the listing only has the teaser.
  useEffect(() => {
    for (const l of listings) {
      if (!l.unlocked || unlocked[l.id]) continue;
      fetch(`/api/marketplace/posts/${l.id}/image`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.imageUrl && setUnlocked((u) => ({ ...u, [l.id]: d.imageUrl })))
        .catch(() => {});
    }
  }, [listings, unlocked]);

  const loadConfig = async () => {
    const res = await fetch("/api/credits");
    if (res.ok) setConfig(await res.json());
  };

  const buy = async (listing: Listing) => {
    const eth = window.ethereum;
    if (!config || !session || !eth) return;
    if (!config.treasury || !config.token) {
      setStatus("Payments aren't configured yet.");
      return;
    }
    setBusy(listing.id);
    setStatus(null);
    try {
      // Mirrors src/lib/pricing.ts's splitSale() exactly, using the live
      // platformCutBps from the server so this never drifts from what the
      // purchase endpoint independently verifies.
      const bps = config.pricing.platformCutBps;
      const creatorCut = Math.round(((listing.priceNomo * (10000 - bps)) / 10000) * 1e6) / 1e6;
      const platformCut = Math.round((listing.priceNomo - creatorCut) * 1e6) / 1e6;

      await ensureChain(eth, config.chainId, config.chainName, config.explorerUrl);

      setStatus("Confirm the creator's payment in your wallet...");
      const creatorTxHash = await sendTokenTransfer(
        eth,
        session.wallet as `0x${string}`,
        config.token,
        listing.creatorWallet,
        creatorCut,
      );

      setStatus("Confirm the platform's payment in your wallet...");
      const treasuryTxHash = await sendTokenTransfer(
        eth,
        session.wallet as `0x${string}`,
        config.token,
        config.treasury,
        platformCut,
      );

      setStatus("Waiting for both payments to confirm on chain...");
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = await fetch("/api/marketplace/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: listing.id, creatorTxHash, treasuryTxHash }),
        });
        const data = await res.json();
        if (res.ok || data.imageUrl) {
          setUnlocked((u) => ({ ...u, [listing.id]: data.imageUrl }));
          setStatus(null);
          return;
        }
        if (res.status !== 409) {
          setStatus(data.error ?? "Something went wrong");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      setStatus("Still not confirmed. Your payment is safe — refresh and try again shortly.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Creator Marketplace</h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">
          Custom gnome scenes made by creators, not the house. Unlock one for NOMO.
        </p>

        {!session && (
          <div className="mt-6">
            <WalletConnect
              onConnected={(s) => {
                setSession(s);
                loadConfig();
                loadListings();
              }}
            />
          </div>
        )}

        {vip && (
          <p className="mt-4 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-300">
            👑 VIP: everything here is unlocked for you
          </p>
        )}

        {status && <p className="mt-4 max-w-md break-all text-xs text-neutral-300">{status}</p>}

        <div className="mt-10 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
              <div className="relative aspect-[3/4] w-full overflow-hidden">
                {unlocked[l.id] ? (
                  <button onClick={() => setViewing(unlocked[l.id])} className="absolute inset-0" aria-label={`Open ${l.title}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- paid blob URL */}
                    <img src={unlocked[l.id]} alt={l.title} className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <>
                    {l.teaserUrl ? (
                      // Server-blurred teaser: the real image never reaches the browser until it's unlocked.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.teaserUrl} alt="" className="h-full w-full scale-110 object-cover blur-sm" />
                    ) : (
                      <Image src={`/gnomes/${l.gnomeId}.webp`} alt={l.gnomeName} fill sizes="20vw" className="object-cover blur-md" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 p-2 text-center">
                      <span className="text-2xl">🔒</span>
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        18+ · {l.gnomeName}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3 text-left">
                <p className="truncate text-sm font-bold text-white">{l.title}</p>
                <div className="flex items-center gap-2">
                  {l.creatorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.creatorAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/30 text-[10px] font-black text-pink-200">
                      {l.creatorName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="truncate text-[11px] text-neutral-400">{l.creatorName}</p>
                </div>
                {unlocked[l.id] ? (
                  <button
                    onClick={() => setViewing(unlocked[l.id])}
                    className="mt-2 rounded-full bg-emerald-400 px-3 py-1.5 text-center text-xs font-bold text-black"
                  >
                    View
                  </button>
                ) : (
                  <button
                    disabled={!session || session.owner || busy === l.id}
                    onClick={() => buy(l)}
                    className="mt-2 rounded-full bg-pink-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === l.id ? "Processing..." : `Unlock — ${fmt(l.priceNomo)} NOMO`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {viewing && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setViewing(null)}
            role="dialog"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewing} alt="" className="max-h-full max-w-full rounded-lg" />
          </div>
        )}

        {listings.length === 0 && <p className="mt-16 text-neutral-500">No listings yet — be the first creator.</p>}
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>18+ only. Fictional AI-generated content. Purchases are non-refundable.</p>
        </div>
      </footer>
    </div>
  );
}
