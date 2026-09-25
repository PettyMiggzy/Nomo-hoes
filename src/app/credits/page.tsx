"use client";

import Link from "next/link";
import { useState } from "react";
import { encodeFunctionData, erc20Abi, parseUnits, decodeFunctionResult, type Hex } from "viem";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";

type Config = {
  creditsAvailable: number | null;
  vipUntil: string | null;
  owner: boolean;
  treasury: `0x${string}` | null;
  token: `0x${string}` | null;
  nohoesToken: `0x${string}` | null;
  burnAddress: `0x${string}`;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  pricing: {
    packs: { name: string; nomo: number }[];
    vipPriceNomo: number;
    vipPriceNohoes: number;
    vipDays: number;
    vipFreeMessages: number;
    nomoPerBatch: number;
    messagesPerBatch: number;
    nomoPerImage: number;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

export default function CreditsPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [amount, setAmount] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadConfig = async () => {
    const res = await fetch("/api/credits");
    if (!res.ok) return;
    const c: Config = await res.json();
    setConfig(c);
    setAmount(c.pricing.packs[0]?.nomo ?? 1);
  };

  // Sends `amount` of `token` to `to` from the connected wallet, then polls
  // `endpoint` with the tx hash until the server confirms it on chain.
  const sendAndRedeem = async (
    token: `0x${string}`,
    to: `0x${string}`,
    tokens: number,
    endpoint: string,
    extra: Record<string, string>,
    onDone: (data: Record<string, unknown>) => string,
  ) => {
    const eth = window.ethereum;
    if (!config || !session || !eth) return;
    setPending(true);
    setStatus(null);
    try {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      } catch (switchError) {
        // 4902 = wallet doesn't have this chain configured yet. Point it at
        // our own /api/rpc proxy rather than a raw RPC URL, so a paid/keyed
        // fallback endpoint never has to be exposed to the browser.
        if ((switchError as { code?: number })?.code !== 4902) throw switchError;
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${config.chainId.toString(16)}`,
              chainName: config.chainName,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [`${window.location.origin}/api/rpc`],
              blockExplorerUrls: [config.explorerUrl],
            },
          ],
        });
      }
      const decimalsHex = (await eth.request({
        method: "eth_call",
        params: [{ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "decimals" }) }, "latest"],
      })) as Hex;
      const decimals = decodeFunctionResult({ abi: erc20Abi, functionName: "decimals", data: decimalsHex });

      setStatus("Confirm the transfer in your wallet...");
      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: session.wallet,
            to: token,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [to, parseUnits(String(tokens), decimals)],
            }),
          },
        ],
      })) as Hex;

      setStatus("Waiting for the transfer to confirm on chain...");
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, ...extra }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus(onDone(data));
          await loadConfig();
          return;
        }
        if (res.status !== 409 || data.error === "This transaction was already redeemed") {
          setStatus(data.error ?? "Something went wrong");
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

  const p = config?.pricing;
  const perks = (nomo: number) =>
    p
      ? `${fmt(Math.floor((nomo / p.nomoPerBatch) * p.messagesPerBatch))} msgs / ${fmt(Math.floor(nomo / p.nomoPerImage))} pics`
      : "";
  const vipActive = config?.vipUntil ? new Date(config.vipUntil) : null;

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

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 pb-24 pt-4 text-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
            Credits &amp; VIP
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Keep the Burrow Open</h1>
        </div>

        {!session ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
            <p className="text-sm text-neutral-400">Connect your wallet to get VIP or buy credits.</p>
            <WalletConnect
              onConnected={(s) => {
                setSession(s);
                loadConfig();
              }}
            />
          </div>
        ) : session.owner ? (
          <p className="text-sm text-pink-400">Owner access — you have unlimited use.</p>
        ) : !config || !p ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : (
          <>
            {config.token && (
              <a
                href={`https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${config.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/20"
              >
                Don&apos;t have NOMO? Swap for it on Uniswap →
              </a>
            )}

            <section className="flex w-full flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5 text-left">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">VIP Pass</p>
                {vipActive && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    Active until {vipActive.toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-300">
                {p.vipFreeMessages} free messages a day across every gnome, plus a VIP badge, for {p.vipDays} days.
                Buying again adds {p.vipDays} more days.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={pending || !config.treasury || !config.token}
                  onClick={() =>
                    sendAndRedeem(config.token!, config.treasury!, p.vipPriceNomo, "/api/vip", { method: "nomo" }, (d) =>
                      `VIP active until ${new Date(String(d.vipUntil)).toLocaleDateString()}.`,
                    )
                  }
                  className="rounded-xl bg-amber-400 px-3 py-3 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Pay {fmt(p.vipPriceNomo)} NOMO
                </button>
                <button
                  disabled={pending || !config.nohoesToken}
                  onClick={() =>
                    sendAndRedeem(config.nohoesToken!, config.burnAddress, p.vipPriceNohoes, "/api/vip", { method: "burn" }, (d) =>
                      `Burned. VIP active until ${new Date(String(d.vipUntil)).toLocaleDateString()}.`,
                    )
                  }
                  className="rounded-xl border border-amber-400/60 px-3 py-3 text-sm font-black text-amber-300 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Burn {fmt(p.vipPriceNohoes)} $NOHOES
                </button>
              </div>
              {!config.nohoesToken && (
                <p className="text-[11px] text-neutral-500">$NOHOES burn opens once the token launches.</p>
              )}
            </section>

            <section className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
              <p className="text-left text-xs font-bold uppercase tracking-widest text-pink-400">Credit Packs</p>
              {config.creditsAvailable !== null && (
                <p className="text-left text-sm text-neutral-400">
                  Balance: <span className="font-bold text-white">{fmt(config.creditsAvailable)} NOMO</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {p.packs.map((pack) => (
                  <button
                    key={pack.name}
                    onClick={() => setAmount(pack.nomo)}
                    className={`rounded-xl border p-3 text-left transition ${
                      amount === pack.nomo ? "border-pink-500 bg-pink-500/10" : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <p className="text-xs font-bold text-pink-400">{pack.name}</p>
                    <p className="text-lg font-black text-white">{fmt(pack.nomo)} NOMO</p>
                    <p className="text-[11px] text-neutral-500">{perks(pack.nomo)}</p>
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Custom amount (NOMO)
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0.01, Number(e.target.value)))}
                  className="rounded-lg bg-white/5 px-4 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </label>
              <button
                disabled={pending || !config.treasury || !config.token}
                onClick={() =>
                  sendAndRedeem(config.token!, config.treasury!, amount, "/api/credits", {}, (d) =>
                    `Credited ${fmt(Number(d.credited))} NOMO. Balance: ${fmt(Number(d.creditsAvailable))}.`,
                  )
                }
                className="w-full rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Processing..." : `Send ${fmt(amount)} NOMO`}
              </button>
              {!config.treasury && (
                <p className="text-[11px] text-neutral-500">NOMO payments open soon.</p>
              )}
            </section>

            {status && <p className="break-all text-xs text-neutral-300">{status}</p>}
          </>
        )}
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            18+ only. Credits and VIP passes are non-refundable and have no cash value. Burned $NOHOES is sent
            to the dead address and gone for good.
          </p>
        </div>
      </footer>
    </div>
  );
}
