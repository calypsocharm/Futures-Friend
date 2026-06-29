"use client";

import { useMemo, useState } from "react";
import type { Timeframe } from "@/lib/types";
import { SCALP_TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";
import { ema } from "@/lib/indicators";
import { useAnalysis } from "@/store/analysis";
import type { ScalpReport, ScalpSignal } from "@/lib/scalp";

const W = 900;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 10;
const PAD_B = 18;

export function ScalpChart({ report }: { report: ScalpReport | null }) {
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const [tf, setTf] = useState<Timeframe>("1m");
  const [count, setCount] = useState(120);

  const bars = useMemo(() => barsByTimeframe[tf] ?? [], [barsByTimeframe, tf]);
  const slice = useMemo(() => bars.slice(-count), [bars, count]);
  const ema9Arr = useMemo(() => (slice.length ? ema(slice.map((b) => b.close), 9) : []), [slice]);
  const ema21Arr = useMemo(() => (slice.length ? ema(slice.map((b) => b.close), 21) : []), [slice]);

  const tfSignals: ScalpSignal[] = useMemo(() => {
    if (!report) return [];
    return report.signals.filter((s) => s.tf === tf);
  }, [report, tf]);

  if (slice.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Scalp chart</h2>
          <TFSelect tf={tf} setTf={setTf} />
        </div>
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
          No {TIMEFRAME_LABELS[tf]} bars yet — waiting for data.
        </div>
      </div>
    );
  }

  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const pad = (max - min) * 0.06 || 1;
  const top = max + pad;
  const bot = min - pad;
  const chartH = 360 - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;
  const cw = plotW / slice.length;
  const x = (i: number) => PAD_L + i * cw + cw / 2;
  const y = (p: number) => PAD_T + ((top - p) / (top - bot)) * chartH;

  const lineFor = (vals: number[]) => {
    if (vals.length !== slice.length) return null;
    let d = "";
    for (let i = 0; i < vals.length; i++) {
      if (Number.isNaN(vals[i])) continue;
      d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(vals[i]).toFixed(1);
    }
    return d;
  };

  const ema9Path = lineFor(ema9Arr);
  const ema21Path = lineFor(ema21Arr);
  const last = slice[slice.length - 1];
  const lastY = y(last.close);

  const SIGNAL_COLOR: Record<string, string> = {
    "ema-cross-up": "var(--bull)",
    "ema-cross-down": "var(--bear)",
    "momentum-burst-up": "var(--bull)",
    "momentum-burst-down": "var(--bear)",
    "atr-fade-long": "#5ad1c4",
    "atr-fade-short": "#f0b429",
  };
  const SIGNAL_ICON: Record<string, string> = {
    "ema-cross-up": "▲+",
    "ema-cross-down": "▼-",
    "momentum-burst-up": "▲▲",
    "momentum-burst-down": "▼▼",
    "atr-fade-long": "↩",
    "atr-fade-short": "↪",
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Scalp chart</h2>
        <div className="flex items-center gap-2">
          <TFSelect tf={tf} setTf={setTf} />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
          >
            <option value={60}>60 bars</option>
            <option value={120}>120 bars</option>
            <option value={240}>240 bars</option>
          </select>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 360`} className="w-full" style={{ height: 360 }}>
        {/* grid */}
        {Array.from({ length: 5 }).map((_, i) => {
          const v = bot + ((top - bot) * i) / 4;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={W - PAD_R + 6} y={y(v) + 3} fill="var(--text-muted)" fontSize="10" fontFamily="ui-monospace, monospace">
                {fmt(v)}
              </text>
            </g>
          );
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
              <line x1={wickX} x2={wickX} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" />
              <rect x={wickX - cw * 0.32} y={bodyTop} width={cw * 0.64} height={Math.max(1, bodyBot - bodyTop)} fill={color} opacity="0.92" />
            </g>
          );
        })}

        {/* EMA lines */}
        {ema9Path && <path d={ema9Path} fill="none" stroke="#f0b429" strokeWidth="1.4" opacity="0.95" />}
        {ema21Path && <path d={ema21Path} fill="none" stroke="#7aa2ff" strokeWidth="1.4" opacity="0.95" />}

        {/* signal markers */}
        {tfSignals.map((s, i) => {
          const idx = slice.length - 1;
          if (idx < 0) return null;
          const color = SIGNAL_COLOR[s.kind] ?? "var(--neutral)";
          const icon = SIGNAL_ICON[s.kind] ?? "•";
          return (
            <g key={"sig" + i}>
              <circle cx={x(idx)} cy={y(s.atPrice)} r="5" fill="none" stroke={color} strokeWidth="1.5" />
              <text x={x(idx) + 8} y={y(s.atPrice) - 8} fill={color} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">
                {icon}
              </text>
            </g>
          );
        })}

        {/* last price tag */}
        <line x1={PAD_L} x2={W - PAD_R} y1={lastY} y2={lastY} stroke="var(--text-muted)" strokeDasharray="1 3" strokeWidth="0.7" />
        <rect x={W - PAD_R} y={lastY - 9} width={PAD_R} height={18} fill="var(--neutral)" />
        <text x={W - PAD_R + 4} y={lastY + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">
          {fmt(last.close)}
        </text>

        {/* legend */}
        <text x={PAD_L + 4} y={354} fill="#f0b429" fontSize="10" fontFamily="ui-monospace, monospace">EMA9</text>
        <text x={PAD_L + 48} y={354} fill="#7aa2ff" fontSize="10" fontFamily="ui-monospace, monospace">EMA21</text>
      </svg>
    </div>
  );
}

function TFSelect({ tf, setTf }: { tf: Timeframe; setTf: (tf: Timeframe) => void }) {
  return (
    <select
      value={tf}
      onChange={(e) => setTf(e.target.value as Timeframe)}
      className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
    >
      {SCALP_TIMEFRAMES.map((t) => (
        <option key={t} value={t}>
          {TIMEFRAME_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}