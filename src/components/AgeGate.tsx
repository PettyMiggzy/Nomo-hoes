"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const STORAGE_KEY = "nohoes-age-verified";

export default function AgeGate() {
  const [verified, setVerified] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    // Syncing one-time from sessionStorage, which isn't readable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVerified(stored === "true");
  }, []);

  if (verified) return null;

  const confirm = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setVerified(true);
  };

  const leave = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-center shadow-2xl">
        <div className="relative h-40 w-full">
          <Image
            src="/mascot.jpg"
            alt=""
            fill
            sizes="24rem"
            className="object-cover opacity-40 blur-[2px]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        </div>
        <div className="-mt-10 space-y-4 px-6 pb-8">
          <span className="inline-block rounded-full bg-pink-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-pink-400">
            Age Verification
          </span>
          <h2 className="text-xl font-black text-white">
            You must be 18+ to enter
          </h2>
          <p className="text-sm text-neutral-400">
            $NOHOES is a meme coin with crude humor and satirical content.
            By entering you confirm you are at least 18 years old and
            understand this is not financial advice.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={confirm}
              className="w-full rounded-full bg-pink-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-pink-400"
            >
              I&apos;m 18+ — Let Me In
            </button>
            <button
              onClick={leave}
              className="w-full rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-neutral-400 transition hover:bg-white/5"
            >
              I&apos;m under 18 — Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
