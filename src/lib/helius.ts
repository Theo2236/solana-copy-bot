import { getAppUrl, getHeliusApiKey } from "./config";
import type { ParsedSwap } from "./types";
import { isCopyableMint, isStablecoinMint, STABLECOIN_DECIMALS } from "./config";

const HELIUS_API = "https://api.helius.xyz/v0";

interface HeliusTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint?: string;
  /** Reeds decimaal-gecorrigeerd bedrag (bijv. 2257867.74). */
  tokenAmount?: number;
}

interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
}

interface HeliusWebhookPayload {
  signature?: string;
  timestamp?: number;
  type?: string;
  feePayer?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
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

/** Geeft de eerste copyable (memecoin) mint terug uit een lijst token in/outputs. */
function pickCopyableMint(
  entries: Array<{ mint: string }>,
): string | null {
  for (const entry of entries) {
    if (entry.mint && isCopyableMint(entry.mint)) return entry.mint;
  }
  return null;
}

type TokenEntry = { mint: string; rawTokenAmount?: { tokenAmount: string } };

/**
 * Decimaal-gecorrigeerde (absolute) tokenhoeveelheid die `wallet` voor `mint`
 * verhandelde, afgeleid uit accountData.tokenBalanceChanges. Geeft `undefined`
 * als die data ontbreekt. Consistent met de eenheid uit parseFromTransfers.
 */
function tokenAmountForMint(
  payload: HeliusWebhookPayload,
  wallet: string,
  mint: string,
): number | undefined {
  const changes = payload.accountData?.flatMap((a) => a.tokenBalanceChanges ?? []);
  if (!changes?.length) return undefined;
  let total = 0;
  for (const c of changes) {
    if (c.mint !== mint) continue;
    if (c.userAccount && c.userAccount !== wallet) continue;
    const raw = Number(c.rawTokenAmount?.tokenAmount ?? "0");
    const decimals = c.rawTokenAmount?.decimals ?? 0;
    if (Number.isFinite(raw)) total += raw / 10 ** decimals;
  }
  return total !== 0 ? Math.abs(total) : undefined;
}

/** Vindt een stablecoin-entry en geeft het USD-bedrag terug (raw → decimals). */
function stableUsdAmount(entries: TokenEntry[]): number | null {
  for (const entry of entries) {
    if (entry.mint && isStablecoinMint(entry.mint)) {
      const raw = Number(entry.rawTokenAmount?.tokenAmount ?? "0");
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const decimals = STABLECOIN_DECIMALS[entry.mint] ?? 6;
      return Math.abs(raw) / 10 ** decimals;
    }
  }
  return null;
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
    // Geen verrijkt swap-event (REST transactions API) → via tokenTransfers.
    const fromTransfers = parseFromTransfers(payload, wallet);
    if (fromTransfers) return fromTransfers;
    return inferSwapFromBalances(payload, wallet);
  }

  const solInput = swap.nativeInput?.amount
    ? Number(swap.nativeInput.amount) / 1_000_000_000
    : 0;
  const solOutput = swap.nativeOutput?.amount
    ? Number(swap.nativeOutput.amount) / 1_000_000_000
    : 0;

  const signature = payload.signature ?? "unknown";
  const timestamp = payload.timestamp ?? Date.now();
  const inputs = (swap.tokenInputs ?? []) as TokenEntry[];
  const outputs = (swap.tokenOutputs ?? []) as TokenEntry[];

  // 1) SOL → memecoin (buy met SOL)
  if (solInput > 0 && outputs.length) {
    const mint = pickCopyableMint(outputs);
    if (mint) {
      return { wallet, side: "buy", mint, solAmount: solInput, quote: "SOL", tokenAmount: tokenAmountForMint(payload, wallet, mint), signature, timestamp };
    }
  }

  // 2) memecoin → SOL (sell naar SOL)
  if (solOutput > 0 && inputs.length) {
    const mint = pickCopyableMint(inputs);
    if (mint) {
      return { wallet, side: "sell", mint, solAmount: solOutput, quote: "SOL", tokenAmount: tokenAmountForMint(payload, wallet, mint), signature, timestamp };
    }
  }

  // 3) stablecoin → memecoin (buy met USDC/USDT)
  const memeOut = pickCopyableMint(outputs);
  if (memeOut && inputs.some((e) => isStablecoinMint(e.mint))) {
    const usd = stableUsdAmount(inputs);
    return {
      wallet,
      side: "buy",
      mint: memeOut,
      solAmount: 0,
      usdAmount: usd ?? undefined,
      quote: "USD",
      tokenAmount: tokenAmountForMint(payload, wallet, memeOut),
      signature,
      timestamp,
    };
  }

