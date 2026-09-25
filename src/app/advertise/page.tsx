"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import WalletConnect, { type SessionInfo } from "@/components/WalletConnect";
import { ensureChain, sendTokenTransfer } from "@/lib/walletTx";

type Config = {
  owner: boolean;
  treasury: `0x${string}` | null;
  token: `0x${string}` | null;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  pricing: { adPriceNomo: number; adDays: number };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"];

export default function AdvertisePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadConfig = async () => {
    const res = await fetch("/api/credits");
    if (res.ok) setConfig(await res.json());
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setStatus("Use PNG, JPEG, WebP, GIF, MP4 or WebM.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setStatus("Max size is 25 MB.");
      return;
    }
    setStatus(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    const eth = window.ethereum;
    if (!config || !session || !eth || !file) return;
    if (!config.treasury || !config.token) {
      setStatus("Ad payments aren't configured yet.");
      return;
    }
    let cleanLink: string | null = null;
    if (linkUrl.trim()) {
      try {
        const u = new URL(linkUrl.trim());
        if (u.protocol !== "https:") throw new Error();
        cleanLink = u.toString();
      } catch {
        setStatus("The link must be a full https:// URL.");
        return;
      }
    }

    setPending(true);
    setStatus("Uploading your media...");
    try {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/ads/upload" });

      await ensureChain(eth, config.chainId, config.chainName, config.explorerUrl);

      setStatus("Confirm the payment in your wallet...");
      const txHash = await sendTokenTransfer(
        eth,
        session.wallet as `0x${string}`,
        config.token,
        config.treasury,
        config.pricing.adPriceNomo,
      );

      setStatus("Waiting for the payment to confirm on chain...");
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = await fetch("/api/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, mediaUrl: blob.url, mediaType, linkUrl: cleanLink }),
        });
        const data = await res.json();
        if (res.ok) {
          setDone(true);
          setStatus(null);
          return;
        }
        if (res.status !== 409 || data.error === "This transaction was already redeemed") {
          setStatus(data.error ?? "Something went wrong");
          return;
        }
        await sleep(3000);
      }
      setStatus(`Still not confirmed. Your payment is safe — tx ${txHash}. Refresh and try again shortly.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  const p = config?.pricing;

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
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
            Advertise
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Run Your Ad in the Burrow</h1>
          <p className="mx-auto mt-3 max-w-sm text-balance text-sm text-neutral-400">
            Your image or short video, right next to every gnome chat, for {p?.adDays ?? 7} days.
          </p>
        </div>

        {done ? (
          <div className="w-full rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6">
            <p className="font-bold text-emerald-300">Submitted for review.</p>
            <p className="mt-1 text-sm text-neutral-300">
              It&apos;ll go live in the rotation once approved — usually within a day.
            </p>
          </div>
        ) : !session ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
            <p className="text-sm text-neutral-400">Connect your wallet to submit an ad.</p>
            <WalletConnect
              onConnected={(s) => {
                setSession(s);
                loadConfig();
              }}
            />
          </div>
        ) : session.owner ? (
          <p className="text-sm text-pink-400">Owner accounts can&apos;t run ads.</p>
        ) : !config ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : (
          <section className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">1. Your media</p>
              <input
                ref={fileInput}
                type="file"
                accept={ALLOWED.join(",")}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {preview ? (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="relative mt-2 aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10"
                >
                  {file?.type.startsWith("video/") ? (
                    <video src={preview} className="h-full w-full object-cover" muted autoPlay loop playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={preview} alt="Ad preview" className="h-full w-full object-cover" />
                  )}
                </button>
              ) : (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="mt-2 flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-sm text-neutral-400 transition hover:border-emerald-400/40"
                >
                  <span className="font-bold">Tap to upload</span>
                  <span className="text-xs text-neutral-500">Image or video, up to 25MB</span>
                </button>
              )}
            </div>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              2. Link (optional)
              <input
                type="url"
                placeholder="https://your-link.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-normal normal-case text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </label>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">3. Pay &amp; submit</p>
              <button
                disabled={pending || !file || !config.treasury || !config.token}
                onClick={submit}
                className="mt-2 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Processing..." : `Pay ${p?.adPriceNomo ?? 5} NOMO — Run for ${p?.adDays ?? 7} days`}
              </button>
              {!config.treasury && <p className="mt-2 text-[11px] text-neutral-500">Ad payments open soon.</p>}
            </div>

            {status && <p className="break-all text-xs text-neutral-300">{status}</p>}
          </section>
        )}

        <p className="max-w-sm text-[11px] text-neutral-500">
          Every ad is reviewed before it goes live. No illegal content, scams, or impersonation — payment is
          non-refundable if your ad is rejected.
        </p>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>18+ only. Ad slots are non-refundable and have no cash value.</p>
        </div>
      </footer>
    </div>
  );
}
