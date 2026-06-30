"use client";

import { useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { analyzeORB } from "@/lib/orb";

const W = 900;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 10;
const PAD_B = 24;
const HEIGHT = 400;

export function ORBPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const [count, setCount] = useState(180);

  const bars = useMemo(() => barsByTimeframe["1m"] ?? barsByTimeframe["5m"] ?? [], [barsByTimeframe]);
  const slice = useMemo(() => bars.slice(-count), [bars, count]);
  const orb = useMemo(() => analyzeORB(slice), [slice]);

  if (slice.length < 30) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">ORB — {symbol}</h2>
        </div>
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
          Need intraday bars (1m or 5m) for ORB analysis. Switch to a fast TF.
        </div>
      </div>
    );
  }

  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);
  const allVals = [...highs, ...lows];
  if (orb.orHigh != null) allVals.push(orb.orHigh);
  if (orb.orLow != null) allVals.push(orb.orLow);
  if (orb.prevClose != null) allVals.push(orb.prevClose);
  for (const t of orb.targets) allVals.push(t);
  if (orb.riskLine != null) allVals.push(orb.riskLine);
  if (orb.ema200 != null) allVals.push(orb.ema200);

  const max = Math.max(...allVals);
  const min = Math.min(...allVals);
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

  const modeColor = orb.longMode ? "var(--bull)" : orb.shortMode ? "var(--bear)" : "var(--neutral)";
  const modeText = orb.longMode ? "▲ LONG BREAKOUT" : orb.shortMode ? "▼ SHORT BREAKDOWN" : "■ NO BREAKOUT";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {symbol} — Opening Range Breakout (0930-1000 ET)
          </div>
          <div className="text-2xl font-bold" style={{ color: modeColor }}>
            {modeText}
            {orb.orHigh != null && orb.orLow != null && (
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                ORH {fmt(orb.orHigh)} · ORL {fmt(orb.orLow)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orb.orHigh != null && orb.orLow != null && (
            <div className="flex gap-2 text-xs">
              <Stat label="Vol" value={`${orb.currentRelVolume.toFixed(2)}x`} color={orb.currentVolumeSpike ? (orb.currentBullSpike ? "var(--bull)" : "var(--bear)") : "var(--text)"} />
              {orb.atrOR != null && <Stat label="ATR" value={fmt(orb.atrOR)} color="var(--text)" />}
            </div>
          )}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs">
            <option value={120}>120 bars</option>
            <option value={180}>180 bars</option>
            <option value={300}>300 bars</option>
          </select>
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

        {/* OR high/low/mean horizontal lines */}
        {orb.orHigh != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.orHigh)} y2={y(orb.orHigh)} stroke="var(--bull)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" />
            <rect x={W - PAD_R} y={y(orb.orHigh) - 8} width={PAD_R} height={16} fill="var(--bull)" />
            <text x={W - PAD_R + 4} y={y(orb.orHigh) + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">ORH</text>
          </g>
        )}
        {orb.orLow != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.orLow)} y2={y(orb.orLow)} stroke="var(--bear)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" />
            <rect x={W - PAD_R} y={y(orb.orLow) - 8} width={PAD_R} height={16} fill="var(--bear)" />
            <text x={W - PAD_R + 4} y={y(orb.orLow) + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">ORL</text>
          </g>
        )}
        {orb.orMean != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.orMean)} y2={y(orb.orMean)} stroke="#f0b429" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
            <text x={W - PAD_R + 4} y={y(orb.orMean) + 3} fill="#f0b429" fontSize="9" fontFamily="ui-monospace, monospace">MEAN</text>
          </g>
        )}

        {/* candles */}
        {slice.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? "var(--bull)" : "var(--bear)";
          const wickX = x(i);
          const bodyTop = y(Math.max(b.open, b.close));
          const bodyBot = y(Math.min(b.open, b.close));
          return (
            <g key={i}>
              <line x1={wickX} x2={wickX} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" opacity="0.6" />
              <rect x={wickX - cw * 0.32} y={bodyTop} width={cw * 0.64} height={Math.max(1, bodyBot - bodyTop)} fill={color} opacity="0.55" />
            </g>
          );
        })}

        {/* volume spike dots */}
        {orb.volumeSpikes.map((v, i) => {
          if (v.index < 0 || v.index >= slice.length) return null;
          const bar = slice[v.index];
          const yPos = v.bull ? y(bar.low) + 10 : y(bar.high) - 10;
          const color = v.bull ? "var(--bull)" : v.bear ? "var(--bear)" : "var(--text-muted)";
          return (
            <g key={"vs" + i}>
              <circle cx={x(v.index)} cy={yPos} r="3" fill={color} opacity="0.85" />
              <text x={x(v.index) + 5} y={yPos + 3} fill={color} fontSize="8" fontFamily="ui-monospace, monospace">
                {v.relVolume.toFixed(1)}x
              </text>
            </g>
          );
        })}

        {/* breakout/breakdown markers */}
        {orb.breakoutIndex != null && orb.breakoutIndex < slice.length && (
          <g>
            <circle cx={x(orb.breakoutIndex)} cy={y(slice[orb.breakoutIndex].close)} r="6" fill="none" stroke="var(--bull)" strokeWidth="2" />
            <text x={x(orb.breakoutIndex) + 10} y={y(slice[orb.breakoutIndex].close) - 8} fill="var(--bull)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">▲ BO</text>
          </g>
        )}
        {orb.breakdownIndex != null && orb.breakdownIndex < slice.length && (
          <g>
            <circle cx={x(orb.breakdownIndex)} cy={y(slice[orb.breakdownIndex].close)} r="6" fill="none" stroke="var(--bear)" strokeWidth="2" />
            <text x={x(orb.breakdownIndex) + 10} y={y(slice[orb.breakdownIndex].close) + 14} fill="var(--bear)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">▼ BD</text>
          </g>
        )}

        {/* targets */}
        {orb.targets.map((t, i) => {
          const color = i === 0 ? "#ffffff" : "#c084fc";
          return (
            <g key={"tgt" + i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke={color} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.6" />
              <circle cx={W - PAD_R} cy={y(t)} r="3" fill={color} />
              <text x={W - PAD_R + 6} y={y(t) + 3} fill={color} fontSize="9" fontFamily="ui-monospace, monospace">T{i + 1}</text>
            </g>
          );
        })}

        {/* risk line */}
        {orb.riskLine != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.riskLine)} y2={y(orb.riskLine)} stroke="var(--bear)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
            <text x={PAD_L + 4} y={y(orb.riskLine) - 4} fill="var(--bear)" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="bold">RISK</text>
          </g>
        )}

        {/* prev close */}
        {orb.prevClose != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.prevClose)} y2={y(orb.prevClose)} stroke="#888" strokeWidth="0.8" strokeDasharray="1 2" opacity="0.5" />
            <text x={PAD_L + 4} y={y(orb.prevClose) - 4} fill="#888" fontSize="9" fontFamily="ui-monospace, monospace">PC {fmt(orb.prevClose)}</text>
          </g>
        )}

        {/* EMA200 */}
        {orb.ema200 != null && (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(orb.ema200)} y2={y(orb.ema200)} stroke="#7aa2ff" strokeWidth="1.2" opacity="0.5" />
            <text x={PAD_L + 4} y={y(orb.ema200) - 4} fill="#7aa2ff" fontSize="9" fontFamily="ui-monospace, monospace">EMA200</text>
          </g>
        )}

        {/* last price */}
        <line x1={PAD_L} x2={W - PAD_R} y1={lastY} y2={lastY} stroke="var(--text-muted)" strokeDasharray="1 3" strokeWidth="0.7" />
        <rect x={W - PAD_R} y={lastY - 9} width={PAD_R} height={18} fill="var(--neutral)" />
        <text x={W - PAD_R + 4} y={lastY + 4} fill="var(--bg)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">{fmt(last.close)}</text>

        <text x={PAD_L + 4} y={HEIGHT - 6} fill="var(--bull)" fontSize="10" fontFamily="ui-monospace, monospace">ORH</text>
        <text x={PAD_L + 30} y={HEIGHT - 6} fill="var(--bear)" fontSize="10" fontFamily="ui-monospace, monospace">ORL</text>
        <text x={PAD_L + 60} y={HEIGHT - 6} fill="#f0b429" fontSize="10" fontFamily="ui-monospace, monospace">Mean</text>
        <text x={PAD_L + 100} y={HEIGHT - 6} fill="#c084fc" fontSize="10" fontFamily="ui-monospace, monospace">Targets</text>
      </svg>

      <div className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm leading-relaxed text-[var(--text)]" style={{ background: "var(--bg-panel-2)" }}>
        {orb.advisor}
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