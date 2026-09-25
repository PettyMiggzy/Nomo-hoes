import { encodeFunctionData, erc20Abi, parseUnits, decodeFunctionResult, type Hex } from "viem";

export type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

// Switches the wallet to `chainId`, adding it first (via our own /api/rpc
// proxy, never a raw keyed RPC URL) if the wallet doesn't know it yet.
export async function ensureChain(
  eth: EthProvider,
  chainId: number,
  chainName: string,
  explorerUrl: string,
): Promise<void> {
  const hexId = `0x${chainId.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (switchError) {
    // 4902 = wallet doesn't have this chain configured yet.
    if ((switchError as { code?: number })?.code !== 4902) throw switchError;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [`${window.location.origin}/api/rpc`],
          blockExplorerUrls: [explorerUrl],
        },
      ],
    });
  }
}

// Sends `amount` of `token` from `from` to `to` and returns the tx hash.
export async function sendTokenTransfer(
  eth: EthProvider,
  from: `0x${string}`,
  token: `0x${string}`,
  to: `0x${string}`,
  amount: number,
): Promise<Hex> {
  const decimalsHex = (await eth.request({
    method: "eth_call",
    params: [{ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "decimals" }) }, "latest"],
  })) as Hex;
  const decimals = decodeFunctionResult({ abi: erc20Abi, functionName: "decimals", data: decimalsHex });

  return (await eth.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, parseUnits(String(amount), decimals)],
        }),
      },
    ],
  })) as Hex;
}
