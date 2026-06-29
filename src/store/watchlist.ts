"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Direction, Timeframe } from "@/lib/types";

export interface WatchlistItem {
  symbol: string;
  label: string;
  direction: Direction;
  confidence: number;
  lastPrice: number;
  updatedAt: number;
}

export interface Alert {
  id: string;
  symbol: string;
  kind: "bias-flip" | "setup" | "price";
  message: string;
  direction?: Direction;
  at: number;
  seen: boolean;
}

interface WatchlistState {
  watchlist: string[];
  items: Record<string, WatchlistItem>;
  alerts: Alert[];
  autoRefresh: boolean;
  intervalSec: number;
  watchTF: Timeframe;
  toggle: (symbol: string) => void;
  setItem: (item: WatchlistItem) => void;
  addAlert: (alert: Omit<Alert, "id" | "at" | "seen">) => void;
  markAlertsSeen: () => void;
  clearAlerts: () => void;
  setAutoRefresh: (v: boolean) => void;
  setIntervalSec: (s: number) => void;
  setWatchTF: (tf: Timeframe) => void;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: ["M2KU2026", "ESU2026", "GCQ2026", "SOL-USD"],
      items: {},
      alerts: [],
      autoRefresh: true,
      intervalSec: 60,
      watchTF: "1H",
      toggle: (symbol) => {
        const wl = get().watchlist;
        const next = wl.includes(symbol)
          ? wl.filter((s) => s !== symbol)
          : [...wl, symbol];
        set({ watchlist: next });
      },
      setItem: (item) => {
        const prev = get().items[item.symbol];
        if (prev && prev.direction !== item.direction) {
          get().addAlert({
            symbol: item.symbol,
            kind: "bias-flip",
            message: `${item.symbol} bias flipped ${prev.direction} → ${item.direction} (${item.confidence}%)`,
            direction: item.direction,
          });
        }
        set({ items: { ...get().items, [item.symbol]: item } });
      },
      addAlert: (alert) => {
        const id = `${alert.symbol}-${alert.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const full: Alert = { ...alert, id, at: Date.now(), seen: false };
        const recent = get().alerts.slice(-49);
        set({ alerts: [full, ...recent] });
      },
      markAlertsSeen: () => set({ alerts: get().alerts.map((a) => ({ ...a, seen: true })) }),
      clearAlerts: () => set({ alerts: [] }),
      setAutoRefresh: (v) => set({ autoRefresh: v }),
      setIntervalSec: (s) => set({ intervalSec: s }),
      setWatchTF: (tf) => set({ watchTF: tf }),
    }),
    {
      name: "futures-friend-watchlist",
      partialize: (s) => ({
        watchlist: s.watchlist,
        autoRefresh: s.autoRefresh,
        intervalSec: s.intervalSec,
        watchTF: s.watchTF,
      }),
    }
  )
);