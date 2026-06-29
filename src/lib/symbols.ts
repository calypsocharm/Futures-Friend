import type { Bar } from "./types";

export interface SymbolDef {
  symbol: string;
  label: string;
  yahoo: string;
  category: "Equity Index" | "Rates" | "Energy" | "Metals" | "Ag" | "FX" | "Crypto";
  tickSize: number;
  tickValue: number;
}

export const SYMBOLS: SymbolDef[] = [
  { symbol: "M2KU2026", label: "Micro 2-Year Yield (Jun 2026)", yahoo: "M2K=F", category: "Rates", tickSize: 0.005, tickValue: 5 },
  { symbol: "ZN2026", label: "10-Year T-Note (Sep 2026)", yahoo: "ZN=F", category: "Rates", tickSize: 0.015625, tickValue: 15.625 },
  { symbol: "ZB2026", label: "30-Year Bond (Sep 2026)", yahoo: "ZB=F", category: "Rates", tickSize: 0.03125, tickValue: 31.25 },
  { symbol: "ESU2026", label: "E-mini S&P 500 (Sep 2026)", yahoo: "ES=F", category: "Equity Index", tickSize: 0.25, tickValue: 12.5 },
  { symbol: "NQU2026", label: "E-mini Nasdaq-100 (Sep 2026)", yahoo: "NQ=F", category: "Equity Index", tickSize: 0.25, tickValue: 5 },
  { symbol: "YM2026", label: "E-mini Dow (Sep 2026)", yahoo: "YM=F", category: "Equity Index", tickSize: 1, tickValue: 5 },
  { symbol: "RTY2026", label: "E-mini Russell 2000 (Sep 2026)", yahoo: "RTY=F", category: "Equity Index", tickSize: 0.1, tickValue: 5 },
  { symbol: "CLU2026", label: "Crude Oil (Aug 2026)", yahoo: "CL=F", category: "Energy", tickSize: 0.01, tickValue: 10 },
  { symbol: "NGU2026", label: "Natural Gas (Aug 2026)", yahoo: "NG=F", category: "Energy", tickSize: 0.001, tickValue: 2.5 },
  { symbol: "GCQ2026", label: "Gold (Aug 2026)", yahoo: "GC=F", category: "Metals", tickSize: 0.1, tickValue: 10 },
  { symbol: "SIQ2026", label: "Silver (Aug 2026)", yahoo: "SI=F", category: "Metals", tickSize: 0.5, tickValue: 25 },
  { symbol: "HG2026", label: "Copper (Sep 2026)", yahoo: "HG=F", category: "Metals", tickSize: 0.0005, tickValue: 12.5 },
  { symbol: "ZCZ2026", label: "Corn (Dec 2026)", yahoo: "ZC=F", category: "Ag", tickSize: 0.25, tickValue: 12.5 },
  { symbol: "ZSX2026", label: "Soybeans (Nov 2026)", yahoo: "ZS=F", category: "Ag", tickSize: 0.25, tickValue: 12.5 },
  { symbol: "ZW2026", label: "Wheat (Sep 2026)", yahoo: "ZW=F", category: "Ag", tickSize: 0.25, tickValue: 12.5 },
  { symbol: "6EU2026", label: "Euro FX (Sep 2026)", yahoo: "6E=F", category: "FX", tickSize: 0.00005, tickValue: 6.25 },
  { symbol: "6JU2026", label: "Japanese Yen (Sep 2026)", yahoo: "6J=F", category: "FX", tickSize: 0.0000005, tickValue: 6.25 },
  { symbol: "BTC2026", label: "Bitcoin Futures (Jul 2026)", yahoo: "BTC=F", category: "Crypto", tickSize: 5, tickValue: 5 },
  { symbol: "ETH2026", label: "Ether Futures (Jul 2026)", yahoo: "ETH=F", category: "Crypto", tickSize: 0.1, tickValue: 5 },
  { symbol: "SOL-USD", label: "Solana / USD (spot)", yahoo: "SOL-USD", category: "Crypto", tickSize: 0.01, tickValue: 1 },
];

export function symbolDef(symbol: string): SymbolDef | undefined {
  return SYMBOLS.find((s) => s.symbol === symbol);
}

export function seedSampleBars(symbol: string, count = 240, base = 100, drift = 0.0005): Bar[] {
  const bars: Bar[] = [];
  let price = base;
  const now = Date.now();
  const stepMs = 60_000;
  let trend = 1;
  for (let i = count; i > 0; i--) {
    if (i % 40 === 0) trend = Math.random() > 0.5 ? 1 : -1;
    const open = price;
    const change = (Math.random() - 0.5) * base * 0.01 + trend * drift * base;
    const close = Math.max(0.01, open + change);
    const high = Math.max(open, close) + Math.random() * base * 0.005;
    const low = Math.min(open, close) - Math.random() * base * 0.005;
    const volume = Math.round(500 + Math.random() * 1500);
    bars.push({ time: now - i * stepMs, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

import type { Timeframe } from "./types";

export interface YahooFetchSpec {
  yahooInterval: string;
  range: string;
  aggregate?: number;
}

export function yahooSpec(tf: Timeframe): YahooFetchSpec {
  switch (tf) {
    case "1M":
      return { yahooInterval: "1mo", range: "10y" };
    case "1W":
      return { yahooInterval: "1wk", range: "10y" };
    case "1D":
      return { yahooInterval: "1d", range: "10y" };
    case "4H":
      return { yahooInterval: "60m", range: "3mo", aggregate: 4 };
    case "1H":
      return { yahooInterval: "60m", range: "1mo" };
    case "30m":
      return { yahooInterval: "30m", range: "5d" };
    case "10m":
      return { yahooInterval: "5m", range: "5d", aggregate: 2 };
    case "5m":
      return { yahooInterval: "5m", range: "5d" };
    case "3m":
      return { yahooInterval: "1m", range: "5d", aggregate: 3 };
    case "1m":
      return { yahooInterval: "1m", range: "1d" };
    case "30s":
      return { yahooInterval: "1m", range: "1d", aggregate: 1 };
    default:
      return { yahooInterval: "1d", range: "1mo" };
  }
}

export function aggregateBars(bars: Bar[], groupSize: number): Bar[] {
  if (groupSize <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += groupSize) {
    const chunk = bars.slice(i, i + groupSize);
    if (chunk.length === 0) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((b) => b.high)),
      low: Math.min(...chunk.map((b) => b.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((a, b) => a + (b.volume ?? 0), 0) || undefined,
    });
  }
  return out;
}