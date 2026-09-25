"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Report = {
  id: number;
  target: "post" | "premium" | "creator";
  targetId: string;
  reporterWallet: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

export default function OwnerReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/reports");
    if (res.status === 403) return setError("Not signed in as owner.");
    if (!res.ok) return setError("Couldn't load reports.");
    setReports((await res.json()).reports);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const act = async (r: Report, action: "dismiss" | "takedown") => {
    if (action === "takedown" && !confirm(`Take down this ${r.target}?`)) return;
    setBusy(r.id);
    try {
      await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action, target: r.target, targetId: r.targetId }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">Content Reports</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>
        <p className="mb-6 text-sm text-neutral-400">
          Treat &quot;underage&quot; and &quot;non-consensual&quot; reports as urgent: take the content down first, then investigate.
        </p>
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {reports && reports.length === 0 && <p className="text-center text-neutral-500">No open reports.</p>}
        <div className="flex flex-col gap-3">
          {reports?.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 text-left text-sm ${
                r.reason === "underage" || r.reason === "non-consensual"
                  ? "border-red-500/50 bg-red-500/10"
                  : "border-white/10 bg-neutral-900/60"
              }`}
            >
              <p className="font-bold text-white">
                {r.reason.toUpperCase()} · {r.target} #{r.targetId}
              </p>
              {r.details && <p className="mt-1 text-neutral-300">{r.details}</p>}
              <p className="mt-1 text-xs text-neutral-500">
                {new Date(r.createdAt).toLocaleString()} · {r.reporterWallet ?? "anonymous"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r, "takedown")}
                  className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-black disabled:opacity-40"
                >
                  {r.target === "creator" ? "Pull creator's posts & DMs" : "Take down"}
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r, "dismiss")}
                  className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-neutral-300 disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
