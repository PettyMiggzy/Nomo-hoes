import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AgeGate from "@/components/AgeGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NOMO HOES — 18+ Gnome Companions",
  description:
    "24 fictional gnome companions. Chat free, then keep going with $NOMO. 18+ only.",
  openGraph: {
    title: "NOMO HOES — 18+ Gnome Companions",
    description: "24 fictional gnome companions. Chat free, then keep going with $NOMO.",
    images: ["/gnomes/brambleflower.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOMO HOES — 18+ Gnome Companions",
    description: "24 fictional gnome companions. Chat free, then keep going with $NOMO.",
    images: ["/gnomes/brambleflower.webp"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-white">
        <AgeGate />
        {children}
      </body>
    </html>
  );
}
