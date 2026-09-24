import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GNOMES, getGnome } from "@/data/gnomes";
import GnomeChat from "@/components/GnomeChat";

export function generateStaticParams() {
  return GNOMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const gnome = getGnome(id);
  if (!gnome) return {};
  return {
    title: `${gnome.name} — NOMO HOES`,
    description: gnome.tagline,
  };
}

export default async function GnomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gnome = getGnome(id);
  if (!gnome) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← All Gnomes
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <div className="relative h-40 w-40 overflow-hidden rounded-full border-2 border-pink-500/30 shadow-[0_0_40px_-10px_rgba(236,72,153,0.5)]">
          <Image src={`/gnomes/${gnome.id}.webp`} alt={gnome.name} fill className="object-cover" priority />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{gnome.name}</h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">{gnome.tagline}</p>

        <div className="mt-10">
          <GnomeChat gnome={gnome} />
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>{gnome.name} is a fictional AI character, not a real person. 18+ only.</p>
        </div>
      </footer>
    </div>
  );
}
