import type { Bar } from "./types";
import { rsi } from "./indicators";

export interface MeanReversionInputs {
  bbPeriod: number;
  bbStd: number;
  zThreshold: number;
  rsiOversold: number;
  rsiOverbought: number;
  vwapDeviationPct: number;
}

export const DEFAULT_MR_INPUTS: MeanReversionInputs = {
  bbPeriod: 20,
  bbStd: 2,
  zThreshold: 2,
  rsiOversold: 30,
  rsiOverbought: 70,
  vwapDeviationPct: 2,
};

export interface BollingerPoint {
  sma: number;
  upper: number;
  lower: number;
  bandwidth: number;
}

export function bollingerBands(closes: number[], period: number, std: number): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      out.push({ sma: 0, upper: 0, lower: 0, bandwidth: 0 });
      continue;
    }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out.push({
      sma: mean,
      upper: mean + std * sd,
      lower: mean - std * sd,
      bandwidth: mean > 0 ? ((upper2(mean, sd, std) - lower2(mean, sd, std)) / mean) * 100 : 0,
    });
  }
  return out;
}

function upper2(mean: number, sd: number, std: number): number {
  return mean + std * sd;
}
function lower2(mean: number, sd: number, std: number): number {
  return mean - std * sd;
}

export function zScore(closes: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      out.push(0);
      continue;
    }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance) || 1;
    out.push((closes[i] - mean) / sd);
  }
  return out;
}

export function vwap(bars: Bar[]): number[] {
  const out: number[] = [];
  let cumVol = 0;
  let cumTP = 0;
  for (const b of bars) {
    const tp = (b.high + b.low + b.close) / 3;
    const v = b.volume ?? 1;
    cumVol += v;
    cumTP += tp * v;
    out.push(cumVol > 0 ? cumTP / cumVol : b.close);
  }
  return out;
}

export type MRSignalKind =
  | "oversold-tag"
  | "overbought-tag"
  | "extreme-z-low"
  | "extreme-z-high"
  | "mean-reclaim-up"
  | "mean-reclaim-down"
  | "vwap-fade-long"
  | "vwap-fade-short";

export interface MRSignal {
  index: number;
  kind: MRSignalKind;
  bias: "long" | "short";
  price: number;
  z: number;
  rsi: number;
  message: string;
}

export interface MeanReversionAnalysis {
  bb: BollingerPoint[];
  z: number[];
  vwapArr: number[];
  rsiVal: number;
  signals: MRSignal[];
  lastPrice: number;
  sma: number;
  upper: number;
  lower: number;
  currentZ: number;
  bandwidth: number;
  vwapVal: number;
  vwapDevPct: number;
  regime: "trending" | "ranging" | "extreme-low" | "extreme-high";
  advisor: string;
}

