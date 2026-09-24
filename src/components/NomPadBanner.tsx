import Image from "next/image";

export default function NomPadBanner() {
  return (
    <a
      href="https://nomosupply.com/garden?utm_source=nomohoes&utm_medium=banner"
      target="_blank"
      rel="noopener"
      className="group relative block w-full overflow-hidden rounded-xl border border-[#2d4a2f] shadow-[0_0_32px_-14px_rgba(182,255,61,0.55)]"
    >
      <Image
        src="/nomo/nompad-banner.webp"
        alt="Nom Pad — Launch. Trade. Grow. Launch with NOMO on Robinhood Chain."
        width={1170}
        height={202}
        sizes="(min-width: 1152px) 72rem, 100vw"
        className="h-auto w-full transition duration-300 group-hover:brightness-110"
      />
      <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9db09a]">
        Ad
      </span>
    </a>
  );
}
