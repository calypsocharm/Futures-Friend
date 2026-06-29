import type { Bar, Direction, Timeframe } from "./types";
import { SCALP_TIMEFRAMES, TIMEFRAME_LABELS } from "./types";
import { atr, ema, rsi } from "./indicators";

export interface ScalpSignal {
  tf: Timeframe;
  label: string;
  kind: "ema-cross-up" | "ema-cross-down" | "momentum-burst-up" | "momentum-burst-down" | "atr-fade-long" | "atr-fade-short";
  bias: "long" | "short";
  atPrice: number;
  barIndex: number;
  message: string;
}

export interface ScalpTFAnalysis {
  tf: Timeframe;
  label: string;
  direction: Direction;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  atr: number;
  atrPct: number;
  lastPrice: number;
  flow: "strong" | "weak" | "range";
  momentum: number;
  barsSinceCross: number;
  crossDirection: "up" | "down" | "none";
  notes: string[];
}

export interface ScalpReport {
  symbol: string;
  dominant: Direction;
  confidence: number;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  perTimeframe: ScalpTFAnalysis[];
  signals: ScalpSignal[];
  advisor: string;
  plan: ScalpPlan;
}

export interface ScalpPlan {
  bias: "long" | "short" | "flat";
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  stopTicks: number;
  t1Ticks: number;
  t2Ticks: number;
  tickSize: number;
  tickValue: number;
  stopDollars: number;
  t1Dollars: number;
  t2Dollars: number;
  rr: number;
}

export function analyzeScalpTF(tf: Timeframe, bars: Bar[]): ScalpTFAnalysis {
  const closes = bars.map((b) => b.close);
  const e9arr = ema(closes, 9);
  const e21arr = ema(closes, 21);
  const e50arr = ema(closes, 50);
  const ema9 = e9arr[e9arr.length - 1] ?? 0;
  const ema21 = e21arr[e21arr.length - 1] ?? 0;
  const ema50 = e50arr[e50arr.length - 1] ?? 0;
  const lastPrice = closes[closes.length - 1] ?? 0;
  const atrVal = atr(bars, 14);
  const atrPct = lastPrice > 0 ? (atrVal / lastPrice) * 100 : 0;
  const rsiVal = rsi(closes, 14);

  let direction: Direction = "neutral";
  if (ema9 > ema21 && lastPrice > ema9) direction = "bull";
  else if (ema9 < ema21 && lastPrice < ema9) direction = "bear";

  let crossDirection: "up" | "down" | "none" = "none";
  let barsSinceCross = 0;
  for (let i = e9arr.length - 1; i >= 1; i--) {
    const prevBull = e9arr[i - 1] >= e21arr[i - 1];
    const nowBull = e9arr[i] >= e21arr[i];
    if (prevBull !== nowBull) {
      crossDirection = nowBull ? "up" : "down";
      barsSinceCross = e9arr.length - 1 - i;
      break;
    }
  }

  const recent = bars.slice(-10);
  let momentum = 0;
  for (const b of recent) momentum += b.close - b.open;
  const flow = Math.abs(momentum) > atrVal * 2 ? "strong" : Math.abs(momentum) > atrVal * 0.5 ? "weak" : "range";

  const notes: string[] = [];
  if (crossDirection === "up" && barsSinceCross <= 3) notes.push(`Fresh EMA9/21 bull cross ${barsSinceCross} bars ago — momentum trigger.`);
  if (crossDirection === "down" && barsSinceCross <= 3) notes.push(`Fresh EMA9/21 bear cross ${barsSinceCross} bars ago — momentum trigger.`);
  if (rsiVal > 70) notes.push(`RSI ${rsiVal.toFixed(0)} hot — extended, wait for pullback.`);
  if (rsiVal < 30) notes.push(`RSI ${rsiVal.toFixed(0)} washed — watch for bounce.`);
  if (atrPct > 0.4) notes.push(`ATR ${atrPct.toFixed(2)}% — vol is hot, size down.`);
  if (atrPct < 0.1) notes.push(`ATR ${atrPct.toFixed(2)}% — vol is dead, scalp may lack range.`);

  return {
    tf,
    label: TIMEFRAME_LABELS[tf],
    direction,
    ema9,
    ema21,
    ema50,
    rsi: rsiVal,
    atr: atrVal,
    atrPct,
    lastPrice,
    flow,
    momentum,
    barsSinceCross,
    crossDirection,
    notes,
  };
}

