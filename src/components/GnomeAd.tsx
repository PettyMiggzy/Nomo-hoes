"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type AdGnome = { id: string; name: string; tagline: string };

const ROTATE_MS = 6000;

export default function GnomeAd({ gnomes }: { gnomes: AdGnome[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || gnomes.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % gnomes.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, gnomes.length]);

  const g = gnomes[index];
  if (!g) return null;

  return (
    <Link
      href={`/gnomes/${g.id}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border border-pink-500/40 shadow-[0_0_40px_-12px_rgba(236,72,153,0.6)]"
    >
      <Image
        key={g.id}
        src={`/gnomes/${g.id}.webp`}
        alt={g.name}
        fill
        sizes="(min-width: 1024px) 16rem, 45vw"
        className="animate-[fadein_.6s_ease] object-cover transition duration-300 group-hover:scale-105"
      />
      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Online now
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-10 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wider text-pink-400">Also in the burrow</p>
        <p className="text-base font-black text-white">{g.name}</p>
        <p className="text-[11px] leading-tight text-neutral-300">{g.tagline}</p>
        <p className="mt-2 inline-block rounded-full bg-pink-500 px-3 py-1 text-xs font-bold text-black">
          Chat with her →
        </p>
      </div>
    </Link>
  );
}
