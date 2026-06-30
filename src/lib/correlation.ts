import type { Bar } from "./types";

export function returns(bars: Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    if (prev > 0) out.push((bars[i].close - prev) / prev);
  }
  return out;
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;
  const aSlice = a.slice(a.length - n);
  const bSlice = b.slice(b.length - n);
  const meanA = aSlice.reduce((x, y) => x + y, 0) / n;
  const meanB = bSlice.reduce((x, y) => x + y, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}

export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
  relationship: "strong-positive" | "positive" | "weak" | "negative" | "strong-negative";
}

export interface CorrelationMatrix {
  symbols: string[];
  pairs: CorrelationPair[];
  matrix: number[][];
}

export function buildCorrelationMatrix(symbols: string[], barsBySymbol: Record<string, Bar[]>): CorrelationMatrix {
  const returnMap: Record<string, number[]> = {};
  for (const sym of symbols) {
    const bars = barsBySymbol[sym];
    if (bars && bars.length > 20) {
      returnMap[sym] = returns(bars);
    }
  }

  const validSymbols = symbols.filter((s) => returnMap[s] && returnMap[s].length >= 10);
  const size = validSymbols.length;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const corr = pearsonCorrelation(returnMap[validSymbols[i]], returnMap[validSymbols[j]]);
      matrix[i][j] = Math.round(corr * 100) / 100;
      if (j > i) {
        pairs.push({
          a: validSymbols[i],
          b: validSymbols[j],
          correlation: Math.round(corr * 100) / 100,
          relationship: classify(corr),
        });
      }
    }
  }

  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return { symbols: validSymbols, pairs, matrix };
}

function classify(corr: number): "strong-positive" | "positive" | "weak" | "negative" | "strong-negative" {
  if (corr >= 0.7) return "strong-positive";
  if (corr >= 0.3) return "positive";
  if (corr > -0.3) return "weak";
  if (corr > -0.7) return "negative";
  return "strong-negative";
}

export function correlationColor(corr: number): string {
  if (corr >= 0.7) return "var(--bull)";
  if (corr >= 0.3) return "rgba(38, 208, 124, 0.5)";
  if (corr > -0.3) return "var(--neutral)";
  if (corr > -0.7) return "rgba(255, 92, 92, 0.5)";
  return "var(--bear)";
}

export function correlationLabel(corr: number): string {
  const a = Math.abs(corr);
  if (a >= 0.7) return corr > 0 ? "strong +" : "strong -";
  if (a >= 0.3) return corr > 0 ? "+" : "-";
  return "~";
}