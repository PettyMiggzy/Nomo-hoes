import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCreator, upsertCreator, myPosts, creatorEarnings } from "@/lib/marketplace";

export const runtime = "nodejs";

const MAX_NAME_LEN = 40;
const MAX_BIO_LEN = 300;

export async function GET() {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });

  const creator = await getCreator(session.wallet);
  if (!creator) return NextResponse.json({ creator: null });

  const [posts, earnings] = await Promise.all([myPosts(session.wallet), creatorEarnings(session.wallet)]);
  return NextResponse.json({ creator, posts, earnings });
}

// Body: { displayName, bio? } -- signs up (or edits) a creator profile. No
// approval gate to become a creator; every post is still owner-reviewed.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });

  let body: { displayName?: string; bio?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const displayName = body.displayName?.trim().slice(0, MAX_NAME_LEN);
  if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  const bio = body.bio?.trim().slice(0, MAX_BIO_LEN) || null;

  const creator = await upsertCreator(session.wallet, displayName, bio);
  return NextResponse.json({ creator });
}
