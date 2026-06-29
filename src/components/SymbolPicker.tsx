"use client";

import { useAnalysis } from "@/store/analysis";
import { SYMBOLS } from "@/lib/symbols";

export function SymbolPicker() {
  const symbol = useAnalysis((s) => s.symbol);
  const setSymbol = useAnalysis((s) => s.setSymbol);
  const loadSample = useAnalysis((s) => s.loadSample);

  const byCategory = SYMBOLS.reduce<Record<string, typeof SYMBOLS>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--neutral)]"
        >
          {Object.entries(byCategory).map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => loadSample(symbol)}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          title="Re-seed sample data for all timeframes"
        >
          Reload sample data
        </button>
      </div>
    </div>
  );
}