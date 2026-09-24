"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { randomCaseNumber, randomCharges } from "@/data/charges";
import { randomMascot } from "@/data/mascots";

const CANVAS_W = 900;
const CANVAS_H = 1125;
const PLACARD_H = 260;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
  return lineY + lineHeight;
}

export default function MugshotGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mascotSrc, setMascotSrc] = useState<string>(() => randomMascot());
  const [charges, setCharges] = useState<string[]>(() => randomCharges());
  const [caseNumber, setCaseNumber] = useState(() => randomCaseNumber());
  const [ready, setReady] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const photoH = CANVAS_H - PLACARD_H;

    const img = imgRef.current;
    if (img) {
      const scale = Math.max(CANVAS_W / img.width, photoH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (CANVAS_W - dw) / 2;
      const dy = (photoH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);

      // Flash tint
      ctx.fillStyle = "rgba(249, 115, 22, 0.08)";
      ctx.fillRect(0, 0, CANVAS_W, photoH);
    } else {
      ctx.fillStyle = "#27272a";
      ctx.fillRect(0, 0, CANVAS_W, photoH);
      ctx.fillStyle = "#52525b";
      ctx.font = "600 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Loading mascot...", CANVAS_W / 2, photoH / 2);
    }

    // Height-chart ticks
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 16px monospace";
    ctx.textAlign = "left";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = 40 + i * ((photoH - 80) / 11);
      const inches = 72 - i * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(28, y);
      ctx.stroke();
      ctx.fillText(`${inches}"`, 34, y + 5);

      ctx.beginPath();
      ctx.moveTo(CANVAS_W - 28, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${inches}"`, CANVAS_W - 34, y + 5);
      ctx.textAlign = "left";
    }

    // Placard
    const placardY = photoH;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, placardY, CANVAS_W, PLACARD_H);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, placardY + 2, CANVAS_W - 4, PLACARD_H - 4);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ec4899";
    ctx.font = "800 34px sans-serif";
    ctx.fillText("$NOHOES BOOKING", 32, placardY + 52);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 18px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`CASE #${caseNumber}`, CANVAS_W - 32, placardY + 50);
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, placardY + 70);
    ctx.lineTo(CANVAS_W - 32, placardY + 70);
    ctx.stroke();

    ctx.fillStyle = "#d4d4d8";
    ctx.font = "700 15px monospace";
    ctx.fillText("CHARGES:", 32, placardY + 100);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 22px sans-serif";
    let y = placardY + 132;
    for (const charge of charges) {
      y = wrapText(ctx, `• ${charge}`, 32, y, CANVAS_W - 64, 28) + 6;
    }

    ctx.fillStyle = "#71717a";
    ctx.font = "500 14px monospace";
    ctx.fillText("MCSD $NOHOES — WALK OF HOES", 32, CANVAS_H - 18);
  }, [charges, caseNumber]);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      draw();
    };
    img.src = mascotSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascotSrc]);

  useEffect(() => {
    draw();
  }, [draw]);

  const reroll = () => {
    setMascotSrc((current) => randomMascot(current));
    setCharges(randomCharges());
    setCaseNumber(randomCaseNumber());
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `nohoes-booking-${caseNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reroll}
          className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-pink-400"
        >
          Get Booked Again
        </button>
        <button
          onClick={download}
          disabled={!ready}
          className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Download
        </button>
      </div>

      <p className="max-w-md text-center text-xs text-neutral-500">
        Every mascot on this site is 100% AI-generated art — no real people,
        no photo uploads. Generated entirely in your browser. Satire only,
        18+.
      </p>
    </div>
  );
}
