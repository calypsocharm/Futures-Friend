import type { Bar } from "./types";
import { atr, ema } from "./indicators";

export interface ORBInputs {
  meanSessionStart: string;
  meanSessionEnd: string;
  orSessionStart: string;
  orSessionEnd: string;
  atrLength: number;
  atrTargetMult: number;
  targetCount: number;
  volAvgLength: number;
  volSpikeMult: number;
  emaPeriod: number;
}

export const DEFAULT_ORB_INPUTS: ORBInputs = {
  meanSessionStart: "0930",
  meanSessionEnd: "0935",
  orSessionStart: "0930",
  orSessionEnd: "1000",
  atrLength: 4,
  atrTargetMult: 2,
  targetCount: 5,
  volAvgLength: 50,
  volSpikeMult: 1.5,
  emaPeriod: 200,
};

export interface VolumeSpike {
  index: number;
  relVolume: number;
  bull: boolean;
  bear: boolean;
}

export interface ORBState {
  meanHigh: number | null;
  meanLow: number | null;
  orHigh: number | null;
  orLow: number | null;
  orMean: number | null;
  atrOR: number | null;
  longMode: boolean;
  shortMode: boolean;
  breakoutIndex: number | null;
  breakdownIndex: number | null;
  targets: number[];
  riskLine: number | null;
  prevClose: number | null;
  ema200: number | null;
  volumeSpikes: VolumeSpike[];
  currentRelVolume: number;
  currentVolumeSpike: boolean;
  currentBullSpike: boolean;
  currentBearSpike: boolean;
  orEnded: boolean;
  relDay: number | null;
  advisor: string;
}

function toETMinute(date: Date): number {
  const etOffset = getETOffsetMinutes(date);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return ((utcMin + etOffset) % 1440 + 1440) % 1440;
}

function getETOffsetMinutes(date: Date): number {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const dow = date.getUTCDay();
  const secondSundayMarch = getNthWeekday(3, 0, 2, date.getUTCFullYear());
  const firstSundayNov = getNthWeekday(11, 0, 1, date.getUTCFullYear());
  const inDST = (month > 3 && month < 11) || (month === 3 && (day > secondSundayMarch || (day === secondSundayMarch && dow >= 0))) || (month === 11 && (day < firstSundayNov || (day === firstSundayNov && dow < 0)));
  return inDST ? -4 * 60 : -5 * 60;
}

function getNthWeekday(month: number, targetDow: number, n: number, year: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    if (date.getUTCMonth() !== month - 1) break;
    if (date.getUTCDay() === targetDow) {
      count++;
      if (count === n) return d;
    }
  }
  return 1;
}

