"use client";

import { useMemo, useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { computePositionSize } from "@/lib/analyzer";
import type { TradePlan } from "@/lib/types";

export function RiskCalculator({ plan }: { plan: TradePlan }) {
  const symbol = useAnalysis((s) => s.symbol);
  const [account, setAccount] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");

  const result = useMemo(() => {
    const a = parseFloat(account);
    const r = parseFloat(riskPct);
    if (Number.isNaN(a) || Number.isNaN(r) || a <= 0 || r <= 0) return null;
    const entry = plan.bias === "bear" ? plan.entryZone.low : plan.entryZone.high;
    return computePositionSize(symbol, a, r, entry, plan.stop);
  }, [symbol, account, riskPct, plan]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Risk calculator
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account size ($)">
          <input
            type="number"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 text-sm font-mono outline-none focus:border-[var(--neutral)]"
          />
        </Field>
        <Field label="Risk per trade (%)">
          <input
            type="number"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
            step="0.25"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 text-sm font-mono outline-none focus:border-[var(--neutral)]"
          />
        </Field>
      </div>

      {result ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Row label="Contracts" value={String(result.contracts)} highlight={result.contracts > 0 ? "var(--bull)" : "var(--bear)"} />
          <Row label="$ at risk" value={`$${result.dollarsAtRisk.toFixed(2)}`} />
          <Row label="Ticks at risk" value={String(result.ticksAtRisk)} />
          <Row label="Tick size" value={String(result.tickSize)} />
          <Row label="Tick value" value={`$${result.tickValue}`} />
          <Row label="Stop" value={fmt(plan.stop)} />
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--bear)]">Enter a valid account size and risk %.</div>
      )}
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        Contracts are floored (no fractional). Zero means stop distance exceeds your risk budget for 1 contract.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-mono font-semibold" style={highlight ? { color: highlight } : undefined}>
        {value}
      </span>
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}