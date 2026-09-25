import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { checkTokenSecurity } from "@/lib/goplus";
import { CHAIN_ID } from "@/lib/auth";

export const runtime = "nodejs";

// GET with no query: checks the two ecosystem tokens (NOMO, $NOHOES).
// GET ?address=0x...: checks any other Robinhood Chain token on request.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const custom = searchParams.get("address");

  if (custom) {
    if (!isAddress(custom)) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    try {
      const summary = await checkTokenSecurity(CHAIN_ID, custom);
      return NextResponse.json({ tokens: [{ label: summary.tokenSymbol ?? "Token", summary }] });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 502 });
    }
  }

  const known: { label: string; address?: string }[] = [
    { label: "NOMO", address: process.env.NOMO_CONTRACT },
    { label: "$NOHOES", address: process.env.NOHOES_CONTRACT },
  ];

  const tokens = await Promise.all(
    known
      .filter((t): t is { label: string; address: string } => !!t.address && isAddress(t.address))
      .map(async (t) => {
        try {
          return { label: t.label, summary: await checkTokenSecurity(CHAIN_ID, t.address) };
        } catch (e) {
          return { label: t.label, error: e instanceof Error ? e.message : "Lookup failed" };
        }
      }),
  );

  return NextResponse.json({ tokens });
}
