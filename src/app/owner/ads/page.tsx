"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Ad = {
  id: number;
  wallet: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  linkUrl: string | null;
  createdAt: string;
  expiresAt: string;
};

export default function OwnerAdsPage() {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/ads");
    if (res.status === 403) {
      setError("Not signed in as owner.");
      return;
    }
    if (!res.ok) {
      setError("Couldn't load ads.");
      return;
    }
    const data = await res.json();
    setAds(data.ads);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const review = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">Ad Review Queue</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

        {ads && ads.length === 0 && <p className="text-center text-neutral-500">Nothing pending.</p>}

        <div className="flex flex-col gap-4">
          {ads?.map((ad) => (
            <div key={ad.id} className="flex gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/10">
                {ad.mediaType === "video" ? (
                  <video src={ad.mediaUrl} className="h-full w-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded blob URL
                  <img src={ad.mediaUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 text-left text-sm">
                <p className="font-mono text-xs text-neutral-500">{ad.wallet}</p>
                {ad.linkUrl && (
                  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="truncate text-pink-400 hover:underline">
                    {ad.linkUrl}
                  </a>
                )}
                <p className="text-xs text-neutral-500">Submitted {new Date(ad.createdAt).toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={busy === ad.id}
                    onClick={() => review(ad.id, true)}
                    className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy === ad.id}
                    onClick={() => review(ad.id, false)}
                    className="rounded-full border border-red-500/50 px-4 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
