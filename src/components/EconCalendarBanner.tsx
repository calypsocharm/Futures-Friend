"use client";

import { useMemo } from "react";
import { useAnalysis } from "@/store/analysis";
import { nextEconEvent, findEconEventsForBars } from "@/lib/econCalendar";
import { symbolDef } from "@/lib/symbols";

const IMPACT_COLOR: Record<string, string> = {
  high: "var(--bear)",
  medium: "var(--neutral)",
  low: "var(--text-muted)",
};

export function EconCalendarBanner() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const def = symbolDef(symbol);

  const next = useMemo(() => (def ? nextEconEvent(def.category) : null), [def]);
  const recent = useMemo(() => {
    if (!def) return [];
    const bars = barsByTimeframe["1D"] ?? [];
    if (bars.length === 0) return [];
    const events = findEconEventsForBars(bars.slice(-60), def.category);
    return events.filter((e) => e.barIndex >= bars.length - 61).slice(-5);
  }, [barsByTimeframe, def]);

  if (!def || !next) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3 text-xs">
      <div className="text-[var(--text-muted)]">Econ calendar</div>
      <div className="mt-1 flex items-center justify-between">
        <span style={{ color: IMPACT_COLOR[next.event.impact] }}>
          {next.event.name}
        </span>
        <span className="font-mono text-[var(--text-muted)]">
          {next.daysUntil === 0 ? "TODAY" : next.daysUntil === 1 ? "TOMORROW" : `${next.daysUntil}d`}
        </span>
      </div>
      <div className="text-[10px] text-[var(--text-muted)]">{next.event.time} · {next.event.impact} impact</div>
      {next.daysUntil <= 2 && next.event.impact === "high" && (
        <div className="mt-1 text-[10px] font-bold" style={{ color: "var(--bear)" }}>
          ⚠ HIGH IMPACT — expect volatility, widen stops or sit out
        </div>
      )}
      {recent.length > 0 && (
        <div className="mt-2 border-t border-[var(--border)] pt-1">
          <div className="text-[10px] text-[var(--text-muted)]">Recent events on chart:</div>
          <div className="mt-0.5 space-y-0.5">
            {recent.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span style={{ color: IMPACT_COLOR[e.event.impact] }}>{e.event.name}</span>
                <span className="font-mono text-[var(--text-muted)]">
                  {e.date.month + 1}/{e.date.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}