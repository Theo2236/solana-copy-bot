import { LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import type { JupiterQuote } from "./jupiter";
import { getPumpBondingCurveQuote, isPumpMint } from "./pump-quote";
import {
  getBotKeypair,
  getBotPublicKey,
  sendSignedVersionedTransaction,
} from "./solana";

const PUMPPORTAL_TRADE_URL = "https://pumpportal.fun/api/trade-local";
const DEFAULT_PRIORITY_FEE_SOL = 0.0001;

function slippagePercentFromBps(slippageBps: number): number {
  return Math.max(0.1, slippageBps / 100);
}

function toJupiterQuote(
  inputMint: string,
  outputMint: string,
  inAmount: string,
  outAmount: string,
): JupiterQuote {
  return {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    priceImpactPct: "0",
  };
}

type PumpPortalAction = "buy" | "sell";

async function requestPumpPortalTransaction(params: {
  action: PumpPortalAction;
  mint: string;
  amount: number | string;
  denominatedInSol: boolean;
  slippageBps: number;
}): Promise<VersionedTransaction> {
  const publicKey = getBotPublicKey();
  if (!publicKey) {
    throw new Error("BOT_WALLET_PRIVATE_KEY not configured");
  }

  const response = await fetch(PUMPPORTAL_TRADE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      action: params.action,
      mint: params.mint,
      amount: params.amount,
      denominatedInSol: params.denominatedInSol ? "true" : "false",
      slippage: slippagePercentFromBps(params.slippageBps),
      priorityFee: DEFAULT_PRIORITY_FEE_SOL,
      pool: "pump",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `PumpPortal ${params.action} mislukt (HTTP ${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

async function signAndSendPumpTransaction(
  tx: VersionedTransaction,
): Promise<string> {
  const kp = getBotKeypair();
  if (!kp) {
    throw new Error("BOT_WALLET_PRIVATE_KEY not configured");
  }
  tx.sign([kp]);
  return sendSignedVersionedTransaction(tx);
}

export async function isPumpBondingCurveActive(mint: string): Promise<boolean> {
  if (!isPumpMint(mint)) return false;
  const quote = await getPumpBondingCurveQuote({
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: mint,
    amountLamports: 10_000_000,
  });
  if (!quote.quote) return false;
  return !quote.error?.includes("afgestudeerd");
}

/**
 * Live buy op pump.fun via PumpPortal (bouwt + signeert bonding-curve tx).
 * Fallback-route wanneer Jupiter geen route heeft voor verse pump-mints.
 */
export async function buyPumpTokenWithSol(params: {
  mint: string;
  solAmount: number;
  slippageBps: number;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  if (!isPumpMint(params.mint)) {
    throw new Error("Geen pump.fun-mint");
  }

  const solLamports = Math.floor(params.solAmount * LAMPORTS_PER_SOL);
  if (solLamports < 1) {
    throw new Error("SOL-bedrag te klein voor pump.fun buy");
  }

  const quotePreview = await getPumpBondingCurveQuote({
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: params.mint,
    amountLamports: solLamports,
  });
  if (!quotePreview.quote) {
    throw new Error(quotePreview.error ?? "Geen pump.fun buy-quote");
  }

  const tx = await requestPumpPortalTransaction({
    action: "buy",
    mint: params.mint,
    amount: params.solAmount,
    denominatedInSol: true,
    slippageBps: params.slippageBps,
  });

  const signature = await signAndSendPumpTransaction(tx);

  return {
    signature,
    quote: toJupiterQuote(
      "So11111111111111111111111111111111111111112",
      params.mint,
      String(solLamports),
      quotePreview.quote.outAmount,
    ),
  };
}

/**
 * Live sell op pump.fun via PumpPortal.
 */
export async function sellPumpTokenForSol(params: {
  mint: string;
  tokenAmount: string;
  slippageBps: number;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  if (!isPumpMint(params.mint)) {
    throw new Error("Geen pump.fun-mint");
  }

  const tokenAmount = BigInt(params.tokenAmount);
  if (tokenAmount <= 0n) {
    throw new Error("Token amount moet > 0 zijn");
  }

  const quotePreview = await getPumpBondingCurveQuote({
    inputMint: params.mint,
    outputMint: "So11111111111111111111111111111111111111112",
    amountLamports: tokenAmount,
  });
  if (!quotePreview.quote) {
    throw new Error(quotePreview.error ?? "Geen pump.fun sell-quote");
  }

  const tx = await requestPumpPortalTransaction({
    action: "sell",
    mint: params.mint,
    amount: params.tokenAmount,
    denominatedInSol: false,
    slippageBps: params.slippageBps,
  });

  const signature = await signAndSendPumpTransaction(tx);

  return {
    signature,
    quote: toJupiterQuote(
      params.mint,
      "So11111111111111111111111111111111111111112",
      params.tokenAmount,
      quotePreview.quote.outAmount,
    ),
  };
}
