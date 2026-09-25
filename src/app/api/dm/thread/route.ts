import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSession } from "@/lib/auth";
import { getMessages, getThread, markRead, sendCreatorReply, sendFanMessage } from "@/lib/dm";

export const runtime = "nodejs";

const MAX_LEN = 1000;

// Works out which side of the creator<->fan thread the caller is on; only
// the two participants can read or write it.
async function participant(creator: string | null, fan: string | null) {
  const session = await getSession();
  if (!session || session.owner) return { error: NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 }) };
  if (!creator || !fan || !isAddress(creator) || !isAddress(fan)) {
    return { error: NextResponse.json({ error: "Invalid thread" }, { status: 400 }) };
  }
  const me = session.wallet.toLowerCase();
  if (me !== creator.toLowerCase() && me !== fan.toLowerCase()) {
    return { error: NextResponse.json({ error: "Not your conversation" }, { status: 403 }) };
  }
  return { asCreator: me === creator.toLowerCase(), creator, fan };
}

// ?creator=0x..&fan=0x..&after=<last id> -- polled for new messages.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const p = await participant(q.get("creator"), q.get("fan"));
  if ("error" in p) return p.error;

  const [thread, messages] = await Promise.all([
    getThread(p.creator, p.fan),
    getMessages(p.creator, p.fan, Number(q.get("after")) || 0),
  ]);
  if (messages.length) await markRead(p.creator, p.fan, p.asCreator);
  return NextResponse.json({ messagesLeft: thread?.messagesLeft ?? 0, exists: Boolean(thread), messages });
}

// Body: { creator, fan, body }
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { creator?: string; fan?: string; body?: string };
  const p = await participant(b.creator ?? null, b.fan ?? null);
  if ("error" in p) return p.error;

  const text = b.body?.trim().slice(0, MAX_LEN);
  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const msg = p.asCreator ? await sendCreatorReply(p.creator, p.fan, text) : await sendFanMessage(p.creator, p.fan, text);
  if (!msg) {
    return NextResponse.json(
      { error: p.asCreator ? "No conversation with this fan" : "out_of_messages" },
      { status: p.asCreator ? 404 : 402 },
    );
  }
  return NextResponse.json({ message: msg });
}
