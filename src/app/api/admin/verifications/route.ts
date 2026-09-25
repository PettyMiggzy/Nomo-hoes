import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pendingVerifications, reviewVerification } from "@/lib/verification";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const pending = await pendingVerifications();
  // Document URLs stay server-side; the page loads them through ./doc.
  return NextResponse.json({
    pending: pending.map((v) => ({
      wallet: v.wallet,
      legalName: v.legalName,
      dateOfBirth: v.dateOfBirth,
      country: v.country,
      submittedAt: v.submittedAt,
    })),
  });
}

// Body: { wallet, approve, reason? }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { wallet?: string; approve?: boolean; reason?: string };
  if (!b.wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  const ok = await reviewVerification(b.wallet, Boolean(b.approve), b.reason?.slice(0, 300) || null);
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not pending" }, { status: 404 });
}