export function detectScalpSignals(bars: Bar[], a: ScalpTFAnalysis): ScalpSignal[] {
  const out: ScalpSignal[] = [];
  const last = bars.length - 1;

  if (a.crossDirection === "up" && a.barsSinceCross <= 2) {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "ema-cross-up",
      bias: "long",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: EMA9 crossed ABOVE EMA21 ${a.barsSinceCross} bars ago — long trigger.`,
    });
  }
  if (a.crossDirection === "down" && a.barsSinceCross <= 2) {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "ema-cross-down",
      bias: "short",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: EMA9 crossed BELOW EMA21 ${a.barsSinceCross} bars ago — short trigger.`,
    });
  }

  const last3 = bars.slice(-3);
  const allUp = last3.length === 3 && last3.every((b) => b.close > b.open);
  const allDown = last3.length === 3 && last3.every((b) => b.close < b.open);
  if (allUp && a.direction === "bull") {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "momentum-burst-up",
      bias: "long",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: 3 consecutive up bars — momentum burst long.`,
    });
  }
  if (allDown && a.direction === "bear") {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "momentum-burst-down",
      bias: "short",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: 3 consecutive down bars — momentum burst short.`,
    });
  }

  const refClose = bars[bars.length - 6]?.close ?? a.lastPrice;
  const extension = Math.abs(a.lastPrice - refClose);
  if (a.rsi < 28 && extension > a.atr * 2 && a.lastPrice < a.ema21) {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "atr-fade-long",
      bias: "long",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: Stretched ${extension.toFixed(2)} past 5-bar ref with RSI ${a.rsi.toFixed(0)} — fade long for a snapback.`,
    });
  }
  if (a.rsi > 72 && extension > a.atr * 2 && a.lastPrice > a.ema21) {
    out.push({
      tf: a.tf,
      label: a.label,
      kind: "atr-fade-short",
      bias: "short",
      atPrice: a.lastPrice,
      barIndex: last,
      message: `${a.label}: Stretched ${extension.toFixed(2)} past 5-bar ref with RSI ${a.rsi.toFixed(0)} — fade short for a snapback.`,
    });
  }

  return out;
}

import { symbolDef } from "./symbols";

export function buildScalpReport(symbol: string, barsByTimeframe: Partial<Record<Timeframe, Bar[]>>): ScalpReport {
  const perTimeframe: ScalpTFAnalysis[] = [];
  const allSignals: ScalpSignal[] = [];
  let bullCount = 0, bearCount = 0, neutralCount = 0;

  for (const tf of SCALP_TIMEFRAMES) {
    const bars = barsByTimeframe[tf];
    if (!bars || bars.length < 10) continue;
    const a = analyzeScalpTF(tf, bars);
    perTimeframe.push(a);
    if (a.direction === "bull") bullCount++;
    else if (a.direction === "bear") bearCount++;
    else neutralCount++;
    allSignals.push(...detectScalpSignals(bars, a));
  }

  let dominant: Direction = "neutral";
  if (bullCount > bearCount && bullCount > neutralCount) dominant = "bull";
  else if (bearCount > bullCount && bearCount > neutralCount) dominant = "bear";

  const total = perTimeframe.length || 1;
  const domCount = dominant === "bull" ? bullCount : dominant === "bear" ? bearCount : neutralCount;
  const confidence = Math.round((domCount / total) * 100);

  const advisor = composeScalpAdvisor(dominant, confidence, perTimeframe, allSignals);
  const plan = buildScalpPlan(symbol, dominant, perTimeframe);

  return {
    symbol,
    dominant,
    confidence,
    bullCount,
    bearCount,
    neutralCount,
    perTimeframe,
    signals: allSignals.slice(0, 12),
    advisor,
    plan,
  };
}

function composeScalpAdvisor(
  dominant: Direction,
  confidence: number,
  analyses: ScalpTFAnalysis[],
  signals: ScalpSignal[]
): string {
  const bullTFs = analyses.filter((a) => a.direction === "bull").map((a) => a.tf);
  const bearTFs = analyses.filter((a) => a.direction === "bear").map((a) => a.tf);
  const fresh = signals.filter((s) => s.kind.startsWith("ema-cross"));
  const bursts = signals.filter((s) => s.kind.startsWith("momentum"));
  const fades = signals.filter((s) => s.kind.startsWith("atr-fade"));

  if (dominant === "neutral") {
    return `No scalp edge — TFs are mixed. Bull: ${bullTFs.join(", ") || "none"}. Bear: ${bearTFs.join(", ") || "none"}. Sit out and wait for a clean EMA9/21 cross with momentum.`;
  }

  const dirAdj = dominant === "bull" ? "long" : "short";
  const parts = [`${confidence}% ${dirAdj} bias across scalp TFs. Bull: ${bullTFs.join(", ") || "none"}. Bear: ${bearTFs.join(", ") || "none"}.`];

  if (fresh.length > 0) {
    parts.push(`Fresh EMA9/21 cross on ${fresh.map((s) => s.tf).join(", ")} — that's your trigger. ${dirAdj === "long" ? "Buy the cross, stop below the swing." : "Sell the cross, stop above the swing."}`);
  } else {
    parts.push(`No fresh cross yet — wait for EMA9/21 to flip on 1m/3m/5m before committing. Don't chase.`);
  }

  if (bursts.length > 0) {
    parts.push(`Momentum burst on ${bursts.map((s) => s.tf).join(", ")} — ${dirAdj === "long" ? "ride it but don't add late." : "ride it but don't add late."}`);
  }

  if (fades.length > 0) {
    parts.push(`ATR fade setup on ${fades.map((s) => s.tf).join(", ")} — counter-trend, keep size tiny and target the EMA21.`);
  }

  const hotVol = analyses.filter((a) => a.atrPct > 0.4).map((a) => a.tf);
  if (hotVol.length > 0) parts.push(`Vol is hot on ${hotVol.join(", ")} — size down, spreads will be wider.`);

  const deadVol = analyses.filter((a) => a.atrPct < 0.1).map((a) => a.tf);
  if (deadVol.length > 0) parts.push(`Vol is dead on ${deadVol.join(", ")} — not enough range to scalp, skip those TFs.`);

  return parts.join(" ");
}

