import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listThreads } from "@/lib/dm";

export const runtime = "nodejs";

// The signed-in wallet's conversations: its creator inbox and the creators it
// has bought messages with.
export async function GET() {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  return NextResponse.json(await listThreads(session.wallet));
}
