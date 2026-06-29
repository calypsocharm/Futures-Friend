"use client";

import { useAnalysis } from "@/store/analysis";
import { useWatchlist } from "@/store/watchlist";
import { SYMBOLS, symbolDef } from "@/lib/symbols";
import type { Direction, Timeframe } from "@/lib/types";
import { TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";

const DIR_COLOR: Record<Direction, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const DIR_ICON: Record<Direction, string> = { bull: "▲", bear: "▼", neutral: "■" };

export function WatchlistPanel() {
  const watchlist = useWatchlist((s) => s.watchlist);
  const items = useWatchlist((s) => s.items);
  const toggle = useWatchlist((s) => s.toggle);
  const watchTF = useWatchlist((s) => s.watchTF);
  const setWatchTF = useWatchlist((s) => s.setWatchTF);
  const setSymbol = useAnalysis((s) => s.setSymbol);
  const current = useAnalysis((s) => s.symbol);

  const available = SYMBOLS.filter((s) => !watchlist.includes(s.symbol));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Watchlist ({watchlist.length})
        </h2>
        <select
          value={watchTF}
          onChange={(e) => setWatchTF(e.target.value as Timeframe)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px]"
          title="Timeframe used for watchlist bias"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {TIMEFRAME_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        {watchlist.length === 0 && (
          <div className="text-xs text-[var(--text-muted)]">No symbols pinned yet.</div>
        )}
        {watchlist.map((sym) => {
          const item = items[sym];
          const def = symbolDef(sym);
          const color = item ? DIR_COLOR[item.direction] : "var(--text-muted)";
          const isCurrent = sym === current;
          return (
            <div
              key={sym}
              className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs ${
                isCurrent ? "border-[var(--neutral)]" : "border-[var(--border)]"
              }`}
              style={{ background: "var(--bg-panel-2)" }}
            >
              <button
                onClick={() => setSymbol(sym)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="font-mono font-semibold" style={{ color }}>
                  {item ? DIR_ICON[item.direction] : "•"}
                </span>
                <span className="font-mono">{sym}</span>
                <span className="truncate text-[var(--text-muted)]">{def?.label.split("(")[0]}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[var(--text-muted)]">
                  {item ? fmt(item.lastPrice) : "—"}
                </span>
                {item && (
                  <span className="text-[10px] font-bold" style={{ color }}>
                    {item.confidence}%
                  </span>
                )}
                <button
                  onClick={() => toggle(sym)}
                  className="ml-1 text-[var(--text-muted)] hover:text-[var(--bear)]"
                  title="Remove from watchlist"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) toggle(e.target.value);
            }}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
          >
            <option value="">+ Add symbol…</option>
            {available.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}