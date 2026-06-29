"use client";

import type { TimeframeAnalysis } from "@/lib/types";

const DIR_COLOR: Record<string, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const DIR_ICON: Record<string, string> = {
  bull: "▲",
  bear: "▼",
  neutral: "■",
};

const FLOW_LABEL: Record<string, string> = {
  strong: "Strong flow",
  weak: "Weak flow",
  range: "Range / chop",
};

export function TimeframeCard({ a }: { a: TimeframeAnalysis }) {
  const color = DIR_COLOR[a.direction];
  return (
    <div
      className="rounded-lg border bg-[var(--bg-panel)] p-3"
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color }}>
          {DIR_ICON[a.direction]} {a.label}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {FLOW_LABEL[a.flow]}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Stat label="Last" value={fmt(a.lastPrice)} />
        <Stat label="ATR(14)" value={fmt(a.atr)} />
        <Stat label="EMA20" value={fmt(a.ema20)} />
        <Stat label="EMA50" value={fmt(a.ema50)} />
        <Stat label="EMA200" value={a.ema200 == null ? "—" : fmt(a.ema200)} />
        <Stat label="RSI(14)" value={a.rsi.toFixed(1)} />
        <Stat label="Swing High" value={a.swingHigh == null ? "—" : fmt(a.swingHigh)} />
        <Stat label="Swing Low" value={a.swingLow == null ? "—" : fmt(a.swingLow)} />
        <Stat label="Structure" value={a.structure} />
        <Stat label="Confluence" value={`${a.confluence}/5`} />
      </div>

      {a.notes.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-muted)]">
          {a.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-[var(--text)]">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  if (n === 0) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}