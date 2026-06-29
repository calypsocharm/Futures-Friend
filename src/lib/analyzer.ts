import type {
  Bar,
  ConfluenceReport,
  Direction,
  FlowStrength,
  Gauge,
  KeyLevel,
  MatrixRow,
  Setup,
  Timeframe,
  TimeframeAnalysis,
  TradePlan,
} from "./types";
import { TIMEFRAME_LABELS } from "./types";
import { atr, emaLast, flowPressure, marketStructure, rsi, swingPoints } from "./indicators";
import { symbolDef } from "./symbols";

export function analyzeTimeframe(timeframe: Timeframe, bars: Bar[]): TimeframeAnalysis {
  const closes = bars.map((b) => b.close);
  const e20 = emaLast(closes, 20);
  const e50 = emaLast(closes, 50);
  const e200 = closes.length >= 200 ? emaLast(closes, 200) : null;
  const atrVal = atr(bars, 14);
  const rsiVal = rsi(closes, 14);
  const lastPrice = closes[closes.length - 1] ?? 0;
  const swings = swingPoints(bars, 3);
  const structure = marketStructure(bars);
  const pressure = flowPressure(bars);

  let direction: Direction = "neutral";
  let flow: FlowStrength = "range";
  const notes: string[] = [];

  if (e20 && e50) {
    if (e20 > e50 && lastPrice > e20) direction = "bull";
    else if (e20 < e50 && lastPrice < e20) direction = "bear";
  }
  if (e200) {
    if (lastPrice > e200 && direction === "bull") notes.push("Price above EMA200 — bullish regime");
    if (lastPrice < e200 && direction === "bear") notes.push("Price below EMA200 — bearish regime");
  }

  if (structure === "HH-HL" && direction === "neutral") direction = "bull";
  if (structure === "LH-LL" && direction === "neutral") direction = "bear";

  const totalPressure = pressure.buyers + pressure.sellers;
  if (totalPressure > 0) {
    const buyerRatio = pressure.buyers / totalPressure;
    if (buyerRatio > 0.65) flow = "strong";
    else if (buyerRatio < 0.35) flow = "strong";
    else flow = "weak";
  }

  if (rsiVal > 70) notes.push(`RSI ${rsiVal.toFixed(1)} — overbought, watch for pullback`);
  else if (rsiVal < 30) notes.push(`RSI ${rsiVal.toFixed(1)} — oversold, watch for bounce`);

  let confluence = 0;
  if (direction === "bull") {
    if (e20 && e50 && e20 > e50) confluence++;
    if (e200 && lastPrice > e200) confluence++;
    if (structure === "HH-HL") confluence++;
    if (rsiVal > 50) confluence++;
    if (flow === "strong") confluence++;
  } else if (direction === "bear") {
    if (e20 && e50 && e20 < e50) confluence++;
    if (e200 && lastPrice < e200) confluence++;
    if (structure === "LH-LL") confluence++;
    if (rsiVal < 50) confluence++;
    if (flow === "strong") confluence++;
  }
  if (direction === "neutral") confluence = 0;

  return {
    timeframe,
    label: TIMEFRAME_LABELS[timeframe],
    direction,
    flow,
    ema20: e20 ?? 0,
    ema50: e50 ?? 0,
    ema200: e200,
    atr: atrVal,
    rsi: rsiVal,
    lastPrice,
    swingHigh: swings.high,
    swingLow: swings.low,
    structure,
    confluence,
    notes,
  };
}

