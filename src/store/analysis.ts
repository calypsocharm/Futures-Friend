"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bar, ConfluenceReport, Timeframe } from "@/lib/types";
import { TIMEFRAMES } from "@/lib/types";
import { buildConfluenceReport } from "@/lib/analyzer";
import { seedSampleBars, symbolDef } from "@/lib/symbols";

interface AnalysisState {
  symbol: string;
  barsByTimeframe: Partial<Record<Timeframe, Bar[]>>;
  report: ConfluenceReport | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  live: boolean;
  setSymbol: (symbol: string) => void;
  refresh: () => Promise<void>;
  setBars: (tf: Timeframe, bars: Bar[]) => void;
  loadSample: (symbol: string) => void;
  run: () => void;
}

const FALLBACK_BASE: Record<string, number> = {
  M2KU2026: 3018,
  ZN2026: 110,
  ZB2026: 115,
  ESU2026: 5500,
  NQU2026: 19500,
  YM2026: 44000,
  RTY2026: 2200,
  CLU2026: 78,
  NGU2026: 2.85,
  GCQ2026: 2400,
  SIQ2026: 31,
  HG2026: 4.5,
  ZCZ2026: 4.5,
  ZSX2026: 11,
  ZW2026: 6,
  "6EU2026": 1.08,
  "6JU2026": 0.0067,
  BTC2026: 60000,
  ETH2026: 3500,
  "SOL-USD": 75,
};

function seedFallback(symbol: string): Partial<Record<Timeframe, Bar[]>> {
  const base = FALLBACK_BASE[symbol] ?? 100;
  const out: Partial<Record<Timeframe, Bar[]>> = {};
  for (const tf of TIMEFRAMES) {
    out[tf] = seedSampleBars(symbol, 200, base, 0.0005);
  }
  return out;
}

async function fetchBars(symbol: string, tf: Timeframe, signal?: AbortSignal): Promise<Bar[]> {
  const url = `/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.bars ?? []) as Bar[];
}

export const useAnalysis = create<AnalysisState>()(
  persist(
    (set, get) => ({
      symbol: "M2KU2026",
      barsByTimeframe: {},
      report: null,
      loading: false,
      error: null,
      fetchedAt: null,
      live: false,
      setSymbol: (symbol) => {
        if (!symbolDef(symbol)) return;
        set({ symbol });
        void get().refresh();
      },
      refresh: async () => {
        const symbol = get().symbol;
        set({ loading: true, error: null });
        const results: Partial<Record<Timeframe, Bar[]>> = {};
        let firstError: string | null = null;
        await Promise.all(
          TIMEFRAMES.map(async (tf) => {
            try {
              const bars = await fetchBars(symbol, tf);
              if (bars.length > 0) results[tf] = bars;
            } catch (e) {
              if (!firstError) firstError = e instanceof Error ? e.message : "fetch failed";
            }
          })
        );
        const anyFetched = Object.keys(results).length > 0;
        if (anyFetched) {
          const report = buildConfluenceReport(symbol, results);
          set({
            barsByTimeframe: results,
            report,
            loading: false,
            error: firstError ? `Partial: ${firstError}` : null,
            fetchedAt: Date.now(),
            live: true,
          });
        } else {
          const fallback = seedFallback(symbol);
          const report = buildConfluenceReport(symbol, fallback);
          set({
            barsByTimeframe: fallback,
            report,
            loading: false,
            error: firstError ?? "live fetch failed — using sample data",
            fetchedAt: Date.now(),
            live: false,
          });
        }
      },
      setBars: (tf, bars) => {
        const prev = get().barsByTimeframe;
        const next = { ...prev, [tf]: bars };
        const report = buildConfluenceReport(get().symbol, next);
        set({ barsByTimeframe: next, report });
      },
      loadSample: (symbol) => {
        const bars = seedFallback(symbol);
        const report = buildConfluenceReport(symbol, bars);
        set({ symbol, barsByTimeframe: bars, report, live: false, fetchedAt: Date.now(), error: null });
      },
      run: () => {
        const report = buildConfluenceReport(get().symbol, get().barsByTimeframe);
        set({ report });
      },
    }),
    {
      name: "futures-friend-state",
      partialize: (s) => ({
        symbol: s.symbol,
        barsByTimeframe: s.barsByTimeframe,
        report: s.report,
      }),
    }
  )
);