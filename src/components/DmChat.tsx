"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Msg = { id: number; fromCreator: boolean; body: string; createdAt: string };

// One creator<->fan conversation. Polls for new messages; a fan's send
// spends one prepaid message, a creator's reply is free.
export default function DmChat({
  creator,
  fan,
  asCreator,
  peerName,
}: {
  creator: string;
  fan: string;
  asCreator: boolean;
  peerName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    lastId.current = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/dm/thread?creator=${creator}&fan=${fan}&after=${lastId.current}`);
        if (!res.ok || stop) return;
        const data = (await res.json()) as { messagesLeft: number; messages: Msg[] };
        setLeft(data.messagesLeft);
        if (data.messages.length) {
          lastId.current = data.messages[data.messages.length - 1].id;
          setMessages((m) => [...m, ...data.messages.filter((x) => !m.some((y) => y.id === x.id))]);
        }
      } catch {
        // transient -- next poll retries
      }
    };
    // Callers key this component by thread, so state starts fresh per chat.
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [creator, fan]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/dm/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator, fan, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "out_of_messages" ? "You're out of messages." : (data.error ?? "Couldn't send"));
        if (data.error === "out_of_messages") setLeft(0);
        return;
      }
      setDraft("");
      lastId.current = Math.max(lastId.current, data.message.id);
      setMessages((m) => [...m, data.message]);
      if (!asCreator) setLeft((l) => (l === null ? l : Math.max(0, l - 1)));
    } finally {
      setSending(false);
    }
  };

  const outOfMessages = !asCreator && left === 0;

  return (
    <div className="flex h-[70vh] min-h-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-bold text-white">{peerName}</p>
        {!asCreator && left !== null && (
          <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-300">
            {left} message{left === 1 ? "" : "s"} left
          </span>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            {asCreator ? "No messages yet." : `Say hi to ${peerName} 👋`}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.fromCreator === asCreator;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-pink-500 text-black" : "bg-white/10 text-white"
                }`}
              >
                {m.body}
              </p>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {outOfMessages ? (
        <div className="border-t border-white/10 p-4 text-center">
          <Link
            href={`/creators/${creator}`}
            className="inline-block rounded-full bg-pink-500 px-5 py-2 text-sm font-black text-black hover:bg-pink-400"
          >
            Buy more messages
          </Link>
        </div>
      ) : (
        <form
          className="flex gap-2 border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder={asCreator ? "Reply..." : "Message (uses 1 credit)..."}
            className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-400"
          />
          <button
            disabled={sending || !draft.trim()}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-black text-black disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
      {error && <p className="px-4 pb-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
