"use client";

import type { Gauge } from "@/lib/types";

const TREND_ICON: Record<string, string> = {
  expanding: "▲ vol+",
  contracting: "▼ vol-",
  flat: "■ vol=",
};

const FLOW_COLOR: Record<string, string> = {
  strong: "var(--neutral)",
  weak: "var(--text-muted)",
  range: "var(--text-muted)",
};

export function GaugesPanel({ gauges }: { gauges: Gauge[] }) {
  if (gauges.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Volatility &amp; flow
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-muted)]">
              <th className="px-2 py-1 text-left">TF</th>
              <th className="px-2 py-1 text-right">ATR%</th>
              <th className="px-2 py-1 text-left">Vol trend</th>
              <th className="px-2 py-1 text-left">Buyers / Sellers</th>
              <th className="px-2 py-1 text-left">Flow</th>
            </tr>
          </thead>
          <tbody>
            {gauges.map((g) => {
              const buyerColor = g.buyerPct > g.sellerPct ? "var(--bull)" : "var(--bear)";
              return (
                <tr key={g.timeframe} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1.5 font-semibold">{g.label}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{g.atrPct.toFixed(2)}%</td>
                  <td className="px-2 py-1.5 font-mono">{TREND_ICON[g.atrTrend]}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded bg-[var(--bg-panel-2)]">
                        <div className="flex h-full">
                          <div style={{ width: `${g.buyerPct}%`, background: "var(--bull)" }} />
                          <div style={{ width: `${g.sellerPct}%`, background: "var(--bear)" }} />
                        </div>
                      </div>
                      <span className="font-mono" style={{ color: buyerColor }}>
                        {g.buyerPct}/{g.sellerPct}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-mono" style={{ color: FLOW_COLOR[g.flow] }}>
                    {g.flow}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}