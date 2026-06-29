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