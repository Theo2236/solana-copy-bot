import { getAppUrl, getHeliusApiKey } from "./config";
import type { ParsedSwap, TradeSide } from "./types";
import { SOL_MINT } from "./config";

const HELIUS_API = "https://api.helius.xyz/v0";

interface HeliusWebhookPayload {
  signature?: string;
  timestamp?: number;
  type?: string;
  feePayer?: string;
  accountData?: Array<{
    account: string;
    nativeBalanceChange?: number;
    tokenBalanceChanges?: Array<{
      mint: string;
      rawTokenAmount?: { tokenAmount: string; decimals: number };
      userAccount?: string;
    }>;
  }>;
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
      tokenOutputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
      innerSwaps?: unknown[];
    };
  };
  description?: string;
}

export function parseHeliusSwap(
  payload: HeliusWebhookPayload,
  trackedWallets: Set<string>,
): ParsedSwap | null {
  const wallet =
    payload.feePayer ??
    payload.accountData?.find((a) => trackedWallets.has(a.account))?.account;

  if (!wallet || !trackedWallets.has(wallet)) {
    return null;
  }

  const swap = payload.events?.swap;
  if (!swap) {
    return inferSwapFromBalances(payload, wallet);
  }

  const solInput = swap.nativeInput?.amount
    ? Number(swap.nativeInput.amount) / 1_000_000_000
    : 0;
  const solOutput = swap.nativeOutput?.amount
    ? Number(swap.nativeOutput.amount) / 1_000_000_000
    : 0;

  if (solInput > 0 && swap.tokenOutputs?.length) {
    const mint = swap.tokenOutputs[0].mint;
    if (mint === SOL_MINT) return null;
    return {
      wallet,
      side: "buy",
      mint,
      solAmount: solInput,
      signature: payload.signature ?? "unknown",
      timestamp: payload.timestamp ?? Date.now(),
    };
  }

  if (solOutput > 0 && swap.tokenInputs?.length) {
    const mint = swap.tokenInputs[0].mint;
    if (mint === SOL_MINT) return null;
    return {
      wallet,
      side: "sell",
      mint,
      solAmount: solOutput,
      signature: payload.signature ?? "unknown",
      timestamp: payload.timestamp ?? Date.now(),
    };
  }

  return inferSwapFromBalances(payload, wallet);
}

function inferSwapFromBalances(
  payload: HeliusWebhookPayload,
  wallet: string,
): ParsedSwap | null {
  const account = payload.accountData?.find((a) => a.account === wallet);
  if (!account) return null;

  const nativeChange = (account.nativeBalanceChange ?? 0) / 1_000_000_000;
  const tokenChange = account.tokenBalanceChanges?.find(
    (t) => t.mint !== SOL_MINT,
  );

  if (!tokenChange?.mint) return null;

  if (nativeChange < -0.001) {
    return {
      wallet,
      side: "buy",
      mint: tokenChange.mint,
      solAmount: Math.abs(nativeChange),
      signature: payload.signature ?? "unknown",
      timestamp: payload.timestamp ?? Date.now(),
    };
  }

  if (nativeChange > 0.001) {
    return {
      wallet,
      side: "sell",
      mint: tokenChange.mint,
      solAmount: nativeChange,
      signature: payload.signature ?? "unknown",
      timestamp: payload.timestamp ?? Date.now(),
    };
  }

  return null;
}

export async function registerHeliusWebhook(
  addresses: string[],
): Promise<{ webhookId: string; webhookUrl: string }> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is required to register webhooks");
  }

  const webhookUrl = `${getAppUrl()}/api/webhook/helius`;
  const existing = await listHeliusWebhooks();

  for (const hook of existing) {
    if (hook.webhookURL === webhookUrl) {
      await updateHeliusWebhook(hook.webhookID, addresses);
      return { webhookId: hook.webhookID, webhookUrl };
    }
  }

  const response = await fetch(`${HELIUS_API}/webhooks?api-key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: webhookUrl,
      transactionTypes: ["SWAP"],
      accountAddresses: addresses,
      webhookType: "enhanced",
      authHeader: process.env.HELIUS_WEBHOOK_SECRET ?? "",
      txnStatus: "success",
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius webhook create failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { webhookID: string };
  return { webhookId: data.webhookID, webhookUrl };
}

async function listHeliusWebhooks(): Promise<
  Array<{ webhookID: string; webhookURL: string }>
> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return [];

  const response = await fetch(`${HELIUS_API}/webhooks?api-key=${apiKey}`);
  if (!response.ok) return [];
  return (await response.json()) as Array<{
    webhookID: string;
    webhookURL: string;
  }>;
}

async function updateHeliusWebhook(
  webhookId: string,
  addresses: string[],
): Promise<void> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return;

  await fetch(`${HELIUS_API}/webhooks/${webhookId}?api-key=${apiKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: `${getAppUrl()}/api/webhook/helius`,
      transactionTypes: ["SWAP"],
      accountAddresses: addresses,
      webhookType: "enhanced",
      authHeader: process.env.HELIUS_WEBHOOK_SECRET ?? "",
      txnStatus: "success",
    }),
  });
}

export async function fetchRecentSwapsForWallet(
  wallet: string,
  limit = 5,
): Promise<ParsedSwap[]> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return [];

  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&type=SWAP&limit=${limit}`,
  );

  if (!response.ok) return [];

  const payloads = (await response.json()) as HeliusWebhookPayload[];
  const tracked = new Set([wallet]);
  const swaps: ParsedSwap[] = [];

  for (const payload of payloads) {
    const parsed = parseHeliusSwap(payload, tracked);
    if (parsed) swaps.push(parsed);
  }

  return swaps;
}
