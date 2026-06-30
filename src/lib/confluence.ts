import type { Bar, Timeframe } from "./types";
import { buildConfluenceReport } from "./analyzer";
import { buildScalpReport } from "./scalp";
import { buildAdaptiveSTReport } from "./adaptiveSt";
import { analyzeMeanReversion } from "./meanReversion";
import { analyzeORB } from "./orb";

export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface ConfluenceVote {
  indicator: string;
  direction: "bull" | "bear" | "neutral";
  weight: number;
  detail: string;
}

export interface ConfluenceScore {
  grade: Grade;
  score: number;
  bullVotes: number;
  bearVotes: number;
  neutralVotes: number;
  totalWeight: number;
  dominant: "bull" | "bear" | "neutral";
  agreement: number;
  votes: ConfluenceVote[];
  summary: string;
}

export function computeConfluence(
  symbol: string,
  barsByTimeframe: Partial<Record<Timeframe, Bar[]>>
): ConfluenceScore {
  const votes: ConfluenceVote[] = [];

  const swing = buildConfluenceReport(symbol, barsByTimeframe);
  votes.push({
    indicator: "Swing TF confluence",
    direction: swing.dominant,
    weight: 3,
    detail: `${swing.confidence}% ${swing.dominant} (${swing.bullishCount}B/${swing.bearishCount}b/${swing.neutralCount}n)`,
  });

  const scalp = buildScalpReport(symbol, barsByTimeframe);
  votes.push({
    indicator: "Scalp EMA9/21",
    direction: scalp.dominant,
    weight: 2,
    detail: `${scalp.confidence}% ${scalp.dominant} (${scalp.bullCount}B/${scalp.bearCount}b/${scalp.neutralCount}n)`,
  });

  const refTF: Timeframe = "1D";
  const refBars = barsByTimeframe[refTF] ?? [];
  if (refBars.length >= 30) {
    const st = buildAdaptiveSTReport(refBars);
    votes.push({
      indicator: "Adaptive SuperTrend",
      direction: st.currentDirection,
      weight: 3,
      detail: st.currentDirection === "bull" ? "Green ST — trend up" : st.currentDirection === "bear" ? "Red ST — trend down" : "Flat — no trend",
    });

    const mr = analyzeMeanReversion(refBars);
    let mrDir: "bull" | "bear" | "neutral" = "neutral";
    if (mr.regime === "extreme-low") mrDir = "bull";
    else if (mr.regime === "extreme-high") mrDir = "bear";
    votes.push({
      indicator: "Mean Reversion",
      direction: mrDir,
      weight: 1.5,
      detail: `${mr.regime} (Z ${mr.currentZ.toFixed(2)}, RSI ${mr.rsiVal.toFixed(0)})`,
    });
  }

  const intradayTF: Timeframe = "1m";
  const intradayBars = barsByTimeframe[intradayTF] ?? barsByTimeframe["5m"] ?? [];
  if (intradayBars.length >= 30) {
    const orb = analyzeORB(intradayBars);
    let orbDir: "bull" | "bear" | "neutral" = "neutral";
    if (orb.longMode) orbDir = "bull";
    else if (orb.shortMode) orbDir = "bear";
    votes.push({
      indicator: "ORB breakout",
      direction: orbDir,
      weight: 2,
      detail: orb.longMode ? "Long breakout confirmed" : orb.shortMode ? "Short breakdown confirmed" : "No breakout yet",
    });
  }

  const bullWeight = votes.filter((v) => v.direction === "bull").reduce((a, v) => a + v.weight, 0);
  const bearWeight = votes.filter((v) => v.direction === "bear").reduce((a, v) => a + v.weight, 0);
  const neutralWeight = votes.filter((v) => v.direction === "neutral").reduce((a, v) => a + v.weight, 0);
  const totalWeight = bullWeight + bearWeight + neutralWeight || 1;

  let dominant: "bull" | "bear" | "neutral" = "neutral";
  if (bullWeight > bearWeight && bullWeight > neutralWeight) dominant = "bull";
  else if (bearWeight > bullWeight && bearWeight > neutralWeight) dominant = "bear";

  const dominantWeight = dominant === "bull" ? bullWeight : dominant === "bear" ? bearWeight : 0;
  const agreement = Math.round((dominantWeight / totalWeight) * 100);

  let score = 0;
  if (dominant !== "neutral") {
    score = (dominantWeight / totalWeight) * 100;
    if (dominant === "bear") score = -score;
  }

  const grade = scoreToGrade(score, dominant);
  const summary = composeSummary(grade, dominant, agreement, votes);

  return {
    grade,
    score,
    bullVotes: votes.filter((v) => v.direction === "bull").length,
    bearVotes: votes.filter((v) => v.direction === "bear").length,
    neutralVotes: votes.filter((v) => v.direction === "neutral").length,
    totalWeight,
    dominant,
    agreement,
    votes,
    summary,
  };
}

function scoreToGrade(score: number, dominant: "bull" | "bear" | "neutral"): Grade {
  const abs = Math.abs(score);
  if (dominant === "neutral" || abs < 20) return "F";
  if (abs >= 85) return "A+";
  if (abs >= 70) return "A";
  if (abs >= 55) return "B";
  if (abs >= 40) return "C";
  return "D";
}

function composeSummary(grade: Grade, dominant: "bull" | "bear" | "neutral", agreement: number, votes: ConfluenceVote[]): string {
  const bullList = votes.filter((v) => v.direction === "bull").map((v) => v.indicator);
  const bearList = votes.filter((v) => v.direction === "bear").map((v) => v.indicator);
  const neutralList = votes.filter((v) => v.direction === "neutral").map((v) => v.indicator);

  if (grade === "F") {
    return `Grade F — no edge. Indicators are split. Bull: ${bullList.join(", ") || "none"}. Bear: ${bearList.join(", ") || "none"}. Neutral: ${neutralList.join(", ") || "none"}. Sit out. Don't trade.`;
  }

  const dir = dominant === "bull" ? "LONG" : "SHORT";
  const opposing = dominant === "bull" ? bearList : bullList;

  if (grade.startsWith("A")) {
    return `Grade ${grade} — high-conviction ${dir}. ${agreement}% weighted agreement. Bull: ${bullList.join(", ") || "none"}. Bear: ${bearList.join(", ") || "none"}. ${opposing.length > 0 ? `Fighting: ${opposing.join(", ")} — manage risk on those.` : "No opposing signals."}`;
  }
  if (grade === "B") {
    return `Grade B — decent ${dir} setup. ${agreement}% agreement but not everyone's on board. Bull: ${bullList.join(", ") || "none"}. Bear: ${bearList.join(", ") || "none"}. Trade with reduced size, tighten stops.`;
  }
  if (grade === "C") {
    return `Grade C — marginal ${dir}. ${agreement}% agreement — too split for conviction. Bull: ${bullList.join(", ") || "none"}. Bear: ${bearList.join(", ") || "none"}. Only trade if your own read confirms, keep size tiny.`;
  }
  return `Grade D — weak ${dir} lean (${agreement}%). Not enough agreement. Bull: ${bullList.join(", ") || "none"}. Bear: ${bearList.join(", ") || "none"}. Skip it.`;
}