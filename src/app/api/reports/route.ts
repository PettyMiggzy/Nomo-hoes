import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fileReport } from "@/lib/reports";

export const runtime = "nodejs";

const REASONS = ["underage", "non-consensual", "stolen", "illegal", "spam", "other"];

// Body: { target: post|premium|creator, targetId, reason, details? } -- open
// to anyone, signed in or not; the owner triages in /owner/reports.
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as {
    target?: string;
    targetId?: string | number;
    reason?: string;
    details?: string;
  };
  if (!["post", "premium", "creator"].includes(b.target ?? "") || !b.targetId || !REASONS.includes(b.reason ?? "")) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const session = await getSession();
  await fileReport(
    b.target as "post" | "premium" | "creator",
    String(b.targetId).slice(0, 80),
    session && !session.owner ? session.wallet : null,
    b.reason!,
    b.details?.trim().slice(0, 500) || null,
  );
  return NextResponse.json({ success: true });
}
