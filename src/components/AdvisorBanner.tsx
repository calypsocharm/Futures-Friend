"use client";

import { useAnalysis } from "@/store/analysis";
import type { Direction } from "@/lib/types";

const COLORS: Record<Direction, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const LABELS: Record<Direction, string> = {
  bull: "BULLISH",
  bear: "BEARISH",
  neutral: "NEUTRAL",
};

export function AdvisorBanner() {
  const report = useAnalysis((s) => s.report);
  if (!report) return null;

  const color = COLORS[report.dominant];
  const counts = {
    bull: report.bullishCount,
    bear: report.bearishCount,
    neutral: report.neutralCount,
  };

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: color, background: "var(--bg-panel)" }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {report.symbol} — Bias
          </div>
          <div className="text-3xl font-bold" style={{ color }}>
            {LABELS[report.dominant]} · {report.confidence}%
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          <CountChip label="Bull" value={counts.bull} color="var(--bull)" />
          <CountChip label="Neutral" value={counts.neutral} color="var(--neutral)" />
          <CountChip label="Bear" value={counts.bear} color="var(--bear)" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text)]">{report.advisor}</p>
    </div>
  );
}

function CountChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-md px-3 py-1.5"
      style={{ background: "var(--bg-panel-2)", border: `1px solid ${color}` }}
    >
      <span className="text-[var(--text-muted)]">{label} </span>
      <span className="font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}