function buildScalpPlan(
  symbol: string,
  dominant: Direction,
  analyses: ScalpTFAnalysis[]
): ScalpPlan {
  const def = symbolDef(symbol);
  const tickSize = def?.tickSize ?? 1;
  const tickValue = def?.tickValue ?? 1;
  const ref = analyses.find((a) => a.ema9 > 0) ?? analyses[0];
  const lastPrice = ref?.lastPrice ?? 0;
  const atrVal = ref?.atr ?? lastPrice * 0.001;

  if (dominant === "neutral") {
    return {
      bias: "flat",
      entry: lastPrice,
      stop: lastPrice,
      target1: lastPrice,
      target2: lastPrice,
      stopTicks: 0,
      t1Ticks: 0,
      t2Ticks: 0,
      tickSize,
      tickValue,
      stopDollars: 0,
      t1Dollars: 0,
      t2Dollars: 0,
      rr: 0,
    };
  }

  const bull = dominant === "bull";
  const entry = lastPrice;
  const stopDist = Math.max(atrVal * 0.75, tickSize * 4);
  const stop = bull ? entry - stopDist : entry + stopDist;
  const target1 = bull ? entry + stopDist * 1.5 : entry - stopDist * 1.5;
  const target2 = bull ? entry + stopDist * 3 : entry - stopDist * 3;

  const stopTicks = Math.round(Math.abs(entry - stop) / tickSize);
  const t1Ticks = Math.round(Math.abs(target1 - entry) / tickSize);
  const t2Ticks = Math.round(Math.abs(target2 - entry) / tickSize);

  return {
    bias: bull ? "long" : "short",
    entry,
    stop,
    target1,
    target2,
    stopTicks,
    t1Ticks,
    t2Ticks,
    tickSize,
    tickValue,
    stopDollars: stopTicks * tickValue,
    t1Dollars: t1Ticks * tickValue,
    t2Dollars: t2Ticks * tickValue,
    rr: 1.5,
  };
}