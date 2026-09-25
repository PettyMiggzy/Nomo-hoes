"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Post = {
  id: number;
  creatorWallet: string;
  gnomeId: string;
  title: string;
  scene: string;
  priceNomo: number;
  createdAt: string;
};

export default function OwnerMarketplacePage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const load = async () => {
    const res = await fetch("/api/admin/marketplace");
    if (res.status === 403) {
      setError("Not signed in as owner.");
      return;
    }
    if (!res.ok) {
      setError("Couldn't load posts.");
      return;
    }
    const data = await res.json();
    setPosts(data.posts);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const viewImage = async (id: number) => {
    const res = await fetch(`/api/marketplace/posts/${id}/image`);
    if (res.ok) {
      const data = await res.json();
      setPreviews((p) => ({ ...p, [id]: data.imageUrl }));
    }
  };

  const review = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await fetch("/api/admin/marketplace", {
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
          <h1 className="text-2xl font-black">Marketplace Review Queue</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {posts && posts.length === 0 && <p className="text-center text-neutral-500">Nothing pending.</p>}

        <div className="flex flex-col gap-4">
          {posts?.map((p) => (
            <div key={p.id} className="flex gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              {previews[p.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- private blob URL, arbitrary generated content
                <img src={previews[p.id]} alt={p.title} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
              ) : (
                <button
                  onClick={() => viewImage(p.id)}
                  className="h-24 w-24 shrink-0 rounded-lg border border-dashed border-white/20 text-xs text-neutral-500"
                >
                  View
                </button>
              )}
              <div className="flex flex-1 flex-col gap-1 text-left text-sm">
                <p className="font-bold text-white">{p.title}</p>
                <p className="font-mono text-xs text-neutral-500">{p.creatorWallet}</p>
                <p className="text-xs text-neutral-400">{p.scene}</p>
                <p className="text-xs text-emerald-400">{p.priceNomo} NOMO</p>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={busy === p.id}
                    onClick={() => review(p.id, true)}
                    className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy === p.id}
                    onClick={() => review(p.id, false)}
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
