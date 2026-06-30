"use client";

import { useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { useIndicatorSettings } from "@/store/settings";
import { buildAdaptiveSTReport } from "@/lib/adaptiveSt";
import type { Timeframe } from "@/lib/types";
import { TIMEFRAME_LABELS } from "@/lib/types";

const W = 900;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 10;
const PAD_B = 24;
const HEIGHT = 400;

export function AdaptiveSTPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [count, setCount] = useState(180);

  const bars = useMemo(() => barsByTimeframe[tf] ?? [], [barsByTimeframe, tf]);
  const slice = useMemo(() => bars.slice(-count), [bars, count]);
  const stInputs = useIndicatorSettings((s) => s.st);
  const stopHuntInputs = useIndicatorSettings((s) => s.stopHunt);
  const dcaInputs = useIndicatorSettings((s) => s.dca);
  const report = useMemo(() => buildAdaptiveSTReport(slice, stInputs, stopHuntInputs, dcaInputs), [slice, stInputs, stopHuntInputs, dcaInputs]);

  if (slice.length < 30) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <Header symbol={symbol} tf={tf} setTf={setTf} count={count} setCount={setCount} />
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
          Not enough bars for Adaptive SuperTrend yet (need 30+).
        </div>
      </div>
    );
  }

  const st = report.st;
  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
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
  const lastST = st[st.length - 1];

  const stColor = (p: typeof st[number]) => (p.isGreen ? "#00ffbb" : "#ff1100");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <Header symbol={symbol} tf={tf} setTf={setTf} count={count} setCount={setCount} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {symbol} — Adaptive SuperTrend ({TIMEFRAME_LABELS[tf]})
          </div>
          <div className="text-2xl font-bold" style={{ color: report.currentDirection === "bull" ? "#00ffbb" : report.currentDirection === "bear" ? "#ff1100" : "var(--neutral)" }}>
            {report.currentDirection === "bull" ? "▲ TREND UP" : report.currentDirection === "bear" ? "▼ TREND DOWN" : "■ FLAT"}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">ST @ {fmt(lastST.st)}</span>
          </div>
        </div>
        {report.trade.inTrade && report.trade.avgEntryPrice != null && (
          <div className="flex gap-2 text-xs">
            <span className="rounded-md border border-[var(--neutral)] px-2 py-1" style={{ background: "var(--bg-panel-2)" }}>
              <span className="text-[var(--text-muted)]">Fills </span>
              <span className="font-mono font-bold">{report.trade.entryCount}</span>
            </span>
            <span className="rounded-md border border-[var(--neutral)] px-2 py-1" style={{ background: "var(--bg-panel-2)" }}>
              <span className="text-[var(--text-muted)]">Avg </span>
              <span className="font-mono font-bold">{fmt(report.trade.avgEntryPrice)}</span>
            </span>
            {report.trade.slActive && report.trade.slPrice != null && (
              <span className="rounded-md border border-[var(--bear)] px-2 py-1" style={{ background: "var(--bg-panel-2)" }}>
                <span className="text-[var(--text-muted)]">SL </span>
                <span className="font-mono font-bold" style={{ color: "var(--bear)" }}>{fmt(report.trade.slPrice)}</span>
              </span>
            )}
          </div>
        )}
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

        {slice.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? "var(--bull)" : "var(--bear)";
          const wickX = x(i);
          const bodyTop = y(Math.max(b.open, b.close));
          const bodyBot = y(Math.min(b.open, b.close));
          return (
            <g key={i}>
              <line x1={wickX} x2={wickX} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" />
              <rect x={wickX - cw * 0.32} y={bodyTop} width={cw * 0.64} height={Math.max(1, bodyBot - bodyTop)} fill={color} opacity="0.6" />
            </g>
          );
        })}

        {st.map((p, i) => {
          if (i === 0 || p.st === 0) return null;
          const prev = st[i - 1];
          if (prev.st === 0) return null;
          const segColor = stColor(p);
          const segColorPrev = stColor(prev);
          const color = segColor === segColorPrev ? segColor : "var(--border)";
          return (
            <g key={"st" + i}>
              <line x1={x(i - 1)} y1={y(prev.st)} x2={x(i)} y2={y(p.st)} stroke={color} strokeWidth="2" opacity="0.85" />
              {p.firstGreenBar && (
                <text x={x(i)} y={y(p.st) - 8} fill="#00ffbb" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">▲</text>
              )}
            </g>
          );
        })}

        {report.diamonds.map((d, i) => {
          const idx = d.index;
          if (idx < 0 || idx >= slice.length) return null;
          const color = d.inRedArea ? "var(--bull)" : "#5ad1c4";
          return (
            <g key={"d" + i}>
              <polygon
                points={`${x(idx)},${y(d.low) + 12} ${x(idx) - 6},${y(d.low) + 4} ${x(idx) + 6},${y(d.low) + 4}`}
                fill={color}
                opacity={d.inRedArea ? 1 : 0.6}
              />
              <text x={x(idx) + 8} y={y(d.low) + 6} fill={color} fontSize="9" fontFamily="ui-monospace, monospace">
                {d.inRedArea ? "◆ RED" : "◆"}
              </text>
            </g>
          );
        })}

        {report.trade.entries.filter((e) => e.status !== "canceled").map((e, i) => {
          const idx = e.index;
          if (idx < 0 || idx >= slice.length) return null;
          const fillIdx = e.fillIndex ?? slice.length - 1;
          const isFilled = e.status === "filled";
          const color = isFilled ? "var(--bull)" : "var(--neutral)";
          return (
            <g key={"ent" + i}>
              <line x1={x(idx)} y1={y(e.price)} x2={x(Math.min(fillIdx, slice.length - 1))} y2={y(e.price)} stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.85" />
              <circle cx={x(idx)} cy={y(e.price)} r="3" fill="none" stroke={color} strokeWidth="1.5" />
              {isFilled && <circle cx={x(fillIdx)} cy={y(e.price)} r="4" fill={color} />}
              <text x={x(idx) + 6} y={y(e.price) - 4} fill={color} fontSize="9" fontFamily="ui-monospace, monospace">
                #{e.number} {fmt(e.price)} qty {e.qty}
              </text>
            </g>
          );
        })}

        {report.trade.slActive && report.trade.slPrice != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(report.trade.slPrice)} y2={y(report.trade.slPrice)} stroke="var(--bear)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.85" />
            <rect x={W - PAD_R} y={y(report.trade.slPrice) - 8} width={PAD_R} height={16} fill="var(--bear)" />
            <text x={W - PAD_R + 4} y={y(report.trade.slPrice) + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">SL</text>
          </g>
        )}

        {report.trade.inTrade && report.trade.avgEntryPrice != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(report.trade.avgEntryPrice)} y2={y(report.trade.avgEntryPrice)} stroke="var(--neutral)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            <rect x={W - PAD_R} y={y(report.trade.avgEntryPrice) - 8} width={PAD_R} height={16} fill="var(--neutral)" />
            <text x={W - PAD_R + 4} y={y(report.trade.avgEntryPrice) + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">AVG</text>
          </g>
        )}

        <line x1={PAD_L} x2={W - PAD_R} y1={lastY} y2={lastY} stroke="var(--text-muted)" strokeDasharray="1 3" strokeWidth="0.7" />
        <rect x={W - PAD_R} y={lastY - 9} width={PAD_R} height={18} fill="var(--neutral)" />
        <text x={W - PAD_R + 4} y={lastY + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">{fmt(last.close)}</text>

        <text x={PAD_L + 4} y={HEIGHT - 6} fill="#00ffbb" fontSize="10" fontFamily="ui-monospace, monospace">▲ Green ST</text>
        <text x={PAD_L + 80} y={HEIGHT - 6} fill="#ff1100" fontSize="10" fontFamily="ui-monospace, monospace">▼ Red ST</text>
        <text x={PAD_L + 160} y={HEIGHT - 6} fill="var(--bull)" fontSize="10" fontFamily="ui-monospace, monospace">◆ Stop-hunt</text>
        <text x={PAD_L + 250} y={HEIGHT - 6} fill="var(--neutral)" fontSize="10" fontFamily="ui-monospace, monospace">- - DCA/SL</text>
      </svg>

      <div className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm leading-relaxed text-[var(--text)]" style={{ background: "var(--bg-panel-2)" }}>
        {report.advisor}
      </div>

      <details className="mt-3 text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer hover:text-[var(--text)]">DCA entries ({report.trade.entries.length})</summary>
        {report.trade.entries.length === 0 ? (
          <div className="mt-2">No entries yet.</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {report.trade.entries.map((e, i) => (
              <li key={i} className="font-mono">
                #{e.number} @ {fmt(e.price)} qty {e.qty} disc {e.discountPct}% — {e.status}{e.fillIndex != null ? ` (filled @${fmt(e.fillPrice ?? e.price)})` : ""}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function Header({ symbol, tf, setTf, count, setCount }: { symbol: string; tf: Timeframe; setTf: (t: Timeframe) => void; count: number; setCount: (n: number) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Adaptive SuperTrend — {symbol}
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

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}