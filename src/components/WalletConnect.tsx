"use client";

import { useEffect, useState } from "react";

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthProvider;
  }
}

export type SessionInfo = { wallet: string; owner: boolean };
type Status = "checking" | "disconnected" | "connecting" | "connected" | "error";

export default function WalletConnect({
  onConnected,
  compact = false,
  knownSession,
}: {
  onConnected?: (session: SessionInfo) => void;
  compact?: boolean;
  knownSession?: SessionInfo | null;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data: { wallet: string | null; owner: boolean }) => {
        if (cancelled) return;
        if (data.wallet) {
          const s = { wallet: data.wallet, owner: data.owner };
          setSession(s);
          setStatus("connected");
          onConnected?.(s);
        } else {
          setStatus("disconnected");
        }
      })
      .catch(() => !cancelled && setStatus("disconnected"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setError(null);
    if (!window.ethereum) {
      setError("No wallet found. Install MetaMask or another wallet extension.");
      setStatus("error");
      return;
    }

    setStatus("connecting");
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned");

      const nonce = crypto.randomUUID();
      const message = `Sign in to NOMO HOES\nNonce: ${nonce}`;
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, nonce }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error === "Insufficient NOMO"
            ? `You need at least ${data.required} NOMO (you have ${data.balance}).`
            : (data.error ?? "Sign-in failed"),
        );
      }

      const s = { wallet: data.wallet as string, owner: false };
      setSession(s);
      setStatus("connected");
      onConnected?.(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setStatus("error");
    }
  };

  if (status === "checking") return null;

  const shown = knownSession ?? session;
  if (shown) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
        {shown.owner ? "Owner" : `${shown.wallet.slice(0, 6)}...${shown.wallet.slice(-4)}`}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${compact ? "items-end" : "items-center"}`}>
      <button
        onClick={connect}
        disabled={status === "connecting"}
        className={`rounded-full bg-pink-500 font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? "px-3 py-1.5 text-xs" : "px-6 py-3 text-sm"
        }`}
      >
        {status === "connecting" ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="max-w-xs text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
