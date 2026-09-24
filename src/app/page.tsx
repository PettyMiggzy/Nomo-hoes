import Image from "next/image";
import Link from "next/link";

const SOCIALS = [
  { label: "X / Twitter", href: "#", handle: "@nohoescoin" },
  { label: "Telegram", href: "#", handle: "t.me/nohoescoin" },
];

const BOOKING_SHEET = [
  { label: "Chain", value: "TBA" },
  { label: "Supply", value: "TBA" },
  { label: "Tax", value: "0/0" },
  { label: "LP", value: "Locked at launch" },
];

const MOST_WANTED = [
  { src: "/mascot.jpg", charge: "Indecent Exposure to Copium" },
  { src: "/mascots/mascot-2.jpg", charge: "Aggravated Diamond Hands" },
  { src: "/mascots/mascot-3.jpg", charge: "Conspiracy to Pump and Dump" },
  { src: "/mascots/mascot-4.jpg", charge: "Excessive Bag Holding" },
  { src: "/mascots/mascot-5.jpg", charge: "Simping in the First Degree" },
  { src: "/mascots/mascot-6.jpg", charge: "Disturbing the Charts" },
  { src: "/mascots/mascot-7.jpg", charge: "Grand Theft of Your Attention" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-black tracking-tight">
          $NOHOES
        </span>
        <div className="hidden items-center gap-6 text-sm font-semibold text-neutral-400 sm:flex">
          <Link href="/walk-of-hoes" className="hover:text-white">
            Walk of Hoes
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
            Launching Soon
          </span>

          <div className="relative h-56 w-56 overflow-hidden rounded-3xl border-2 border-white/10 shadow-[0_0_60px_-10px_rgba(236,72,153,0.5)] sm:h-72 sm:w-72">
            <Image
              src="/mascot.jpg"
              alt="$NOHOES mascot booking photo"
              fill
              priority
              className="object-cover"
            />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              $NOHOES
            </h1>
            <p className="mx-auto max-w-xl text-balance text-lg text-neutral-400">
              Booked, charged, and about to moon. No more hoes — just
              degenerate gains. 18+ only, no bail.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-neutral-200"
              >
                {s.label}
              </a>
            ))}
            <button
              disabled
              className="cursor-not-allowed rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-neutral-500"
            >
              Buy — Coming Soon
            </button>
          </div>
        </section>

        {/* Most Wanted gallery */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              Most Wanted
            </h2>
            <Link
              href="/walk-of-hoes"
              className="text-sm font-bold text-pink-400 hover:text-pink-300"
            >
              Get booked yourself →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {MOST_WANTED.map((m) => (
              <div
                key={m.src}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
              >
                <Image
                  src={m.src}
                  alt={m.charge}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                  <p className="text-[11px] font-semibold leading-tight text-white">
                    {m.charge}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Booking sheet */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-20">
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-neutral-400">
                Booking Sheet
              </h2>
              <span className="font-mono text-xs text-neutral-500">
                Case #042725
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {BOOKING_SHEET.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-white">
                    {item.value}
                  </dd>
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
            <p className="mt-2 font-mono text-lg font-bold text-neutral-300">
              Revealed at launch
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-neutral-500">
              We will never DM you a contract address first. The only real
              CA will be posted on our official X and Telegram above —
              anything else is a scam.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center text-xs text-neutral-500">
          <p>
            18+ only. $NOHOES is a satirical meme coin with no intrinsic
            value or expectation of financial return. Nothing on this site
            is financial advice.
          </p>
          <p>© {new Date().getFullYear()} $NOHOES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
