import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getBotConfig, isDryRun } from "./config";
import { buyTokenWithSol, sellTokenForSol } from "./jupiter";
import {
  addEvent,
  createEventId,
  getBotEnabledState,
  getPositions,
  getTargets,
  getTradesToday,
  incrementTradesToday,
  recordTradeResult,
  upsertPosition,
} from "./store";
import type { ParsedSwap, Position } from "./types";
import { getBotBalanceSol } from "./solana";

export async function processSwap(swap: ParsedSwap): Promise<void> {
  const config = getBotConfig();
  const enabled = await getBotEnabledState();
  const targets = await getTargets();
  const target = targets.find(
    (t) => t.address === swap.wallet && t.enabled,
  );

  if (!target) {
    await logSkip(swap, "Wallet niet in actieve targets");
    return;
  }

  if (!enabled) {
    await logSkip(swap, "Bot staat uit");
    return;
  }

  if (swap.side === "buy") {
    await handleCopyBuy(swap, config);
    return;
  }

  await handleCopySell(swap);
}

async function handleCopyBuy(
  swap: ParsedSwap,
  config: ReturnType<typeof getBotConfig>,
): Promise<void> {
  const positions = await getPositions();
  const openPositions = positions.filter((p) => p.status === "open");
  const tradesToday = await getTradesToday();

  if (openPositions.length >= config.maxOpenPositions) {
    await logSkip(swap, "Max open posities bereikt");
    return;
  }

  if (tradesToday >= config.maxTradesPerDay) {
    await logSkip(swap, "Daglimiet trades bereikt");
    return;
  }

  if (openPositions.some((p) => p.mint === swap.mint)) {
    await logSkip(swap, "Positie voor mint bestaat al");
    return;
  }

  const balance = await getBotBalanceSol();
  if (balance < config.tradeSizeSol + 0.01) {
    await logSkip(swap, "Onvoldoende SOL saldo");
    return;
  }

  const position: Position = {
    id: createEventId(),
    mint: swap.mint,
    entrySol: config.tradeSizeSol,
    openedAt: new Date().toISOString(),
    sourceWallet: swap.wallet,
    sourceTx: swap.signature,
    status: "open",
  };

  if (isDryRun()) {
    await upsertPosition(position);
    await incrementTradesToday();
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] Zou ${config.tradeSizeSol} SOL kopen op ${swap.mint}`,
      txSignature: swap.signature,
      metadata: { mode: "dry_run" },
    });
    return;
  }

  try {
    const result = await buyTokenWithSol({
      mint: swap.mint,
      solAmount: config.tradeSizeSol,
      slippageBps: config.slippageBps,
    });

    position.quantity = result.quote.outAmount;
    await upsertPosition(position);
    await incrementTradesToday();
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Gekocht: ${config.tradeSizeSol} SOL → ${swap.mint}`,
      txSignature: result.signature,
    });
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Buy mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
      txSignature: swap.signature,
    });
  }
}

async function handleCopySell(swap: ParsedSwap): Promise<void> {
  const positions = await getPositions();
  const position = positions.find(
    (p) => p.mint === swap.mint && p.status === "open",
  );

  if (!position) {
    await logSkip(swap, "Geen open positie om te verkopen");
    return;
  }

  if (isDryRun()) {
    const pnlSol = estimatePnl(position);
    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = "copy_sell";
    position.exitSol = position.entrySol + pnlSol;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] Zou positie sluiten op copy-sell`,
      txSignature: swap.signature,
    });
    return;
  }

  if (!position.quantity) {
    await logSkip(swap, "Geen token quantity opgeslagen voor sell");
    return;
  }

  try {
    const result = await sellTokenForSol({
      mint: swap.mint,
      tokenAmount: position.quantity,
      slippageBps: getBotConfig().slippageBps,
    });

    const exitSol =
      Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = exitSol - position.entrySol;

    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = "copy_sell";
    position.exitSol = exitSol;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Verkocht: ${swap.mint} (PnL ${pnlSol.toFixed(4)} SOL)`,
      txSignature: result.signature,
    });
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Sell mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
      txSignature: swap.signature,
    });
  }
}

function estimatePnl(position: Position): number {
  return position.entrySol * 0.05 * (Math.random() > 0.5 ? 1 : -1);
}

async function logSkip(swap: ParsedSwap, reason: string): Promise<void> {
  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "skip",
    wallet: swap.wallet,
    mint: swap.mint,
    message: reason,
    txSignature: swap.signature,
  });
}

export async function checkOpenPositions(): Promise<void> {
  const config = getBotConfig();
  const positions = await getPositions();

  for (const position of positions.filter((p) => p.status === "open")) {
    const ageHours =
      (Date.now() - new Date(position.openedAt).getTime()) / 3_600_000;

    if (ageHours > 24) {
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "position_close",
        mint: position.mint,
        message: `Positie ouder dan 24u — handmatige review aanbevolen (SL ${config.stopLossPct}% / TP ${config.takeProfitPct}%)`,
      });
    }
  }
}
