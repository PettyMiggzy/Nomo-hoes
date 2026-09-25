import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { getCreator } from "@/lib/marketplace";
import { getVerification, isAdult, submitVerification } from "@/lib/verification";
import { seal } from "@/lib/sealed";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET() {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  const v = await getVerification(session.wallet);
  return NextResponse.json({ status: v?.status ?? null, rejectReason: v?.rejectReason ?? null });
}

// multipart: legalName, dateOfBirth (YYYY-MM-DD), country, idDoc, selfie, attest=yes.
// Both photos are encrypted before they're stored; only the owner's review
// route can decrypt them.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.owner) return NextResponse.json({ error: "Sign in with a wallet" }, { status: 401 });
  if (!(await getCreator(session.wallet))) return NextResponse.json({ error: "Create your creator profile first" }, { status: 400 });

  const form = await request.formData();
  const legalName = String(form.get("legalName") ?? "").trim().slice(0, 120);
  const dob = String(form.get("dateOfBirth") ?? "");
  const country = String(form.get("country") ?? "").trim().slice(0, 60);
  const idDoc = form.get("idDoc");
  const selfie = form.get("selfie");

  if (form.get("attest") !== "yes") return NextResponse.json({ error: "You must confirm the statement" }, { status: 400 });
  if (!legalName || !country) return NextResponse.json({ error: "Legal name and country are required" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !isAdult(dob)) {
    return NextResponse.json({ error: "You must be 18 or older" }, { status: 400 });
  }
  for (const [f, label] of [
    [idDoc, "ID photo"],
    [selfie, "Selfie with your ID"],
  ] as const) {
    if (!(f instanceof File) || !IMAGE_TYPES.includes(f.type)) {
      return NextResponse.json({ error: `${label} must be a photo` }, { status: 400 });
    }
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `${label} must be under 4MB` }, { status: 400 });
  }

  const store = async (f: File, which: string) =>
    (
      await put(`verifications/${which}.bin`, seal(Buffer.from(await (f as File).arrayBuffer())), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/octet-stream",
      })
    ).url;
  const [idDocUrl, selfieUrl] = await Promise.all([store(idDoc as File, "id"), store(selfie as File, "selfie")]);

  const ok = await submitVerification(session.wallet, legalName, dob, country, idDocUrl, selfieUrl);
  if (!ok) return NextResponse.json({ error: "You're already verified" }, { status: 400 });
  return NextResponse.json({ status: "pending" });
}