export function analyzeMeanReversion(bars: Bar[], inputs: MeanReversionInputs = DEFAULT_MR_INPUTS): MeanReversionAnalysis {
  const { bbPeriod, bbStd, zThreshold, rsiOversold, rsiOverbought, vwapDeviationPct } = inputs;
  const closes = bars.map((b) => b.close);
  const bb = bollingerBands(closes, bbPeriod, bbStd);
  const z = zScore(closes, bbPeriod);
  const vwapArr = vwap(bars);
  const rsiVal = rsi(closes, 14);

  const last = bars.length - 1;
  const lastPrice = closes[last] ?? 0;
  const lastBB = bb[last] ?? { sma: 0, upper: 0, lower: 0, bandwidth: 0 };
  const currentZ = z[last] ?? 0;
  const vwapVal = vwapArr[last] ?? lastPrice;
  const vwapDevPct = vwapVal > 0 ? ((lastPrice - vwapVal) / vwapVal) * 100 : 0;

  const signals: MRSignal[] = [];
  for (let i = Math.max(bbPeriod, 20); i < bars.length; i++) {
    const c = closes[i];
    const bbI = bb[i];
    const zI = z[i];
    const rsiI = rsi(closes.slice(0, i + 1), 14);
    if (!bbI || bbI.sma === 0) continue;

    if (c <= bbI.lower && rsiI < rsiOversold) {
      signals.push({
        index: i,
        kind: "oversold-tag",
        bias: "long",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Oversold tag: price ${fmt(c)} hit lower BB ${fmt(bbI.lower)} with RSI ${rsiI.toFixed(0)} — snapback long setup.`,
      });
    }
    if (c >= bbI.upper && rsiI > rsiOverbought) {
      signals.push({
        index: i,
        kind: "overbought-tag",
        bias: "short",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Overbought tag: price ${fmt(c)} hit upper BB ${fmt(bbI.upper)} with RSI ${rsiI.toFixed(0)} — snapback short setup.`,
      });
    }
    if (zI <= -zThreshold) {
      signals.push({
        index: i,
        kind: "extreme-z-low",
        bias: "long",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Extreme Z-score ${zI.toFixed(2)} (below -${zThreshold}) — statistically stretched, mean reversion likely.`,
      });
    }
    if (zI >= zThreshold) {
      signals.push({
        index: i,
        kind: "extreme-z-high",
        bias: "short",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Extreme Z-score ${zI.toFixed(2)} (above +${zThreshold}) — statistically stretched, mean reversion likely.`,
      });
    }
    if (i > 0 && closes[i - 1] < bbI.sma && c > bbI.sma && z[i - 1] < -1) {
      signals.push({
        index: i,
        kind: "mean-reclaim-up",
        bias: "long",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Mean reclaim UP: price crossed back above SMA${bbPeriod} from below after Z ${(z[i - 1]).toFixed(2)} — reversion confirmed long.`,
      });
    }
    if (i > 0 && closes[i - 1] > bbI.sma && c < bbI.sma && z[i - 1] > 1) {
      signals.push({
        index: i,
        kind: "mean-reclaim-down",
        bias: "short",
        price: c,
        z: zI,
        rsi: rsiI,
        message: `Mean reclaim DOWN: price crossed back below SMA${bbPeriod} from above after Z ${(z[i - 1]).toFixed(2)} — reversion confirmed short.`,
      });
    }
    const vwapI = vwapArr[i];
    if (vwapI > 0) {
      const dev = ((c - vwapI) / vwapI) * 100;
      if (dev <= -vwapDeviationPct && rsiI < 40) {
        signals.push({
          index: i,
          kind: "vwap-fade-long",
          bias: "long",
          price: c,
          z: zI,
          rsi: rsiI,
          message: `VWAP fade long: price ${dev.toFixed(2)}% below VWAP with RSI ${rsiI.toFixed(0)} — fade back toward mean.`,
        });
      }
      if (dev >= vwapDeviationPct && rsiI > 60) {
        signals.push({
          index: i,
          kind: "vwap-fade-short",
          bias: "short",
          price: c,
          z: zI,
          rsi: rsiI,
          message: `VWAP fade short: price +${dev.toFixed(2)}% above VWAP with RSI ${rsiI.toFixed(0)} — fade back toward mean.`,
        });
      }
    }
  }

  const recentSignals = signals.slice(-10);

  let regime: "trending" | "ranging" | "extreme-low" | "extreme-high" = "ranging";
  if (currentZ <= -zThreshold) regime = "extreme-low";
  else if (currentZ >= zThreshold) regime = "extreme-high";
  else if (lastBB.bandwidth > 4) regime = "trending";

  const advisor = composeMRAdvisor({
    lastPrice,
    sma: lastBB.sma,
    upper: lastBB.upper,
    lower: lastBB.lower,
    currentZ,
    bandwidth: lastBB.bandwidth,
    rsiVal,
    vwapVal,
    vwapDevPct,
    regime,
    recentSignals,
  });

  return {
    bb,
    z,
    vwapArr,
    rsiVal,
    signals: recentSignals,
    lastPrice,
    sma: lastBB.sma,
    upper: lastBB.upper,
    lower: lastBB.lower,
    currentZ,
    bandwidth: lastBB.bandwidth,
    vwapVal,
    vwapDevPct,
    regime,
    advisor,
  };
}

function composeMRAdvisor(p: {
  lastPrice: number;
  sma: number;
  upper: number;
  lower: number;
  currentZ: number;
  bandwidth: number;
  rsiVal: number;
  vwapVal: number;
  vwapDevPct: number;
  regime: string;
  recentSignals: MRSignal[];
}): string {
  const parts: string[] = [];

  if (p.regime === "extreme-low") {
    parts.push(`Mean reversion alert — price ${fmt(p.lastPrice)} is at Z-score ${p.currentZ.toFixed(2)} (below -2 std dev from SMA20). Stretched to the downside, snapback long likely.`);
  } else if (p.regime === "extreme-high") {
    parts.push(`Mean reversion alert — price ${fmt(p.lastPrice)} is at Z-score ${p.currentZ.toFixed(2)} (above +2 std dev from SMA20). Stretched to the upside, snapback short likely.`);
  } else if (p.bandwidth > 4) {
    parts.push(`Market is trending (BB bandwidth ${p.bandwidth.toFixed(2)}%) — mean reversion signals weaker in trends, use with caution.`);
  } else {
    parts.push(`Market is ranging (BB bandwidth ${p.bandwidth.toFixed(2)}%) — mean reversion is the higher-probability play. Fade the bands.`);
  }

  parts.push(`Bollinger Bands: lower ${fmt(p.lower)} · SMA20 ${fmt(p.sma)} · upper ${fmt(p.upper)}. RSI ${p.rsiVal.toFixed(0)}. Z-score ${p.currentZ.toFixed(2)}.`);

  if (p.vwapVal > 0) {
    const side = p.vwapDevPct >= 0 ? "above" : "below";
    parts.push(`VWAP ${fmt(p.vwapVal)} — price is ${Math.abs(p.vwapDevPct).toFixed(2)}% ${side} VWAP.`);
  }

  const longSigs = p.recentSignals.filter((s) => s.bias === "long");
  const shortSigs = p.recentSignals.filter((s) => s.bias === "short");
  if (longSigs.length > 0) {
    const latest = longSigs[longSigs.length - 1];
    const age = p.recentSignals.length - p.recentSignals.indexOf(latest);
    parts.push(`Latest long signal (${age} bars ago): ${latest.message}`);
  }
  if (shortSigs.length > 0) {
    const latest = shortSigs[shortSigs.length - 1];
    const age = p.recentSignals.length - p.recentSignals.indexOf(latest);
    parts.push(`Latest short signal (${age} bars ago): ${latest.message}`);
  }

  if (p.recentSignals.length === 0) {
    parts.push(`No mean reversion signals in the last 10 bars — price is respecting the mean, no fade setup.`);
  }

  return parts.join(" ");
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}