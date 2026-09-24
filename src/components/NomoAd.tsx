"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SITE = "https://nomosupply.com";
const UTM = "utm_source=nomohoes&utm_medium=sidebar";

const ADS = [
  { slug: "launch", title: "Create a Token", blurb: "Launch. Trade. Grow. Launch with NOMO on Robinhood Chain.", cta: "Launch Token", path: "/garden/launch" },
  { slug: "run", title: "NOMO Run", blurb: "Play your way into NOMO.", cta: "Play Now", path: "/game" },
  { slug: "nft", title: "Gnomies NFTs", blurb: "Meet the Gnomies — the 10K gnomes of Robinhood Chain.", cta: "View Collection", path: "/nft" },
  { slug: "raffle", title: "NOMO Raffles", blurb: "A little luck. A lot of NOMO.", cta: "Enter Raffle", path: "/raffle" },
  { slug: "shop", title: "NOMO Shop", blurb: "Original NOMO designs. Rep the gnome IRL.", cta: "Shop Merch", path: "/shop" },
  { slug: "music", title: "NOMO Music", blurb: "The Bad Days Soundtrack.", cta: "Listen", path: "/music" },
];

const ROTATE_MS = 7000;

export default function NomoAd() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ADS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const ad = ADS[index];
  const href = `${SITE}${ad.path}?${UTM}`;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="overflow-hidden rounded-xl border border-[#2d4a2f] bg-[#0c140c] text-left shadow-[0_0_32px_-14px_rgba(182,255,61,0.55)]"
    >
      <a href={href} target="_blank" rel="noopener" className="group block">
        <div className="relative aspect-[40/21] w-full overflow-hidden">
          <Image
            key={ad.slug}
            src={`/nomo/ads/${ad.slug}.webp`}
            alt={`${ad.title} on nomosupply.com`}
            fill
            sizes="(min-width: 1024px) 16rem, 90vw"
            className="animate-[fadein_.6s_ease] object-cover transition duration-300 group-hover:scale-105"
          />
          <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9db09a]">
            Ad
          </span>
        </div>
        <div className="p-3">
          <p className="font-serif text-lg font-black leading-tight text-[#f2f7f0]">{ad.title}</p>
          <p className="mt-1 text-xs leading-snug text-[#9db09a]">{ad.blurb}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#b6ff3d]/60 bg-[#b6ff3d]/10 px-3 py-1 text-xs font-bold text-[#b6ff3d] transition group-hover:bg-[#b6ff3d] group-hover:text-black">
            {ad.cta} →
          </span>
        </div>
      </a>
      <div className="flex justify-center gap-1.5 pb-3">
        {ADS.map((a, i) => (
          <button
            key={a.slug}
            onClick={() => setIndex(i)}
            aria-label={`Show ${a.title}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-[#b6ff3d]" : "w-1.5 bg-[#2d4a2f]"}`}
          />
        ))}
      </div>
    </div>
  );
}
