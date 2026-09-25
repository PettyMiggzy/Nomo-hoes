import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pendingPosts, reviewPost } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json({ posts: await pendingPosts() });
}

// Body: { id, approve }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  let body: { id?: number; approve?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.id !== "number" || typeof body.approve !== "boolean") {
    return NextResponse.json({ error: "Missing id or approve" }, { status: 400 });
  }

  const ok = await reviewPost(body.id, body.approve);
  if (!ok) return NextResponse.json({ error: "Already reviewed or not found" }, { status: 409 });
  return NextResponse.json({ success: true });
}
