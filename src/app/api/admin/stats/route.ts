import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTodayStats } from "@/lib/usage";
import { veniceBalance } from "@/lib/venice";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.owner) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  const [stats, venice] = await Promise.all([getTodayStats(), veniceBalance()]);
  return NextResponse.json({ ...stats, venice });
}
