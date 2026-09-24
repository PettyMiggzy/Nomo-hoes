import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTodayStats } from "@/lib/usage";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.owner) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  return NextResponse.json(await getTodayStats());
}
