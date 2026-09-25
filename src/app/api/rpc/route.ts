import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

async function forward(url: string, body: string): Promise<NextResponse | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) return null;
    return new NextResponse(await res.text(), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return null;
  }
}

// Wallets configured with this endpoint (via wallet_addEthereumChain) call it
// directly, so it stands in for Robinhood Chain's public RPC and only falls
// back to our paid, keyed provider server-side -- the key never reaches the
// browser or shows up in dev tools.
export async function POST(request: Request) {
  const body = await request.text();
  const primary = await forward(PUBLIC_RPC, body);
  if (primary) return primary;

  const fallback = process.env.ROBINHOOD_RPC;
  if (fallback) {
    const secondary = await forward(fallback, body);
    if (secondary) return secondary;
  }
  return NextResponse.json({ error: "RPC unavailable" }, { status: 502 });
}
