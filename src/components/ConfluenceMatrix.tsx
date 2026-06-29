"use client";

import type { MatrixRow } from "@/lib/types";

const DIR_COLOR: Record<string, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const DIR_ICON: Record<string, string> = { bull: "▲", bear: "▼", neutral: "■" };
const FLOW_ICON: Record<string, string> = { strong: "▓", weak: "▒", range: "░" };

export function ConfluenceMatrix({ rows }: { rows: MatrixRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Confluence matrix
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-muted)]">
              <th className="px-2 py-1 text-left">TF</th>
              <th className="px-2 py-1 text-left">Dir</th>
              <th className="px-2 py-1 text-left">Flow</th>
              <th className="px-2 py-1 text-left">Structure</th>
              <th className="px-2 py-1 text-right">Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = DIR_COLOR[r.direction];
              return (
                <tr key={r.timeframe} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1.5 font-semibold">{r.label}</td>
                  <td className="px-2 py-1.5" style={{ color: c }}>
                    {DIR_ICON[r.direction]} {r.direction.toUpperCase()}
                  </td>
                  <td className="px-2 py-1.5 font-mono" title={r.flow}>
                    {FLOW_ICON[r.flow]} {r.flow}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{r.structure}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.confluence}/5</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}