function parseSessionTime(s: string): number {
  const parts = s.replace(/"/g, "").trim();
  const digits = parts.replace(/\D/g, "");
  if (digits.length < 3) return 0;
  const h = parseInt(digits.slice(0, -2), 10) || 0;
  const m = parseInt(digits.slice(-2), 10) || 0;
  return h * 60 + m;
}

function dateDay(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

export function analyzeORB(bars: Bar[], inputs: ORBInputs = DEFAULT_ORB_INPUTS): ORBState {
  const {
    meanSessionStart, meanSessionEnd, orSessionStart, orSessionEnd,
    atrLength, atrTargetMult, targetCount, volAvgLength, volSpikeMult, emaPeriod,
  } = inputs;

  const meanStart = parseSessionTime(meanSessionStart);
  const meanEnd = parseSessionTime(meanSessionEnd);
  const orStart = parseSessionTime(orSessionStart);
  const orEnd = parseSessionTime(orSessionEnd);

  let meanHigh: number | null = null;
  let meanLow: number | null = null;
  let orHigh: number | null = null;
  let orLow: number | null = null;
  let atrOR: number | null = null;
  let longMode = false;
  let shortMode = false;
  let breakoutIndex: number | null = null;
  let breakdownIndex: number | null = null;
  let prevDay = -1;
  let prevClose: number | null = null;

  const volumeSpikes: VolumeSpike[] = [];
  const closes = bars.map((b) => b.close);
  const ema200Arr = closes.length >= emaPeriod ? ema(closes, emaPeriod) : [];
  const ema200Val = ema200Arr.length ? ema200Arr[ema200Arr.length - 1] : null;

  let orEnded = false;
  let relDay: number | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const date = new Date(bar.time);
    const etMin = toETMinute(date);
    const day = dateDay(date);
    const isNewDay = day !== prevDay;

    if (isNewDay && prevDay >= 0) {
      prevClose = bars[i - 1]?.close ?? null;
      meanHigh = null;
      meanLow = null;
      orHigh = null;
      orLow = null;
      atrOR = null;
      longMode = false;
      shortMode = false;
      orEnded = false;
    }
    prevDay = day;

    const inMean = etMin >= meanStart && etMin < meanEnd;
    const inOR = etMin >= orStart && etMin < orEnd;

    if (inMean) {
      if (etMin === meanStart) {
        meanHigh = bar.high;
        meanLow = bar.low;
      } else {
        meanHigh = Math.max(meanHigh ?? bar.high, bar.high);
        meanLow = Math.min(meanLow ?? bar.low, bar.low);
      }
    }

    if (inOR) {
      if (etMin === orStart) {
        orHigh = bar.high;
        orLow = bar.low;
      } else {
        orHigh = Math.max(orHigh ?? bar.high, bar.high);
        orLow = Math.min(orLow ?? bar.low, bar.low);
      }
      atrOR = atr(bars.slice(0, i + 1), atrLength);
    }

    if (!inOR && orHigh != null) {
      orEnded = true;
    }

    if (!inOR && orHigh != null && orLow != null && bar.close > orHigh && !longMode) {
      longMode = true;
      shortMode = false;
      breakoutIndex = i;
    }
    if (!inOR && orHigh != null && orLow != null && bar.close < orLow && !shortMode) {
      shortMode = true;
      longMode = false;
      breakdownIndex = i;
    }

    const volWindow = bars.slice(Math.max(0, i - volAvgLength + 1), i + 1);
    if (volWindow.length >= volAvgLength) {
      const volAvg = volWindow.reduce((a, b) => a + (b.volume ?? 0), 0) / volWindow.length;
      const vol = bar.volume ?? 0;
      const relVol = volAvg > 0 ? vol / volAvg : 0;
      const isSpike = relVol >= volSpikeMult;
      if (isSpike && i > volAvgLength) {
        volumeSpikes.push({
          index: i,
          relVolume: relVol,
          bull: bar.close > bar.open,
          bear: bar.close < bar.open,
        });
      }
    }
  }

  if (orHigh != null && orLow != null && meanHigh != null && meanLow != null) {
    const orMeanVal = (meanHigh + meanLow) / 2;
    const orWidth = orHigh - orLow;
    relDay = orWidth !== 0 ? (orMeanVal - orLow) / orWidth : null;
  }

  const step = atrOR != null ? atrOR * atrTargetMult : 0;
  const targets: number[] = [];
  if (longMode && orHigh != null) {
    for (let t = 1; t <= targetCount; t++) targets.push(orHigh + step * t);
  } else if (shortMode && orLow != null) {
    for (let t = 1; t <= targetCount; t++) targets.push(orLow - step * t);
  }

  const riskLine = longMode ? orLow : shortMode ? orHigh : null;

  const last = bars.length - 1;
  const lastBar = bars[last];
  const volWindow = bars.slice(Math.max(0, last - volAvgLength + 1), last + 1);
  const volAvg = volWindow.length >= volAvgLength ? volWindow.reduce((a, b) => a + (b.volume ?? 0), 0) / volWindow.length : 0;
  const currentRelVolume = volAvg > 0 ? (lastBar.volume ?? 0) / volAvg : 0;
  const currentVolumeSpike = currentRelVolume >= volSpikeMult;
  const currentBullSpike = currentVolumeSpike && lastBar.close > lastBar.open;
  const currentBearSpike = currentVolumeSpike && lastBar.close < lastBar.open;

  const advisor = composeORBAdvisor({
    longMode, shortMode, orHigh, orLow, orMean: meanHigh != null && meanLow != null ? (meanHigh + meanLow) / 2 : null,
    atrOR, step, targets, riskLine, prevClose, ema200Val, orEnded, relDay,
    currentRelVolume, currentVolumeSpike, currentBullSpike, currentBearSpike,
    breakoutIndex, breakdownIndex, lastIndex: last,
  });

  return {
    meanHigh, meanLow, orHigh, orLow,
    orMean: meanHigh != null && meanLow != null ? (meanHigh + meanLow) / 2 : null,
    atrOR, longMode, shortMode, breakoutIndex, breakdownIndex,
    targets, riskLine, prevClose, ema200: ema200Val,
    volumeSpikes: volumeSpikes.slice(-15),
    currentRelVolume, currentVolumeSpike, currentBullSpike, currentBearSpike,
    orEnded, relDay, advisor,
  };
}

function composeORBAdvisor(p: {
  longMode: boolean;
  shortMode: boolean;
  orHigh: number | null;
  orLow: number | null;
  orMean: number | null;
  atrOR: number | null;
  step: number;
  targets: number[];
  riskLine: number | null;
  prevClose: number | null;
  ema200Val: number | null;
  orEnded: boolean;
  relDay: number | null;
  currentRelVolume: number;
  currentVolumeSpike: boolean;
  currentBullSpike: boolean;
  currentBearSpike: boolean;
  breakoutIndex: number | null;
  breakdownIndex: number | null;
  lastIndex: number;
}): string {
  const parts: string[] = [];

  if (p.orHigh == null || p.orLow == null) {
    return "Opening Range not established yet — waiting for 0930-1000 ET session to complete.";
  }

  parts.push(`Opening Range: high ${fmt(p.orHigh)} / low ${fmt(p.orLow)} (${((p.orHigh - p.orLow)).toFixed(2)} wide).`);
  if (p.orMean != null) parts.push(`OR mean (5-min opening): ${fmt(p.orMean)}.`);
  if (p.atrOR != null) parts.push(`ATR(${4}) at OR: ${fmt(p.atrOR)}, target step = ${fmt(p.step)} (${(2).toFixed(1)}x ATR).`);

  if (p.longMode) {
    parts.push(`LONG mode — breakout above ORH confirmed${p.breakoutIndex != null ? ` ${p.lastIndex - p.breakoutIndex} bar(s) ago` : ""}.`);
    if (p.riskLine != null) parts.push(`Risk line (stop) below OR low @ ${fmt(p.riskLine)}.`);
    if (p.targets.length > 0) {
      parts.push(`Targets: ${p.targets.map((t, i) => `T${i + 1} ${fmt(t)}`).join(", ")}.`);
    }
  } else if (p.shortMode) {
    parts.push(`SHORT mode — breakdown below ORL confirmed${p.breakdownIndex != null ? ` ${p.lastIndex - p.breakdownIndex} bar(s) ago` : ""}.`);
    if (p.riskLine != null) parts.push(`Risk line (stop) above OR high @ ${fmt(p.riskLine)}.`);
    if (p.targets.length > 0) {
      parts.push(`Targets: ${p.targets.map((t, i) => `T${i + 1} ${fmt(t)}`).join(", ")}.`);
    }
  } else if (p.orEnded) {
    parts.push(`OR ended — no breakout yet. Waiting for price to close above ${fmt(p.orHigh)} (long) or below ${fmt(p.orLow)} (short).`);
  } else {
    parts.push(`OR still forming (0930-1000 ET). Levels will lock at 1000.`);
  }

  if (p.relDay != null) {
    const bias = p.relDay > 0.5 ? "bullish lean (close above mid)" : p.relDay < 0.5 ? "bearish lean (close below mid)" : "neutral";
    parts.push(`Relative day position: ${p.relDay.toFixed(2)} — ${bias}.`);
  }

  if (p.prevClose != null) parts.push(`Previous close: ${fmt(p.prevClose)}.`);
  if (p.ema200Val != null) parts.push(`EMA200: ${fmt(p.ema200Val)}.`);

  if (p.currentVolumeSpike) {
    const kind = p.currentBullSpike ? "bull" : p.currentBearSpike ? "bear" : "neutral";
    parts.push(`Volume spike: ${p.currentRelVolume.toFixed(2)}x avg (${kind}) — confirms the move.`);
  } else {
    parts.push(`Volume: ${p.currentRelVolume.toFixed(2)}x avg (no spike, need ${1.5}x for confirmation).`);
  }

  return parts.join(" ");
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}