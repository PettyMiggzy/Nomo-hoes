import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getItem, hasUnlocked } from "@/lib/premium";

export const runtime = "nodejs";

// The only endpoint that hands out a premium item's real media URL.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = await getItem(itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!session.owner && !(await hasUnlocked(itemId, session.wallet))) {
    return NextResponse.json({ error: "Unlock this to view it" }, { status: 403 });
  }
  return NextResponse.json({ mediaUrl: item.mediaUrl, kind: item.kind });
}
