"use client";

import Link from "next/link";
import { useState } from "react";

export default function OwnerLogin() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const login = async () => {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setStatus("Wrong password.");
        return;
      }
      setSignedIn(true);
      setPassword("");
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    await fetch("/api/owner", { method: "DELETE" });
    setSignedIn(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <meta name="robots" content="noindex, nofollow" />
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center">
        <h1 className="text-xl font-black">Owner Access</h1>
        {signedIn ? (
          <>
            <p className="text-sm text-neutral-400">
              Signed in. Unlimited chat and images, no wallet needed, for 24 hours.
            </p>
            <Link
              href="/owner/dashboard"
              className="rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-amber-300"
            >
              Profit Dashboard
            </Link>
            <Link
              href="/owner/ads"
              className="rounded-full border border-emerald-400/50 px-6 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Ad Review Queue
            </Link>
            <Link
              href="/owner/marketplace"
              className="rounded-full border border-emerald-400/50 px-6 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Marketplace Review Queue
            </Link>
            <Link
              href="/owner/premium"
              className="rounded-full border border-emerald-400/50 px-6 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Premium Content
            </Link>
            <Link
              href="/owner/verifications"
              className="rounded-full border border-emerald-400/50 px-6 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Creator ID Verification
            </Link>
            <Link
              href="/owner/reports"
              className="rounded-full border border-red-400/50 px-6 py-3 text-sm font-bold text-red-300 transition hover:bg-red-400/10"
            >
              Reports
            </Link>
            <Link
              href="/gnomes"
              className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400"
            >
              Go to the Gnomes
            </Link>
            <button onClick={logout} className="text-xs text-neutral-500 hover:text-white">
              Sign out
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="rounded-lg bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            <button
              type="submit"
              disabled={pending || !password}
              className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400 disabled:opacity-50"
            >
              {pending ? "Checking..." : "Sign in"}
            </button>
            {status && <p className="text-xs text-red-400">{status}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
