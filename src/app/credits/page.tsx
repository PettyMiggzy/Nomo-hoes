"use client";

import Link from "next/link";
import { useState } from "react";
import { encodeFunctionData, erc20Abi, parseUnits, decodeFunctionResult, type Hex } from "viem";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";

type Config = {
  creditsAvailable: number | null;
  owner: boolean;
  treasury: `0x${string}` | null;
  token: `0x${string}` | null;
  chainId: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CreditsPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [amount, setAmount] = useState(5);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onConnected = async (s: SessionInfo) => {
    setSession(s);
    const res = await fetch("/api/credits");
    if (res.ok) setConfig(await res.json());
  };

  const buy = async () => {
    const eth = window.ethereum;
    if (!config?.treasury || !config.token || !session || !eth) return;
    setPending(true);
    setStatus(null);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });

      const decimalsHex = (await eth.request({
        method: "eth_call",
        params: [
          { to: config.token, data: encodeFunctionData({ abi: erc20Abi, functionName: "decimals" }) },
          "latest",
        ],
      })) as Hex;
      const decimals = decodeFunctionResult({ abi: erc20Abi, functionName: "decimals", data: decimalsHex });

      setStatus("Confirm the transfer in your wallet...");
      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: session.wallet,
            to: config.token,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [config.treasury, parseUnits(String(amount), decimals)],
            }),
          },
        ],
      })) as Hex;

      setStatus("Waiting for the transfer to confirm on chain...");
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = await fetch("/api/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus(`Credited ${data.credited} NOMO. Balance: ${Number(data.creditsAvailable).toFixed(2)}.`);
          setConfig((c) => (c ? { ...c, creditsAvailable: data.creditsAvailable } : c));
          return;
        }
        if (res.status !== 409 || data.error === "This transaction was already redeemed") {
          setStatus(data.error ?? "Purchase failed");
          return;
        }
        await sleep(3000);
      }
      setStatus(`Still not confirmed. Your transfer is safe — tx ${txHash}. Refresh and try again shortly.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-black tracking-tight">
          NOMO HOES
        </Link>
        <Link href="/gnomes" className="text-sm font-semibold text-neutral-400 hover:text-white">
          ← All Gnomes
        </Link>
      </nav>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-24 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
          Credits
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Buy NOMO Credits</h1>
        <p className="mx-auto mt-3 max-w-sm text-balance text-neutral-400">
          10 free messages per gnome, per day. After that: 0.2 NOMO per 20 messages, or 0.5 NOMO
          per unlocked image. Credits = the NOMO you send, 1:1.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
          {!session ? (
            <>
              <p className="text-sm text-neutral-400">Connect your wallet to buy credits.</p>
              <WalletConnect onConnected={onConnected} />
            </>
          ) : session.owner ? (
            <p className="text-sm text-pink-400">Owner access — you have unlimited use.</p>
          ) : !config?.treasury ? (
            <p className="text-sm text-neutral-400">Payments aren&apos;t open yet. Check back soon.</p>
          ) : (
            <>
              {config.creditsAvailable !== null && (
                <p className="text-sm text-neutral-400">
                  Balance: <span className="font-bold text-white">{config.creditsAvailable.toFixed(2)} NOMO</span>
                </p>
              )}
              <div className="grid w-full grid-cols-2 gap-2">
                {[
                  { name: "Gardener", nomo: 5, note: "500 msgs / 10 pics" },
                  { name: "Hollow Lord", nomo: 25, note: "2,500 msgs / 50 pics" },
                ].map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setAmount(p.nomo)}
                    className={`rounded-xl border p-3 text-left transition ${
                      amount === p.nomo ? "border-pink-500 bg-pink-500/10" : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <p className="text-xs font-bold text-pink-400">{p.name}</p>
                    <p className="text-lg font-black text-white">{p.nomo} NOMO</p>
                    <p className="text-[11px] text-neutral-500">{p.note}</p>
                  </button>
                ))}
              </div>
              <label className="flex w-full flex-col gap-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Amount (NOMO)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className="rounded-lg bg-white/5 px-4 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </label>
              <button
                onClick={buy}
                disabled={pending}
                className="w-full rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Processing..." : `Send ${amount} NOMO`}
              </button>
              {status && <p className="break-all text-xs text-neutral-300">{status}</p>}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>18+ only. NOMO credits are non-refundable and have no cash value outside this platform.</p>
        </div>
      </footer>
    </div>
  );
}
