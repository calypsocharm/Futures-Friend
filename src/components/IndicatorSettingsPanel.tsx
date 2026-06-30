"use client";

import { useState } from "react";
import { useIndicatorSettings } from "@/store/settings";

export function IndicatorSettingsPanel() {
  const st = useIndicatorSettings((s) => s.st);
  const setST = useIndicatorSettings((s) => s.setST);
  const stopHunt = useIndicatorSettings((s) => s.stopHunt);
  const setStopHunt = useIndicatorSettings((s) => s.setStopHunt);
  const dca = useIndicatorSettings((s) => s.dca);
  const setDCA = useIndicatorSettings((s) => s.setDCA);
  const mr = useIndicatorSettings((s) => s.mr);
  const setMR = useIndicatorSettings((s) => s.setMR);
  const orb = useIndicatorSettings((s) => s.orb);
  const setORB = useIndicatorSettings((s) => s.setORB);
  const resetAll = useIndicatorSettings((s) => s.resetAll);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Indicator settings
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1 text-xs text-[var(--text)] hover:border-[var(--neutral)]">
            {open ? "Hide" : "Tune"}
          </button>
          <button onClick={resetAll} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--bear)]">
            Reset
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {/* SuperTrend */}
          <Section title="Adaptive SuperTrend">
            <Num label="ATR length" value={st.atrLen} onChange={(v) => setST({ atrLen: v })} step={1} min={1} />
            <Num label="Factor" value={st.factor} onChange={(v) => setST({ factor: v })} step={0.5} min={0.5} />
            <Num label="Training period" value={st.trainingPeriod} onChange={(v) => setST({ trainingPeriod: v })} step={10} min={20} />
            <Num label="High vol %" value={st.highVolPct} onChange={(v) => setST({ highVolPct: v })} step={0.05} min={0} max={1} />
            <Num label="Mid vol %" value={st.midVolPct} onChange={(v) => setST({ midVolPct: v })} step={0.05} min={0} max={1} />
            <Num label="Low vol %" value={st.lowVolPct} onChange={(v) => setST({ lowVolPct: v })} step={0.05} min={0} max={1} />
          </Section>

          {/* Stop Hunt */}
          <Section title="Bull Stop Hunt">
            <Num label="Lookback" value={stopHunt.lookback} onChange={(v) => setStopHunt({ lookback: v })} step={1} min={2} />
            <Num label="Vol avg length" value={stopHunt.volAvgLength} onChange={(v) => setStopHunt({ volAvgLength: v })} step={5} min={2} />
            <Num label="Vol mult" value={stopHunt.volMult} onChange={(v) => setStopHunt({ volMult: v })} step={0.1} min={0.1} />
          </Section>

          {/* DCA */}
          <Section title="DCA Ladder">
            <Num label="Min diamonds" value={dca.minDiamondsBeforeBuy} onChange={(v) => setDCA({ minDiamondsBeforeBuy: v })} step={1} min={1} />
            <Num label="Min avg improve %" value={dca.minAvgImprovePct} onChange={(v) => setDCA({ minAvgImprovePct: v })} step={0.5} min={0} />
            <Num label="Trail start %" value={dca.trailStartPct} onChange={(v) => setDCA({ trailStartPct: v })} step={1} min={0.1} />
            <Num label="Trail below %" value={dca.trailBelowPct} onChange={(v) => setDCA({ trailBelowPct: v })} step={1} min={0.1} />
            <div className="col-span-2">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Discounts % (comma-separated)</div>
              <input
                type="text"
                value={dca.discounts.join(", ")}
                onChange={(e) => setDCA({ discounts: e.target.value.split(",").map((x) => parseFloat(x.trim()) || 0) })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Quantities (comma-separated)</div>
              <input
                type="text"
                value={dca.quantities.join(", ")}
                onChange={(e) => setDCA({ quantities: e.target.value.split(",").map((x) => parseFloat(x.trim()) || 0) })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs font-mono"
              />
            </div>
          </Section>

          {/* Mean Reversion */}
          <Section title="Mean Reversion">
            <Num label="BB period" value={mr.bbPeriod} onChange={(v) => setMR({ bbPeriod: v })} step={1} min={5} />
            <Num label="BB std" value={mr.bbStd} onChange={(v) => setMR({ bbStd: v })} step={0.5} min={0.5} />
            <Num label="Z threshold" value={mr.zThreshold} onChange={(v) => setMR({ zThreshold: v })} step={0.25} min={0.5} />
            <Num label="RSI oversold" value={mr.rsiOversold} onChange={(v) => setMR({ rsiOversold: v })} step={1} min={5} max={50} />
            <Num label="RSI overbought" value={mr.rsiOverbought} onChange={(v) => setMR({ rsiOverbought: v })} step={1} min={50} max={95} />
            <Num label="VWAP dev %" value={mr.vwapDeviationPct} onChange={(v) => setMR({ vwapDeviationPct: v })} step={0.5} min={0.5} />
          </Section>

          {/* ORB */}
          <Section title="ORB">
            <Num label="ATR length" value={orb.atrLength} onChange={(v) => setORB({ atrLength: v })} step={1} min={1} />
            <Num label="ATR target mult" value={orb.atrTargetMult} onChange={(v) => setORB({ atrTargetMult: v })} step={0.5} min={0.1} />
            <Num label="Target count" value={orb.targetCount} onChange={(v) => setORB({ targetCount: v })} step={1} min={1} max={5} />
            <Num label="Vol avg length" value={orb.volAvgLength} onChange={(v) => setORB({ volAvgLength: v })} step={5} min={2} />
            <Num label="Vol spike mult" value={orb.volSpikeMult} onChange={(v) => setORB({ volSpikeMult: v })} step={0.1} min={0.1} />
            <Num label="EMA period" value={orb.emaPeriod} onChange={(v) => setORB({ emaPeriod: v })} step={10} min={20} />
            <div className="col-span-2">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Mean session (HHMM-HHMM ET)</div>
              <input
                type="text"
                value={orb.meanSessionStart + "-" + orb.meanSessionEnd}
                onChange={(e) => {
                  const parts = e.target.value.split("-");
                  setORB({ meanSessionStart: parts[0]?.trim() ?? "0930", meanSessionEnd: parts[1]?.trim() ?? "0935" });
                }}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">OR session (HHMM-HHMM ET)</div>
              <input
                type="text"
                value={orb.orSessionStart + "-" + orb.orSessionEnd}
                onChange={(e) => {
                  const parts = e.target.value.split("-");
                  setORB({ orSessionStart: parts[0]?.trim() ?? "0930", orSessionEnd: parts[1]?.trim() ?? "1000" });
                }}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs font-mono"
              />
            </div>
          </Section>

          <p className="text-[10px] text-[var(--text-muted)]">
            Settings persist in your browser and apply to all indicator panels immediately. Reset restores the Pine defaults.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-3">
      <div className="mb-2 text-xs font-semibold text-[var(--text)]">{title}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function Num({ label, value, onChange, step, min, max }: { label: string; value: number; onChange: (v: number) => void; step: number; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-[var(--text-muted)]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-mono"
      />
    </label>
  );
}