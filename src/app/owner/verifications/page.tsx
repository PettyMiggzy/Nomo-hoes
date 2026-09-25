"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Pending = { wallet: string; legalName: string; dateOfBirth: string; country: string; submittedAt: string };

const age = (dob: string) => {
  const d = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
};

export default function OwnerVerificationsPage() {
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const load = async () => {
    const res = await fetch("/api/admin/verifications");
    if (res.status === 403) return setError("Not signed in as owner.");
    if (!res.ok) return setError("Couldn't load verifications.");
    setPending((await res.json()).pending);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const review = async (wallet: string, approve: boolean) => {
    const reason = approve ? null : prompt("Reason for rejecting (shown to the creator):", "ID unreadable or doesn't match selfie");
    if (!approve && reason === null) return;
    setBusy(wallet);
    try {
      await fetch("/api/admin/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, approve, reason }),
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
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-black">Creator ID Verification</h1>
          <Link href="/owner" className="text-sm text-neutral-400 hover:text-white">
            ← Owner
          </Link>
        </div>
        <p className="mb-6 text-sm text-neutral-400">
          Approve only if: the ID looks genuine and unexpired, the name and date of birth match what they typed, they&apos;re
          18+, and the selfie is clearly the same person holding the same ID.
        </p>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {pending && pending.length === 0 && <p className="text-center text-neutral-500">Nothing pending.</p>}

        <div className="flex flex-col gap-4">
          {pending?.map((v) => (
            <div key={v.wallet} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 text-left text-sm">
              <p className="font-bold text-white">{v.legalName}</p>
              <p className="text-neutral-400">
                DOB {v.dateOfBirth} (age {age(v.dateOfBirth)}) · {v.country}
              </p>
              <p className="font-mono text-xs text-neutral-500">{v.wallet}</p>
              {shown[v.wallet] ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["id", "selfie"] as const).map((w) => (
                    // eslint-disable-next-line @next/next/no-img-element -- decrypted on request, never cached
                    <img
                      key={w}
                      src={`/api/admin/verifications/doc?wallet=${v.wallet}&which=${w}`}
                      alt={w}
                      className="w-full rounded-lg border border-white/10"
                    />
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShown((s) => ({ ...s, [v.wallet]: true }))}
                  className="mt-3 rounded-full border border-white/20 px-4 py-1.5 text-xs text-neutral-300"
                >
                  Show ID &amp; selfie
                </button>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === v.wallet || !shown[v.wallet]}
                  onClick={() => review(v.wallet, true)}
                  className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  disabled={busy === v.wallet}
                  onClick={() => review(v.wallet, false)}
                  className="rounded-full border border-red-500/50 px-4 py-1.5 text-xs font-bold text-red-300 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
