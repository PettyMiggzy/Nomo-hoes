"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { GNOMES } from "@/data/gnomes";
import { CATEGORIES } from "@/lib/categories";
import CreatorDmSettings from "@/components/CreatorDmSettings";
import CreatorOwnContent from "@/components/CreatorOwnContent";

type Pricing = { platformCutBps: number; creatorMinPriceNomo: number; nomoPerImage: number };
type Creator = { wallet: string; displayName: string; bio: string | null; avatarUrl: string | null };
type Post = {
  id: number;
  gnomeId: string;
  title: string;
  scene: string;
  priceNomo: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

export default function CreatorPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [creator, setCreator] = useState<Creator | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [earnings, setEarnings] = useState<{ sales: number; earnedNomo: number } | null>(null);
  const [dm, setDm] = useState<{ enabled: boolean; priceNomo: number | null } | null>(null);
  const [dmEarned, setDmEarned] = useState<{ bundles: number; earnedNomo: number } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [gnomeId, setGnomeId] = useState(GNOMES[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [scene, setScene] = useState("");
  const [price, setPrice] = useState(0);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const load = async () => {
    const [creatorRes, configRes] = await Promise.all([fetch("/api/creator"), fetch("/api/credits")]);
    if (creatorRes.ok) {
      const data = await creatorRes.json();
      setCreator(data.creator ?? null);
      setPosts(data.posts ?? []);
      setEarnings(data.earnings ?? null);
      setDm(data.dm ?? null);
      setDmEarned(data.dmEarnings ?? null);
    }
    if (configRes.ok) {
      const data = await configRes.json();
      setPricing(data.pricing);
      setPrice((p) => (p === 0 ? data.pricing.creatorMinPriceNomo : p));
    }
  };

  const signUp = async () => {
    setStatus(null);
    const res = await fetch("/api/creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, bio }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Something went wrong");
      return;
    }
    await load();
  };

  const submitPost = async () => {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/creator/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gnomeId, title, scene, category, priceNomo: price }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          data.error === "insufficient_credits"
            ? `You need ${data.required} NOMO in credits to generate (have ${data.available}). Buy some on the /credits page.`
            : (data.error ?? "Something went wrong"),
        );
        return;
      }
      setTitle("");
      setScene("");
      await load();
    } finally {
      setPending(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setStatus(null);
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch("/api/creator/avatar", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error ?? "Upload failed");
      return;
    }
    setCreator((c) => (c ? { ...c, avatarUrl: data.avatarUrl } : c));
  };

  const viewPreview = async (postId: number) => {
    const res = await fetch(`/api/marketplace/posts/${postId}/image`);
    if (res.ok) {
      const data = await res.json();
      setPreviews((p) => ({ ...p, [postId]: data.imageUrl }));
    }
  };

  useEffect(() => {
    if (session && !session.owner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
  }, [session]);

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/marketplace" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← Marketplace
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-6 pb-24 pt-4 text-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
            Creator Studio
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Your Content, Your Business</h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm text-neutral-400">
            Post your own photos &amp; videos or AI gnome scenes, sell paid DMs, set your prices — you keep {pricing ? 100 - pricing.platformCutBps / 100 : "most"}% of
            every sale — paid straight to your wallet, on chain, the moment someone buys.
          </p>
        </div>

        {!session ? (
          <WalletConnect onConnected={setSession} />
        ) : session.owner ? (
          <p className="text-sm text-pink-400">Owner accounts can&apos;t sell content.</p>
        ) : creator === undefined ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : creator === null ? (
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-left">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-normal normal-case text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Bio (optional)
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-normal normal-case text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </label>
            <button
              disabled={!displayName.trim()}
              onClick={signUp}
              className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
            >
              Become a Creator
            </button>
            {status && <p className="text-xs text-red-400">{status}</p>}
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3">
              {creator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/30 text-lg font-black text-pink-200">
                  {creator.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-left text-sm">
                <span className="block font-bold text-white">{creator.displayName}</span>
                <span className="text-xs text-emerald-400">{creator.avatarUrl ? "Change" : "Add"} profile pic</span>
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            </label>

            {earnings && (
              <div className="flex w-full max-w-sm justify-center gap-6 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <div>
                  <p className="text-xl font-black text-emerald-400">{earnings.sales}</p>
                  <p className="text-[11px] text-neutral-500">Sales</p>
                </div>
                <div>
                  <p className="text-xl font-black text-emerald-400">{fmt(earnings.earnedNomo)}</p>
                  <p className="text-[11px] text-neutral-500">NOMO Earned</p>
                </div>
              </div>
            )}

            {pricing && (
              <CreatorDmSettings
                key={creator.wallet}
                wallet={creator.wallet}
                initial={dm}
                earnings={dmEarned}
                cutPercent={pricing.platformCutBps / 100}
              />
            )}

            {pricing && <CreatorOwnContent wallet={creator.wallet} minPrice={pricing.creatorMinPriceNomo} />}

            <section className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">New AI gnome post</p>
              <select
                value={gnomeId}
                onChange={(e) => setGnomeId(e.target.value)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {GNOMES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <textarea
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                placeholder="Describe the scene..."
                rows={3}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Price (NOMO)
                <input
                  type="number"
                  min={pricing?.creatorMinPriceNomo ?? 0}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(Math.max(pricing?.creatorMinPriceNomo ?? 0, Number(e.target.value)))}
                  className="rounded-lg bg-white/5 px-4 py-2 text-sm font-normal normal-case text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </label>
              <button
                disabled={pending || !title.trim() || !scene.trim() || !pricing}
                onClick={submitPost}
                className="rounded-full bg-pink-500 px-6 py-3 text-sm font-black text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Generating..." : `Generate & Submit (${pricing ? fmt(pricing.nomoPerImage) : "..."} NOMO)`}
              </button>
              {status && <p className="text-xs text-red-400">{status}</p>}
            </section>

            <section className="flex w-full flex-col gap-3">
              <p className="text-left text-xs font-bold uppercase tracking-widest text-neutral-400">Your posts</p>
              {posts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/60 p-3 text-left">
                  {previews[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private blob URL, arbitrary content
                    <img src={previews[p.id]} alt={p.title} className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <button
                      onClick={() => viewPreview(p.id)}
                      className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-white/20 text-[10px] text-neutral-500"
                    >
                      View
                    </button>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{p.title}</p>
                    <p className="text-xs text-neutral-500">{fmt(p.priceNomo)} NOMO</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      p.status === "approved"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : p.status === "rejected"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-400/20 text-amber-300"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
              {posts.length === 0 && <p className="text-sm text-neutral-500">No posts yet.</p>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
