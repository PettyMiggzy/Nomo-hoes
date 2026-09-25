import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { openReports, resolveReport } from "@/lib/reports";
import { takeDownCreatorPosts, takeDownPost } from "@/lib/marketplace";
import { getDmSettings, setDmSettings } from "@/lib/dm";
import { updateItem } from "@/lib/premium";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json({ reports: await openReports() });
}

// Body: { id, action: "dismiss" | "takedown" } -- takedown removes the
// reported post/item, or for a reported creator pulls all their posts and
// switches off their DMs.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { id?: number; action?: string; target?: string; targetId?: string };
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (b.action === "takedown" && b.targetId) {
    if (b.target === "post") await takeDownPost(Number(b.targetId));
    else if (b.target === "premium") await updateItem(Number(b.targetId), { active: false });
    else if (b.target === "creator") {
      await takeDownCreatorPosts(b.targetId);
      const dm = await getDmSettings(b.targetId);
      if (dm) await setDmSettings(b.targetId, false, dm.priceNomo ?? 0.01);
    }
  }
  await resolveReport(id);
  return NextResponse.json({ success: true });
}
