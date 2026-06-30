"use client";

import { useEffect, useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useWatchlist } from "@/store/watchlist";
import { buildScalpReport } from "@/lib/scalp";
import type { ScalpReport } from "@/lib/scalp";
import { SCALP_TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";
import type { Direction } from "@/lib/types";
import { SymbolPicker } from "@/components/SymbolPicker";
import { ScalpChart } from "@/components/ScalpChart";
import { ORBPanel } from "@/components/ORBPanel";
import { EconCalendarBanner } from "@/components/EconCalendarBanner";
import Link from "next/link";
import { symbolDef } from "@/lib/symbols";

const DIR_COLOR: Record<Direction, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};
const DIR_ICON: Record<Direction, string> = { bull: "▲", bear: "▼", neutral: "■" };
const DIR_WORD: Record<Direction, string> = { bull: "LONG BIAS", bear: "SHORT BIAS", neutral: "NO EDGE" };

export default function ScalpPage() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const refresh = useAnalysis((s) => s.refresh);
  const loading = useAnalysis((s) => s.loading);
  const live = useAnalysis((s) => s.live);
  const fetchedAt = useAnalysis((s) => s.fetchedAt);
  const autoRefresh = useWatchlist((s) => s.autoRefresh);

  useAutoRefresh();

  const scalpBars = useMemo(() => {
    const out: Partial<Record<string, typeof barsByTimeframe[keyof typeof barsByTimeframe]>> = {};
    for (const tf of SCALP_TIMEFRAMES) {
      out[tf] = barsByTimeframe[tf];
    }
    return out as typeof barsByTimeframe;
  }, [barsByTimeframe]);

  const report = useMemo(() => buildScalpReport(symbol, scalpBars), [symbol, scalpBars]);

  useEffect(() => {
    const has = Object.values(barsByTimeframe).some((b) => b && b.length > 0);
    if (!has && !loading) void refresh();
  }, [barsByTimeframe, loading, refresh]);

  const def = symbolDef(symbol);
  const tfCount = Object.values(barsByTimeframe).filter((b) => b && b.length > 0).length;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className={`ff-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <div className="ff-hamburger" onClick={() => setSidebarOpen((s) => !s)}>
        <span /><span /><span />
      </div>
      <aside className={`ff-sidebar flex w-72 flex-shrink-0 flex-col gap-4 border-r border-[var(--border)] bg-[var(--bg-panel)] p-4 ${sidebarOpen ? "open" : ""}`}>
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Scalping Friend
          </div>
          <h1 className="text-lg font-bold">Fast TF Scalper</h1>
        </div>

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-center text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            ← Swing Friend
          </Link>
        </div>

        <SymbolPicker />

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Data</span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: live ? "var(--bull)" : "var(--neutral)", color: "var(--bg)" }}
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
            <span className="text-[var(--text-muted)]">Auto</span>
            <span className="text-[10px] font-bold" style={{ color: autoRefresh ? "var(--bull)" : "var(--text-muted)" }}>
              {autoRefresh ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {def && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
            <div className="text-[var(--text-muted)]">Contract</div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <span className="text-[var(--text-muted)]">Tick</span>
              <span className="font-mono">{def.tickSize} = ${def.tickValue}</span>
              <span className="text-[var(--text-muted)]">Yahoo</span>
              <span className="font-mono">{def.yahoo}</span>
            </div>
          </div>
        )}

        <EconCalendarBanner />

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
          <div className="text-[var(--text-muted)]">Scalp TFs</div>
          <div className="mt-1 font-mono text-[var(--text)]">
            {SCALP_TIMEFRAMES.map((t) => TIMEFRAME_LABELS[t]).join(" · ")}
          </div>
        </div>

        <p className="mt-auto text-[10px] leading-relaxed text-[var(--text-muted)]">
          Educational tool only. Not financial advice. Scalping is high-risk — most scalpers lose. Trade small.
        </p>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {tfCount === 0 && loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
            Fetching live scalp data for {symbol}…
          </div>
        ) : (
          <>
            {/* Trigger banner */}
            <ScalpTriggerBanner trigger={report.trigger} />

            {/* Bias banner */}
            <div className="mt-4 rounded-xl border p-5" style={{ borderColor: DIR_COLOR[report.dominant], background: "var(--bg-panel)" }}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                    {symbol} — Scalp Bias
                  </div>
                  <div className="text-3xl font-bold" style={{ color: DIR_COLOR[report.dominant] }}>
                    {DIR_ICON[report.dominant]} {DIR_WORD[report.dominant]} · {report.confidence}%
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <Chip label="Long" value={report.bullCount} color="var(--bull)" />
                  <Chip label="Flat" value={report.neutralCount} color="var(--neutral)" />
                  <Chip label="Short" value={report.bearCount} color="var(--bear)" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text)]">{report.advisor}</p>
            </div>

            {/* Scalp plan */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ScalpPlanPanel report={report} />
              <ScalpTFTable report={report} />
            </div>

            {/* Chart */}
            <div className="mt-6">
              <ScalpChart report={report} />
            </div>

            {/* ORB */}
            <div className="mt-6">
              <ORBPanel />
            </div>

            {/* Signals */}
            <div className="mt-6">
              <ScalpSignalsPanel report={report} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md px-3 py-1.5" style={{ background: "var(--bg-panel-2)", border: `1px solid ${color}` }}>
      <span className="text-[var(--text-muted)]">{label} </span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function ScalpPlanPanel({ report }: { report: ReturnType<typeof buildScalpReport> }) {
  const p = report.plan;
  if (p.bias === "flat") {
    return (
      <div className="rounded-xl border border-[var(--neutral)] bg-[var(--bg-panel)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Scalp plan</h2>
        <div className="mt-2 text-sm text-[var(--text-muted)]">No bias — sit out. Wait for a clean EMA9/21 cross.</div>
      </div>
    );
  }
  const color = p.bias === "long" ? "var(--bull)" : "var(--bear)";
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: color, background: "var(--bg-panel)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Scalp plan</h2>
        <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: color, color: "var(--bg)" }}>
          {p.bias.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Block label="Entry" value={fmt(p.entry)} color="var(--neutral)" />
        <Block label="Stop" value={`${fmt(p.stop)} (${p.stopTicks}t = $${p.stopDollars})`} color="var(--bear)" />
        <Block label="Target 1" value={`${fmt(p.target1)} (${p.t1Ticks}t = +$${p.t1Dollars})`} color="var(--bull)" />
        <Block label="Target 2" value={`${fmt(p.target2)} (${p.t2Ticks}t = +$${p.t2Dollars})`} color="var(--bull)" />
      </div>
      <div className="mt-2 text-xs text-[var(--text-muted)]">
        R:R = 1.5:1 to T1, 3:1 to T2. Stop = 0.75×ATR or 4 ticks min. Per-contract $ at risk: ${p.stopDollars}.
      </div>
    </div>
  );
}

function Block({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: color, background: "var(--bg-panel-2)" }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}

function ScalpTFTable({ report }: { report: ReturnType<typeof buildScalpReport> }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Scalp TF ladder
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-muted)]">
              <th className="px-2 py-1 text-left">TF</th>
              <th className="px-2 py-1 text-left">Dir</th>
              <th className="px-2 py-1 text-right">EMA9</th>
              <th className="px-2 py-1 text-right">EMA21</th>
              <th className="px-2 py-1 text-right">RSI</th>
              <th className="px-2 py-1 text-right">ATR%</th>
              <th className="px-2 py-1 text-left">Cross</th>
              <th className="px-2 py-1 text-left">Flow</th>
            </tr>
          </thead>
          <tbody>
            {report.perTimeframe.map((a) => (
              <tr key={a.tf} className="border-t border-[var(--border)]">
                <td className="px-2 py-1.5 font-semibold">{a.label}</td>
                <td className="px-2 py-1.5" style={{ color: DIR_COLOR[a.direction] }}>
                  {DIR_ICON[a.direction]}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt(a.ema9)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt(a.ema21)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{a.rsi.toFixed(0)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{a.atrPct.toFixed(2)}%</td>
                <td className="px-2 py-1.5 font-mono">
                  {a.crossDirection === "up" ? "▲" : a.crossDirection === "down" ? "▼" : "—"}
                  {a.barsSinceCross > 0 && a.barsSinceCross < 99 ? ` ${a.barsSinceCross}b` : ""}
                </td>
                <td className="px-2 py-1.5 font-mono" style={{ color: a.flow === "strong" ? "var(--neutral)" : "var(--text-muted)" }}>
                  {a.flow}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScalpSignalsPanel({ report }: { report: ReturnType<typeof buildScalpReport> }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Scalp signals ({report.signals.length})
      </h2>
      {report.signals.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">No active scalp signals. Waiting for an EMA9/21 cross or momentum burst.</div>
      ) : (
        <ul className="space-y-2">
          {report.signals.map((s, i) => {
            const c = s.bias === "long" ? "var(--bull)" : "var(--bear)";
            return (
              <li key={i} className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: c, background: "var(--bg-panel-2)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.message}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: c, color: "var(--bg)" }}>
                    {s.bias.toUpperCase()} @ {fmt(s.atPrice)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

function ScalpTriggerBanner({ trigger }: { trigger: ScalpReport["trigger"] }) {
  const STATUS_COLOR: Record<string, string> = {
    GO: "var(--bull)",
    WAIT: "var(--neutral)",
    "NO-GO": "var(--bear)",
  };
  const STATUS_BG: Record<string, string> = {
    GO: "rgba(38, 208, 124, 0.08)",
    WAIT: "rgba(240, 180, 41, 0.06)",
    "NO-GO": "rgba(255, 92, 92, 0.06)",
  };
  const c = STATUS_COLOR[trigger.status] ?? "var(--text-muted)";
  const bg = STATUS_BG[trigger.status] ?? "var(--bg-panel)";
  const big = trigger.status === "GO";

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: c, background: bg }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="rounded-lg px-4 py-2 text-2xl font-black"
            style={{ background: c, color: "var(--bg)" }}
          >
            {trigger.status}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
              Scalp trigger
            </div>
            <div className={`font-bold ${big ? "text-2xl" : "text-lg"}`} style={{ color: c }}>
              {trigger.action}
            </div>
          </div>
        </div>
        {trigger.entry != null && (
          <div className="flex gap-4 text-sm">
            <div className="rounded-md border border-[var(--neutral)] px-3 py-1.5" style={{ background: "var(--bg-panel-2)" }}>
              <span className="text-[var(--text-muted)]">Entry </span>
              <span className="font-mono font-bold">{fmt(trigger.entry)}</span>
            </div>
            {trigger.stop != null && (
              <div className="rounded-md border border-[var(--bear)] px-3 py-1.5" style={{ background: "var(--bg-panel-2)" }}>
                <span className="text-[var(--text-muted)]">Stop </span>
                <span className="font-mono font-bold" style={{ color: "var(--bear)" }}>{fmt(trigger.stop)}</span>
              </div>
            )}
            {trigger.target != null && (
              <div className="rounded-md border border-[var(--bull)] px-3 py-1.5" style={{ background: "var(--bg-panel-2)" }}>
                <span className="text-[var(--text-muted)]">T1 </span>
                <span className="font-mono font-bold" style={{ color: "var(--bull)" }}>{fmt(trigger.target)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{trigger.reason}</p>
    </div>
  );
}