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
  barsSinceCross: number;
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

export interface ScalpTrigger {
  status: "GO" | "WAIT" | "NO-GO";
  action: string;
  entry?: number;
  stop?: number;
  target?: number;
  reason: string;
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
  trigger: ScalpTrigger;
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

  const last5 = bars.slice(-5);
  const recentChange = last5.length === 5 ? last5[4].close - last5[0].open : 0;
  const recentReds = last5.length === 5 ? last5.filter((b) => b.close < b.open).length : 0;
  const recentGreens = last5.length === 5 ? last5.filter((b) => b.close >= b.open).length : 0;
  const dropping = recentChange < -atrVal * 0.5 || recentReds >= 4;
  const spiking = recentChange > atrVal * 0.5 || recentGreens >= 4;

  if (direction === "bull" && dropping) {
    direction = recentReds >= 4 ? "bear" : "neutral";
  }
  if (direction === "bear" && spiking) {
    direction = recentGreens >= 4 ? "bull" : "neutral";
  }

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
  if (dropping && ema9 > ema21) notes.push(`Price dropping fast (last 5 bars) but EMA9 still above EMA21 — EMAs lagging, momentum override active.`);
  if (spiking && ema9 < ema21) notes.push(`Price spiking fast (last 5 bars) but EMA9 still below EMA21 — EMAs lagging, momentum override active.`);
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
      barsSinceCross: a.barsSinceCross,
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
      barsSinceCross: a.barsSinceCross,
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
      barsSinceCross: -1,
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
      barsSinceCross: -1,
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
      barsSinceCross: -1,
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
      barsSinceCross: -1,
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
  const trigger = buildScalpTrigger(dominant, confidence, perTimeframe, allSignals, plan);

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
    trigger,
  };
}

