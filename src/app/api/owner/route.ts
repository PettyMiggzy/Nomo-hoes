import { NextResponse } from "next/server";
import {
  checkOwnerPassword,
  signSession,
  OWNER_WALLET,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Fixed delay blunts online password guessing.
  await new Promise((r) => setTimeout(r, 1000));

  if (typeof body.password !== "string" || !checkOwnerPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ wallet: OWNER_WALLET, owner: true });
  res.cookies.set(SESSION_COOKIE, signSession(OWNER_WALLET, true), sessionCookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
