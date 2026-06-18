import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOL_MINT } from "./config";
import { getTradeQuote, type QuoteSource } from "./trade-quote";
import type { OpenPositionMark, Position } from "./types";

export async function computeOpenPositionMarks(
  positions: Position[],
  slippageBps: number,
): Promise<OpenPositionMark[]> {
  const open = positions.filter((p) => p.status === "open");

  return Promise.all(
    open.map(async (position) => {
      const base = {
        positionId: position.id,
        mint: position.mint,
      };

      if (!position.quantity) {
        return {
          ...base,
          currentValueSol: null,
          pnlSol: null,
          pnlPct: null,
        };
      }

      try {
        const quoteResult = await getTradeQuote({
          inputMint: position.mint,
          outputMint: SOL_MINT,
          amountLamports: BigInt(position.quantity),
          slippageBps,
        });

        if (!quoteResult.quote) {
          return {
            ...base,
            currentValueSol: null,
            pnlSol: null,
            pnlPct: null,
          };
        }

        const currentValueSol =
          Number(quoteResult.quote.outAmount) / LAMPORTS_PER_SOL;
        if (!Number.isFinite(currentValueSol)) {
          return {
            ...base,
            currentValueSol: null,
            pnlSol: null,
            pnlPct: null,
          };
        }

        const pnlSol = currentValueSol - position.entrySol;
        const pnlPct =
          position.entrySol > 0 ? (pnlSol / position.entrySol) * 100 : null;

        return {
          ...base,
          currentValueSol,
          pnlSol,
          pnlPct: Number.isFinite(pnlPct as number) ? pnlPct : null,
          quoteSource: quoteResult.source as QuoteSource | undefined,
          updatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          ...base,
          currentValueSol: null,
          pnlSol: null,
          pnlPct: null,
        };
      }
    }),
  );
}
