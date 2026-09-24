"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const GREETING: Message = {
  role: "assistant",
  content:
    "Yo, new fish. Name's Bunkie — I'm doing life for excessive shitposting. Talk to me about the bags, the charts, or your terrible trades. Keep it PG-13 on the romance, I'm not that kind of cellmate.",
};

const MAX_LEN = 500;

export default function CellmateChat() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim().slice(0, MAX_LEN);
    if (!text || pending) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json();
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: data.reply ?? "..." },
      ]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: "Bunkie dropped the phone. Try again." },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    }
  };

  return (
    <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-pink-500/20" />
        <div>
          <p className="text-sm font-bold text-white">Bunkie</p>
          <p className="text-xs text-neutral-500">
            $NOHOES cellmate · AI, not a real person
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex h-80 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-pink-500 text-black"
                : "self-start bg-white/10 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div className="self-start rounded-2xl bg-white/10 px-4 py-2 text-sm text-neutral-400">
            Bunkie is typing…
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
          placeholder="Say something to Bunkie..."
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
    </div>
  );
}
