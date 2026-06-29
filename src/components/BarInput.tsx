"use client";

import { useState } from "react";
import { useAnalysis } from "@/store/analysis";
import type { Bar, Timeframe } from "@/lib/types";
import { TIMEFRAMES, TIMEFRAME_LABELS } from "@/lib/types";

export function BarInput() {
  const symbol = useAnalysis((s) => s.symbol);
  const setBars = useAnalysis((s) => s.setBars);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function parse(): Bar[] {
    const lines = text.trim().split(/\n+/);
    const out: Bar[] = [];
    for (const line of lines) {
      const parts = line.split(/[\s,;\t]+/).filter(Boolean);
      if (parts.length < 4) throw new Error("Each line needs O H L C (and optional Close-time Volume)");
      const o = Number(parts[0]);
      const h = Number(parts[1]);
      const l = Number(parts[2]);
      const c = Number(parts[3]);
      if ([o, h, l, c].some((n) => Number.isNaN(n))) throw new Error("Non-numeric value in: " + line);
      const time = parts[4] ? new Date(parts[4]).getTime() : Date.now() - out.length * 60_000;
      const volume = parts[5] ? Number(parts[5]) : undefined;
      out.push({ time, open: o, high: h, low: l, close: c, volume });
    }
    return out;
  }

  function apply() {
    try {
      const bars = parse();
      if (bars.length < 5) throw new Error("Need at least 5 bars.");
      setBars(tf, bars);
      setErr(null);
      setText("");
      setOk(`Applied ${bars.length} bars to ${tf}`);
      window.setTimeout(() => setOk(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Parse error");
      setOk(null);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Override bars — {symbol}</h3>
        <select
          value={tf}
          onChange={(e) => setTf(e.target.value as Timeframe)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {TIMEFRAME_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        Paste OHLC bars, one per line: <code>O H L C [time] [volume]</code>. Time can be ISO or epoch ms.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"104.50 104.62 104.48 104.59 2026-06-29T13:00 1200\n104.59 104.70 104.55 104.68 2026-06-29T14:00 980"}
        rows={5}
        className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--neutral)]"
      />
      {err && <div className="mt-1 text-xs text-[var(--bear)]">{err}</div>}
      {ok && <div className="mt-1 text-xs text-[var(--bull)]">{ok}</div>}
      <div className="mt-2 flex justify-end">
        <button
          onClick={apply}
          className="rounded-md bg-[var(--neutral)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)]"
        >
          Apply to {TIMEFRAME_LABELS[tf]}
        </button>
      </div>
    </div>
  );
}