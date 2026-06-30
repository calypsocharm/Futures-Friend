"use client";

import { useEffect, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { SYMBOLS } from "@/lib/symbols";
import type { Bar, Direction } from "@/lib/types";
import { computeConfluence } from "@/lib/confluence";
import type { Grade } from "@/lib/confluence";

const GRADE_COLOR: Record<Grade, string> = {
  "A+": "var(--bull)",
  "A": "var(--bull)",
  "B": "#5ad1c4",
  "C": "var(--neutral)",
  "D": "#f0b429",
  "F": "var(--bear)",
};

const DIR_ICON: Record<Direction, string> = { bull: "▲", bear: "▼", neutral: "■" };

interface ScanResult {
  symbol: string;
  label: string;
  category: string;
  grade: Grade;
  score: number;
  direction: Direction;
  agreement: number;
  lastPrice: number;
  rsi: number;
  atrPct: number;
  tickValue: number;
  stopDollars: number;
  stopPrice: number;
  target1: number;
  target2: number;
  holdTime: string;
  holdReason: string;
  exitCondition: string;
  invalidation: string;
}

async function fetchScanBars(symbol: string): Promise<Partial<Record<string, Bar[]>>> {
  const tfs = ["1D", "4H", "1H", "1m"];
  const out: Partial<Record<string, Bar[]>> = {};
  await Promise.all(tfs.map(async (tf) => {
    try {
      const res = await fetch(`/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${tf}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      out[tf] = (d.bars ?? []) as Bar[];
    } catch { /* skip */ }
  }));
  return out;
}

export function BestPlaysPanel() {
  const setSymbol = useAnalysis((s) => s.setSymbol);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);

  async function scan() {
    setLoading(true);
    setScanned(false);
    const out: ScanResult[] = [];
    for (const def of SYMBOLS) {
      const bars = await fetchScanBars(def.symbol);
      const c = computeConfluence(def.symbol, bars);
      const refTF = bars["1D"] ?? bars["4H"] ?? bars["1H"] ?? [];
      const lastPrice = refTF.length > 0 ? refTF[refTF.length - 1].close : 0;
      let rsi = 50, atrPct = 0, atrVal = 0;
      if (refTF.length >= 20) {
        const closes = refTF.map((b) => b.close);
        let g = 0, l = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const d = closes[i] - closes[i - 1];
          if (d >= 0) g += d; else l -= d;
        }
        rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
        const highs = refTF.map((b) => b.high);
        const lows = refTF.map((b) => b.low);
        const trs: number[] = [];
        for (let i = 1; i < refTF.length; i++) {
          trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - refTF[i - 1].close), Math.abs(lows[i] - refTF[i - 1].close)));
        }
        atrVal = trs.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trs.length);
        atrPct = lastPrice > 0 ? (atrVal / lastPrice) * 100 : 0;
      }
      const stopDollars = atrVal * 0.75 * (def.tickValue / def.tickSize);

      // Determine hold time based on which TFs have the most bars + signal strength
      const dailyBars = bars["1D"] ?? [];
      const h4Bars = bars["4H"] ?? [];
      const h1Bars = bars["1H"] ?? [];
      const hasDaily = dailyBars.length >= 30;
      const has4H = h4Bars.length >= 20;
      const has1H = h1Bars.length >= 20;

      let holdTime = "Intraday (hours)";
      let holdReason = "Signal driven by hourly timeframe";
      if (hasDaily && c.agreement >= 70) {
        holdTime = "2-5 days (swing)";
        holdReason = "Daily confluence is strong — this is a swing hold, not a quick flip";
      } else if (has4H && c.agreement >= 60) {
        holdTime = "1-3 days";
        holdReason = "4H confluence — hold overnight to a few days";
      } else if (has1H) {
        holdTime = "2-8 hours (intraday)";
        holdReason = "1H signal — intraday hold, exit by end of session unless it runs";
      } else {
        holdTime = "Minutes to 1 hour";
        holdReason = "Fast TF signal only — quick scalp, don't hold overnight";
      }

      // Exit conditions
      const bull = c.dominant === "bull";
      const stopPrice = bull ? lastPrice - atrVal * 0.75 : lastPrice + atrVal * 0.75;
      const target1 = bull ? lastPrice + atrVal * 1.5 : lastPrice - atrVal * 1.5;
      const target2 = bull ? lastPrice + atrVal * 3 : lastPrice - atrVal * 3;
      const exitCondition = `Scale 50% at T1 (${fmt(target1)}), trail rest to T2 (${fmt(target2)}). Move stop to breakeven after T1 hits.`;
      const invalidation = `Close below ${fmt(stopPrice)} (0.75×ATR) = thesis wrong, exit immediately. ${rsi > 70 && bull ? "RSI overbought — if price stalls at T1, take profit don't hold hoping." : rsi < 30 && !bull ? "RSI oversold — if price stalls at T1, take profit don't hold hoping." : ""}`;

      out.push({
        symbol: def.symbol,
        label: def.label,
        category: def.category,
        grade: c.grade,
        score: c.score,
        direction: c.dominant,
        agreement: c.agreement,
        lastPrice,
        rsi: Math.round(rsi),
        atrPct: Math.round(atrPct * 100) / 100,
        tickValue: def.tickValue,
        stopDollars: Math.round(stopDollars),
        stopPrice,
        target1,
        target2,
        holdTime,
        holdReason,
        exitCondition,
        invalidation,
      });
    }
    out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    setResults(out);
    setLoading(false);
    setScanned(true);
    setLastScan(Date.now());
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    scan();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const longs = results.filter((r) => r.direction === "bull");
  const shorts = results.filter((r) => r.direction === "bear");
  const neutrals = results.filter((r) => r.direction === "neutral");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Best Plays Scanner ({results.length} symbols)
        </h2>
        <div className="flex items-center gap-2">
          {lastScan && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {new Date(lastScan).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => scan()}
            disabled={loading}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1 text-xs text-[var(--text)] hover:border-[var(--neutral)] disabled:opacity-50"
          >
            {loading ? "Scanning…" : "↻ Re-scan"}
          </button>
        </div>
      </div>

      {loading && results.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
          Scanning all 20 symbols…
        </div>
      ) : scanned ? (
        <>
          {/* Longs */}
          {longs.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--bull)]">Long candidates (ranked)</div>
              <div className="space-y-1.5">
                {longs.map((r, i) => (
                  <ScanRow key={r.symbol} r={r} rank={i + 1} onClick={() => setSymbol(r.symbol)} />
                ))}
              </div>
            </div>
          )}

          {/* Shorts */}
          {shorts.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--bear)]">Short candidates (ranked)</div>
              <div className="space-y-1.5">
                {shorts.map((r, i) => (
                  <ScanRow key={r.symbol} r={r} rank={i + 1} onClick={() => setSymbol(r.symbol)} />
                ))}
              </div>
            </div>
          )}

          {/* Neutral */}
          {neutrals.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">No edge — sit out</div>
              <div className="flex flex-wrap gap-2">
                {neutrals.map((r) => (
                  <span key={r.symbol} className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-mono text-[var(--text-muted)]" style={{ background: "var(--bg-panel-2)" }}>
                    {r.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[10px] text-[var(--text-muted)]">
            Click any row to load that symbol into the dashboard. Stop $ = 0.75×ATR in dollar terms per contract. Re-scan to refresh.
          </p>
        </>
      ) : null}
    </div>
  );
}

function ScanRow({ r, rank, onClick }: { r: ScanResult; rank: number; onClick: () => void }) {
  const color = GRADE_COLOR[r.grade];
  const dirColor = r.direction === "bull" ? "var(--bull)" : "var(--bear)";
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md border transition"
      style={{ borderColor: color, background: "var(--bg-panel-2)" }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded text-sm font-black" style={{ background: color, color: "var(--bg)" }}>
            {r.grade}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{r.symbol}</span>
              <span style={{ color: dirColor }}>{DIR_ICON[r.direction]}</span>
              <span className="text-[var(--text-muted)]">#{rank}</span>
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">{r.category} · {r.agreement}% agree · ⏱ {r.holdTime}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-[var(--text-muted)]">Price</div>
            <div className="font-bold">{fmt(r.lastPrice)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[var(--text-muted)]">RSI</div>
            <div style={{ color: r.rsi > 70 ? "var(--bear)" : r.rsi < 30 ? "var(--bull)" : "var(--text)" }}>{r.rsi}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[var(--text-muted)]">Stop $</div>
            <div style={{ color: "var(--bear)" }}>${r.stopDollars}</div>
          </div>
          <span className="text-[var(--text-muted)]">{expanded ? "▼" : "▶"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-3 text-xs">
          {/* Trade plan grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PlanBlock label="Entry" value={fmt(r.lastPrice)} color="var(--neutral)" />
            <PlanBlock label="Stop" value={fmt(r.stopPrice)} sub={`$${r.stopDollars}`} color="var(--bear)" />
            <PlanBlock label="Target 1" value={fmt(r.target1)} sub="scale 50%" color="var(--bull)" />
            <PlanBlock label="Target 2" value={fmt(r.target2)} sub="trail rest" color="var(--bull)" />
          </div>

          {/* Hold time */}
          <div className="mt-3 rounded-md border border-[var(--border)] p-2" style={{ background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[var(--neutral)] font-bold">⏱ Hold time: {r.holdTime}</span>
            </div>
            <div className="mt-0.5 text-[var(--text-muted)]">{r.holdReason}</div>
          </div>

          {/* Exit conditions */}
          <div className="mt-2 rounded-md border border-[var(--border)] p-2" style={{ background: "var(--bg-panel)" }}>
            <div className="text-[var(--bull)] font-bold">📋 Exit plan</div>
            <div className="mt-0.5 text-[var(--text)]">{r.exitCondition}</div>
          </div>

          {/* Invalidation */}
          <div className="mt-2 rounded-md border border-[var(--bear)] p-2" style={{ background: "var(--bg-panel)" }}>
            <div className="text-[var(--bear)] font-bold">⛔ Invalidation</div>
            <div className="mt-0.5 text-[var(--text)]">{r.invalidation}</div>
          </div>

          {/* Load into dashboard */}
          <button
            onClick={onClick}
            className="mt-3 w-full rounded-md bg-[var(--neutral)] px-3 py-1.5 text-xs font-bold text-[var(--bg)]"
          >
            → Load {r.symbol} into dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function PlanBlock({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: color, background: "var(--bg-panel)" }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="font-mono font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}