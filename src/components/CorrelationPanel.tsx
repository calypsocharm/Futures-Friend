"use client";

import { useEffect, useMemo, useState } from "react";
import { useWatchlist } from "@/store/watchlist";
import { buildCorrelationMatrix, correlationColor } from "@/lib/correlation";
import type { Bar, Timeframe } from "@/lib/types";
import { TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";

async function fetchBarsForCorrelation(symbol: string, tf: Timeframe): Promise<Bar[]> {
  try {
    const res = await fetch(`/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.bars ?? []) as Bar[];
  } catch {
    return [];
  }
}

export function CorrelationPanel() {
  const watchlist = useWatchlist((s) => s.watchlist);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [bars, setBars] = useState<Record<string, Bar[]>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (watchlist.length < 2) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setLoaded(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all(watchlist.map(async (sym) => {
      const b = await fetchBarsForCorrelation(sym, tf);
      return [sym, b] as const;
    })).then((results) => {
      if (cancelled) return;
      const map: Record<string, Bar[]> = {};
      for (const [sym, b] of results) map[sym] = b;
      setBars(map);
      setLoading(false);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [watchlist, tf]);

  const corr = useMemo(() => buildCorrelationMatrix(watchlist, bars), [watchlist, bars]);

  if (watchlist.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Correlation matrix</h2>
        <div className="text-xs text-[var(--text-muted)]">Add at least 2 symbols to the watchlist to see correlations.</div>
      </div>
    );
  }

  const syms = corr.symbols;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Correlation matrix ({syms.length} symbols)
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">TF:</span>
          <select value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs">
            {TIMEFRAMES.map((t) => (
              <option key={t} value={t}>{TIMEFRAME_LABELS[t]}</option>
            ))}
          </select>
          {loading && <span className="text-[10px] text-[var(--neutral)]">fetching…</span>}
        </div>
      </div>

      {loaded && syms.length >= 2 ? (
        <>
          {/* Matrix grid */}
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-1 py-1"></th>
                  {syms.map((s) => (
                    <th key={s} className="px-1 py-1 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {s.length > 8 ? s.slice(0, 6) : s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syms.map((rowSym, i) => (
                  <tr key={rowSym}>
                    <td className="px-1 py-1 font-mono text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                      {rowSym.length > 8 ? rowSym.slice(0, 6) : rowSym}
                    </td>
                    {syms.map((colSym, j) => {
                      const val = corr.matrix[i]?.[j] ?? 0;
                      const isSelf = i === j;
                      const color = isSelf ? "var(--border)" : correlationColor(val);
                      return (
                        <td key={colSym} className="px-1 py-1">
                          <div
                            className="flex h-9 min-w-[40px] items-center justify-center rounded font-mono text-[10px] font-bold"
                            style={{
                              background: isSelf ? "var(--bg-panel-2)" : `${color}`,
                              color: isSelf ? "var(--text-muted)" : Math.abs(val) >= 0.5 ? "var(--bg)" : "var(--text)",
                              opacity: isSelf ? 0.5 : Math.min(1, Math.abs(val) + 0.3),
                            }}
                            title={`${rowSym} vs ${colSym}: ${val.toFixed(2)}`}
                          >
                            {isSelf ? "—" : val.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top inverse + top correlated pairs */}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Most inverse (hedges)</div>
              <ul className="mt-1 space-y-1">
                {corr.pairs.filter((p) => p.correlation < 0).slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-[var(--border)] px-2 py-1 text-xs" style={{ background: "var(--bg-panel-2)" }}>
                    <span className="font-mono">{p.a} / {p.b}</span>
                    <span className="font-mono font-bold" style={{ color: "var(--bear)" }}>{p.correlation.toFixed(2)}</span>
                  </li>
                ))}
                {corr.pairs.filter((p) => p.correlation < 0).length === 0 && (
                  <li className="text-xs text-[var(--text-muted)]">No inverse pairs.</li>
                )}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Most correlated (avoid over-diversification)</div>
              <ul className="mt-1 space-y-1">
                {corr.pairs.filter((p) => p.correlation > 0).slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-[var(--border)] px-2 py-1 text-xs" style={{ background: "var(--bg-panel-2)" }}>
                    <span className="font-mono">{p.a} / {p.b}</span>
                    <span className="font-mono font-bold" style={{ color: "var(--bull)" }}>{p.correlation.toFixed(2)}</span>
                  </li>
                ))}
                {corr.pairs.filter((p) => p.correlation > 0).length === 0 && (
                  <li className="text-xs text-[var(--text-muted)]">No positive correlations.</li>
                )}
              </ul>
            </div>
          </div>

          <p className="mt-3 text-[10px] text-[var(--text-muted)]">
            Uses daily bar returns over the available history. Correlation &ne; causation. Pairs above +0.7 move together (don&apos;t double-count risk). Pairs below -0.7 are good hedges. Near-zero = independent.
          </p>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
          {loading ? "Fetching correlation data…" : "Not enough data yet."}
        </div>
      )}
    </div>
  );
}