"use client";

import { useEffect, useRef } from "react";
import { useWatchlist } from "@/store/watchlist";

export function AlertsPanel() {
  const alerts = useWatchlist((s) => s.alerts);
  const markSeen = useWatchlist((s) => s.markAlertsSeen);
  const clear = useWatchlist((s) => s.clearAlerts);
  const unseen = alerts.filter((a) => !a.seen).length;
  const seenRef = useRef(false);

  useEffect(() => {
    if (unseen > 0 && !seenRef.current) {
      seenRef.current = true;
      const t = window.setTimeout(() => {
        markSeen();
        seenRef.current = false;
      }, 3000);
      return () => window.clearTimeout(t);
    }
  }, [unseen, markSeen]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Alerts {unseen > 0 && (
            <span className="ml-1 rounded bg-[var(--bear)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--bg)]">
              {unseen} new
            </span>
          )}
        </h2>
        {alerts.length > 0 && (
          <button
            onClick={clear}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">No alerts yet. Bias flips and setups will show here.</div>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-md border px-2.5 py-1.5 text-xs"
              style={{
                borderColor: a.seen ? "var(--border)" : "var(--neutral)",
                background: "var(--bg-panel-2)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{a.symbol}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {new Date(a.at).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-0.5 text-[var(--text)]">{a.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}