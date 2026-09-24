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
  title: "$NOHOES — Launching Soon",
  description:
    "$NOHOES is coming. 18+ meme coin. No more hoes, just gains. Follow for the launch.",
  openGraph: {
    title: "$NOHOES — Launching Soon",
    description:
      "$NOHOES is coming. 18+ meme coin. No more hoes, just gains.",
    images: ["/mascot.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "$NOHOES — Launching Soon",
    description:
      "$NOHOES is coming. 18+ meme coin. No more hoes, just gains.",
    images: ["/mascot.jpg"],
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
