import { NextResponse } from "next/server";
import { getGnome } from "@/data/gnomes";
import { getSession } from "@/lib/auth";
import {
  canSendMessage,
  recordMessage,
  usageStats,
  consumeGuestMessage,
  refundGuestMessage,
} from "@/lib/credits";
import { veniceChat } from "@/lib/venice";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";

const MAX_HISTORY = 40;
const MAX_MESSAGE_LEN = 500;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Vercel sets these from the connecting client and overwrites spoofed values.
function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(request: Request) {
  const session = await getSession();

  let body: { gnomeId?: string; messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const gnome = body.gnomeId ? getGnome(body.gnomeId) : undefined;
  if (!gnome) {
    return NextResponse.json({ error: "Unknown gnome" }, { status: 400 });
  }

  const trimmed = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_LEN) }));

  if (trimmed.length === 0) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  if (!session) {
    const ip = clientIp(request);
    const remaining = await consumeGuestMessage(ip);
    if (remaining < 0) {
      return NextResponse.json({ error: "guest_limit" }, { status: 403 });
    }
    try {
      const { reply, costUsd } = await veniceChat(gnome.persona, trimmed);
      await logUsage(null, "chat", false, costUsd);
      return NextResponse.json({ reply, guestRemaining: remaining });
    } catch (e) {
      console.error("Venice chat error", e);
      await refundGuestMessage(ip);
      return NextResponse.json({ reply: `${gnome.name} got distracted. Try again in a sec.` });
    }
  }

  let wasFree = true;
  if (!session.owner) {
    const gate = await canSendMessage(session.wallet);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          details: gate.reason,
          stats: await usageStats(session.wallet),
        },
        { status: 403 },
      );
    }
    wasFree = (await usageStats(session.wallet)).freeMessagesRemaining > 0;
  }

  let reply: string, costUsd: number;
  try {
    ({ reply, costUsd } = await veniceChat(gnome.persona, trimmed));
  } catch (e) {
    console.error("Venice chat error", e);
    return NextResponse.json({ reply: `${gnome.name} got distracted. Try again in a sec.` });
  }

  await logUsage(session.wallet, "chat", !wasFree && !session.owner, costUsd);

  if (session.owner) return NextResponse.json({ reply });

  await recordMessage(session.wallet, gnome.id);
  return NextResponse.json({ reply, stats: await usageStats(session.wallet) });
}
