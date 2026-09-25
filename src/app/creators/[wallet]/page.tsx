"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { categoryLabel } from "@/lib/categories";
import { buyDmBundle, NeedCredits } from "@/lib/unlockClient";
import { usd } from "@/lib/money";
import ReportButton from "@/components/ReportButton";

type Profile = {
  creator: { wallet: `0x${string}`; displayName: string; bio: string | null; avatarUrl: string | null };
  dm: { priceNomo: number; bundles: number[] } | null;
  posts: { id: number; title: string; category: string | null; gnomeName: string; teaserUrl: string | null; priceNomo: number }[];
};


export default function CreatorProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [needTopUp, setNeedTopUp] = useState(false);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/creators/${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [wallet]);

  const refreshLeft = (fan: string) =>
    fetch(`/api/dm/thread?creator=${wallet}&fan=${fan}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLeft(d.messagesLeft))
      .catch(() => {});

  const onConnected = (s: SessionInfo) => {
    setSession(s);
    if (!s.owner) refreshLeft(s.wallet);
  };

  const buy = async (messages: number) => {
    if (!session || !profile?.dm) return;
    setBusy(messages);
    setStatus(null);
    setNeedTopUp(false);
    try {
      await buyDmBundle(profile.creator.wallet, messages);
      await refreshLeft(session.wallet);
      router.push(`/messages?creator=${profile.creator.wallet}`);
    } catch (e) {
      setNeedTopUp(e instanceof NeedCredits);
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (profile === undefined) return <p className="p-10 text-center text-neutral-500">Loading...</p>;
  if (profile === null) return <p className="p-10 text-center text-neutral-500">Creator not found.</p>;

  const { creator, dm, posts } = profile;
  const isSelf = session?.wallet.toLowerCase() === creator.wallet.toLowerCase();

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <div className="flex gap-4">
          <Link href="/messages" className="text-sm font-semibold text-pink-400 hover:text-pink-300">
            Messages
          </Link>
          <Link href="/marketplace" className="text-sm font-semibold text-neutral-400 hover:text-white">
            ← Marketplace
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 pb-24 text-center sm:px-6">
        {creator.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatarUrl} alt="" className="h-28 w-28 rounded-full border-2 border-pink-500/40 object-cover" />
        ) : (
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-pink-500/30 text-4xl font-black text-pink-200">
            {creator.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <h1 className="mt-4 text-3xl font-black tracking-tight">{creator.displayName}</h1>
        {creator.bio && <p className="mx-auto mt-2 max-w-md text-balance text-neutral-400">{creator.bio}</p>}
        <ReportButton target="creator" targetId={creator.wallet} className="mt-2" />

        <section className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
          {!dm ? (
            <p className="text-sm text-neutral-500">{creator.displayName} isn&apos;t taking messages right now.</p>
          ) : isSelf ? (
            <p className="text-sm text-neutral-400">
              Fans pay {usd(dm.priceNomo)} per message to DM you.{" "}
              <Link href="/messages" className="text-pink-400 underline">
                Open your inbox
              </Link>
            </p>
          ) : (
            <>
              <p className="text-lg font-black text-white">💬 Message {creator.displayName}</p>
              <p className="mt-1 text-sm text-neutral-400">
                {usd(dm.priceNomo)} per message · they reply personally
              </p>
              {!session ? (
                <div className="mt-4 flex justify-center">
                  <WalletConnect onConnected={onConnected} />
                </div>
              ) : session.owner ? (
                <p className="mt-4 text-xs text-neutral-500">Sign in with a wallet to message creators.</p>
              ) : (
                <>
                  {left > 0 && (
                    <Link
                      href={`/messages?creator=${creator.wallet}`}
                      className="mt-4 inline-block rounded-full bg-emerald-400 px-5 py-2 text-sm font-black text-black"
                    >
                      Continue chat · {left} left
                    </Link>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {dm.bundles.map((n) => (
                      <button
                        key={n}
                        disabled={busy !== null}
                        onClick={() => buy(n)}
                        className="flex flex-col items-center rounded-xl border border-pink-500/40 bg-pink-500/10 px-2 py-3 transition hover:bg-pink-500/20 disabled:opacity-40"
                      >
                        <span className="text-lg font-black text-white">{n}</span>
                        <span className="text-[11px] text-neutral-400">messages</span>
                        <span className="mt-1 text-xs font-bold text-pink-300">
                          {busy === n ? "..." : usd(Math.round(dm.priceNomo * n * 1e6) / 1e6)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {status && (
                <p className="mt-3 text-xs text-neutral-300">
                  {status}{" "}
                  {needTopUp && (
                    <Link href="/credits" className="font-bold text-pink-400 underline">
                      Top up →
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </section>

        {posts.length > 0 && (
          <section className="mt-10 w-full text-left">
            <h2 className="mb-3 text-xl font-black">Posts</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href="/marketplace"
                  className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60"
                >
                  <div className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.teaserUrl ?? ""} alt="" className="h-full w-full scale-110 object-cover blur-md" />
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">🔒</span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold text-white">{p.title}</p>
                    <p className="text-[11px] text-neutral-500">
                      {p.gnomeName} · {categoryLabel(p.category)} · {usd(p.priceNomo)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
