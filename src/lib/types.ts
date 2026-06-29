export type Timeframe =
  | "1M"
  | "1W"
  | "1D"
  | "4H"
  | "1H"
  | "30m"
  | "10m"
  | "5m"
  | "3m"
  | "1m"
  | "30s";

export const TIMEFRAMES: Timeframe[] = [
  "1M",
  "1W",
  "1D",
  "4H",
  "1H",
  "30m",
  "10m",
  "5m",
  "3m",
  "1m",
  "30s",
];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1M": "Monthly",
  "1W": "Weekly",
  "1D": "Daily",
  "4H": "4 Hour",
  "1H": "1 Hour",
  "30m": "30 Min",
  "10m": "10 Min",
  "5m": "5 Min",
  "3m": "3 Min",
  "1m": "1 Min",
  "30s": "30 Sec",
};

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Direction = "bull" | "bear" | "neutral";
export type FlowStrength = "strong" | "weak" | "range";

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  label: string;
  direction: Direction;
  flow: FlowStrength;
  ema20: number;
  ema50: number;
  ema200: number | null;
  atr: number;
  rsi: number;
  lastPrice: number;
  swingHigh: number | null;
  swingLow: number | null;
  structure: "HH-HL" | "LH-LL" | "ranging";
  confluence: number;
  notes: string[];
}

export interface ConfluenceReport {
  symbol: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  dominant: Direction;
  confidence: number;
  perTimeframe: TimeframeAnalysis[];
  advisor: string;
  keyLevels: KeyLevel[];
  tradePlan: TradePlan;
  setups: Setup[];
  gauges: Gauge[];
  matrix: MatrixRow[];
}

export interface KeyLevel {
  price: number;
  type: "resistance" | "support";
  timeframes: Timeframe[];
  strength: number;
}

export interface TradePlan {
  bias: Direction;
  entryZone: { low: number; high: number };
  entryNote: string;
  stop: number;
  stopNote: string;
  target1: number;
  target2: number;
  target3: number;
  riskReward: { t1: number; t2: number; t3: number };
  invalidation: string;
}

export type SetupKind =
  | "EMA20 pullback (trend continuation)"
  | "Swing breakout"
  | "Oversold bounce in bull regime"
  | "Overbought pullback in bear regime"
  | "EMA alignment stack"
  | "RSI divergence"
  | "Range extreme fade";

export type SetupBias = "long" | "short";

export interface Setup {
  kind: SetupKind;
  bias: SetupBias;
  timeframe: Timeframe;
  detail: string;
}

export interface Gauge {
  timeframe: Timeframe;
  label: string;
  atrPct: number;
  atrTrend: "expanding" | "contracting" | "flat";
  buyerPct: number;
  sellerPct: number;
  flow: FlowStrength;
}

export interface MatrixRow {
  timeframe: Timeframe;
  label: string;
  direction: Direction;
  flow: FlowStrength;
  structure: "HH-HL" | "LH-LL" | "ranging";
  confluence: number;
}