  // 4) memecoin → stablecoin (sell naar USDC/USDT)
  const memeIn = pickCopyableMint(inputs);
  if (memeIn && outputs.some((e) => isStablecoinMint(e.mint))) {
    const usd = stableUsdAmount(outputs);
    return {
      wallet,
      side: "sell",
      mint: memeIn,
      solAmount: 0,
      usdAmount: usd ?? undefined,
      quote: "USD",
      tokenAmount: tokenAmountForMint(payload, wallet, memeIn),
      signature,
      timestamp,
    };
  }

  const fromTransfers = parseFromTransfers(payload, wallet);
  if (fromTransfers) return fromTransfers;

  return inferSwapFromBalances(payload, wallet);
}

/** Minimaal SOL-bedrag (lamports) om een swap als SOL-gefund te zien (boven fees). */
const SOL_FUNDING_THRESHOLD_LAMPORTS = 5_000_000; // 0.005 SOL

/**
 * Hoofd-parser voor de Helius transactions REST API. Die levert geen
 * `events.swap`, maar wel top-level `tokenTransfers` + `nativeTransfers`.
 * We bepalen de richting via de netto memecoin-beweging van de wallet.
 */
function parseFromTransfers(
  payload: HeliusWebhookPayload,
  wallet: string,
): ParsedSwap | null {
  const transfers = payload.tokenTransfers ?? [];
  if (transfers.length === 0) return null;

  // Netto tokenbeweging per copyable mint voor deze wallet.
  const net = new Map<string, number>();
  for (const t of transfers) {
    if (!t.mint || !isCopyableMint(t.mint)) continue;
    const amount = Number(t.tokenAmount ?? 0);
    if (!Number.isFinite(amount)) continue;
    let delta = 0;
    if (t.toUserAccount === wallet) delta += amount;
    if (t.fromUserAccount === wallet) delta -= amount;
    if (delta !== 0) net.set(t.mint, (net.get(t.mint) ?? 0) + delta);
  }

  // Kies de mint met de grootste absolute netto beweging.
  let mint: string | null = null;
  let best = 0;
  for (const [m, value] of net) {
    if (Math.abs(value) > Math.abs(best)) {
      best = value;
      mint = m;
    }
  }
  if (!mint || best === 0) return null;

  const side: ParsedSwap["side"] = best > 0 ? "buy" : "sell";
  const tokenAmount = Math.abs(best);
  const signature = payload.signature ?? "unknown";
  const timestamp = payload.timestamp ?? Date.now();

  // SOL-beweging van de wallet (incl. fees) als funding-indicatie.
  const nativeChangeLamports = Math.abs(
    payload.accountData?.find((a) => a.account === wallet)
      ?.nativeBalanceChange ?? 0,
  );

  if (nativeChangeLamports >= SOL_FUNDING_THRESHOLD_LAMPORTS) {
    return {
      wallet,
      side,
      mint,
      solAmount: nativeChangeLamports / 1_000_000_000,
      quote: "SOL",
      tokenAmount,
      signature,
      timestamp,
    };
  }

  // Geen noemenswaardige SOL-beweging → stablecoin-gefund. Zoek USD-bedrag.
  let usd: number | undefined;
  for (const t of transfers) {
    if (t.mint && isStablecoinMint(t.mint)) {
      const amt = Math.abs(Number(t.tokenAmount ?? 0));
      if (Number.isFinite(amt) && amt > 0) {
        usd = amt;
        break;
      }
    }
  }

  return {
    wallet,
    side,
    mint,
    solAmount: 0,
    usdAmount: usd,
    quote: "USD",
    tokenAmount,
    signature,
    timestamp,
  };
}

