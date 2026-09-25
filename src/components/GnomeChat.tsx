"use client";

import Link from "next/link";
import { usd } from "@/lib/money";
import { useRef, useState } from "react";
import WalletConnect, { type SessionInfo } from "./WalletConnect";
import type { Gnome } from "@/data/gnomes";

type Message = { role: "user" | "assistant"; content: string; image?: string };
type Stats = {
  freeMessagesRemaining: number;
  creditsAvailable: number;
  vipUntil: string | null;
};

const MAX_LEN = 500;

export default function GnomeChat({
  gnome,
  guestFree,
  picPrice,
}: {
  gnome: Gnome;
  guestFree: number;
  picPrice: number;
}) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `*looks you over with a grin* Well hello there... I'm ${gnome.name}. ${gnome.tagline}. What brings you my way?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [guestRemaining, setGuestRemaining] = useState(guestFree);
  const [gate, setGate] = useState<"guest" | "pic" | "credits" | null>(null);
  const [gateDetail, setGateDetail] = useState<string | null>(null);
  const [scene, setScene] = useState("");
  const [picPending, setPicPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });

  const requestPic = async () => {
    const text = scene.trim().slice(0, 300);
    if (!text || picPending) return;
    if (!session) {
      setGate("pic");
      scrollDown();
      return;
    }
    setPicPending(true);
    setGate(null);
    setMessages((cur) => [...cur, { role: "user", content: `Send me a pic: ${text}` }]);
    setScene("");
    scrollDown();
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gnomeId: gnome.id, scene: text, variant: Math.floor(Math.random() * 1000) }),
      });
      if (res.status === 403) {
        const data = await res.json();
        setGate("credits");
        setGateDetail(`Private pics cost ${usd(Number(data.required))} in credits — you have ${usd(Number(data.available))}.`);
        return;
      }
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      setMessages((cur) => [...cur, { role: "assistant", content: "*sends you a private pic*", image: url }]);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", content: "*camera jams* Ugh, try asking again." }]);
    } finally {
      setPicPending(false);
      scrollDown();
    }
  };

  const send = async () => {
    const text = input.trim().slice(0, MAX_LEN);
    if (!text || pending) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    setGate(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gnomeId: gnome.id,
          messages: next
            .filter((m) => !m.image)
            .slice(-40)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();

      if (res.status === 403 && data.error === "guest_limit") {
        setGuestRemaining(0);
        setGate("guest");
        return;
      }
      if (res.status === 403 && data.error === "insufficient_credits") {
        setGate("credits");
        setGateDetail(data.details);
        setStats(data.stats);
        return;
      }

      setMessages((cur) => [...cur, { role: "assistant", content: data.reply ?? "..." }]);
      if (data.stats) setStats(data.stats);
      if (typeof data.guestRemaining === "number") setGuestRemaining(data.guestRemaining);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", content: "*the connection fizzles out* Try again?" }]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    }
  };

  const statusText = session?.owner
    ? "Owner · unlimited"
    : session
      ? stats
        ? `${stats.vipUntil ? "VIP · " : ""}${
            stats.freeMessagesRemaining > 0
              ? `${stats.freeMessagesRemaining} free msgs left today`
              : `${usd(stats.creditsAvailable)} in credits`
          }`
        : "Free daily msgs with your wallet"
      : `${guestRemaining} free msgs left · no wallet needed`;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-left">
          <p className="text-sm font-bold text-white">{gnome.name}</p>
          <p className="text-[11px] text-pink-400">{statusText}</p>
        </div>
        <WalletConnect onConnected={(s) => setSession(s)} knownSession={session} compact />
      </div>

      <div ref={listRef} className="flex h-96 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-left text-sm ${
              m.role === "user" ? "self-end bg-pink-500 text-black" : "self-start bg-white/10 text-white"
            }`}
          >
            {m.content}
            {m.image && (
              // Blob URLs can't go through next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt={`Private pic from ${gnome.name}`} className="mt-2 w-full rounded-xl" />
            )}
          </div>
        ))}
        {picPending && (
          <div className="self-start rounded-2xl bg-white/10 px-4 py-2 text-sm text-neutral-400">
            {gnome.name} is taking a pic for you… (up to 30s)
          </div>
        )}
        {gate === "pic" && (
          <div className="flex flex-col items-center gap-3 self-center rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-4 text-center text-xs text-pink-200">
            <p>*{gnome.name} winks* Private pics need a connected wallet. Connect to unlock them.</p>
            <WalletConnect
              onConnected={(s) => {
                setSession(s);
                setGate(null);
              }}
            />
          </div>
        )}
        {pending && (
          <div className="self-start rounded-2xl bg-white/10 px-4 py-2 text-sm text-neutral-400">
            {gnome.name} is typing…
          </div>
        )}
        {gate === "guest" && (
          <div className="flex flex-col items-center gap-3 self-center rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-4 text-center text-xs text-pink-200">
            <p>
              *{gnome.name} pouts* That&apos;s all your free messages for today. Connect a wallet to
              keep going — more free messages daily, and VIP gets the most.
            </p>
            <WalletConnect
              onConnected={(s) => {
                setSession(s);
                setGate(null);
              }}
            />
          </div>
        )}
        {gate === "credits" && (
          <div className="self-center rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-center text-xs text-pink-300">
            {gateDetail}
            <div className="mt-2">
              <Link href="/credits" className="font-bold underline">
                Buy more credits →
              </Link>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
          placeholder={`Say something to ${gnome.name}...`}
          className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Send
        </button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          requestPic();
        }}
        className="flex items-center gap-2 border-t border-white/10 bg-black/20 p-3"
      >
        <input
          value={scene}
          onChange={(e) => setScene(e.target.value.slice(0, 300))}
          placeholder="Describe a private pic..."
          className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={picPending || !scene.trim()}
          className="whitespace-nowrap rounded-full bg-violet-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Get pic{!session?.owner && <span className="hidden sm:inline"> · {usd(picPrice)}</span>}
        </button>
      </form>
    </div>
  );
}
