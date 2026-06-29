"use client";

import type { TradePlan } from "@/lib/types";

const BIAS_COLOR: Record<string, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  neutral: "var(--neutral)",
};

const BIAS_WORD: Record<string, string> = {
  bull: "LONG",
  bear: "SHORT",
  neutral: "RANGE",
};

export function TradePlanPanel({ plan }: { plan: TradePlan }) {
  const c = BIAS_COLOR[plan.bias];
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: c, background: "var(--bg-panel)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Trade plan
        </h2>
        <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: c, color: "var(--bg)" }}>
          {BIAS_WORD[plan.bias]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Block title="Entry zone" color="var(--neutral)">
          <div className="font-mono text-sm">
            {fmt(plan.entryZone.low)} – {fmt(plan.entryZone.high)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{plan.entryNote}</div>
        </Block>

        <Block title="Stop" color="var(--bear)">
          <div className="font-mono text-sm">{fmt(plan.stop)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{plan.stopNote}</div>
        </Block>

        <Block title="Targets (1R / 2R / 3R)" color="var(--bull)">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Target price={plan.target1} rr="1R" />
            <Target price={plan.target2} rr="2R" />
            <Target price={plan.target3} rr="3R" />
          </div>
        </Block>

        <Block title="Invalidation" color="var(--neutral)">
          <div className="text-xs text-[var(--text)]">{plan.invalidation}</div>
        </Block>
      </div>

      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        Auto-derived from the dominant bias, EMA20 and ATR. Not financial advice — confirm with your own analysis.
      </p>
    </div>
  );
}

function Block({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: color, background: "var(--bg-panel-2)" }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Target({ price, rr }: { price: number; rr: string }) {
  return (
    <div>
      <div className="font-mono text-xs">{fmt(price)}</div>
      <div className="text-[10px] text-[var(--text-muted)]">{rr}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}