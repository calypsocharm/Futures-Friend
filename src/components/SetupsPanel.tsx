"use client";

import type { Setup } from "@/lib/types";

const BIAS_COLOR: Record<string, string> = {
  long: "var(--bull)",
  short: "var(--bear)",
};

export function SetupsPanel({ setups }: { setups: Setup[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Active setups ({setups.length})
      </h2>
      {setups.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">No actionable setups detected right now.</div>
      ) : (
        <ul className="space-y-2">
          {setups.map((s, i) => {
            const c = BIAS_COLOR[s.bias];
            return (
              <li
                key={i}
                className="rounded-md border px-3 py-2"
                style={{ borderColor: c, background: "var(--bg-panel-2)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.kind}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: c, color: "var(--bg)" }}
                  >
                    {s.bias.toUpperCase()} · {s.timeframe}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{s.detail}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}