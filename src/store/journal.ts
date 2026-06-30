"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface JournalTrade {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number | null;
  stopPrice: number;
  targetPrice: number;
  contracts: number;
  entryTime: number;
  exitTime: number | null;
  rMultiple: number | null;
  pnl: number | null;
  grade: string;
  advisorSnapshot: string;
  checklist: { biasAligned: boolean; triggerFresh: boolean; stopSet: boolean; sizeCorrect: boolean };
  notes: string;
  status: "open" | "closed";
}

export interface JournalState {
  trades: JournalTrade[];
  maxDailyLossR: number;
  maxDailyTrades: number;
  lockedOut: boolean;
  lockoutReason: string;
  addTrade: (t: Omit<JournalTrade, "id" | "entryTime" | "status">) => string;
  closeTrade: (id: string, exitPrice: number) => void;
  deleteTrade: (id: string) => void;
  setMaxDailyLossR: (r: number) => void;
  setMaxDailyTrades: (n: number) => void;
  checkLockout: () => void;
  clearLockout: () => void;
}

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      trades: [],
      maxDailyLossR: 3,
      maxDailyTrades: 5,
      lockedOut: false,
      lockoutReason: "",

      addTrade: (t) => {
        const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const trade: JournalTrade = { ...t, id, entryTime: Date.now(), status: "open" };
        set({ trades: [trade, ...get().trades] });
        get().checkLockout();
        return id;
      },

      closeTrade: (id, exitPrice) => {
        const trades = get().trades.map((t) => {
          if (t.id !== id) return t;
          const risk = Math.abs(t.entryPrice - t.stopPrice);
          const reward = t.direction === "long" ? exitPrice - t.entryPrice : t.entryPrice - exitPrice;
          const rMultiple = risk > 0 ? reward / risk : 0;
          const pnl = reward * t.contracts * (t.symbol.includes("M2K") || t.symbol.includes("ES") ? 1 : 1);
          return { ...t, exitPrice, exitTime: Date.now(), rMultiple, pnl, status: "closed" as const };
        });
        set({ trades });
        get().checkLockout();
      },

      deleteTrade: (id) => {
        set({ trades: get().trades.filter((t) => t.id !== id) });
        get().checkLockout();
      },

      setMaxDailyLossR: (r) => set({ maxDailyLossR: r }),
      setMaxDailyTrades: (n) => set({ maxDailyTrades: n }),

      checkLockout: () => {
        const today = todayStart();
        const todayTrades = get().trades.filter((t) => t.entryTime >= today);
        const closedToday = todayTrades.filter((t) => t.status === "closed");
        const totalR = closedToday.reduce((a, t) => a + (t.rMultiple ?? 0), 0);
        const lossR = -totalR;

        if (lossR >= get().maxDailyLossR) {
          set({ lockedOut: true, lockoutReason: `Daily loss limit hit: -${lossR.toFixed(1)}R (max ${get().maxDailyLossR}R). Stop trading. Walk away.` });
          return;
        }
        if (todayTrades.length >= get().maxDailyTrades) {
          set({ lockedOut: true, lockoutReason: `Max daily trades hit: ${todayTrades.length} (max ${get().maxDailyTrades}). Stop for today.` });
          return;
        }
        set({ lockedOut: false, lockoutReason: "" });
      },

      clearLockout: () => set({ lockedOut: false, lockoutReason: "" }),
    }),
    {
      name: "futures-friend-journal",
      partialize: (s) => ({
        trades: s.trades,
        maxDailyLossR: s.maxDailyLossR,
        maxDailyTrades: s.maxDailyTrades,
      }),
    }
  )
);

export function journalStats(trades: JournalTrade[]) {
  const closed = trades.filter((t) => t.status === "closed");
  if (closed.length === 0) return { total: 0, wins: 0, losses: 0, winRate: 0, avgR: 0, totalR: 0, biggestWin: 0, biggestLoss: 0, todayR: 0, todayTrades: 0 };
  const wins = closed.filter((t) => (t.rMultiple ?? 0) > 0);
  const losses = closed.filter((t) => (t.rMultiple ?? 0) <= 0);
  const totalR = closed.reduce((a, t) => a + (t.rMultiple ?? 0), 0);
  const avgR = totalR / closed.length;
  const biggestWin = Math.max(...closed.map((t) => t.rMultiple ?? 0));
  const biggestLoss = Math.min(...closed.map((t) => t.rMultiple ?? 0));
  const today = todayStart();
  const todayClosed = closed.filter((t) => (t.exitTime ?? t.entryTime) >= today);
  const todayR = todayClosed.reduce((a, t) => a + (t.rMultiple ?? 0), 0);
  return {
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round((wins.length / closed.length) * 100),
    avgR: Math.round(avgR * 100) / 100,
    totalR: Math.round(totalR * 100) / 100,
    biggestWin: Math.round(biggestWin * 100) / 100,
    biggestLoss: Math.round(biggestLoss * 100) / 100,
    todayR: Math.round(todayR * 100) / 100,
    todayTrades: todayClosed.length,
  };
}