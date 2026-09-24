import type { Metadata } from "next";
import Link from "next/link";
import MugshotGenerator from "@/components/MugshotGenerator";

export const metadata: Metadata = {
  title: "Walk of Hoes — $NOHOES Booking Generator",
  description:
    "Generate a satirical $NOHOES booking card from our AI mascot lineup. 18+, all in your browser, no real people, no uploads.",
};

export default function WalkOfHoes() {
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
          Walk of Hoes
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
          Roll the Booking Sheet
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">
          Pull a random $NOHOES mascot and slap it with degenerate charges.
          100% AI-generated art, 100% client-side — no real people, no
          photo uploads. 18+, keep it a joke.
        </p>

        <div className="mt-10">
          <MugshotGenerator />
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            18+ only. Satirical, AI-generated meme generator — no real
            people, no photo uploads. Nothing is stored or shared by this
            site.
          </p>
        </div>
      </footer>
    </div>
  );
}
