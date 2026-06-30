import type { Bar } from "./types";
import { atr } from "./indicators";

export interface AdaptiveSTInputs {
  atrLen: number;
  factor: number;
  trainingPeriod: number;
  highVolPct: number;
  midVolPct: number;
  lowVolPct: number;
}

export const DEFAULT_ST_INPUTS: AdaptiveSTInputs = {
  atrLen: 10,
  factor: 3,
  trainingPeriod: 100,
  highVolPct: 0.75,
  midVolPct: 0.5,
  lowVolPct: 0.25,
};

export interface SuperTrendPoint {
  st: number;
  direction: 1 | -1;
  isGreen: boolean;
  isRed: boolean;
  firstGreenBar: boolean;
}

export function computeAdaptiveSuperTrend(bars: Bar[], inputs: AdaptiveSTInputs = DEFAULT_ST_INPUTS): SuperTrendPoint[] {
  const { atrLen, factor, trainingPeriod, highVolPct, midVolPct, lowVolPct } = inputs;
  const n = bars.length;
  if (n < atrLen + 2) return [];

  const atrArr: number[] = [];
  for (let i = 0; i < n; i++) {
    atrArr.push(atr(bars.slice(0, i + 1), atrLen));
  }

  const out: SuperTrendPoint[] = new Array(n).fill(null).map(() => ({ st: 0, direction: 1 as const, isGreen: false, isRed: true, firstGreenBar: false }));
  let prevST = 0;
  let prevUpper = 0;
  let prevLower = 0;
  let firstUpper = true;
  let firstLower = true;

  for (let i = 0; i < n; i++) {
    const a = atrArr[i];
    if (!a || a <= 0 || Number.isNaN(a)) {
      out[i] = { st: 0, direction: 1, isGreen: false, isRed: true, firstGreenBar: false };
      continue;
    }

    const window = atrArr.slice(Math.max(0, i - trainingPeriod + 1), i + 1);
    if (window.length < 5) {
      out[i] = { st: 0, direction: 1, isGreen: false, isRed: true, firstGreenBar: false };
      continue;
    }
    const upper = Math.max(...window);
    const lower = Math.min(...window);

    const hv = lower + (upper - lower) * highVolPct;
    const mv = lower + (upper - lower) * midVolPct;
    const lv = lower + (upper - lower) * lowVolPct;

    let amean = hv;
    let bmean = mv;
    let cmean = lv;
    const trainStart = Math.max(0, i - trainingPeriod + 1);
    const trainEnd = i + 1;

    for (let iter = 0; iter < 8; iter++) {
      const hvB: number[] = [];
      const mvB: number[] = [];
      const lvB: number[] = [];
      for (let j = trainStart; j < trainEnd; j++) {
        const v = atrArr[j];
        if (!v || v <= 0) continue;
        const d1 = Math.abs(v - amean);
        const d2 = Math.abs(v - bmean);
        const d3 = Math.abs(v - cmean);
        if (d1 < d2 && d1 < d3) hvB.push(v);
        else if (d2 < d1 && d2 < d3) mvB.push(v);
        else if (d3 < d1 && d3 < d2) lvB.push(v);
      }
      const newA = hvB.length ? hvB.reduce((a, b) => a + b, 0) / hvB.length : amean;
      const newB = mvB.length ? mvB.reduce((a, b) => a + b, 0) / mvB.length : bmean;
      const newC = lvB.length ? lvB.reduce((a, b) => a + b, 0) / lvB.length : cmean;
      if (Math.abs(newA - amean) < 1e-9 && Math.abs(newB - bmean) < 1e-9 && Math.abs(newC - cmean) < 1e-9) {
        amean = newA; bmean = newB; cmean = newC;
        break;
      }
      amean = newA; bmean = newB; cmean = newC;
    }

    const dA = Math.abs(a - amean);
    const dB = Math.abs(a - bmean);
    const dC = Math.abs(a - cmean);
    const assigned = dA < dB && dA < dC ? amean : dB < dA && dB < dC ? bmean : cmean;

    const src = (bars[i].high + bars[i].low) / 2;
    let upperBand = src + factor * assigned;
    let lowerBand = src - factor * assigned;

    if (!firstUpper) {
      upperBand = upperBand > prevUpper || bars[i - 1].close > prevUpper ? upperBand : prevUpper;
    }
    if (!firstLower) {
      lowerBand = lowerBand > prevLower || bars[i - 1].close < prevLower ? lowerBand : prevLower;
    }
    firstUpper = false;
    firstLower = false;

    let dir: 1 | -1;
    if (i < atrLen + 1) {
      dir = 1;
    } else if (prevST === prevUpper) {
      dir = bars[i].close > upperBand ? -1 : 1;
    } else {
      dir = bars[i].close < lowerBand ? 1 : -1;
    }

    const st = dir === -1 ? lowerBand : upperBand;
    const isGreen = bars[i].close > st;
    const isRed = bars[i].close < st;
    const prevWasRed = i > 0 ? !out[i - 1].isGreen : true;
    const firstGreenBar = isGreen && prevWasRed;

    out[i] = { st, direction: dir, isGreen, isRed, firstGreenBar };

    prevST = st;
    prevUpper = upperBand;
    prevLower = lowerBand;
  }
  return out;
}