function buildScalpTrigger(
  dominant: Direction,
  confidence: number,
  analyses: ScalpTFAnalysis[],
  signals: ScalpSignal[],
  plan: ScalpPlan
): ScalpTrigger {
  const fastTFs = ["5m", "3m", "1m", "30s"];
  const fastAnalyses = analyses.filter((a) => fastTFs.includes(a.tf));
  const fastAligned = fastAnalyses.filter((a) => a.direction === dominant);
  const fastAlignedTFs = fastAligned.map((a) => a.tf);

  const freshCrosses = signals.filter((s) => s.kind.startsWith("ema-cross") && s.barsSinceCross <= 2);
  const freshOnFast = freshCrosses.filter((s) => fastTFs.includes(s.tf));

  const deadVol = analyses.filter((a) => a.atrPct < 0.08);
  const deadTFs = deadVol.map((a) => a.tf);
  const tooDead = deadVol.length >= 4;

  const tangled = analyses.filter((a) => Math.abs(a.ema9 - a.ema21) < a.atr * 0.25);
  const tangledCount = tangled.length;
  const neutralCount = analyses.filter((a) => a.direction === "neutral").length;

  const splitTFs = confidence < 55 || dominant === "neutral";
  const chopScore = (tangledCount >= 3 ? 1 : 0) + (neutralCount >= 4 ? 1 : 0) + (splitTFs ? 1 : 0) + (freshCrosses.length === 0 && splitTFs ? 1 : 0);

  if (splitTFs && chopScore >= 2) {
    return {
      status: "NO-GO",
      action: "CHOP — sit out",
      reason: `TFs are split (${confidence}%, ${neutralCount}/${analyses.length} neutral) and ${tangledCount} TFs have tangled EMAs. No clean edge. Don't trade.`,
    };
  }

  if (tooDead) {
    return {
      status: "WAIT",
      action: "WAIT — vol too thin",
      reason: `ATR is below 0.08% on ${deadTFs.join(", ")} (${deadVol[0]?.atrPct.toFixed(3)}%). Range can't cover spread + commissions. Wait for vol to pick up.`,
    };
  }

  if (freshOnFast.length > 0 && fastAligned.length >= 2 && confidence >= 60) {
    const sig = freshOnFast[0];
    const action = dominant === "bull" ? `LONG NOW @ ${fmt(plan.entry)}` : `SHORT NOW @ ${fmt(plan.entry)}`;
    return {
      status: "GO",
      action,
      entry: plan.entry,
      stop: plan.stop,
      target: plan.target1,
      reason: `Fresh EMA9/21 ${sig.bias} cross on ${sig.tf} (${sig.barsSinceCross}b ago), ${fastAligned.length}/${fastTFs.length} fast TFs aligned ${dominant}, ${confidence}% confidence. Stop @ ${fmt(plan.stop)} (${plan.stopTicks}t). Target @ ${fmt(plan.target1)} (${plan.t1Ticks}t = +$${plan.t1Dollars}).`,
    };
  }

  if (fastAligned.length >= 3 && confidence >= 70 && freshCrosses.length === 0) {
    return {
      status: "WAIT",
      action: `WAIT — ${dominant === "bull" ? "long" : "short"} but no fresh trigger`,
      reason: `${fastAlignedTFs.join(", ")} are aligned ${dominant} (${confidence}%) but no fresh EMA9/21 cross in the last 2 bars. Hold existing if in, don't start new. Wait for a pullback + fresh cross to enter.`,
    };
  }

  if (freshOnFast.length > 0 && fastAligned.length < 2) {
    return {
      status: "WAIT",
      action: `WAIT — cross but no confluence`,
      reason: `Fresh cross on ${freshOnFast.map((s) => s.tf).join(", ")} but only ${fastAligned.length}/${fastTFs.length} fast TFs aligned. One TF flipping isn't a scalp — need at least 2 fast TFs agreeing. Wait for confirmation.`,
    };
  }

  if (confidence < 60) {
    return {
      status: "WAIT",
      action: "WAIT — bias too weak",
      reason: `Only ${confidence}% bias across scalp TFs. Need 60%+ for a GO. Fast TFs aligned: ${fastAlignedTFs.join(", ") || "none"}. Wait for alignment to build.`,
    };
  }

  return {
    status: "WAIT",
    action: "WAIT — no clean setup",
    reason: `Bias is ${dominant} (${confidence}%) but no fresh trigger + no confluence on fast TFs. Sit tight until a clean EMA9/21 cross fires with at least 2 fast TFs aligned.`,
  };
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

function composeScalpAdvisor(
  dominant: Direction,
  confidence: number,
  analyses: ScalpTFAnalysis[],
  signals: ScalpSignal[]
): string {
  const bullTFs = analyses.filter((a) => a.direction === "bull").map((a) => a.tf);
  const bearTFs = analyses.filter((a) => a.direction === "bear").map((a) => a.tf);
  const neutralTFs = analyses.filter((a) => a.direction === "neutral").map((a) => a.tf);
  const fresh = signals.filter((s) => s.kind.startsWith("ema-cross"));
  const bursts = signals.filter((s) => s.kind.startsWith("momentum"));
  const fades = signals.filter((s) => s.kind.startsWith("atr-fade"));

  const emaTangled = analyses.filter((a) => Math.abs(a.ema9 - a.ema21) < a.atr * 0.3);
  const tangledTFs = emaTangled.map((a) => a.tf);
  const deadVol = analyses.filter((a) => a.atrPct < 0.1);
  const deadTFs = deadVol.map((a) => a.tf);
  const noFresh = fresh.length === 0;
  const noBursts = bursts.length === 0;

  const strongBias = dominant !== "neutral" && confidence >= 60;
  const splitTFs = confidence < 55 || dominant === "neutral";
  const chopScore = (tangledTFs.length >= 3 ? 1 : 0) + (neutralTFs.length >= 4 ? 1 : 0) + (splitTFs ? 1 : 0) + (noFresh && splitTFs ? 1 : 0) + (noBursts && splitTFs ? 1 : 0);

  if (splitTFs && chopScore >= 2) {
    const reasons: string[] = [];
    if (tangledTFs.length > 0) reasons.push(`EMA9/21 tangled on ${tangledTFs.join(", ")} (no separation = no trend)`);
    if (deadTFs.length >= 4) reasons.push(`vol dead across ${deadTFs.length} TFs (${deadVol[0]?.atrPct.toFixed(2)}% ATR — not enough range)`);
    if (noFresh) reasons.push("no fresh EMA9/21 cross");
    if (noBursts) reasons.push("no momentum bursts");
    if (neutralTFs.length >= 3) reasons.push(`${neutralTFs.length}/${analyses.length} TFs neutral`);
    const reasonText = reasons.length > 0 ? `: ${reasons.join(", ")}` : "";
    return `⚠️ CHOP ZONE — don't trade right now${reasonText}. Bull: ${bullTFs.join(", ") || "none"}. Bear: ${bearTFs.join(", ") || "none"}. Sit on your hands until EMA9/21 separates cleanly on at least 3 TFs with rising volume. Scalping chop = death by a thousand cuts.`;
  }

  const dirAdj = dominant === "bull" ? "long" : "short";
  const parts = [`${confidence}% ${dirAdj} bias across scalp TFs. Bull: ${bullTFs.join(", ") || "none"}. Bear: ${bearTFs.join(", ") || "none"}.`];

  if (strongBias && noFresh && deadTFs.length >= 4) {
    parts.push(`Trend is intact but vol is thin (${deadVol[0]?.atrPct.toFixed(2)}% ATR) and no fresh cross — slow grind, hold existing ${dirAdj}s but don't add aggressively. Not chop, just quiet.`);
  } else if (strongBias && noFresh) {
    parts.push(`Trend holding with no fresh cross — continuation, not a new trigger. Hold existing ${dirAdj}s, wait for a pullback to add.`);
  } else if (fresh.length > 0) {
    parts.push(`Fresh EMA9/21 cross on ${fresh.map((s) => s.tf).join(", ")} — that's your trigger. ${dirAdj === "long" ? "Buy the cross, stop below the swing." : "Sell the cross, stop above the swing."}`);
  } else {
    parts.push(`No fresh cross yet — wait for EMA9/21 to flip on 1m/3m/5m before committing. Don't chase.`);
  }

  if (bursts.length > 0) {
    parts.push(`Momentum burst on ${bursts.map((s) => s.tf).join(", ")} — ride it but don't add late.`);
  }

  if (fades.length > 0) {
    parts.push(`ATR fade setup on ${fades.map((s) => s.tf).join(", ")} — counter-trend, keep size tiny and target the EMA21.`);
  }

  const hotVol = analyses.filter((a) => a.atrPct > 0.4).map((a) => a.tf);
  if (hotVol.length > 0) parts.push(`Vol is hot on ${hotVol.join(", ")} — size down, spreads will be wider.`);

  if (deadVol.length > 0 && deadTFs.length < 3) parts.push(`Vol is dead on ${deadTFs.join(", ")} — skip those TFs.`);

  if (tangledTFs.length > 0 && tangledTFs.length < 3) parts.push(`EMA9/21 tangled on ${tangledTFs.join(", ")} — those TFs are choppy, only trade the ones with clean separation.`);

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