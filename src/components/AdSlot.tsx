"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Ad = { id: number; mediaUrl: string; mediaType: "image" | "video"; linkUrl: string | null };

const ROTATE_MS = 8000;

export default function AdSlot() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/ads/active")
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((d) => setAds(d.ads ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (paused || ads.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, ads.length]);

  if (ads.length === 0) {
    return (
      <Link
        href="/advertise"
        className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-neutral-900/40 p-4 text-center transition hover:border-pink-500/40 hover:bg-neutral-900/60"
      >
        <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Ad space
        </span>
        <p className="text-sm font-bold text-neutral-300">Run your ad here</p>
        <p className="text-[11px] text-neutral-500">Right next to every gnome chat, for 7 days</p>
      </Link>
    );
  }

  const ad = ads[index];
  const media =
    ad.mediaType === "video" ? (
      <video
        key={ad.id}
        src={ad.mediaUrl}
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full animate-[fadein_.6s_ease] object-cover"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded blob URLs, not local assets
      <img key={ad.id} src={ad.mediaUrl} alt="Advertisement" className="h-full w-full animate-[fadein_.6s_ease] object-cover" />
    );

  const content = (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10"
    >
      {media}
      <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-300">
        Ad
      </span>
    </div>
  );

  return ad.linkUrl ? (
    <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
      {content}
    </a>
  ) : (
    content
  );
}