export interface StopHuntInputs {
  lookback: number;
  volAvgLength: number;
  volMult: number;
}

export const DEFAULT_STOPHUNT_INPUTS: StopHuntInputs = {
  lookback: 10,
  volAvgLength: 40,
  volMult: 1.8,
};

export interface StopHuntSignal {
  index: number;
  price: number;
  low: number;
  close: number;
  volume: number;
  inRedArea: boolean;
}

export function detectStopHunts(bars: Bar[], st: SuperTrendPoint[], inputs: StopHuntInputs = DEFAULT_STOPHUNT_INPUTS): StopHuntSignal[] {
  const { lookback, volAvgLength, volMult } = inputs;
  const out: StopHuntSignal[] = [];
  for (let i = volAvgLength; i < bars.length; i++) {
    const window = bars.slice(Math.max(0, i - lookback), i);
    if (window.length < lookback) continue;
    const prevLow = Math.min(...window.map((b) => b.low));
    const volWindow = bars.slice(i - volAvgLength, i);
    const volAvg = volWindow.reduce((a, b) => a + (b.volume ?? 0), 0) / volWindow.length;
    const bar = bars[i];
    const vol = bar.volume ?? 0;
    const isDiamond =
      bar.low < prevLow &&
      bar.close > prevLow &&
      vol > volAvg * volMult;
    if (isDiamond) {
      out.push({
        index: i,
        price: bar.close,
        low: bar.low,
        close: bar.close,
        volume: vol,
        inRedArea: st[i]?.isRed ?? false,
      });
    }
  }
  return out;
}

export interface DCAEntry {
  index: number;
  number: number;
  price: number;
  qty: number;
  discountPct: number;
  status: "pending" | "filled" | "canceled";
  fillIndex?: number;
  fillPrice?: number;
}

export interface DCATradeState {
  inTrade: boolean;
  entries: DCAEntry[];
  avgEntryPrice: number | null;
  totalEntryCost: number;
  totalEntryQty: number;
  entryCount: number;
  lastFillIndex: number | null;
  slPrice: number | null;
  slActive: boolean;
  slWatchBar: number | null;
  slHit: boolean;
  slHitIndex: number | null;
  lockedOut: boolean;
}

export interface DCAInputs {
  discounts: number[];
  quantities: number[];
  minDiamondsBeforeBuy: number;
  minAvgImprovePct: number;
  trailStartPct: number;
  trailBelowPct: number;
}

export const DEFAULT_DCA_INPUTS: DCAInputs = {
  discounts: [3, 5, 8, 12],
  quantities: [10, 30, 60, 100],
  minDiamondsBeforeBuy: 2,
  minAvgImprovePct: 5,
  trailStartPct: 10,
  trailBelowPct: 8,
};

