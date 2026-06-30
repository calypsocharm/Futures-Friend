"use client";

import { useEffect, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { AdvisorBanner } from "@/components/AdvisorBanner";
import { TimeframeCard } from "@/components/TimeframeCard";
import { SymbolPicker } from "@/components/SymbolPicker";
import { BarInput } from "@/components/BarInput";
import { ConfluenceMatrix } from "@/components/ConfluenceMatrix";
import { KeyLevelsPanel } from "@/components/KeyLevelsPanel";
import { TradePlanPanel } from "@/components/TradePlanPanel";
import { RiskCalculator } from "@/components/RiskCalculator";
import { SetupsPanel } from "@/components/SetupsPanel";
import { GaugesPanel } from "@/components/GaugesPanel";
import { ChartPanel } from "@/components/ChartPanel";
import { BacktestPanel } from "@/components/BacktestPanel";
import { AdaptiveSTPanel } from "@/components/AdaptiveSTPanel";
import { MeanReversionPanel } from "@/components/MeanReversionPanel";
import { ConfluenceBanner, JournalPanel } from "@/components/ConfluenceJournal";
import { CorrelationPanel } from "@/components/CorrelationPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { AlertsPanel } from "@/components/AlertsPanel";
import Link from "next/link";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useWatchlist } from "@/store/watchlist";
import { symbolDef } from "@/lib/symbols";

export default function Page() {
  const symbol = useAnalysis((s) => s.symbol);
  const report = useAnalysis((s) => s.report);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const refresh = useAnalysis((s) => s.refresh);
  const loading = useAnalysis((s) => s.loading);
  const error = useAnalysis((s) => s.error);
  const fetchedAt = useAnalysis((s) => s.fetchedAt);
  const live = useAnalysis((s) => s.live);
  const autoRefresh = useWatchlist((s) => s.autoRefresh);
  const setAutoRefresh = useWatchlist((s) => s.setAutoRefresh);
  const intervalSec = useWatchlist((s) => s.intervalSec);
  const setIntervalSec = useWatchlist((s) => s.setIntervalSec);
  const setItem = useWatchlist((s) => s.setItem);
  const [view, setView] = useState<"live" | "backtest">("live");
  const tfCount = Object.values(barsByTimeframe).filter((b) => b && b.length > 0).length;

  useAutoRefresh();

  useEffect(() => {
    if (tfCount === 0 && !loading) void refresh();
  }, [tfCount, loading, refresh]);

  useEffect(() => {
    if (report && report.perTimeframe[0]) {
      setItem({
        symbol,
        label: symbolDef(symbol)?.label ?? symbol,
        direction: report.dominant,
        confidence: report.confidence,
        lastPrice: report.perTimeframe[0].lastPrice,
        updatedAt: Date.now(),
      });
    }
  }, [report, symbol, setItem]);

  const def = symbolDef(symbol);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-72 flex-shrink-0 flex-col gap-4 border-r border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Futures Friend
          </div>
          <h1 className="text-lg font-bold">Trend &amp; Flow Adviser</h1>
        </div>
        <Link
          href="/scalp"
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-center text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--neutral)]"
        >
          → Scalping Friend
        </Link>
        <SymbolPicker />
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Data source</span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: live ? "var(--bull)" : "var(--neutral)",
                color: "var(--bg)",
              }}
            >
              {live ? "LIVE" : "SAMPLE"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Last update</span>
            <span className="font-mono">
              {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : "—"}
            </span>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1.5 text-xs text-[var(--text)] hover:border-[var(--neutral)] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh now"}
          </button>
          <div className="mt-2 flex items-center justify-between">
            <label className="text-[var(--text-muted)]">Auto-refresh</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: autoRefresh ? "var(--bull)" : "var(--bg-panel)",
                color: autoRefresh ? "var(--bg)" : "var(--text-muted)",
                borderColor: autoRefresh ? "var(--bull)" : "var(--border)",
              }}
            >
              {autoRefresh ? "ON" : "OFF"}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <label className="text-[var(--text-muted)]">Interval</label>
            <select
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px]"
            >
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={120}>2m</option>
              <option value={300}>5m</option>
            </select>
          </div>
          {error && (
            <div className="mt-1 text-[10px] text-[var(--bear)]">{error}</div>
          )}
        </div>
        {def && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
            <div className="text-[var(--text-muted)]">Contract specs</div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <span className="text-[var(--text-muted)]">Category</span>
              <span>{def.category}</span>
              <span className="text-[var(--text-muted)]">Tick size</span>
              <span className="font-mono">{def.tickSize}</span>
              <span className="text-[var(--text-muted)]">Tick value</span>
              <span className="font-mono">${def.tickValue}</span>
              <span className="text-[var(--text-muted)]">Yahoo</span>
              <span className="font-mono">{def.yahoo}</span>
            </div>
          </div>
        )}
        <BarInput />
        <p className="mt-auto text-[10px] leading-relaxed text-[var(--text-muted)]">
          Live data via Yahoo Finance public endpoints (free, no key). Educational tool only — not financial advice.
        </p>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setView("live")}
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: view === "live" ? "var(--neutral)" : "var(--bg-panel)",
              color: view === "live" ? "var(--bg)" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            ● Live
          </button>
          <button
            onClick={() => setView("backtest")}
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: view === "backtest" ? "var(--neutral)" : "var(--bg-panel)",
              color: view === "backtest" ? "var(--bg)" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            ◀▶ Backtest
          </button>
        </div>

        {view === "backtest" ? (
          <BacktestPanel />
        ) : (
          <>
            <ConfluenceBanner />

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AdvisorBanner />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <WatchlistPanel />
                <AlertsPanel />
              </div>
            </div>

            {report && report.perTimeframe.length > 0 && (
              <div className="mt-6">
                <ChartPanel />
              </div>
            )}

            {report && report.perTimeframe.length > 0 && (
              <div className="mt-6">
                <AdaptiveSTPanel />
              </div>
            )}

            {report && report.perTimeframe.length > 0 && (
              <div className="mt-6">
                <MeanReversionPanel />
              </div>
            )}

            {report && report.matrix.length > 0 && (
              <div className="mt-6">
                <ConfluenceMatrix rows={report.matrix} />
              </div>
            )}

            {report && report.tradePlan && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TradePlanPanel plan={report.tradePlan} />
                <RiskCalculator plan={report.tradePlan} />
              </div>
            )}

            {report && (report.setups.length > 0 || report.keyLevels.length > 0) && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SetupsPanel setups={report.setups} />
                {report.perTimeframe[0] && (
                  <KeyLevelsPanel levels={report.keyLevels} lastPrice={report.perTimeframe[0].lastPrice} />
                )}
              </div>
            )}

            {report && report.gauges.length > 0 && (
              <div className="mt-6">
                <GaugesPanel gauges={report.gauges} />
              </div>
            )}

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Timeframe ladder
              </h2>
              {report && report.perTimeframe.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {report.perTimeframe.map((a) => (
                    <TimeframeCard key={a.timeframe} a={a} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
                  {loading ? `Fetching live data for ${symbol}…` : `No data loaded for ${symbol}. Hit Refresh.`}
                </div>
              )}
            </div>

            {report && (
              <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-xs text-[var(--text-muted)]">
                <span className="text-[var(--text)]">Loaded bars: </span>
                {Object.entries(barsByTimeframe).map(([tf, bars]) => (
                  <span key={tf} className="mr-3 inline-block">
                    {tf}: {bars?.length ?? 0}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6">
              <JournalPanel />
            </div>

            <div className="mt-6">
              <CorrelationPanel />
            </div>
          </>
        )}
      </main>
    </div>
  );
}