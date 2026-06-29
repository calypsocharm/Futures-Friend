"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useAnalysis } from "@/store/analysis";
import { replayAt } from "@/lib/analyzer";
import { CandleChart } from "@/components/CandleChart";
import { ema } from "@/lib/indicators";
import type { Direction, Timeframe } from "@/lib/types";
import { TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";

const DIR_COLOR: Record<Direction, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const DIR_ICON: Record<Direction, string> = { bull: "▲", bear: "▼", neutral: "■" };
const DIR_WORD: Record<Direction, string> = { bull: "LONG", bear: "SHORT", neutral: "NEUTRAL" };

export function BacktestPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);
  const [windowSize, setWindowSize] = useState(120);
  const playRef = useRef<number | null>(null);

  const allBars = useMemo(() => barsByTimeframe[tf] ?? [], [barsByTimeframe, tf]);
  const max = allBars.length;
  const safeStep = Math.min(step, Math.max(0, max - 1));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (max > 0 && step === 0) setStep(Math.min(windowSize, max - 1));
    if (max > 0 && step >= max) setStep(max - 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  useEffect(() => {
    if (!playing) {
      if (playRef.current) window.clearInterval(playRef.current);
      return;
    }
    playRef.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= max - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, speedMs);
    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
    };
  }, [playing, speedMs, max]);

  const visible = useMemo(() => {
    const start = Math.max(0, safeStep - windowSize + 1);
    return allBars.slice(start, safeStep + 1);
  }, [allBars, safeStep, windowSize]);

  const verdict = useMemo(() => {
    if (!allBars.length || safeStep < 5) return null;
    return replayAt(allBars, safeStep, symbol);
  }, [allBars, safeStep, symbol]);

  const ema20Arr = useMemo(() => (visible.length ? ema(visible.map((b) => b.close), 20) : []), [visible]);
  const ema50Arr = useMemo(() => (visible.length ? ema(visible.map((b) => b.close), 50) : []), [visible]);

  if (!allBars.length) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-sm text-[var(--text-muted)]">
        No bars loaded for backtest yet. Wait for data to load.
      </div>
    );
  }

  const color = verdict ? DIR_COLOR[verdict.direction] : "var(--text-muted)";
  const pct = max > 1 ? Math.round((safeStep / (max - 1)) * 100) : 0;
  const curBar = allBars[safeStep];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Backtest / Replay — {symbol}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tf}
            onChange={(e) => {
              setTf(e.target.value as Timeframe);
              setStep(0);
              setPlaying(false);
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
          >
            {TIMEFRAMES.map((t) => (
              <option key={t} value={t}>
                {TIMEFRAME_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
            title="Bars visible in the chart window"
          >
            <option value={60}>60-bar window</option>
            <option value={120}>120-bar window</option>
            <option value={240}>240-bar window</option>
          </select>
        </div>
      </div>

      {verdict && (
        <div className="mb-3 rounded-lg border p-3" style={{ borderColor: color, background: "var(--bg-panel-2)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold" style={{ color }}>
                {DIR_ICON[verdict.direction]} {DIR_WORD[verdict.direction]}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {verdict.confidence}% confidence · {verdict.bars} bars used
              </span>
            </div>
            <div className="flex gap-3 text-xs font-mono">
              <span><span className="text-[var(--text-muted)]">P </span>{fmt(verdict.lastPrice)}</span>
              <span><span className="text-[var(--text-muted)]">E20 </span>{fmt(verdict.ema20)}</span>
              <span><span className="text-[var(--text-muted)]">E50 </span>{fmt(verdict.ema50)}</span>
              <span><span className="text-[var(--text-muted)]">RSI </span>{verdict.rsi.toFixed(1)}</span>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">{verdict.advisor}</p>
        </div>
      )}

      <CandleChart
        bars={visible}
        ema20={ema20Arr}
        ema50={ema50Arr}
        height={320}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setStep(Math.max(0, safeStep - 1))}
          disabled={safeStep <= 0}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs hover:border-[var(--neutral)] disabled:opacity-40"
          title="Previous bar"
        >
          ◀
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={safeStep >= max - 1}
          className="rounded-md border px-3 py-1.5 text-xs font-semibold"
          style={{
            background: playing ? "var(--bear)" : "var(--bull)",
            color: "var(--bg)",
            borderColor: playing ? "var(--bear)" : "var(--bull)",
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => setStep(Math.min(max - 1, safeStep + 1))}
          disabled={safeStep >= max - 1}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs hover:border-[var(--neutral)] disabled:opacity-40"
          title="Next bar"
        >
          ▶
        </button>
        <button
          onClick={() => { setStep(Math.min(max - 1, safeStep + 10)); }}
          disabled={safeStep >= max - 1}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs hover:border-[var(--neutral)] disabled:opacity-40"
          title="Skip 10 bars"
        >
          ⏩ +10
        </button>
        <button
          onClick={() => { setStep(max - 1); setPlaying(false); }}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs hover:border-[var(--neutral)]"
          title="Jump to latest"
        >
          ⏭ Latest
        </button>
        <div className="ml-2 flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">Speed</span>
          <select
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px]"
          >
            <option value={2000}>0.5×</option>
            <option value={1000}>1×</option>
            <option value={500}>2×</option>
            <option value={200}>5×</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={Math.max(0, max - 1)}
          value={safeStep}
          onChange={(e) => { setStep(Number(e.target.value)); setPlaying(false); }}
          className="w-full"
          style={{ accentColor: "var(--neutral)" }}
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>
            Bar {safeStep + 1} / {max} · {pct}% through history
          </span>
          <span>
            {curBar ? new Date(curBar.time).toLocaleString() : "—"}
          </span>
          <span>{curBar ? `O ${fmt(curBar.open)} C ${fmt(curBar.close)}` : ""}</span>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}