export function simulateDCATrade(bars: Bar[], st: SuperTrendPoint[], diamonds: StopHuntSignal[], inputs: DCAInputs = DEFAULT_DCA_INPUTS): DCATradeState {
  const { discounts, quantities, minDiamondsBeforeBuy, minAvgImprovePct, trailStartPct, trailBelowPct } = inputs;
  const state: DCATradeState = {
    inTrade: false,
    entries: [],
    avgEntryPrice: null,
    totalEntryCost: 0,
    totalEntryQty: 0,
    entryCount: 0,
    lastFillIndex: null,
    slPrice: null,
    slActive: false,
    slWatchBar: null,
    slHit: false,
    slHitIndex: null,
    lockedOut: false,
  };

  const diamondByIndex = new Map<number, StopHuntSignal>();
  for (const d of diamonds) diamondByIndex.set(d.index, d);

  const pendingEntries: DCAEntry[] = [];
  let redDiamondCount = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const isRed = st[i]?.isRed ?? false;
    const isGreen = st[i]?.isGreen ?? false;

    if (!isRed) redDiamondCount = 0;

    const diamond = diamondByIndex.get(i);
    const redDiamond = diamond && diamond.inRedArea;
    if (redDiamond) {
      redDiamondCount++;
      state.lockedOut = false;
    }

    for (const e of pendingEntries) {
      if (i > e.index && bar.low <= e.price && e.status === "pending") {
        e.status = "filled";
        e.fillIndex = i;
        e.fillPrice = e.price;
        state.inTrade = true;
        state.lastFillIndex = i;
        state.totalEntryCost += e.price * e.qty;
        state.totalEntryQty += e.qty;
        state.entryCount++;
        state.avgEntryPrice = state.totalEntryCost / state.totalEntryQty;
        state.slPrice = null;
        state.slActive = false;
      }
    }

    if (redDiamond && redDiamondCount >= minDiamondsBeforeBuy && !state.lockedOut) {
      const nextNum = state.entryCount + pendingEntries.length + 1;
      const discountPct = discounts[Math.min(nextNum - 1, discounts.length - 1)] ?? discounts[discounts.length - 1];
      const entryPrice = diamond.low * (1 - discountPct / 100);
      const improvesAvg =
        !state.inTrade ||
        state.avgEntryPrice == null ||
        entryPrice <= state.avgEntryPrice * (1 - minAvgImprovePct / 100);
      if (improvesAvg) {
        const qty = quantities[Math.min(nextNum - 1, quantities.length - 1)] ?? quantities[quantities.length - 1];
        const entry: DCAEntry = {
          index: i,
          number: nextNum,
          price: entryPrice,
          qty,
          discountPct,
          status: "pending",
        };
        pendingEntries.push(entry);
        state.entries.push(entry);
      }
    }

    if (state.inTrade && state.avgEntryPrice != null) {
      const activationPrice = state.avgEntryPrice * (1 + trailStartPct / 100);
      if (!state.slActive && state.lastFillIndex != null && i > state.lastFillIndex && bar.high >= activationPrice && isGreen) {
        state.slActive = true;
        const candidate = bar.high * (1 - trailBelowPct / 100);
        state.slPrice = state.slPrice == null ? candidate : Math.max(state.slPrice, candidate);
        state.slWatchBar = i;
      }
      if (state.slActive && state.slPrice != null && state.slWatchBar != null && i > state.slWatchBar) {
        if (bar.low <= state.slPrice) {
          if (bar.close > state.slPrice) {
            state.slWatchBar = i;
          } else {
            state.slHit = true;
            state.slHitIndex = i;
            state.lockedOut = true;
            state.inTrade = false;
            for (const e of pendingEntries) e.status = "canceled";
            pendingEntries.length = 0;
            state.avgEntryPrice = null;
            state.totalEntryCost = 0;
            state.totalEntryQty = 0;
            state.entryCount = 0;
            state.lastFillIndex = null;
            state.slPrice = null;
            state.slActive = false;
          }
        } else {
          const candidate = bar.high * (1 - trailBelowPct / 100);
          if (candidate > (state.slPrice ?? 0)) state.slPrice = candidate;
        }
      }
    }
  }

  return state;
}

export interface AdaptiveSTReport {
  st: SuperTrendPoint[];
  diamonds: StopHuntSignal[];
  trade: DCATradeState;
  currentDirection: "bull" | "bear" | "neutral";
  currentST: number;
  advisor: string;
}

