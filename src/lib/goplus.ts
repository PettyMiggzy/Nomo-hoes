// GoPlus's free public Token Security API -- no key needed. See
// https://docs.gopluslabs.io/reference/tokensecurityusingget_1
const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

type GoPlusHolder = { address: string; percent: string; is_locked: number; is_contract: number };

type GoPlusRawResult = {
  token_name?: string;
  token_symbol?: string;
  total_supply?: string;
  holder_count?: string;
  owner_address?: string;
  is_honeypot?: string;
  is_mintable?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_blacklisted?: string;
  is_whitelisted?: string;
  hidden_owner?: string;
  can_take_back_ownership?: string;
  selfdestruct?: string;
  transfer_pausable?: string;
  slippage_modifiable?: string;
  is_anti_whale?: string;
  cannot_buy?: string;
  buy_tax?: string;
  sell_tax?: string;
  holders?: GoPlusHolder[];
};

export type SecurityCheck = { label: string; ok: boolean; detail: string };

export type SecuritySummary = {
  address: string;
  chainId: number;
  tokenName: string | null;
  tokenSymbol: string | null;
  totalSupply: string | null;
  holderCount: number | null;
  buyTax: number | null;
  sellTax: number | null;
  checks: SecurityCheck[];
  reportUrl: string;
};

const isTrue = (v: string | undefined) => v === "1";
const isFalseOrUnset = (v: string | undefined) => v === "0" || v === undefined || v === "";

function summarize(chainId: number, address: string, r: GoPlusRawResult): SecuritySummary {
  const checks: SecurityCheck[] = [
    { label: "Not a honeypot", ok: isFalseOrUnset(r.is_honeypot), detail: "Can be sold, not just bought" },
    { label: "Not mintable", ok: isFalseOrUnset(r.is_mintable), detail: "Supply can't be inflated by the owner" },
    { label: "Source verified", ok: isTrue(r.is_open_source), detail: "Contract code is public" },
    { label: "Ownership renounced", ok: r.owner_address === "0x0000000000000000000000000000000000000000" || isFalseOrUnset(r.owner_address), detail: "No owner-only backdoors" },
    { label: "No hidden owner", ok: isFalseOrUnset(r.hidden_owner), detail: "No disguised control after renouncing" },
    { label: "Ownership can't be reclaimed", ok: isFalseOrUnset(r.can_take_back_ownership), detail: "Renounce can't be undone" },
    { label: "No self-destruct", ok: isFalseOrUnset(r.selfdestruct), detail: "Contract can't be wiped" },
    { label: "Not blacklistable", ok: isFalseOrUnset(r.is_blacklisted), detail: "No per-wallet trading bans" },
    { label: "Not whitelist-gated", ok: isFalseOrUnset(r.is_whitelisted), detail: "Anyone can trade, not just approved wallets" },
    { label: "Trading can't be paused", ok: isFalseOrUnset(r.transfer_pausable), detail: "Owner can't freeze transfers" },
    { label: "Tax isn't adjustable", ok: isFalseOrUnset(r.slippage_modifiable), detail: "Buy/sell tax can't be changed after launch" },
    { label: "Not a proxy contract", ok: isFalseOrUnset(r.is_proxy), detail: "Logic can't be swapped out later" },
  ];

  return {
    address,
    chainId,
    tokenName: r.token_name ?? null,
    tokenSymbol: r.token_symbol ?? null,
    totalSupply: r.total_supply ?? null,
    holderCount: r.holder_count ? Number(r.holder_count) : null,
    buyTax: r.buy_tax ? Number(r.buy_tax) * 100 : null,
    sellTax: r.sell_tax ? Number(r.sell_tax) * 100 : null,
    checks,
    reportUrl: `https://gopluslabs.io/token-security/${chainId}/${address}`,
  };
}

export async function checkTokenSecurity(chainId: number, address: string): Promise<SecuritySummary> {
  const res = await fetch(`${GOPLUS_BASE}/${chainId}?contract_addresses=${address}`);
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const data = (await res.json()) as { code: number; message: string; result?: Record<string, GoPlusRawResult> };
  if (data.code !== 1 || !data.result) throw new Error(data.message || "GoPlus lookup failed");
  const raw = data.result[address.toLowerCase()];
  if (!raw) throw new Error("No data returned for that address");
  return summarize(chainId, address, raw);
}
