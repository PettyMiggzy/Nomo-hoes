import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

// Lazily creates tables on first use -- see src/lib/ads.ts for why.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      // Age/identity records for creators who post content of themselves.
      // id_doc_url / selfie_url point at AES-GCM sealed blobs (src/lib/sealed.ts).
      await sql`
        CREATE TABLE IF NOT EXISTS creator_verifications (
          wallet TEXT PRIMARY KEY,
          legal_name TEXT NOT NULL,
          date_of_birth DATE NOT NULL,
          country TEXT NOT NULL,
          id_doc_url TEXT NOT NULL,
          selfie_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          reject_reason TEXT,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          reviewed_at TIMESTAMPTZ
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS content_reports (
          id BIGSERIAL PRIMARY KEY,
          target TEXT NOT NULL CHECK (target IN ('post', 'premium', 'creator')),
          target_id TEXT NOT NULL,
          reporter_wallet TEXT,
          reason TEXT NOT NULL,
          details TEXT,
          resolved BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })();
  }
  return schemaReady;
}

const addr = (wallet: string) => wallet.toLowerCase();

export type VerificationStatus = "pending" | "approved" | "rejected";

export type Verification = {
  wallet: string;
  legalName: string;
  dateOfBirth: string;
  country: string;
  idDocUrl: string;
  selfieUrl: string;
  status: VerificationStatus;
  rejectReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

type Row = {
  wallet: string;
  legal_name: string;
  date_of_birth: string;
  country: string;
  id_doc_url: string;
  selfie_url: string;
  status: VerificationStatus;
  reject_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const map = (r: Row): Verification => ({
  wallet: r.wallet,
  legalName: r.legal_name,
  dateOfBirth: new Date(r.date_of_birth).toISOString().slice(0, 10),
  country: r.country,
  idDocUrl: r.id_doc_url,
  selfieUrl: r.selfie_url,
  status: r.status,
  rejectReason: r.reject_reason,
  submittedAt: new Date(r.submitted_at).toISOString(),
  reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
});

export function isAdult(dob: string, now = new Date()): boolean {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const eighteenth = new Date(Date.UTC(d.getUTCFullYear() + 18, d.getUTCMonth(), d.getUTCDate()));
  return eighteenth <= now;
}

export async function getVerification(wallet: string): Promise<Verification | null> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM creator_verifications WHERE wallet = ${addr(wallet)}`;
  return rows.length ? map(rows[0] as unknown as Row) : null;
}

export async function isVerifiedCreator(wallet: string): Promise<boolean> {
  return (await getVerification(wallet))?.status === "approved";
}

// Submitting again (e.g. after a rejection) replaces the old documents and
// puts the creator back in the queue. An approved creator can't resubmit.
export async function submitVerification(
  wallet: string,
  legalName: string,
  dateOfBirth: string,
  country: string,
  idDocUrl: string,
  selfieUrl: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    INSERT INTO creator_verifications (wallet, legal_name, date_of_birth, country, id_doc_url, selfie_url)
    VALUES (${addr(wallet)}, ${legalName}, ${dateOfBirth}, ${country}, ${idDocUrl}, ${selfieUrl})
    ON CONFLICT (wallet) DO UPDATE SET
      legal_name = EXCLUDED.legal_name, date_of_birth = EXCLUDED.date_of_birth, country = EXCLUDED.country,
      id_doc_url = EXCLUDED.id_doc_url, selfie_url = EXCLUDED.selfie_url,
      status = 'pending', reject_reason = NULL, submitted_at = now(), reviewed_at = NULL
    WHERE creator_verifications.status <> 'approved'
    RETURNING wallet`;
  return rows.length > 0;
}

export async function pendingVerifications(): Promise<Verification[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM creator_verifications WHERE status = 'pending' ORDER BY submitted_at ASC`;
  return (rows as unknown as Row[]).map(map);
}

export async function reviewVerification(wallet: string, approve: boolean, reason: string | null): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE creator_verifications
    SET status = ${approve ? "approved" : "rejected"}, reject_reason = ${approve ? null : reason}, reviewed_at = now()
    WHERE wallet = ${addr(wallet)} AND status = 'pending'
    RETURNING wallet`;
  return rows.length > 0;
}

// Revokes an approved creator (e.g. after a valid report).
export async function revokeVerification(wallet: string, reason: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`
    UPDATE creator_verifications SET status = 'rejected', reject_reason = ${reason}, reviewed_at = now()
    WHERE wallet = ${addr(wallet)} RETURNING wallet`;
  return rows.length > 0;
}

export type Report = {
  id: number;
  target: "post" | "premium" | "creator";
  targetId: string;
  reporterWallet: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

export async function fileReport(
  target: Report["target"],
  targetId: string,
  reporterWallet: string | null,
  reason: string,
  details: string | null,
): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO content_reports (target, target_id, reporter_wallet, reason, details)
    VALUES (${target}, ${targetId}, ${reporterWallet ? addr(reporterWallet) : null}, ${reason}, ${details})`;
}

export async function openReports(): Promise<Report[]> {
  await ensureSchema();
  const rows = await db()`SELECT * FROM content_reports WHERE NOT resolved ORDER BY created_at ASC LIMIT 200`;
  return (
    rows as unknown as {
      id: string;
      target: Report["target"];
      target_id: string;
      reporter_wallet: string | null;
      reason: string;
      details: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: Number(r.id),
    target: r.target,
    targetId: r.target_id,
    reporterWallet: r.reporter_wallet,
    reason: r.reason,
    details: r.details,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function resolveReport(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db()`UPDATE content_reports SET resolved = true WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
