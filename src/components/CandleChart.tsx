"use client";

import { useMemo, useRef, useState } from "react";
import type { Bar } from "@/lib/types";
import type { Divergence } from "@/lib/indicators";

interface Props {
  bars: Bar[];
  ema20?: number[];
  ema50?: number[];
  ema200?: number[];
  swingHigh?: number | null;
  swingLow?: number | null;
  divergences?: Divergence[];
  barOffset?: number;
  height?: number;
}

const W = 900;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 10;
const PAD_B = 18;
const VOL_H = 40;

export function CandleChart({ bars, ema20, ema50, ema200, swingHigh, swingLow, divergences, barOffset = 0, height = 360 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const view = useMemo(() => {
    const recent = bars.slice(-120);
    if (recent.length === 0) return null;
    const highs = recent.map((b) => b.high);
    const lows = recent.map((b) => b.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const pad = (max - min) * 0.06 || 1;
    const top = max + pad;
    const bot = min - pad;
    const volMax = Math.max(...recent.map((b) => b.volume ?? 0), 1);

    const chartH = height - PAD_T - PAD_B - VOL_H - 6;
    const plotW = W - PAD_L - PAD_R;
    const cw = plotW / recent.length;
    const x = (i: number) => PAD_L + i * cw + cw / 2;
    const y = (p: number) => PAD_T + ((top - p) / (top - bot)) * chartH;
    const vy = (v: number) => PAD_T + chartH + 6 + ((volMax - v) / volMax) * VOL_H;

    const lineFor = (vals: number[] | undefined) => {
      if (!vals) return null;
      const slice = vals.slice(-recent.length);
      if (slice.length !== recent.length) return null;
      let d = "";
      for (let i = 0; i < slice.length; i++) {
        if (Number.isNaN(slice[i])) continue;
        d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(slice[i]).toFixed(1);
      }
      return d || null;
    };

    return {
      recent,
      top,
      bot,
      volMax,
      chartH,
      plotW,
      cw,
      x,
      y,
      vy,
      ema20Path: lineFor(ema20),
      ema50Path: lineFor(ema50),
      ema200Path: lineFor(ema200),
    };
  }, [bars, ema20, ema50, ema200, height]);

  if (!view) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
        No bars to chart
      </div>
    );
  }

  const { recent, top, bot, x, y, vy, ema20Path, ema50Path, ema200Path } = view;
  const cw = view.cw;
  const last = recent[recent.length - 1];
  const lastY = y(last.close);
  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => bot + ((top - bot) * i) / gridLines);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - PAD_L) / cw);
    if (i >= 0 && i < recent.length) setHover(i);
    else setHover(null);
  }

  const hb = hover != null ? recent[hover] : null;
  const hbE20 = hover != null && ema20 ? ema20.slice(-recent.length)[hover] : null;
  const hbE50 = hover != null && ema50 ? ema50.slice(-recent.length)[hover] : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid + price axis */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={W - PAD_R + 6}
              y={y(v) + 3}
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* swing markers */}
        {swingHigh != null && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(swingHigh)}
            y2={y(swingHigh)}
            stroke="var(--bear)"
            strokeOpacity="0.35"
            strokeDasharray="6 3"
          />
        )}
        {swingLow != null && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(swingLow)}
            y2={y(swingLow)}
            stroke="var(--bull)"
            strokeOpacity="0.35"
            strokeDasharray="6 3"
          />
        )}

        {/* volume bars */}
        {recent.map((b, i) => {
          const v = b.volume ?? 0;
          if (v <= 0) return null;
          const up = b.close >= b.open;
          return (
            <rect
              key={"v" + i}
              x={x(i) - cw * 0.35}
              y={vy(v)}
              width={cw * 0.7}
              height={PAD_T + (height - PAD_T - PAD_B) - vy(v)}
              fill={up ? "var(--bull)" : "var(--bear)"}
              opacity="0.22"
            />
          );
        })}

        {/* candles */}
        {recent.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? "var(--bull)" : "var(--bear)";
          const wickX = x(i);
          const bodyTop = y(Math.max(b.open, b.close));
          const bodyBot = y(Math.min(b.open, b.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              <line x1={wickX} x2={wickX} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" />
              <rect
                x={wickX - cw * 0.32}
                y={bodyTop}
                width={cw * 0.64}
                height={bodyH}
                fill={color}
                opacity={hover === i ? 1 : 0.92}
              />
            </g>
          );
        })}

        {/* EMA lines */}
        {ema20Path && <path d={ema20Path} fill="none" stroke="#f0b429" strokeWidth="1.4" opacity="0.9" />}
        {ema50Path && <path d={ema50Path} fill="none" stroke="#7aa2ff" strokeWidth="1.4" opacity="0.9" />}
        {ema200Path && <path d={ema200Path} fill="none" stroke="#c084fc" strokeWidth="1.4" opacity="0.9" />}

        {/* Divergence lines */}
        {divergences && divergences.length > 0 && (() => {
          const DIV_COLOR: Record<string, string> = {
            "regular-bear": "var(--bear)",
            "regular-bull": "var(--bull)",
            "hidden-bear": "#ff9a4a",
            "hidden-bull": "#5ad1c4",
          };
          return divergences.map((d, i) => {
            const aIdx = d.idxA - barOffset;
            const bIdx = d.idxB - barOffset;
            if (aIdx < 0 || bIdx < 0 || aIdx >= recent.length || bIdx >= recent.length) return null;
            const color = DIV_COLOR[d.kind] ?? "var(--neutral)";
            const yA = y(d.priceA);
            const yB = y(d.priceB);
            const isBear = d.kind.includes("bear");
            return (
              <g key={"div" + i}>
                <line x1={x(aIdx)} y1={yA} x2={x(bIdx)} y2={yB} stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />
                <circle cx={x(aIdx)} cy={yA} r="3" fill={color} />
                <circle cx={x(bIdx)} cy={yB} r="3" fill={color} />
                <text x={x(bIdx) + 4} y={yB - 6} fill={color} fontSize="9" fontFamily="ui-monospace, monospace">
                  {isBear ? "▼" : "▲"} {d.kind.split("-")[1]} div
                </text>
              </g>
            );
          });
        })()}

        {/* last price line */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={lastY}
          y2={lastY}
          stroke="var(--text-muted)"
          strokeDasharray="1 3"
          strokeWidth="0.7"
        />
        <rect x={W - PAD_R} y={lastY - 9} width={PAD_R} height={18} fill="var(--neutral)" />
        <text
          x={W - PAD_R + 4}
          y={lastY + 4}
          fill="var(--bg)"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
          fontWeight="bold"
        >
          {fmt(last.close)}
        </text>

        {/* hover crosshair + readout */}
        {hb && hover != null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T}
              y2={height - PAD_B}
              stroke="var(--text)"
              strokeOpacity="0.25"
            />
            <rect
              x={PAD_L + 4}
              y={PAD_T + 4}
              width={210}
              height={hbE20 ? 64 : 48}
              fill="var(--bg-panel-2)"
              stroke="var(--border)"
              rx="3"
            />
            <text x={PAD_L + 10} y={PAD_T + 18} fill="var(--text)" fontSize="10" fontFamily="ui-monospace, monospace">
              {new Date(hb.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </text>
            <text x={PAD_L + 10} y={PAD_T + 32} fill="var(--text)" fontSize="10" fontFamily="ui-monospace, monospace">
              O {fmt(hb.open)}  H {fmt(hb.high)}  L {fmt(hb.low)}  C {fmt(hb.close)}
            </text>
            <text x={PAD_L + 10} y={PAD_T + 44} fill="var(--text-muted)" fontSize="10" fontFamily="ui-monospace, monospace">
              Vol {(hb.volume ?? 0).toLocaleString()}
            </text>
            {hbE20 != null && (
              <text x={PAD_L + 10} y={PAD_T + 58} fill="var(--text-muted)" fontSize="10" fontFamily="ui-monospace, monospace">
                EMA20 {fmt(hbE20)}  EMA50 {hbE50 ? fmt(hbE50) : "—"}
              </text>
            )}
          </g>
        )}

        {/* legend */}
        <g transform={`translate(${PAD_L + 4}, ${height - 4})`}>
          <text fill="#f0b429" fontSize="10" fontFamily="ui-monospace, monospace">EMA20</text>
          <text x="48" fill="#7aa2ff" fontSize="10" fontFamily="ui-monospace, monospace">EMA50</text>
          <text x="96" fill="#c084fc" fontSize="10" fontFamily="ui-monospace, monospace">EMA200</text>
        </g>
      </svg>
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}