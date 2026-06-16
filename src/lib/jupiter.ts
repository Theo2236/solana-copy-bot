import { SOL_MINT } from "./config";
import { getBotPublicKey, sendVersionedTransaction } from "./solana";

export type QuoteFailureReason =
  | "api_error"
  | "token_not_tradable"
  | "no_route"
  | "amount_too_small"
  | "timeout"
  | "pump_graduated"
  | "pump_no_data"
  | "unknown";

/** V6-host quote-api.jup.ag is uitgefaseerd; lite-api is het actieve endpoint. */
const JUPITER_QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_URL = "https://lite-api.jup.ag/swap/v1/swap";
const FETCH_TIMEOUT_MS = 12_000;

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

export type JupiterQuoteResult = {
  quote: JupiterQuote | null;
  error?: {
    reason: QuoteFailureReason;
    message: string;
    statusCode?: number;
    errorCode?: string;
  };
};

type JupiterErrorBody = {
  error?: string;
  errorCode?: string;
  message?: string;
};

function mapJupiterError(
  status: number,
  body: JupiterErrorBody,
): JupiterQuoteResult["error"] {
  const errorCode = body.errorCode;
  const message =
    body.error ?? body.message ?? `Jupiter HTTP ${status}`;

  let reason: QuoteFailureReason = "api_error";
  if (errorCode === "TOKEN_NOT_TRADABLE") reason = "token_not_tradable";
  else if (errorCode === "COULD_NOT_FIND_ANY_ROUTE") reason = "no_route";
  else if (status === 400 && message.toLowerCase().includes("route")) {
    reason = "no_route";
  } else if (status >= 500) reason = "api_error";

  return { reason, message, statusCode: status, errorCode };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Geldig geheel lamport-bedrag voor Jupiter (geen NaN/decimale strings). */
export function toQuoteAmountLamports(value: number | bigint): number | null {
  if (typeof value === "bigint") {
    if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }
  if (!Number.isFinite(value) || value < 1) return null;
  const floored = Math.floor(value);
  return floored >= 1 ? floored : null;
}

export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}): Promise<JupiterQuoteResult> {
  const amount = toQuoteAmountLamports(params.amountLamports);
  if (amount === null) {
    return {
      quote: null,
      error: {
        reason: "amount_too_small",
        message: `Ongeldig swapbedrag (${params.amountLamports})`,
      },
    };
  }

  const url = new URL(JUPITER_QUOTE_URL);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("slippageBps", String(params.slippageBps));
  // Aanbevolen door Jupiter: ruimte voor pump.fun / DLMM-routes.
  url.searchParams.set("maxAccounts", "64");

  try {
    const response = await fetchWithTimeout(url, { next: { revalidate: 0 } });
    if (!response.ok) {
      let body: JupiterErrorBody = {};
      try {
        body = (await response.json()) as JupiterErrorBody;
      } catch {
        body = { error: await response.text() };
      }
      const error = mapJupiterError(response.status, body);
      console.error("Jupiter quote failed", error);
      return { quote: null, error };
    }

    const quote = (await response.json()) as JupiterQuote;
    if (!quote?.outAmount || quote.outAmount === "0") {
      return {
        quote: null,
        error: {
          reason: "no_route",
          message: "Jupiter quote zonder output amount",
        },
      };
    }

    return { quote };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Jupiter quote timeout"
        : error instanceof Error
          ? error.message
          : "Jupiter quote fetch error";
    console.error("Jupiter quote fetch error", error);
    return {
      quote: null,
      error: {
        reason: error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "unknown",
        message,
      },
    };
  }
}

/** Backwards-compatible wrapper — retourneert alleen de quote of null. */
export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}): Promise<JupiterQuote | null> {
  const result = await getJupiterQuote(params);
  return result.quote;
}

export async function executeSwap(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  const wallet = getBotPublicKey();
  if (!wallet) {
    throw new Error("Bot wallet not configured");
  }

  const { quote } = await getJupiterQuote(params);
  if (!quote) {
    throw new Error("No Jupiter quote available");
  }

  const swapResponse = await fetchWithTimeout(JUPITER_SWAP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!swapResponse.ok) {
    throw new Error(`Jupiter swap failed: ${await swapResponse.text()}`);
  }

  const { swapTransaction } = (await swapResponse.json()) as {
    swapTransaction: string;
  };

  const signature = await sendVersionedTransaction(swapTransaction);
  return { signature, quote };
}

export async function buyTokenWithSol(params: {
  mint: string;
  solAmount: number;
  slippageBps: number;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  const lamports = Math.floor(params.solAmount * 1_000_000_000);
  return executeSwap({
    inputMint: SOL_MINT,
    outputMint: params.mint,
    amountLamports: lamports,
    slippageBps: params.slippageBps,
  });
}

export async function sellTokenForSol(params: {
  mint: string;
  tokenAmount: string;
  slippageBps: number;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  return executeSwap({
    inputMint: params.mint,
    outputMint: SOL_MINT,
    amountLamports: Number(params.tokenAmount),
    slippageBps: params.slippageBps,
  });
}
