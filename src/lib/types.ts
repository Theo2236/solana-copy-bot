export type TradeSide = "buy" | "sell";

export type TradeStatus =
  | "pending"
  | "executed"
  | "skipped"
  | "failed"
  | "closed";

export interface TargetWallet {
  address: string;
  label: string;
  pnl30dSol: number;
  winRate: number;
  enabled: boolean;
}

export type CopySizeMode = "fixed" | "conviction";

export interface BotConfig {
  tradeSizeSol: number;
  copySizeMode: CopySizeMode;
  /** Bij conviction: tradeSizeSol hoort bij deze % wallet-inzet van de target (bv. 0.1 = 10%). */
  referenceConvictionPct: number;
  minCopyTradeSol: number;
  maxCopyTradeSol: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxDrawdownEur: number;
  minLiquidityUsd: number;
  minTokenAgeHours: number;
  slippageBps: number;
  targets: TargetWallet[];
}

export interface Position {
  id: string;
  mint: string;
  symbol?: string;
  /** Totaal geïnvesteerde SOL in de (nog open) positie — som van alle buys minus verkochte porties. */
  entrySol: number;
  /** Gewogen gemiddelde entryprijs (SOL per token base-unit). */
  entryPrice?: number;
  /** Resterende token-hoeveelheid (raw base units) na eventuele gedeeltelijke verkopen. */
  quantity?: string;
  openedAt: string;
  sourceWallet: string;
  sourceTx: string;
  status: "open" | "closed";
  exitSol?: number;
  pnlSol?: number;
  closedAt?: string;
  closeReason?: "take_profit" | "stop_loss" | "copy_sell" | "manual";
  /** Aantal keer bijgekocht (averaging-in). Start op 1. */
  buyCount?: number;
  /** Aantal gedeeltelijke verkopen. */
  sellCount?: number;
  /** Gerealiseerde PnL uit gedeeltelijke verkopen vóór volledige sluiting. */
  realizedPnlSol?: number;
  lastBuyAt?: string;
  lastSellAt?: string;
}

export interface TradeEvent {
  id: string;
  timestamp: string;
  type:
    | "webhook_received"
    | "copy_buy"
    | "copy_sell"
    | "skip"
    | "error"
    | "cron_poll"
    | "position_close";
  wallet?: string;
  mint?: string;
  message: string;
  txSignature?: string;
  metadata?: Record<string, unknown>;
}

export interface BotStats {
  balanceSol: number;
  openPositions: number;
  totalTrades: number;
  wins: number;
  losses: number;
  realizedPnlSol: number;
  tradesToday: number;
  lastEventAt?: string;
  botEnabled: boolean;
  mode: "live" | "dry_run";
  uptimeSince?: string;
  solPriceEur?: number | null;
}

export type DashboardConfig = Omit<BotConfig, "targets">;

/** Afgeleide statistieken, berekend uit bestaande posities + events. */
export interface DerivedStats {
  winRate: number | null;
  closedTrades: number;
  avgPnlSol: number | null;
  bestTradeSol: number | null;
  worstTradeSol: number | null;
  pnlTodaySol: number;
  pnlWeekSol: number;
  openExposureSol: number;
  exposurePct: number | null;
  skipCount24h: number;
  errorCount24h: number;
  copyCount24h: number;
}

/** Aggregatie van bot-kopieën per bron-wallet. */
export interface TargetPerformance {
  address: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  openTrades: number;
  realizedPnlSol: number;
  lastActivityAt?: string;
}

/** Eén dag in de PnL-tijdlijn (gesloten posities). */
export interface PnlPoint {
  date: string;
  pnlSol: number;
  trades: number;
}

export interface HealthStatus {
  redisConfigured: boolean;
  heliusConfigured: boolean;
  botWalletConfigured: boolean;
  webhookSecretConfigured: boolean;
  mode: "live" | "dry_run";
  lastEventAt?: string;
  minutesSinceLastEvent: number | null;
  silenceWarning: boolean;
}

export interface DashboardData {
  stats: BotStats;
  positions: Position[];
  recentEvents: TradeEvent[];
  targets: TargetWallet[];
  config: DashboardConfig;
  derivedStats: DerivedStats;
  targetPerformance: TargetPerformance[];
  pnlTimeline: PnlPoint[];
  health: HealthStatus;
  botWallet?: string | null;
}

export interface ParsedSwap {
  wallet: string;
  side: TradeSide;
  mint: string;
  /** Bedrag in SOL waarmee de target handelde (0 als met stablecoin gefund). */
  solAmount: number;
  /** Bedrag in USD als de trade met een stablecoin (USDC/USDT) is gefund. */
  usdAmount?: number;
  /** Funding-valuta van de target-trade. */
  quote?: "SOL" | "USD";
  /** Hoeveelheid van de memecoin die de target verhandelde (decimaal-gecorrigeerd, absoluut). */
  tokenAmount?: number;
  signature: string;
  timestamp: number;
}
