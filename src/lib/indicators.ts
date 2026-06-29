import type { Bar } from "./types";

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function emaLast(closes: number[], period: number): number | null {
  if (closes.length === 0) return null;
  return ema(closes, period)[closes.length - 1];
}

export function atr(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prev.close),
      Math.abs(b.low - prev.close)
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, c) => a + c, 0) / slice.length;
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

export function rsiSeries(closes: number[], period = 14): number[] {
  const out: number[] = [];
  if (closes.length <= period) {
    return closes.map(() => 50);
  }
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out.push(100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out.push(100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));
  }
  return out;
}

export interface SwingPoint {
  index: number;
  price: number;
  isHigh: boolean;
}

export function findSwings(bars: Bar[], lookback = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const window = bars.slice(i - lookback, i + lookback + 1);
    const isHigh = window.every((b) => bars[i].high >= b.high);
    const isLow = window.every((b) => bars[i].low <= b.low);
    if (isHigh) swings.push({ index: i, price: bars[i].high, isHigh: true });
    if (isLow) swings.push({ index: i, price: bars[i].low, isHigh: false });
  }
  return swings;
}

export type DivKind = "regular-bear" | "regular-bull" | "hidden-bear" | "hidden-bull";

export interface Divergence {
  kind: DivKind;
  tf: string;
  idxA: number;
  idxB: number;
  priceA: number;
  priceB: number;
  rsiA: number;
  rsiB: number;
  message: string;
}

export function detectDivergences(
  bars: Bar[],
  rsiVals: number[],
  lookback = 5,
  maxAge = 30
): Divergence[] {
  if (bars.length < 30 || rsiVals.length < 30) return [];
  const out: Divergence[] = [];
  const swings = findSwings(bars, lookback).filter((s) => s.index < rsiVals.length);
  const highs = swings.filter((s) => s.isHigh);
  const lows = swings.filter((s) => !s.isHigh);
  const last = bars.length - 1;

  for (let i = 1; i < highs.length; i++) {
    const a = highs[i - 1];
    const b = highs[i];
    if (last - b.index > maxAge) continue;
    const rsiA = rsiVals[a.index];
    const rsiB = rsiVals[b.index];
    if (b.price > a.price && rsiB < rsiA && rsiA > 60) {
      out.push({
        kind: "regular-bear",
        tf: "",
        idxA: a.index,
        idxB: b.index,
        priceA: a.price,
        priceB: b.price,
        rsiA,
        rsiB,
        message: `Regular bearish RSI divergence: price HH (${fmt(a.price)} → ${fmt(b.price)}) but RSI LH (${rsiA.toFixed(1)} → ${rsiB.toFixed(1)}) — momentum fading, watch for reversal lower.`,
      });
    }
    if (b.price < a.price && rsiB > rsiA) {
      out.push({
        kind: "hidden-bear",
        tf: "",
        idxA: a.index,
        idxB: b.index,
        priceA: a.price,
        priceB: b.price,
        rsiA,
        rsiB,
        message: `Hidden bearish RSI divergence: price LH but RSI HH — downtrend likely to resume, continuation short.`,
      });
    }
  }

  for (let i = 1; i < lows.length; i++) {
    const a = lows[i - 1];
    const b = lows[i];
    if (last - b.index > maxAge) continue;
    const rsiA = rsiVals[a.index];
    const rsiB = rsiVals[b.index];
    if (b.price < a.price && rsiB > rsiA && rsiA < 40) {
      out.push({
        kind: "regular-bull",
        tf: "",
        idxA: a.index,
        idxB: b.index,
        priceA: a.price,
        priceB: b.price,
        rsiA,
        rsiB,
        message: `Regular bullish RSI divergence: price LL (${fmt(a.price)} → ${fmt(b.price)}) but RSI HL (${rsiA.toFixed(1)} → ${rsiB.toFixed(1)}) — momentum diverging, watch for reversal higher.`,
      });
    }
    if (b.price > a.price && rsiB < rsiA) {
      out.push({
        kind: "hidden-bull",
        tf: "",
        idxA: a.index,
        idxB: b.index,
        priceA: a.price,
        priceB: b.price,
        rsiA,
        rsiB,
        message: `Hidden bullish RSI divergence: price HL but RSI LL — uptrend likely to resume, continuation long.`,
      });
    }
  }
  return out.slice(-6);
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

export function swingPoints(bars: Bar[], lookback = 3): { high: number | null; low: number | null } {
  if (bars.length < lookback * 2 + 1) {
    return {
      high: bars.length ? Math.max(...bars.map((b) => b.high)) : null,
      low: bars.length ? Math.min(...bars.map((b) => b.low)) : null,
    };
  }
  const recent = bars.slice(-lookback * 2 - 1);
  const center = recent[lookback];
  const isHigh = recent.every((b) => center.high >= b.high);
  const isLow = recent.every((b) => center.low <= b.low);
  return {
    high: isHigh ? center.high : Math.max(...recent.map((b) => b.high)),
    low: isLow ? center.low : Math.min(...recent.map((b) => b.low)),
  };
}

export function marketStructure(bars: Bar[]): "HH-HL" | "LH-LL" | "ranging" {
  if (bars.length < 10) return "ranging";
  const half = Math.floor(bars.length / 2);
  const first = swingPoints(bars.slice(0, half));
  const second = swingPoints(bars.slice(-half - 1));
  if (first.high == null || first.low == null || second.high == null || second.low == null)
    return "ranging";
  const higherHigh = second.high > first.high;
  const higherLow = second.low > first.low;
  const lowerHigh = second.high < first.high;
  const lowerLow = second.low < first.low;
  if (higherHigh && higherLow) return "HH-HL";
  if (lowerHigh && lowerLow) return "LH-LL";
  return "ranging";
}

export function flowPressure(bars: Bar[]): { buyers: number; sellers: number } {
  const recent = bars.slice(-20);
  let buyers = 0;
  let sellers = 0;
  for (const b of recent) {
    const body = b.close - b.open;
    const range = b.high - b.low || 1;
    const ratio = Math.abs(body) / range;
    if (body > 0) buyers += ratio;
    else sellers += ratio;
  }
  return { buyers, sellers };
}