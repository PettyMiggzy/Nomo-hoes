import type { Metadata } from "next";
import Link from "next/link";
import CellmateChat from "@/components/CellmateChat";

export const metadata: Metadata = {
  title: "Cellmate — Chat With Bunkie",
  description:
    "Chat with Bunkie, the $NOHOES AI cellmate. Crude, funny, degenerate — not a real person, not a romance bot.",
};

export default function Cellmate() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          $NOHOES
        </Link>
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-400 hover:text-white"
        >
          ← Back
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
          Cellmate
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
          Talk to Bunkie
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">
          An AI chatbot, not a real person and not a romantic partner. Ask
          about the charts, the bags, or your life choices. 18+ humor, no
          NSFW, no exceptions.
        </p>

        <div className="mt-10">
          <CellmateChat />
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            Bunkie is an AI character, not a real person. Nothing said here
            is financial, legal, or relationship advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
