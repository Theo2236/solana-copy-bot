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

export interface BotConfig {
  tradeSizeSol: number;
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
  entrySol: number;
  entryPrice?: number;
  quantity?: string;
  openedAt: string;
  sourceWallet: string;
  sourceTx: string;
  status: "open" | "closed";
  exitSol?: number;
  pnlSol?: number;
  closedAt?: string;
  closeReason?: "take_profit" | "stop_loss" | "copy_sell" | "manual";
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

export interface DashboardData {
  stats: BotStats;
  positions: Position[];
  recentEvents: TradeEvent[];
  targets: TargetWallet[];
  config: Pick<
    BotConfig,
    | "tradeSizeSol"
    | "maxOpenPositions"
    | "maxTradesPerDay"
    | "stopLossPct"
    | "takeProfitPct"
  >;
}

export interface ParsedSwap {
  wallet: string;
  side: TradeSide;
  mint: string;
  solAmount: number;
  signature: string;
  timestamp: number;
}
