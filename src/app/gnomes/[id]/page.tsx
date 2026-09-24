import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GNOMES, getGnome } from "@/data/gnomes";
import { PRICING } from "@/lib/pricing";
import GnomeChat from "@/components/GnomeChat";
import NsfwTeaser from "@/components/NsfwTeaser";
import GnomeAd from "@/components/GnomeAd";
import NomoAd from "@/components/NomoAd";
import NomPadBanner from "@/components/NomPadBanner";

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

  const teaser = (n: number) => (
    <NsfwTeaser src={`/gnomes/teasers/${gnome.id}-${n}.webp`} alt={`${gnome.name}, 18+ photo ${n}`} />
  );

  // Advertise the other gnomes, starting just after this one so each page
  // leads with a different face.
  const start = GNOMES.findIndex((g) => g.id === gnome.id);
  const ads = [...GNOMES.slice(start + 1), ...GNOMES.slice(0, start)].map(({ id, name, tagline }) => ({
    id,
    name,
    tagline,
  }));

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← All Gnomes
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-pink-500/30 shadow-[0_0_40px_-10px_rgba(236,72,153,0.5)]">
          <Image src={`/gnomes/${gnome.id}.webp`} alt={gnome.name} fill sizes="8rem" className="object-cover" priority />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{gnome.name}</h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-neutral-400">{gnome.tagline}</p>

        <div className="mt-10 grid w-full items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
          <aside className="hidden flex-col gap-4 lg:flex">
            {teaser(1)}
            {teaser(2)}
          </aside>
          <GnomeChat gnome={gnome} guestFree={PRICING.guestFreeMessages} />
          <aside className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
            <GnomeAd gnomes={ads} />
            <NomoAd />
          </aside>
          <div className="grid grid-cols-2 gap-4 lg:hidden">
            {teaser(1)}
            {teaser(2)}
          </div>
          <div className="mx-auto grid w-full max-w-xs gap-4 lg:hidden">
            <GnomeAd gnomes={ads} />
            <NomoAd />
          </div>
        </div>

        <div className="mt-10 w-full">
          <NomPadBanner />
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>{gnome.name} is a fictional, AI-generated adult character, not a real person. 18+ only.</p>
        </div>
      </footer>
    </div>
  );
}
