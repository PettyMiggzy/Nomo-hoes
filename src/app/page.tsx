import Image from "next/image";
import Link from "next/link";
import { GNOMES } from "@/data/gnomes";

const SOCIALS = [
  { label: "X / Twitter", href: "#", handle: "@nomohoes" },
  { label: "Telegram", href: "#", handle: "t.me/nomohoes" },
];

const TOKEN_SHEET = [
  { label: "Chain", value: "Robinhood (4663)" },
  { label: "Token", value: "$NOMO" },
  { label: "Access", value: "1,000 NOMO" },
  { label: "Per gnome", value: "10 free msgs/day" },
];

const FEATURED = GNOMES.slice(0, 8);

const PACKAGES = [
  {
    name: "Free Taste",
    price: "Free",
    detail: "No wallet needed",
    perks: ["5 free messages a day", "Chat with any gnome", "Peek at 18+ teasers"],
    cta: { label: "Start Chatting", href: "/gnomes" },
    featured: false,
  },
  {
    name: "Holder",
    price: "1,000 NOMO",
    detail: "Just hold it — nothing spent",
    perks: ["10 free messages a day with every gnome", "240 free messages a day total", "Unlocks paid packs"],
    cta: { label: "Meet the Gnomes", href: "/gnomes" },
    featured: false,
  },
  {
    name: "Gardener",
    price: "5 NOMO",
    detail: "Most popular",
    perks: ["500 extra messages", "or 10 custom 18+ pics", "Credits never expire"],
    cta: { label: "Buy Credits", href: "/credits" },
    featured: true,
  },
  {
    name: "Hollow Lord",
    price: "25 NOMO",
    detail: "For the committed",
    perks: ["2,500 extra messages", "or 50 custom 18+ pics", "Credits never expire"],
    cta: { label: "Buy Credits", href: "/credits" },
    featured: false,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-black tracking-tight">NOMO HOES</span>
        <div className="hidden items-center gap-6 text-sm font-semibold text-neutral-400 sm:flex">
          <Link href="/gnomes" className="hover:text-white">
            The Gnomes
          </Link>
          <Link href="/credits" className="hover:text-white">
            Credits
          </Link>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} className="hover:text-white">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 pb-20 pt-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-pink-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
            18+ Fictional AI Companions
          </span>

          <div className="relative h-56 w-56 overflow-hidden rounded-3xl border-2 border-white/10 shadow-[0_0_60px_-10px_rgba(236,72,153,0.5)] sm:h-72 sm:w-72">
            <Image
              src="/gnomes/brambleflower.webp"
              alt="NOMO HOES gnome companion"
              fill
              priority
              sizes="(min-width: 640px) 18rem, 14rem"
              className="object-cover"
            />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">NOMO HOES</h1>
            <p className="mx-auto max-w-xl text-balance text-lg text-neutral-400">
              24 gnome companions. 24 personalities. Start chatting free —
              no wallet, no signup. Hold $NOMO for more, and see what
              they&apos;re hiding. 18+ only.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/gnomes"
              className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400"
            >
              Chat Free Now
            </Link>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-neutral-200"
              >
                {s.label}
              </a>
            ))}
          </div>
        </section>

        {/* Packages */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="mb-6 text-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Packages</h2>
            <p className="mt-2 text-neutral-400">Everyone gets free messages. Keep going with $NOMO.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PACKAGES.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-2xl border p-5 text-left ${
                  p.featured
                    ? "border-pink-500/60 bg-pink-500/10 shadow-[0_0_40px_-12px_rgba(236,72,153,0.6)]"
                    : "border-white/10 bg-neutral-900/60"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-pink-400">{p.name}</p>
                <p className="mt-2 text-2xl font-black text-white">{p.price}</p>
                <p className="text-xs text-neutral-500">{p.detail}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-300">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span className="text-pink-400">✓</span>
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.cta.href}
                  className={`mt-5 rounded-full px-4 py-2 text-center text-sm font-bold transition ${
                    p.featured
                      ? "bg-pink-500 text-black hover:bg-pink-400"
                      : "border border-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  {p.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Gnome gallery */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              Featured Gnomes
            </h2>
            <Link href="/gnomes" className="text-sm font-bold text-pink-400 hover:text-pink-300">
              See all 24 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {FEATURED.map((g) => (
              <Link
                key={g.id}
                href={`/gnomes/${g.id}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
              >
                <Image
                  src={`/gnomes/${g.id}.webp`}
                  alt={g.name}
                  fill
                  sizes="(min-width: 768px) 20vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                  <p className="text-[11px] font-semibold leading-tight text-white">{g.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Token sheet */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-20">
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-neutral-400">
                Access Sheet
              </h2>
              <span className="font-mono text-xs text-neutral-500">$NOMO</span>
            </div>
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {TOKEN_SHEET.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Contract address */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-24">
          <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Contract Address
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-neutral-300">Revealed at launch</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-neutral-500">
              We will never DM you a contract address first. The only real CA
              will be posted on our official X and Telegram above — anything
              else is a scam.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            18+ only. Every gnome is a fictional AI character — no real
            people. $NOMO has no intrinsic value or expectation of financial
            return; nothing on this site is financial advice.
          </p>
          <p>© {new Date().getFullYear()} NOMO HOES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
