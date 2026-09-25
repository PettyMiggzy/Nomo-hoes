"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import DmChat from "@/components/DmChat";

type Thread = {
  creatorWallet: string;
  fanWallet: string;
  messagesLeft: number;
  lastMessageAt: string;
  unread: number;
  peerName: string | null;
  peerAvatar: string | null;
  lastBody: string | null;
};

const short = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;

export default function MessagesPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [threads, setThreads] = useState<{ asCreator: Thread[]; asFan: Thread[] } | null>(null);
  const [tab, setTab] = useState<"fan" | "creator">("fan");
  const [open, setOpen] = useState<{ creator: string; fan: string; asCreator: boolean; name: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dm");
    if (res.ok) setThreads(await res.json());
  }, []);

  useEffect(() => {
    if (!session || session.owner) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [session, load]);

  // Deep link from a creator's page: /messages?creator=0x...
  useEffect(() => {
    if (!session || session.owner || !threads) return;
    const creator = new URLSearchParams(window.location.search).get("creator")?.toLowerCase();
    if (!creator || open) return;
    const t = threads.asFan.find((x) => x.creatorWallet === creator);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setOpen({ creator: t.creatorWallet, fan: t.fanWallet, asCreator: false, name: t.peerName ?? short(creator) });
  }, [session, threads, open]);

  useEffect(() => {
    // Creators with an inbox but no purchases land on their inbox.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (threads && threads.asFan.length === 0 && threads.asCreator.length > 0) setTab("creator");
  }, [threads]);

  const list = tab === "fan" ? threads?.asFan : threads?.asCreator;
  const unread = (ts?: Thread[]) => ts?.reduce((n, t) => n + t.unread, 0) ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/marketplace" className="text-sm font-semibold text-neutral-400 hover:text-white">
          Marketplace
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight">Messages</h1>

        {!session ? (
          <div className="mt-6">
            <WalletConnect onConnected={setSession} />
          </div>
        ) : session.owner ? (
          <p className="mt-6 text-sm text-neutral-400">Sign in with a wallet to use messages.</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
            <div className={`${open ? "hidden md:block" : ""}`}>
              <div className="mb-3 flex gap-2">
                {(["fan", "creator"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                      tab === t ? "bg-pink-500 text-black" : "border border-white/10 text-neutral-300"
                    }`}
                  >
                    {t === "fan" ? "My chats" : "Creator inbox"}
                    {unread(t === "fan" ? threads?.asFan : threads?.asCreator) > 0 &&
                      ` (${unread(t === "fan" ? threads?.asFan : threads?.asCreator)})`}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {list?.map((t) => {
                  const peer = tab === "fan" ? t.creatorWallet : t.fanWallet;
                  const name = t.peerName ?? short(peer);
                  const active = open?.creator === t.creatorWallet && open?.fan === t.fanWallet;
                  return (
                    <button
                      key={`${t.creatorWallet}-${t.fanWallet}`}
                      onClick={() => setOpen({ creator: t.creatorWallet, fan: t.fanWallet, asCreator: tab === "creator", name })}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left ${
                        active ? "border-pink-500/60 bg-pink-500/10" : "border-white/10 bg-neutral-900/60 hover:bg-white/5"
                      }`}
                    >
                      {t.peerAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.peerAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-500/30 text-sm font-black text-pink-200">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{name}</span>
                        <span className="block truncate text-xs text-neutral-500">{t.lastBody ?? "No messages yet"}</span>
                      </span>
                      {t.unread > 0 && (
                        <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-black text-black">{t.unread}</span>
                      )}
                    </button>
                  );
                })}
                {list && list.length === 0 && (
                  <p className="p-4 text-center text-sm text-neutral-500">
                    {tab === "fan" ? (
                      <>
                        No chats yet. Find a creator on the{" "}
                        <Link href="/marketplace" className="text-pink-400 underline">
                          marketplace
                        </Link>
                        .
                      </>
                    ) : (
                      "No fans have messaged you yet."
                    )}
                  </p>
                )}
              </div>
            </div>

            <div>
              {open ? (
                <>
                  <button onClick={() => setOpen(null)} className="mb-2 text-sm text-neutral-400 md:hidden">
                    ← Back
                  </button>
                  <DmChat
                    key={`${open.creator}-${open.fan}`}
                    creator={open.creator}
                    fan={open.fan}
                    asCreator={open.asCreator}
                    peerName={open.name}
                  />
                </>
              ) : (
                <div className="hidden h-96 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-neutral-500 md:flex">
                  Pick a conversation
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <p className="text-center text-xs text-neutral-500">
          18+ only. Be respectful — no harassment, no sharing anyone&apos;s personal info, no links to scams.
        </p>
      </footer>
    </div>
  );
}
