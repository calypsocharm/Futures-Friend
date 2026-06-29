"use client";

import { useEffect, useRef } from "react";
import { useAnalysis } from "@/store/analysis";
import { useWatchlist } from "@/store/watchlist";
import { symbolDef } from "@/lib/symbols";
import type { Timeframe } from "@/lib/types";

async function fetchSummary(symbol: string, tf: Timeframe): Promise<{ direction: string; confidence: number; lastPrice: number } | null> {
  try {
    const res = await fetch(`/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    const bars: { close: number; time: number; open: number; high: number; low: number; volume?: number }[] = d.bars ?? [];
    if (bars.length < 5) return null;
    const c = bars.map((b) => b.close);
    const lastPrice = c[c.length - 1];
    const ema = (arr: number[], p: number) => {
      const k = 2 / (p + 1);
      let v = arr[0];
      for (let i = 1; i < arr.length; i++) v = arr[i] * k + v * (1 - k);
      return v;
    };
    const e20 = ema(c.slice(-30), 20);
    const e50 = ema(c.slice(-60), 50);
    const e200 = c.length >= 200 ? ema(c.slice(-200), 200) : null;
    let bull = 0, bear = 0, neutral = 0;
    if (e20 > e50 && lastPrice > e20) bull++;
    else if (e20 < e50 && lastPrice < e20) bear++;
    else neutral++;
    if (e200) {
      if (lastPrice > e200) bull++;
      else bear++;
    }
    if (c[c.length - 1] > c[c.length - 5]) bull++;
    else bear++;
    let direction = "neutral";
    if (bull > bear && bull > neutral) direction = "bull";
    else if (bear > bull && bear > neutral) direction = "bear";
    const total = bull + bear + neutral;
    const dominant = direction === "bull" ? bull : direction === "bear" ? bear : neutral;
    return { direction, confidence: Math.round((dominant / total) * 100), lastPrice };
  } catch {
    return null;
  }
}

export function useAutoRefresh() {
  const refresh = useAnalysis((s) => s.refresh);
  const symbol = useAnalysis((s) => s.symbol);
  const report = useAnalysis((s) => s.report);
  const autoRefresh = useWatchlist((s) => s.autoRefresh);
  const intervalSec = useWatchlist((s) => s.intervalSec);
  const watchTF = useWatchlist((s) => s.watchTF);
  const setItem = useWatchlist((s) => s.setItem);
  const watchlist = useWatchlist((s) => s.watchlist);
  const lastTick = useRef<number>(0);

  async function pollWatchlist() {
    for (const sym of watchlist) {
      if (!symbolDef(sym)) continue;
      if (sym === symbol && report && report.perTimeframe[0]) {
        setItem({
          symbol: sym,
          label: symbolDef(sym)?.label ?? sym,
          direction: report.dominant,
          confidence: report.confidence,
          lastPrice: report.perTimeframe[0].lastPrice,
          updatedAt: Date.now(),
        });
        continue;
      }
      const summary = await fetchSummary(sym, watchTF);
      if (summary) {
        setItem({
          symbol: sym,
          label: symbolDef(sym)?.label ?? sym,
          direction: summary.direction as "bull" | "bear" | "neutral",
          confidence: summary.confidence,
          lastPrice: summary.lastPrice,
          updatedAt: Date.now(),
        });
      }
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = intervalSec * 1000;
    const id = window.setInterval(() => {
      void refresh();
      void pollWatchlist();
    }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, intervalSec, refresh, symbol, report]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (Date.now() - lastTick.current > 5000) {
      lastTick.current = Date.now();
      void pollWatchlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, watchlist, symbol]);
}