export type CardCondition =
  | "mint"
  | "near_mint"
  | "lightly_played"
  | "moderately_played"
  | "heavily_played"
  | "damaged"
  | "unknown";

export type DetectedCard = {
  index: number;
  name: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string;
  condition: CardCondition;
  confidence: number;
  notes?: string;
};

export type CardPrice = {
  variant: string;
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
};

export type MatchedCard = {
  detected: DetectedCard;
  matchStatus: "matched" | "partial" | "not_found";
  card?: {
    id: string;
    name: string;
    set: string;
    number: string;
    rarity: string;
    imageUrl?: string;
    tcgplayerUrl?: string;
    prices: CardPrice[];
  };
  searchQuery: string;
  error?: string;
};

export type ScanSummary = {
  totalDetected: number;
  matched: number;
  partial: number;
  notFound: number;
  totalMarketValue: number;
  currency: "USD";
};

export type ScanResponse = {
  id: string;
  scannedAt: string;
  provider: "gemini" | "openai";
  cards: MatchedCard[];
  summary: ScanSummary;
};
