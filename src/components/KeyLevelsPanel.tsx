"use client";

import type { KeyLevel } from "@/lib/types";
import type { Timeframe } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  resistance: "var(--bear)",
  support: "var(--bull)",
};

export function KeyLevelsPanel({ levels, lastPrice }: { levels: KeyLevel[]; lastPrice: number }) {
  if (levels.length === 0) return null;
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Key levels (S/R)
      </h2>
      <div className="space-y-1.5">
        {sorted.map((l, i) => {
          const c = TYPE_COLOR[l.type];
          const above = l.price > lastPrice;
          const dist = lastPrice > 0 ? ((l.price - lastPrice) / lastPrice) * 100 : 0;
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
              style={{ borderColor: c, background: "var(--bg-panel-2)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: c }}>{l.type === "resistance" ? "R" : "S"}</span>
                <span className="font-mono font-semibold">{fmt(l.price)}</span>
                <span className="text-[var(--text-muted)]">
                  {above ? "+" : ""}
                  {dist.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                {l.timeframes.map((tf: Timeframe) => (
                  <span
                    key={tf}
                    className="rounded px-1 py-0.5 text-[10px]"
                    style={{ background: c, color: "var(--bg)" }}
                    title={`${l.type} from ${tf}`}
                  >
                    {tf}
                  </span>
                ))}
                <span className="ml-1 text-[var(--text-muted)]">×{l.strength}</span>
              </div>
            </div>
          );
        })}
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