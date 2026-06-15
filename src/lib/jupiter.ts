import { SOL_MINT } from "./config";
import { getBotPublicKey, sendVersionedTransaction } from "./solana";

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

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}): Promise<JupiterQuote | null> {
  const url = new URL(JUPITER_QUOTE_URL);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", String(params.amountLamports));
  url.searchParams.set("slippageBps", String(params.slippageBps));

  try {
    const response = await fetchWithTimeout(url, { next: { revalidate: 0 } });
    if (!response.ok) {
      console.error("Jupiter quote failed", await response.text());
      return null;
    }

    return (await response.json()) as JupiterQuote;
  } catch (error) {
    console.error("Jupiter quote fetch error", error);
    return null;
  }
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

  const quote = await getQuote(params);
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
