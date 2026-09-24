import { NextResponse } from "next/server";
import { getGnome } from "@/data/gnomes";
import { getSession } from "@/lib/auth";
import { canSendMessage, recordMessage, usageStats } from "@/lib/credits";
import { veniceChat } from "@/lib/venice";

export const runtime = "nodejs";

const MAX_HISTORY = 40;
const MAX_MESSAGE_LEN = 500;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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

  if (!session.owner) {
    const gate = await canSendMessage(session.wallet, gnome.id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          details: gate.reason,
          stats: await usageStats(session.wallet, gnome.id),
        },
        { status: 403 },
      );
    }
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

  let reply: string;
  try {
    reply = await veniceChat(gnome.persona, trimmed);
  } catch (e) {
    console.error("Venice chat error", e);
    return NextResponse.json({ reply: `${gnome.name} got distracted. Try again in a sec.` });
  }

  if (session.owner) return NextResponse.json({ reply });

  await recordMessage(session.wallet, gnome.id);
  return NextResponse.json({ reply, stats: await usageStats(session.wallet, gnome.id) });
}
