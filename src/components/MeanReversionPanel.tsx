"use client";

import { useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { analyzeMeanReversion } from "@/lib/meanReversion";
import type { Timeframe } from "@/lib/types";
import { TIMEFRAME_LABELS } from "@/lib/types";

const W = 900;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 10;
const PAD_B = 24;
const HEIGHT = 400;

export function MeanReversionPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [count, setCount] = useState(180);

  const bars = useMemo(() => barsByTimeframe[tf] ?? [], [barsByTimeframe, tf]);
  const slice = useMemo(() => bars.slice(-count), [bars, count]);
  const mr = useMemo(() => analyzeMeanReversion(slice), [slice]);

  if (slice.length < 30) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <Header symbol={symbol} tf={tf} setTf={setTf} count={count} setCount={setCount} />
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
          Not enough bars for mean reversion analysis (need 30+).
        </div>
      </div>
    );
  }

  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);
  const max = Math.max(...highs, mr.upper);
  const min = Math.min(...lows, mr.lower);
  const pad = (max - min) * 0.06 || 1;
  const top = max + pad;
  const bot = min - pad;
  const chartH = HEIGHT - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;
  const cw = plotW / slice.length;
  const x = (i: number) => PAD_L + i * cw + cw / 2;
  const y = (p: number) => PAD_T + ((top - p) / (top - bot)) * chartH;

  const last = slice[slice.length - 1];
  const lastY = y(last.close);

  const SIGNAL_COLOR: Record<string, string> = {
    "oversold-tag": "var(--bull)",
    "overbought-tag": "var(--bear)",
    "extreme-z-low": "var(--bull)",
    "extreme-z-high": "var(--bear)",
    "mean-reclaim-up": "#5ad1c4",
    "mean-reclaim-down": "#f0b429",
    "vwap-fade-long": "var(--bull)",
    "vwap-fade-short": "var(--bear)",
  };
  const SIGNAL_ICON: Record<string, string> = {
    "oversold-tag": "OL",
    "overbought-tag": "OB",
    "extreme-z-low": "Z-",
    "extreme-z-high": "Z+",
    "mean-reclaim-up": "↑M",
    "mean-reclaim-down": "↓M",
    "vwap-fade-long": "VW↑",
    "vwap-fade-short": "VW↓",
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <Header symbol={symbol} tf={tf} setTf={setTf} count={count} setCount={setCount} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {symbol} — Mean Reversion ({TIMEFRAME_LABELS[tf]})
          </div>
          <div className="text-2xl font-bold" style={{ color: mr.regime === "extreme-low" ? "var(--bull)" : mr.regime === "extreme-high" ? "var(--bear)" : mr.regime === "trending" ? "var(--neutral)" : "var(--text-muted)" }}>
            {mr.regime === "extreme-low" ? "▲ OVERSOLD" : mr.regime === "extreme-high" ? "▼ OVERBOUGHT" : mr.regime === "trending" ? "■ TRENDING" : "○ RANGING"}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">Z {mr.currentZ.toFixed(2)} · BB width {mr.bandwidth.toFixed(2)}%</span>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Stat label="RSI" value={mr.rsiVal.toFixed(0)} color={mr.rsiVal < 30 ? "var(--bull)" : mr.rsiVal > 70 ? "var(--bear)" : "var(--text)"} />
          <Stat label="Z" value={mr.currentZ.toFixed(2)} color={Math.abs(mr.currentZ) >= 2 ? "var(--neutral)" : "var(--text)"} />
          <Stat label="VWAP dev" value={`${mr.vwapDevPct >= 0 ? "+" : ""}${mr.vwapDevPct.toFixed(2)}%`} color={Math.abs(mr.vwapDevPct) >= 2 ? "var(--neutral)" : "var(--text)"} />
          <Stat label="Signals" value={String(mr.signals.length)} color="var(--text)" />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const v = bot + ((top - bot) * i) / 4;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={W - PAD_R + 6} y={y(v) + 3} fill="var(--text-muted)" fontSize="10" fontFamily="ui-monospace, monospace">{fmt(v)}</text>
            </g>
          );
        })}

        {/* Bollinger bands fill */}
        {slice.map((_, i) => {
          if (i === 0 || mr.bb[i].sma === 0) return null;
          const upper = mr.bb[i].upper;
          const lower = mr.bb[i].lower;
          return (
            <rect
              key={"bbf" + i}
              x={x(i) - cw / 2}
              y={y(upper)}
              width={cw}
              height={y(lower) - y(upper)}
              fill="var(--neutral)"
              fillOpacity="0.06"
            />
          );
        })}

        {/* Bollinger bands lines */}
        {mr.bb.map((b, i) => {
          if (i === 0 || b.sma === 0) return null;
          const prev = mr.bb[i - 1];
          if (prev.sma === 0) return null;
          return (
            <g key={"bb" + i}>
              <line x1={x(i - 1)} y1={y(prev.upper)} x2={x(i)} y2={y(b.upper)} stroke="#7aa2ff" strokeWidth="1" opacity="0.6" />
              <line x1={x(i - 1)} y1={y(prev.sma)} x2={x(i)} y2={y(b.sma)} stroke="#f0b429" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
              <line x1={x(i - 1)} y1={y(prev.lower)} x2={x(i)} y2={y(b.lower)} stroke="#7aa2ff" strokeWidth="1" opacity="0.6" />
            </g>
          );
        })}

        {/* VWAP line */}
        {mr.vwapArr.map((v, i) => {
          if (i === 0 || v === 0) return null;
          const prev = mr.vwapArr[i - 1];
          if (prev === 0) return null;
          return <line key={"vwap" + i} x1={x(i - 1)} y1={y(prev)} x2={x(i)} y2={y(v)} stroke="#c084fc" strokeWidth="1.2" opacity="0.55" />;
        })}

        {/* candles */}
        {slice.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? "var(--bull)" : "var(--bear)";
          const wickX = x(i);
          const bodyTop = y(Math.max(b.open, b.close));
          const bodyBot = y(Math.min(b.open, b.close));
          return (
            <g key={i}>
              <line x1={wickX} x2={wickX} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" opacity="0.7" />
              <rect x={wickX - cw * 0.32} y={bodyTop} width={cw * 0.64} height={Math.max(1, bodyBot - bodyTop)} fill={color} opacity="0.6" />
            </g>
          );
        })}

        {/* signal markers */}
        {mr.signals.map((s, i) => {
          const idx = s.index;
          if (idx < 0 || idx >= slice.length) return null;
          const color = SIGNAL_COLOR[s.kind] ?? "var(--neutral)";
          const icon = SIGNAL_ICON[s.kind] ?? "•";
          return (
            <g key={"sig" + i}>
              <circle cx={x(idx)} cy={y(s.price)} r="5" fill="none" stroke={color} strokeWidth="1.5" />
              <text x={x(idx) + 8} y={y(s.price) - 6} fill={color} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="bold">
                {icon}
              </text>
            </g>
          );
        })}

        {/* last price */}
        <line x1={PAD_L} x2={W - PAD_R} y1={lastY} y2={lastY} stroke="var(--text-muted)" strokeDasharray="1 3" strokeWidth="0.7" />
        <rect x={W - PAD_R} y={lastY - 9} width={PAD_R} height={18} fill="var(--neutral)" />
        <text x={W - PAD_R + 4} y={lastY + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">{fmt(last.close)}</text>

        {/* legend */}
        <text x={PAD_L + 4} y={HEIGHT - 6} fill="#7aa2ff" fontSize="10" fontFamily="ui-monospace, monospace">BB</text>
        <text x={PAD_L + 24} y={HEIGHT - 6} fill="#f0b429" fontSize="10" fontFamily="ui-monospace, monospace">SMA20</text>
        <text x={PAD_L + 64} y={HEIGHT - 6} fill="#c084fc" fontSize="10" fontFamily="ui-monospace, monospace">VWAP</text>
      </svg>

      <div className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm leading-relaxed text-[var(--text)]" style={{ background: "var(--bg-panel-2)" }}>
        {mr.advisor}
      </div>

      {mr.signals.length > 0 && (
        <details className="mt-3 text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer hover:text-[var(--text)]">Recent signals ({mr.signals.length})</summary>
          <ul className="mt-2 space-y-1">
            {mr.signals.slice().reverse().map((s, i) => (
              <li key={i} className="font-mono" style={{ color: s.bias === "long" ? "var(--bull)" : "var(--bear)" }}>
                [{s.kind}] {s.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Header({ symbol, tf, setTf, count, setCount }: { symbol: string; tf: Timeframe; setTf: (t: Timeframe) => void; count: number; setCount: (n: number) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Mean Reversion — {symbol}
      </h2>
      <div className="flex items-center gap-2">
        <select value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs">
          {Object.entries(TIMEFRAME_LABELS).map(([t, l]) => (
            <option key={t} value={t}>{l}</option>
          ))}
        </select>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs">
          <option value={120}>120 bars</option>
          <option value={180}>180 bars</option>
          <option value={300}>300 bars</option>
          <option value={500}>500 bars</option>
        </select>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="rounded-md border border-[var(--border)] px-2 py-1" style={{ background: "var(--bg-panel-2)" }}>
      <span className="text-[var(--text-muted)]">{label} </span>
      <span className="font-mono font-bold" style={{ color }}>{value}</span>
    </span>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}