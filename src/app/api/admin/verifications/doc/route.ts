import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVerification } from "@/lib/verification";
import { unseal } from "@/lib/sealed";

export const runtime = "nodejs";

// ?wallet=0x..&which=id|selfie -- decrypts a creator's ID document for the
// owner's review. Never cached.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.owner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const v = await getVerification(q.get("wallet") ?? "");
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = await fetch(q.get("which") === "selfie" ? v.selfieUrl : v.idDocUrl, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "Document missing" }, { status: 404 });
  const plain = unseal(Buffer.from(await res.arrayBuffer()));
  return new NextResponse(new Blob([Uint8Array.from(plain)]), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store, private" },
  });
}