function inferSwapFromBalances(
  payload: HeliusWebhookPayload,
  wallet: string,
): ParsedSwap | null {
  const account = payload.accountData?.find((a) => a.account === wallet);
  if (!account) return null;

  const signature = payload.signature ?? "unknown";
  const timestamp = payload.timestamp ?? Date.now();
  const nativeChange = (account.nativeBalanceChange ?? 0) / 1_000_000_000;
  const tokenChange = account.tokenBalanceChanges?.find(
    (t) => isCopyableMint(t.mint),
  );

  if (!tokenChange?.mint) return null;

  const tokenAmount = tokenAmountForMint(payload, wallet, tokenChange.mint);

  // SOL-gefunde swap: richting bepalen via SOL-balansverandering.
  if (nativeChange < -0.001) {
    return { wallet, side: "buy", mint: tokenChange.mint, solAmount: Math.abs(nativeChange), quote: "SOL", tokenAmount, signature, timestamp };
  }
  if (nativeChange > 0.001) {
    return { wallet, side: "sell", mint: tokenChange.mint, solAmount: nativeChange, quote: "SOL", tokenAmount, signature, timestamp };
  }

  // Geen SOL-beweging → waarschijnlijk stablecoin-gefund. Richting bepalen via
  // de memecoin-balansverandering (positief = buy, negatief = sell).
  const memeAmount = Number(tokenChange.rawTokenAmount?.tokenAmount ?? "0");
  const stableChange = account.tokenBalanceChanges?.find((t) =>
    isStablecoinMint(t.mint),
  );
  const usd =
    stableChange?.rawTokenAmount
      ? Math.abs(Number(stableChange.rawTokenAmount.tokenAmount)) /
        10 ** (STABLECOIN_DECIMALS[stableChange.mint] ?? 6)
      : undefined;

  if (Number.isFinite(memeAmount) && memeAmount > 0) {
    return { wallet, side: "buy", mint: tokenChange.mint, solAmount: 0, usdAmount: usd, quote: "USD", tokenAmount, signature, timestamp };
  }
  if (Number.isFinite(memeAmount) && memeAmount < 0) {
    return { wallet, side: "sell", mint: tokenChange.mint, solAmount: 0, usdAmount: usd, quote: "USD", tokenAmount, signature, timestamp };
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

export interface WalletActivity {
  ok: boolean;
  swapCount: number;
  lastTimestamp: number | null;
  copyableSwapCount: number;
}

/**
 * Haalt recente SWAP-activiteit op voor een wallet via Helius. Gebruikt om
 * kandidaat-wallets te valideren op echte, recente memecoin-handel.
 */
export async function getWalletActivity(
  wallet: string,
  limit = 25,
): Promise<WalletActivity> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return { ok: false, swapCount: 0, lastTimestamp: null, copyableSwapCount: 0 };

  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&type=SWAP&limit=${limit}`,
  );
  if (!response.ok) {
    return { ok: false, swapCount: 0, lastTimestamp: null, copyableSwapCount: 0 };
  }

  const payloads = (await response.json()) as HeliusWebhookPayload[];
  const tracked = new Set([wallet]);
  let copyable = 0;
  let lastTimestamp: number | null = null;

  for (const payload of payloads) {
    if (payload.timestamp && (lastTimestamp === null || payload.timestamp > lastTimestamp)) {
      lastTimestamp = payload.timestamp;
    }
    if (parseHeliusSwap(payload, tracked)) copyable++;
  }

  return {
    ok: true,
    swapCount: payloads.length,
    lastTimestamp,
    copyableSwapCount: copyable,
  };
}

/** Debug: geeft een ruwe samenvatting van de laatste SWAP-transacties terug. */
export async function getWalletSwapSample(
  wallet: string,
  limit = 3,
): Promise<unknown> {
  const apiKey = getHeliusApiKey();
  if (!apiKey) return { error: "no api key" };

  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&type=SWAP&limit=${limit}`,
  );
  if (!response.ok) return { error: `status ${response.status}` };

  const payloads = (await response.json()) as Array<
    HeliusWebhookPayload & {
      tokenTransfers?: Array<{
        fromUserAccount?: string;
        toUserAccount?: string;
        mint?: string;
        tokenAmount?: number;
      }>;
      nativeTransfers?: Array<{
        fromUserAccount?: string;
        toUserAccount?: string;
        amount?: number;
      }>;
    }
  >;
  return payloads.map((p) => ({
    type: p.type,
    feePayer: p.feePayer,
    hasSwapEvent: Boolean(p.events?.swap),
    nativeBalanceChange:
      p.accountData?.find((a) => a.account === wallet)?.nativeBalanceChange ??
      null,
    tokenTransfers: p.tokenTransfers?.map((t) => ({
      mint: t.mint,
      in: t.toUserAccount === wallet,
      out: t.fromUserAccount === wallet,
      amount: t.tokenAmount,
    })),
    nativeTransfers: p.nativeTransfers?.map((t) => ({
      in: t.toUserAccount === wallet,
      out: t.fromUserAccount === wallet,
      amount: t.amount,
    })),
  }));
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