export function buildConfluenceReport(
  symbol: string,
  barsByTimeframe: Partial<Record<Timeframe, Bar[]>>
): ConfluenceReport {
  const perTimeframe: TimeframeAnalysis[] = [];
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const tf of Object.keys(barsByTimeframe) as Timeframe[]) {
    const bars = barsByTimeframe[tf];
    if (!bars || bars.length < 5) continue;
    const a = analyzeTimeframe(tf, bars);
    perTimeframe.push(a);
    if (a.direction === "bull") bullishCount++;
    else if (a.direction === "bear") bearishCount++;
    else neutralCount++;
  }

  let dominant: Direction = "neutral";
  if (bullishCount > bearishCount && bullishCount > neutralCount) dominant = "bull";
  else if (bearishCount > bullishCount && bearishCount > neutralCount) dominant = "bear";

  const total = perTimeframe.length || 1;
  const dominantCount = dominant === "bull" ? bullishCount : dominant === "bear" ? bearishCount : neutralCount;
  const confidence = Math.round((dominantCount / total) * 100);

  const advisor = composeAdvisor(dominant, confidence, perTimeframe);
  const keyLevels = aggregateKeyLevels(perTimeframe);
  const tradePlan = buildTradePlan(dominant, perTimeframe, keyLevels);
  const setups = detectSetups(perTimeframe);
  const gauges = buildGauges(barsByTimeframe, perTimeframe);
  const matrix = buildMatrix(perTimeframe);

  return {
    symbol,
    bullishCount,
    bearishCount,
    neutralCount,
    dominant,
    confidence,
    perTimeframe,
    advisor,
    keyLevels,
    tradePlan,
    setups,
    gauges,
    matrix,
  };
}

