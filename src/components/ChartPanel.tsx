"use client";

import { useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { CandleChart } from "@/components/CandleChart";
import { ema } from "@/lib/indicators";
import { swingPoints } from "@/lib/indicators";
import type { Divergence } from "@/lib/indicators";
import type { Timeframe } from "@/lib/types";
import { TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";

export function ChartPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const report = useAnalysis((s) => s.report);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [count, setCount] = useState(120);

  const bars = useMemo(() => barsByTimeframe[tf] ?? [], [barsByTimeframe, tf]);
  const slice = useMemo(() => bars.slice(-count), [bars, count]);

  const divergences: Divergence[] = useMemo(() => {
    if (!report || !report.divergences[tf]) return [];
    const all = report.divergences[tf] ?? [];
    return all.filter((d) => d.idxB >= bars.length - count);
  }, [report, tf, bars, count]);

  const ema20 = useMemo(() => (slice.length > 0 ? ema(slice.map((b) => b.close), 20) : []), [slice]);
  const ema50 = useMemo(() => (slice.length > 0 ? ema(slice.map((b) => b.close), 50) : []), [slice]);
  const ema200 = useMemo(
    () => (slice.length >= 200 ? ema(bars.slice(-count < 200 ? -200 : -count).map((b) => b.close), 200).slice(-(slice.length)) : []),
    [bars, slice, count]
  );

  const swings = useMemo(() => (slice.length > 0 ? swingPoints(slice, 3) : { high: null, low: null }), [slice]);

  const last = slice[slice.length - 1];
  const first = slice[0];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Chart — {symbol}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tf}
            onChange={(e) => setTf(e.target.value as Timeframe)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
          >
            {TIMEFRAMES.map((t) => (
              <option key={t} value={t}>
                {TIMEFRAME_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
          >
            <option value={60}>60 bars</option>
            <option value={120}>120 bars</option>
            <option value={240}>240 bars</option>
            <option value={500}>500 bars</option>
          </select>
        </div>
      </div>

      {last && first ? (
        <>
          <CandleChart
            bars={slice}
            ema20={ema20}
            ema50={ema50}
            ema200={ema200.length === slice.length ? ema200 : undefined}
            swingHigh={swings.high}
            swingLow={swings.low}
            divergences={divergences}
            barOffset={bars.length - slice.length}
            height={380}
          />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-muted)]">
            <Stat label="Last" value={fmt(last.close)} />
            <Stat label="Change" value={`${last.close >= first.close ? "+" : ""}${(last.close - first.close).toFixed(absDecimals(last.close))}`} tone={last.close >= first.close ? "var(--bull)" : "var(--bear)"} />
            <Stat label="% Chg" value={`${last.close >= first.close ? "+" : ""}${(((last.close - first.close) / first.close) * 100).toFixed(2)}%`} tone={last.close >= first.close ? "var(--bull)" : "var(--bear)"} />
            <Stat label="High" value={fmt(Math.max(...slice.map((b) => b.high)))} />
            <Stat label="Low" value={fmt(Math.min(...slice.map((b) => b.low)))} />
            <Stat label="Bars" value={String(slice.length)} />
          </div>
        </>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)]">
          No {TIMEFRAME_LABELS[tf]} bars loaded for {symbol}. Try Refresh or another timeframe.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span>
      <span className="text-[var(--text-muted)]">{label} </span>
      <span className="font-mono font-semibold" style={tone ? { color: tone } : undefined}>{value}</span>
    </span>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

function absDecimals(n: number): number {
  if (Math.abs(n) >= 1000) return 2;
  if (Math.abs(n) >= 100) return 2;
  if (Math.abs(n) >= 1) return 3;
  return 5;
}