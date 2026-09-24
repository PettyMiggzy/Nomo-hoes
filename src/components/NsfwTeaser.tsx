"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const PREF_KEY = "nomohoes-show-nsfw";
const PREF_EVENT = "nomohoes-nsfw-pref";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

export default function NsfwTeaser({ src, alt }: { src: string; alt: string }) {
  const [revealed, setRevealed] = useState(false);
  const [always, setAlways] = useState(false);

  useEffect(() => {
    const sync = () => setAlways(readPref());
    sync();
    window.addEventListener(PREF_EVENT, sync);
    return () => window.removeEventListener(PREF_EVENT, sync);
  }, []);

  const shown = revealed || always;

  const setAlwaysPref = (value: boolean) => {
    try {
      localStorage.setItem(PREF_KEY, String(value));
    } catch {}
    window.dispatchEvent(new Event(PREF_EVENT));
  };

  return (
    <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 16rem, 45vw"
        className={`object-cover transition duration-500 ${shown ? "" : "scale-110 blur-2xl"}`}
      />
      {!shown && (
        <button
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-center"
        >
          <span className="rounded-full bg-rose-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            18+
          </span>
          <span className="text-xs font-bold text-white">Tap to reveal</span>
        </button>
      )}
      {shown && (
        <button
          onClick={() => {
            setRevealed(false);
            if (always) setAlwaysPref(false);
          }}
          className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
        >
          Hide
        </button>
      )}
      {revealed && !always && (
        <button
          onClick={() => setAlwaysPref(true)}
          className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
        >
          Always show 18+ pics
        </button>
      )}
    </div>
  );
}