function composeAdvisor(
  dominant: Direction,
  confidence: number,
  analyses: TimeframeAnalysis[]
): string {
  const highTimeframes = ["1M", "1W", "1D"];
  const high = analyses.filter((a) => highTimeframes.includes(a.timeframe));
  const highAgree = high.length > 0 && high.every((a) => a.direction === dominant);
  const ref = analyses[0];
  const rsi = ref?.rsi ?? 50;
  const flow = ref?.flow ?? "range";
  const structure = ref?.structure ?? "ranging";
  const overbought = rsi > 70;
  const oversold = rsi < 30;
  const chop = dominant === "neutral" || (flow === "range" && structure === "ranging");
  const strongFlow = flow === "strong";
  const bull = dominant === "bull";
  const bear = dominant === "bear";

  if (dominant === "neutral") {
    if (chop) {
      const parts = ["Market's in chop — timeframes are fighting and there's no clean edge."];
      if (structure === "ranging") parts.push("Stay out of the middle. If you must trade, fade the extremes with small size and tight stops.");
      else parts.push("Sit on your hands until the higher timeframes realign. Better to miss the move than catch a knife.");
      if (analyses.some((a) => a.rsi > 75 || a.rsi < 25)) parts.push("RSI is hitting extremes on some TFs — wait for a confirmed break or a clean reclaim before doing anything.");
      return parts.join(" ");
    }
    return "No clean bias right now. Patience pays — wait for timeframes to line up before risking capital.";
  }

  const dirAdj = bull ? "bullish" : "bearish";
  const action = bull ? "stay long and buy the dips" : "stay short and sell the rips";
  const entryCue = bull ? "pullbacks into EMA20" : "rallies into EMA20";

  if (confidence >= 70 && highAgree) {
    const parts = [`Strong ${dirAdj} alignment — ${confidence}% of timeframes agree and the higher TFs are lined up.`];
    parts.push(`${capitalize(action)} — that's the play.`);
    if (strongFlow) parts.push(`Flow is confirming on the lower TFs, so don't fight it.`);
    if (overbought && bull) parts.push(`RSI ${rsi.toFixed(0)} is a bit hot though, so don't chase the move — wait for a ${entryCue} to add.`);
    else if (oversold && bear) parts.push(`RSI ${rsi.toFixed(0)} is washed out though, so don't pile in here — wait for a ${entryCue} to add.`);
    else parts.push(`Look for ${entryCue} on the lower timeframes for entries.`);
    return parts.join(" ");
  }

  if (confidence >= 60) {
    const parts = [`${capitalize(dirAdj)} lean (${confidence}%), but the higher TFs aren't all on board yet.`];
    parts.push(`Bias toward ${bull ? "longs" : "shorts"}, but keep size light and stops tight until they align.`);
    if (!strongFlow) parts.push(`Flow is mixed on the lower TFs — only take clean setups, don't force it.`);
    return parts.join(" ");
  }

  if (confidence >= 45) {
    const parts = [`Weak ${dirAdj} lean (${confidence}%) — timeframes are split.`];
    parts.push(`If you ${bull ? "buy" : "sell"}, do it small and only on a high-quality setup. No ${action.split(" and ")[1]} yet.`);
    if (chop) parts.push(`Honestly this looks choppy — sitting out is a valid position.`);
    return parts.join(" ");
  }

  return `Timeframes are too split to have conviction (${confidence}%). Sit out the chop and wait for a cleaner read.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function aggregateKeyLevels(analyses: TimeframeAnalysis[]): KeyLevel[] {
  const map = new Map<number, { type: "resistance" | "support"; tfs: Set<Timeframe> }>();
  for (const a of analyses) {
    if (a.lastPrice <= 0) continue;
    if (a.swingHigh != null && a.swingHigh > a.lastPrice) {
      const key = roundLevel(a.swingHigh, a.lastPrice);
      const e = map.get(key) ?? { type: "resistance" as const, tfs: new Set() };
      e.tfs.add(a.timeframe);
      map.set(key, e);
    }
    if (a.swingLow != null && a.swingLow < a.lastPrice) {
      const key = roundLevel(a.swingLow, a.lastPrice);
      const e = map.get(key) ?? { type: "support" as const, tfs: new Set() };
      e.tfs.add(a.timeframe);
      map.set(key, e);
    }
  }
  const out: KeyLevel[] = [];
  for (const [price, e] of map) {
    out.push({ price, type: e.type, timeframes: [...e.tfs], strength: e.tfs.size });
  }
  out.sort((a, b) => Math.abs(b.price - (analyses[0]?.lastPrice ?? 0)) - Math.abs(a.price - (analyses[0]?.lastPrice ?? 0)));
  return out.slice(0, 8);
}

function roundLevel(price: number, ref: number): number {
  const scale = ref >= 1000 ? 1 : ref >= 100 ? 0.5 : ref >= 10 ? 0.1 : ref >= 1 ? 0.01 : 0.001;
  return Math.round(price / scale) * scale;
}

function buildTradePlan(
  dominant: Direction,
  analyses: TimeframeAnalysis[],
  levels: KeyLevel[]
): TradePlan {
  const last = analyses[0]?.lastPrice ?? 0;
  const bull = dominant === "bull";

  if (dominant === "neutral") {
    const swingHi = maxOrNull(analyses.map((a) => a.swingHigh));
    const swingLo = minOrNull(analyses.map((a) => a.swingLow));
    return {
      bias: "neutral",
      entryZone: { low: swingLo ?? last, high: swingHi ?? last },
      entryNote: "Range: fade edges. Long near support, short near resistance, small size only.",
      stop: swingHi ?? last,
      stopNote: "Stop beyond the range extreme being faded.",
      target1: swingLo ?? last,
      target2: last,
      target3: swingHi ?? last,
      riskReward: { t1: 1, t2: 0, t3: 1 },
      invalidation: "A clean close outside the range cancels the fade bias.",
    };
  }

  const ref = analyses.find((a) => a.ema20 > 0) ?? analyses[0];
  const atrVal = ref?.atr ?? Math.max(...analyses.map((a) => a.atr), 0.0001);
  const ema20 = ref?.ema20 ?? last;

  let entryLow: number;
  let entryHigh: number;
  let entryNote: string;
  if (bull) {
    entryHigh = ema20;
    entryLow = Math.max(ema20 - 0.5 * atrVal, levels.find((l) => l.type === "support")?.price ?? ema20 - atrVal);
    entryNote = `Pullback into EMA20 on a lower TF, ideally tagging nearest support. Bias long.`;
  } else {
    entryLow = ema20;
    entryHigh = Math.min(ema20 + 0.5 * atrVal, levels.find((l) => l.type === "resistance")?.price ?? ema20 + atrVal);
    entryNote = `Pullback into EMA20 on a lower TF, ideally tagging nearest resistance. Bias short.`;
  }

  let stop: number;
  let stopNote: string;
  if (bull) {
    const swingLow = minOrNull(analyses.map((a) => a.swingLow)) ?? ema20 - atrVal;
    stop = Math.min(swingLow, ema20 - 1.5 * atrVal);
    stopNote = `Below recent swing low (${fmt(swingLow)}) or 1.5×ATR under entry, whichever is tighter.`;
  } else {
    const swingHigh = maxOrNull(analyses.map((a) => a.swingHigh)) ?? ema20 + atrVal;
    stop = Math.max(swingHigh, ema20 + 1.5 * atrVal);
    stopNote = `Above recent swing high (${fmt(swingHigh)}) or 1.5×ATR over entry, whichever is tighter.`;
  }

  const risk = Math.abs(entryHigh - stop) || atrVal;
  let t1: number, t2: number, t3: number;
  if (bull) {
    t1 = entryHigh + risk;
    t2 = entryHigh + 2 * risk;
    t3 = entryHigh + 3 * risk;
  } else {
    t1 = entryLow - risk;
    t2 = entryLow - 2 * risk;
    t3 = entryLow - 3 * risk;
  }

  return {
    bias: dominant,
    entryZone: { low: entryLow, high: entryHigh },
    entryNote,
    stop,
    stopNote,
    target1: t1,
    target2: t2,
    target3: t3,
    riskReward: { t1: 1, t2: 2, t3: 3 },
    invalidation: bull
      ? `A clean close below ${fmt(stop)} invalidates the long bias.`
      : `A clean close above ${fmt(stop)} invalidates the short bias.`,
  };
}

function detectSetups(analyses: TimeframeAnalysis[]): Setup[] {
  const out: Setup[] = [];
  for (const a of analyses) {
    if (a.direction === "bull" && a.lastPrice > 0 && a.ema20 > 0 && a.lastPrice > a.ema20 && a.lastPrice < a.ema20 + 0.3 * a.atr) {
      out.push({
        kind: "EMA20 pullback (trend continuation)",
        bias: "long",
        timeframe: a.timeframe,
        detail: `${a.label}: price riding EMA20 in uptrend — potential continuation long.`,
      });
    }
    if (a.direction === "bear" && a.lastPrice > 0 && a.ema20 > 0 && a.lastPrice < a.ema20 && a.lastPrice > a.ema20 - 0.3 * a.atr) {
      out.push({
        kind: "EMA20 pullback (trend continuation)",
        bias: "short",
        timeframe: a.timeframe,
        detail: `${a.label}: price riding EMA20 in downtrend — potential continuation short.`,
      });
    }
    if (a.structure === "HH-HL" && a.swingHigh != null && a.lastPrice > a.swingHigh) {
      out.push({
        kind: "Swing breakout",
        bias: "long",
        timeframe: a.timeframe,
        detail: `${a.label}: close above prior swing high ${fmt(a.swingHigh)} — breakout long.`,
      });
    }
    if (a.structure === "LH-LL" && a.swingLow != null && a.lastPrice < a.swingLow) {
      out.push({
        kind: "Swing breakout",
        bias: "short",
        timeframe: a.timeframe,
        detail: `${a.label}: close below prior swing low ${fmt(a.swingLow)} — breakdown short.`,
      });
    }
    if (a.rsi < 30 && a.direction === "bull") {
      out.push({
        kind: "Oversold bounce in bull regime",
        bias: "long",
        timeframe: a.timeframe,
        detail: `${a.label}: RSI ${a.rsi.toFixed(1)} oversold inside bullish regime — bounce long.`,
      });
    }
    if (a.rsi > 70 && a.direction === "bear") {
      out.push({
        kind: "Overbought pullback in bear regime",
        bias: "short",
        timeframe: a.timeframe,
        detail: `${a.label}: RSI ${a.rsi.toFixed(1)} overbought inside bearish regime — fade short.`,
      });
    }
    if (a.ema200 && a.ema20 > 0 && a.ema50 > 0) {
      const stack = a.direction === "bull" && a.ema20 > a.ema50 && a.ema50 > a.ema200 && a.lastPrice > a.ema20;
      const stackShort = a.direction === "bear" && a.ema20 < a.ema50 && a.ema50 < a.ema200 && a.lastPrice < a.ema20;
      if (stack) {
        out.push({
          kind: "EMA alignment stack",
          bias: "long",
          timeframe: a.timeframe,
          detail: `${a.label}: price > EMA20 > EMA50 > EMA200 — full bullish stack.`,
        });
      }
      if (stackShort) {
        out.push({
          kind: "EMA alignment stack",
          bias: "short",
          timeframe: a.timeframe,
          detail: `${a.label}: price < EMA20 < EMA50 < EMA200 — full bearish stack.`,
        });
      }
    }
    if (a.structure === "ranging" && a.rsi > 75) {
      out.push({
        kind: "Range extreme fade",
        bias: "short",
        timeframe: a.timeframe,
        detail: `${a.label}: RSI ${a.rsi.toFixed(1)} at top of range — fade short toward range mid.`,
      });
    }
    if (a.structure === "ranging" && a.rsi < 25) {
      out.push({
        kind: "Range extreme fade",
        bias: "long",
        timeframe: a.timeframe,
        detail: `${a.label}: RSI ${a.rsi.toFixed(1)} at bottom of range — fade long toward range mid.`,
      });
    }
  }
  return out.slice(0, 12);
}

function buildGauges(
  barsByTimeframe: Partial<Record<Timeframe, Bar[]>>,
  analyses: TimeframeAnalysis[]
): Gauge[] {
  const out: Gauge[] = [];
  for (const a of analyses) {
    const bars = barsByTimeframe[a.timeframe];
    let atrTrend: "expanding" | "contracting" | "flat" = "flat";
    if (bars && bars.length >= 30) {
      const recentAtr = atr(bars.slice(-14), 14);
      const priorAtr = atr(bars.slice(-28, -14), 14);
      if (recentAtr > priorAtr * 1.15) atrTrend = "expanding";
      else if (recentAtr < priorAtr * 0.85) atrTrend = "contracting";
    }
    const pressure = bars ? flowPressure(bars) : { buyers: 0, sellers: 0 };
    const total = pressure.buyers + pressure.sellers || 1;
    out.push({
      timeframe: a.timeframe,
      label: a.label,
      atrPct: a.lastPrice > 0 ? (a.atr / a.lastPrice) * 100 : 0,
      atrTrend,
      buyerPct: Math.round((pressure.buyers / total) * 100),
      sellerPct: Math.round((pressure.sellers / total) * 100),
      flow: a.flow,
    });
  }
  return out;
}

function buildMatrix(analyses: TimeframeAnalysis[]): MatrixRow[] {
  return analyses.map((a) => ({
    timeframe: a.timeframe,
    label: a.label,
    direction: a.direction,
    flow: a.flow,
    structure: a.structure,
    confluence: a.confluence,
  }));
}

function maxOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.max(...nums) : null;
}

function minOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.min(...nums) : null;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

export function computePositionSize(
  symbol: string,
  accountSize: number,
  riskPct: number,
  entry: number,
  stop: number
): { contracts: number; dollarsAtRisk: number; ticksAtRisk: number; tickSize: number; tickValue: number } | null {
  const def = symbolDef(symbol);
  if (!def) return null;
  const tickSize = def.tickSize;
  const tickValue = def.tickValue;
  const riskPerContract = Math.abs(entry - stop) * (tickValue / tickSize);
  if (riskPerContract <= 0) return null;
  const dollarRisk = accountSize * (riskPct / 100);
  const contracts = Math.floor(dollarRisk / riskPerContract);
  const ticksAtRisk = Math.round(Math.abs(entry - stop) / tickSize);
  return { contracts: Math.max(0, contracts), dollarsAtRisk: contracts * riskPerContract, ticksAtRisk, tickSize, tickValue };
}