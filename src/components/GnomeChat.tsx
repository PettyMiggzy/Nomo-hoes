"use client";

import { useRef, useState } from "react";
import WalletConnect from "./WalletConnect";
import type { Gnome } from "@/data/gnomes";

type Message = { role: "user" | "assistant"; content: string };
type Stats = {
  messagesUsed: number;
  freeMessagesRemaining: number;
  creditsAvailable: number;
  chargePerBatch: number;
  messagesPerBatch: number;
};

const MAX_LEN = 500;

export default function GnomeChat({ gnome }: { gnome: Gnome }) {
  const [connected, setConnected] = useState(false);
  const [owner, setOwner] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `*looks you over with a grin* Well hello there... I'm ${gnome.name}. ${gnome.tagline}. What brings you my way?` },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim().slice(0, MAX_LEN);
    if (!text || pending || !connected) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    setGateMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gnomeId: gnome.id, messages: next.slice(-40) }),
      });
      const data = await res.json();

      if (res.status === 403 && data.error === "insufficient_credits") {
        setGateMessage(data.details);
        setStats(data.stats);
        return;
      }

      setMessages((cur) => [...cur, { role: "assistant", content: data.reply ?? "..." }]);
      if (data.stats) setStats(data.stats);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", content: "*the connection fizzles out* Try again?" }]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    }
  };

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4">
      {!connected && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center">
          <p className="text-sm text-neutral-400">
            Connect your wallet to chat with {gnome.name}. Requires holding NOMO.
          </p>
          <WalletConnect
            onConnected={(s) => {
              setConnected(true);
              setOwner(s.owner);
            }}
          />
        </div>
      )}

      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-white">{gnome.name}</p>
            <p className="text-xs text-neutral-500">Fictional AI companion · 18+</p>
          </div>
          {owner && <p className="text-right text-[11px] text-pink-400">Owner · unlimited</p>}
          {!owner && stats && (
            <p className="text-right text-[11px] text-neutral-500">
              {stats.freeMessagesRemaining > 0
                ? `${stats.freeMessagesRemaining} free msgs left`
                : `${stats.creditsAvailable.toFixed(2)} NOMO credits`}
            </p>
          )}
        </div>

        <div ref={listRef} className="flex h-80 flex-col gap-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "self-end bg-pink-500 text-black" : "self-start bg-white/10 text-white"
              }`}
            >
              {m.content}
            </div>
          ))}
          {pending && (
            <div className="self-start rounded-2xl bg-white/10 px-4 py-2 text-sm text-neutral-400">
              {gnome.name} is typing…
            </div>
          )}
          {gateMessage && (
            <div className="self-center rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-center text-xs text-pink-300">
              {gateMessage}
              <div className="mt-2">
                <a href="/credits" className="font-bold underline">
                  Buy more credits →
                </a>
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
            placeholder={connected ? `Say something to ${gnome.name}...` : "Connect your wallet first"}
            disabled={!connected}
            className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !input.trim() || !connected}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
