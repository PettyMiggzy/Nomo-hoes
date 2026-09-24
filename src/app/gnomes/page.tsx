import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GNOMES } from "@/data/gnomes";
import NomPadBanner from "@/components/NomPadBanner";

export const metadata: Metadata = {
  title: "Meet the Gnomes — NOMO HOES",
  description:
    "24 fantasy gnome companions, each with their own personality. Chat and unlock art with $NOMO. 18+ fictional AI characters.",
};

export default function GnomesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← Back
        </Link>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
          The Roster
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
          Meet the Gnomes
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">
          24 fictional companions, 24 personalities. Chat free for a bit, then
          keep it going with $NOMO. 18+ only — fictional AI characters, not
          real people.
        </p>

        <div className="mt-8">
          <NomPadBanner />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {GNOMES.map((g) => (
            <Link
              key={g.id}
              href={`/gnomes/${g.id}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10"
            >
              <Image
                src={`/gnomes/${g.id}.webp`}
                alt={g.name}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 text-left">
                <p className="text-sm font-bold text-white">{g.name}</p>
                <p className="text-[11px] leading-tight text-neutral-300">{g.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            All gnomes are 100% AI-generated fictional characters — no real
            people. 18+ only.
          </p>
        </div>
      </footer>
    </div>
  );
}