export function buildAdaptiveSTReport(bars: Bar[]): AdaptiveSTReport {
  if (bars.length < 30) {
    return {
      st: [],
      diamonds: [],
      trade: {
        inTrade: false,
        entries: [],
        avgEntryPrice: null,
        totalEntryCost: 0,
        totalEntryQty: 0,
        entryCount: 0,
        lastFillIndex: null,
        slPrice: null,
        slActive: false,
        slWatchBar: null,
        slHit: false,
        slHitIndex: null,
        lockedOut: false,
      },
      currentDirection: "neutral",
      currentST: 0,
      advisor: "Not enough bars to compute Adaptive SuperTrend.",
    };
  }
  const st = computeAdaptiveSuperTrend(bars);
  const diamonds = detectStopHunts(bars, st);
  const trade = simulateDCATrade(bars, st, diamonds);
  const last = st[st.length - 1];
  const lastPrice = bars[bars.length - 1].close;
  const currentDirection: "bull" | "bear" | "neutral" = last.isGreen ? "bull" : last.isRed ? "bear" : "neutral";
  const currentST = last.st;
  const recentDiamond = diamonds[diamonds.length - 1];
  const advisor = composeSTAdvisor(currentDirection, lastPrice, currentST, trade, recentDiamond, bars.length - 1);
  return { st, diamonds, trade, currentDirection, currentST, advisor };
}

function composeSTAdvisor(
  dir: "bull" | "bear" | "neutral",
  lastPrice: number,
  st: number,
  trade: DCATradeState,
  recentDiamond: StopHuntSignal | undefined,
  lastIndex: number
): string {
  const parts: string[] = [];
  if (dir === "bull") parts.push(`Adaptive SuperTrend is GREEN @ ${fmt(st)} — trend is up, hold longs.`);
  else if (dir === "bear") parts.push(`Adaptive SuperTrend is RED @ ${fmt(st)} — trend is down, hold shorts / sit out longs.`);
  else parts.push(`Adaptive SuperTrend is flat — no clean trend.`);

  if (trade.inTrade && trade.avgEntryPrice != null) {
    const unrealizedPct = ((lastPrice - trade.avgEntryPrice) / trade.avgEntryPrice) * 100;
    parts.push(`In DCA trade: ${trade.entryCount} fill(s), avg entry ${fmt(trade.avgEntryPrice)} (${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(2)}% unrealized).`);
    if (trade.slActive && trade.slPrice != null) {
      const slPct = ((lastPrice - trade.slPrice) / lastPrice) * 100;
      parts.push(`Trailing SL active @ ${fmt(trade.slPrice)} (${slPct >= 0 ? "+" : ""}${slPct.toFixed(2)}% below price) — ratchets up only.`);
    } else {
      const activationPct = (trade.avgEntryPrice * 1.10 - lastPrice) / lastPrice * 100;
      parts.push(`Trailing SL not yet active — needs price to reach ${fmt(trade.avgEntryPrice * 1.1)} (+10% from avg, ${activationPct > 0 ? activationPct.toFixed(1) + "% away" : "hit"}).`);
    }
  } else if (trade.slHit) {
    parts.push(`Last trade stopped out at bar ${trade.slHitIndex}. Locked out of new buys until next red-area diamond.`);
  }

  if (recentDiamond) {
    const age = lastIndex - recentDiamond.index;
    if (recentDiamond.inRedArea) {
      parts.push(`Red-area stop-hunt diamond ${age} bar${age === 1 ? "" : "s"} ago @ low ${fmt(recentDiamond.low)} — DCA ladder active if avg-improvement rule passes.`);
    } else {
      parts.push(`Stop-hunt diamond ${age} bar${age === 1 ? "" : "s"} ago @ low ${fmt(recentDiamond.low)} (in green area — no DCA).`);
    }
  }

  if (trade.entries.some((e) => e.status === "pending")) {
    const pend = trade.entries.filter((e) => e.status === "pending");
    parts.push(`Pending limit buy${pend.length === 1 ? "" : "s"}: ${pend.map((e) => `#${e.number} @ ${fmt(e.price)} (qty ${e.qty})`).join(", ")}.`);
  }

  return parts.join(" ");
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}