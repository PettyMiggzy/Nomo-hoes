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

type Status = "disconnected" | "connecting" | "connected" | "error";

export default function WalletConnect({
  onConnected,
}: {
  onConnected?: (wallet: string) => void;
}) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then(() => {
        // A 200 here just means a session cookie already exists.
      })
      .catch(() => {});
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
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
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
        throw new Error(data.error === "Insufficient NOMO"
          ? `You need at least ${data.required} NOMO (you have ${data.balance}).`
          : data.error ?? "Sign-in failed");
      }

      setWallet(data.wallet);
      setStatus("connected");
      onConnected?.(data.wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setStatus("error");
    }
  };

  if (status === "connected" && wallet) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
        {wallet.slice(0, 6)}...{wallet.slice(-4)}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={connect}
        disabled={status === "connecting"}
        className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="max-w-xs text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
