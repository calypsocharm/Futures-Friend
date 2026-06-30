"use client";

import { useState } from "react";
import { useAnalysis } from "@/store/analysis";
import { useJournal, journalStats } from "@/store/journal";
import { computeConfluence } from "@/lib/confluence";
import type { Grade } from "@/lib/confluence";

const GRADE_COLOR: Record<Grade, string> = {
  "A+": "var(--bull)",
  "A": "var(--bull)",
  "B": "#5ad1c4",
  "C": "var(--neutral)",
  "D": "#f0b429",
  "F": "var(--bear)",
};

export function ConfluenceBanner() {
  const symbol = useAnalysis((s) => s.symbol);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const score = computeConfluence(symbol, barsByTimeframe);
  const color = GRADE_COLOR[score.grade];

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: color, background: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg px-5 py-3 text-4xl font-black" style={{ background: color, color: "var(--bg)" }}>
            {score.grade}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Confluence grade — {symbol}</div>
            <div className="text-xl font-bold" style={{ color }}>
              {score.dominant === "bull" ? "▲ LONG" : score.dominant === "bear" ? "▼ SHORT" : "■ NEUTRAL"} · {score.agreement}% agreement
            </div>
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <VoteChip label="Bull" value={score.bullVotes} color="var(--bull)" />
          <VoteChip label="Neutral" value={score.neutralVotes} color="var(--neutral)" />
          <VoteChip label="Bear" value={score.bearVotes} color="var(--bear)" />
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {score.votes.map((v, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-1.5 text-xs" style={{ background: "var(--bg-panel-2)" }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: v.direction === "bull" ? "var(--bull)" : v.direction === "bear" ? "var(--bear)" : "var(--text-muted)" }}>
                {v.direction === "bull" ? "▲" : v.direction === "bear" ? "▼" : "■"}
              </span>
              <span className="text-[var(--text)]">{v.indicator}</span>
              <span className="text-[var(--text-muted)]">(weight {v.weight})</span>
            </div>
            <span className="text-[var(--text-muted)]">{v.detail}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{score.summary}</p>
    </div>
  );
}

function VoteChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md px-3 py-1.5" style={{ background: "var(--bg-panel-2)", border: `1px solid ${color}` }}>
      <span className="text-[var(--text-muted)]">{label} </span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

export function JournalPanel() {
  const symbol = useAnalysis((s) => s.symbol);
  const report = useAnalysis((s) => s.report);
  const barsByTimeframe = useAnalysis((s) => s.barsByTimeframe);
  const trades = useJournal((s) => s.trades);
  const addTrade = useJournal((s) => s.addTrade);
  const closeTrade = useJournal((s) => s.closeTrade);
  const deleteTrade = useJournal((s) => s.deleteTrade);
  const lockedOut = useJournal((s) => s.lockedOut);
  const lockoutReason = useJournal((s) => s.lockoutReason);
  const maxDailyLossR = useJournal((s) => s.maxDailyLossR);
  const maxDailyTrades = useJournal((s) => s.maxDailyTrades);
  const setMaxDailyLossR = useJournal((s) => s.setMaxDailyLossR);
  const setMaxDailyTrades = useJournal((s) => s.setMaxDailyTrades);
  const clearLockout = useJournal((s) => s.clearLockout);
  const score = computeConfluence(symbol, barsByTimeframe);
  const stats = journalStats(trades);
  const openTrades = trades.filter((t) => t.status === "open");

  const [showForm, setShowForm] = useState(false);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [contracts, setContracts] = useState("1");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState({ biasAligned: false, triggerFresh: false, stopSet: false, sizeCorrect: false });
  const [closePrice, setClosePrice] = useState<Record<string, string>>({});

  const lastPrice = report?.perTimeframe[0]?.lastPrice ?? 0;

  function logTrade() {
    const e = parseFloat(entry) || lastPrice;
    const s = parseFloat(stop) || 0;
    const t = parseFloat(target) || 0;
    const c = parseInt(contracts) || 1;
    addTrade({
      symbol,
      direction,
      entryPrice: e,
      stopPrice: s,
      targetPrice: t,
      contracts: c,
      exitPrice: null,
      exitTime: null,
      rMultiple: null,
      pnl: null,
      grade: score.grade,
      advisorSnapshot: report?.advisor ?? score.summary,
      checklist,
      notes,
    });
    setShowForm(false);
    setEntry(""); setStop(""); setTarget(""); setContracts("1"); setNotes("");
    setChecklist({ biasAligned: false, triggerFresh: false, stopSet: false, sizeCorrect: false });
  }

  function handleClose(id: string) {
    const price = parseFloat(closePrice[id] ?? "");
    if (price) {
      closeTrade(id, price);
      setClosePrice((p) => ({ ...p, [id]: "" }));
    }
  }

  const checklistPassed = checklist.biasAligned && checklist.triggerFresh && checklist.stopSet && checklist.sizeCorrect;

  return (
    <div className="space-y-4">
      {/* Daily risk lockout */}
      <div className="rounded-xl border p-4" style={{ borderColor: lockedOut ? "var(--bear)" : "var(--border)", background: "var(--bg-panel)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Daily risk manager</h2>
          <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: lockedOut ? "var(--bear)" : "var(--bull)", color: "var(--bg)" }}>
            {lockedOut ? "LOCKED OUT" : "OK TO TRADE"}
          </span>
        </div>
        {lockedOut ? (
          <div className="mt-2 rounded-md border border-[var(--bear)] p-3 text-sm text-[var(--bear)]" style={{ background: "var(--bg-panel-2)" }}>
            ⛔ {lockoutReason}
            <button onClick={clearLockout} className="ml-3 text-xs text-[var(--text-muted)] underline">override (use wisely)</button>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-3 text-xs">
            <Stat label="Today R" value={`${stats.todayR >= 0 ? "+" : ""}${stats.todayR}`} color={stats.todayR >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="Today trades" value={`${stats.todayTrades}/${maxDailyTrades}`} color="var(--text)" />
            <Stat label="Max loss" value={`-${maxDailyLossR}R`} color="var(--bear)" />
            <Stat label="Max trades" value={String(maxDailyTrades)} color="var(--text)" />
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs">
          <label className="text-[var(--text-muted)]">Max daily loss (R):</label>
          <input type="number" value={maxDailyLossR} onChange={(e) => setMaxDailyLossR(Number(e.target.value))} step="0.5" className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 font-mono" />
          <label className="text-[var(--text-muted)]">Max trades:</label>
          <input type="number" value={maxDailyTrades} onChange={(e) => setMaxDailyTrades(Number(e.target.value))} className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 font-mono" />
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Journal stats</h2>
          <div className="grid grid-cols-4 gap-3 text-xs sm:grid-cols-8">
            <Stat label="Trades" value={String(stats.total)} color="var(--text)" />
            <Stat label="Win rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="Wins" value={String(stats.wins)} color="var(--bull)" />
            <Stat label="Losses" value={String(stats.losses)} color="var(--bear)" />
            <Stat label="Avg R" value={`${stats.avgR >= 0 ? "+" : ""}${stats.avgR}`} color={stats.avgR >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="Total R" value={`${stats.totalR >= 0 ? "+" : ""}${stats.totalR}`} color={stats.totalR >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="Biggest W" value={`+${stats.biggestWin}`} color="var(--bull)" />
            <Stat label="Biggest L" value={`${stats.biggestLoss}`} color="var(--bear)" />
          </div>
        </div>
      )}

      {/* Log trade form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Trade journal</h2>
          <button
            onClick={() => setShowForm((s) => !s)}
            disabled={lockedOut}
            className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ background: lockedOut ? "var(--bear)" : "var(--bull)", color: "var(--bg)" }}
          >
            {lockedOut ? "🔒 Locked" : showForm ? "Cancel" : "+ Log trade"}
          </button>
        </div>

        {showForm && (
          <div className="mt-3 rounded-lg border border-[var(--border)] p-3" style={{ background: "var(--bg-panel-2)" }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Direction">
                <select value={direction} onChange={(e) => setDirection(e.target.value as "long" | "short")} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs">
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </Field>
              <Field label="Entry price">
                <input type="number" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder={lastPrice ? String(lastPrice) : ""} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-mono" />
              </Field>
              <Field label="Stop price">
                <input type="number" value={stop} onChange={(e) => setStop(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-mono" />
              </Field>
              <Field label="Target price">
                <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-mono" />
              </Field>
            </div>

            {/* Pre-trade checklist */}
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pre-trade checklist (all required)</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <CheckItem label="Bias aligned" checked={checklist.biasAligned} onChange={(v) => setChecklist((c) => ({ ...c, biasAligned: v }))} />
                <CheckItem label="Trigger fresh" checked={checklist.triggerFresh} onChange={(v) => setChecklist((c) => ({ ...c, triggerFresh: v }))} />
                <CheckItem label="Stop set" checked={checklist.stopSet} onChange={(v) => setChecklist((c) => ({ ...c, stopSet: v }))} />
                <CheckItem label="Size correct" checked={checklist.sizeCorrect} onChange={(v) => setChecklist((c) => ({ ...c, sizeCorrect: v }))} />
              </div>
            </div>

            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)..." className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 text-xs" />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">Grade at entry: <span className="font-bold" style={{ color: GRADE_COLOR[score.grade as Grade] }}>{score.grade}</span></span>
              <button
                onClick={logTrade}
                disabled={!checklistPassed}
                className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ background: checklistPassed ? "var(--bull)" : "var(--bg-panel)", color: checklistPassed ? "var(--bg)" : "var(--text-muted)" }}
              >
                {checklistPassed ? "Log trade" : "Complete checklist first"}
              </button>
            </div>
          </div>
        )}

        {/* Open + recent trades */}
        {trades.length === 0 ? (
          <div className="mt-3 text-xs text-[var(--text-muted)]">No trades logged yet. Click &ldquo;+ Log trade&rdquo; to start journaling.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {openTrades.length > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Open trades ({openTrades.length})</div>
            )}
            {openTrades.map((t) => (
              <div key={t.id} className="rounded-md border p-2 text-xs" style={{ borderColor: "var(--neutral)", background: "var(--bg-panel-2)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold" style={{ color: t.direction === "long" ? "var(--bull)" : "var(--bear)" }}>
                    {t.direction.toUpperCase()} {t.symbol} @ {fmt(t.entryPrice)} · {t.contracts}c
                  </span>
                  <span className="text-[var(--text-muted)]">Grade {t.grade} · {new Date(t.entryTime).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 text-[var(--text-muted)]">Stop {fmt(t.stopPrice)} · Target {fmt(t.targetPrice)}</div>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" value={closePrice[t.id] ?? ""} onChange={(e) => setClosePrice((p) => ({ ...p, [t.id]: e.target.value }))} placeholder="Exit price" className="w-28 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-0.5 font-mono text-xs" />
                  <button onClick={() => handleClose(t.id)} className="rounded-md bg-[var(--neutral)] px-2 py-0.5 text-[10px] font-bold text-[var(--bg)]">Close</button>
                  <button onClick={() => deleteTrade(t.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--bear)]">delete</button>
                </div>
              </div>
            ))}

            {trades.some((t) => t.status === "closed") && (
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Closed trades</div>
            )}
            {trades.filter((t) => t.status === "closed").slice(0, 10).map((t) => (
              <div key={t.id} className="rounded-md border border-[var(--border)] p-2 text-xs" style={{ background: "var(--bg-panel-2)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold" style={{ color: t.direction === "long" ? "var(--bull)" : "var(--bear)" }}>
                    {t.direction.toUpperCase()} {t.symbol} @ {fmt(t.entryPrice)} → {fmt(t.exitPrice ?? 0)}
                  </span>
                  <span className="font-mono font-bold" style={{ color: (t.rMultiple ?? 0) >= 0 ? "var(--bull)" : "var(--bear)" }}>
                    {(t.rMultiple ?? 0) >= 0 ? "+" : ""}{t.rMultiple?.toFixed(2)}R
                  </span>
                </div>
                <div className="mt-0.5 text-[var(--text-muted)]">Grade {t.grade} · {new Date(t.exitTime ?? t.entryTime).toLocaleString()}</div>
                {t.notes && <div className="mt-0.5 text-[var(--text-muted)]">{t.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-2" style={{ background: "var(--bg-panel-2)" }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="font-mono font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--neutral)]" />
      <span style={{ color: checked ? "var(--bull)" : "var(--text-muted)" }}>{label}</span>
    </label>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}