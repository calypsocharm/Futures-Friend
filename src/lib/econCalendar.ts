import type { Bar } from "./types";

type Category = "Rates" | "Equity Index" | "Energy" | "Metals" | "Ag" | "FX" | "Crypto";

export interface EconEvent {
  name: string;
  time: string;
  impact: "high" | "medium" | "low";
  affects: Category[];
  pattern: "weekly" | "monthly" | "quarterly" | "annual";
  dayRule?: number;
  weekday?: number;
  weekOfMonth?: number;
}

export const ECON_EVENTS: EconEvent[] = [
  { name: "FOMC Meeting", time: "14:00 ET", impact: "high", affects: ["Rates", "Equity Index", "Metals", "FX", "Crypto"], pattern: "quarterly", weekday: 3, weekOfMonth: 3 },
  { name: "FOMC Minutes", time: "14:00 ET", impact: "medium", affects: ["Rates", "Equity Index"], pattern: "monthly", weekday: 3, weekOfMonth: 2 },
  { name: "CPI", time: "08:30 ET", impact: "high", affects: ["Rates", "Equity Index", "Metals", "FX"], pattern: "monthly", dayRule: 13 },
  { name: "PPI", time: "08:30 ET", impact: "medium", affects: ["Rates", "Equity Index"], pattern: "monthly", dayRule: 14 },
  { name: "Nonfarm Payrolls (NFP)", time: "08:30 ET", impact: "high", affects: ["Rates", "Equity Index", "Metals", "FX"], pattern: "monthly", weekday: 5, weekOfMonth: 1 },
  { name: "Initial Jobless Claims", time: "08:30 ET", impact: "low", affects: ["Rates", "Equity Index"], pattern: "weekly", weekday: 4 },
  { name: "Retail Sales", time: "08:30 ET", impact: "medium", affects: ["Rates", "Equity Index"], pattern: "monthly", dayRule: 15 },
  { name: "GDP Advance", time: "08:30 ET", impact: "high", affects: ["Rates", "Equity Index"], pattern: "quarterly", weekday: 3, weekOfMonth: 4 },
  { name: "ISM Manufacturing", time: "10:00 ET", impact: "medium", affects: ["Rates", "Equity Index"], pattern: "monthly", dayRule: 1 },
  { name: "Crude Oil Inventories", time: "10:30 ET", impact: "medium", affects: ["Energy"], pattern: "weekly", weekday: 3 },
  { name: "Treasury Auction - 2Y", time: "13:00 ET", impact: "low", affects: ["Rates"], pattern: "monthly", dayRule: 23 },
  { name: "Treasury Auction - 5Y", time: "13:00 ET", impact: "low", affects: ["Rates"], pattern: "monthly", dayRule: 24 },
  { name: "Treasury Auction - 7Y", time: "13:00 ET", impact: "low", affects: ["Rates"], pattern: "monthly", dayRule: 25 },
  { name: "Powell Speech (Jackson Hole)", time: "10:00 ET", impact: "high", affects: ["Rates", "Equity Index", "Metals", "FX"], pattern: "annual", dayRule: -258 },
];

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(Date.UTC(year, month, d));
    if (date.getUTCMonth() !== month) break;
    if (date.getUTCDay() === weekday) {
      count++;
      if (count === n) return d;
    }
  }
  return -1;
}

export interface EconEventOccurrence {
  event: EconEvent;
  date: { year: number; month: number; day: number };
  barIndex: number;
}

export function findEconEventsForBars(bars: Bar[], category: string): EconEventOccurrence[] {
  const out: EconEventOccurrence[] = [];
  if (bars.length === 0) return out;
  const relevantEvents = ECON_EVENTS.filter((e) => e.affects.includes(category as Category));

  for (let i = 0; i < bars.length; i++) {
    const d = new Date(bars[i].time);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();

    for (const event of relevantEvents) {
      let eventDay = -1;
      if (event.pattern === "monthly" && event.dayRule != null && event.dayRule > 0) {
        const maxDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const candidate = Math.min(event.dayRule, maxDays);
        const candidateDate = new Date(Date.UTC(year, month, candidate));
        if (candidateDate.getUTCDay() === 0 || candidateDate.getUTCDay() === 6) {
          eventDay = candidateDate.getUTCDay() === 0 ? candidate + 1 : candidate - 1;
        } else {
          eventDay = candidate;
        }
        if (eventDay === day) {
          out.push({ event, date: { year, month, day }, barIndex: i });
        }
      } else if (event.pattern === "monthly" && event.weekday != null && event.weekOfMonth != null) {
        eventDay = getNthWeekdayOfMonth(year, month, event.weekday, event.weekOfMonth);
        if (eventDay === day) {
          out.push({ event, date: { year, month, day }, barIndex: i });
        }
      } else if (event.pattern === "quarterly" && event.weekday != null && event.weekOfMonth != null) {
        const quarterMonths = [2, 5, 8, 11];
        if (quarterMonths.includes(month)) {
          eventDay = getNthWeekdayOfMonth(year, month, event.weekday, event.weekOfMonth);
          if (eventDay === day) {
            out.push({ event, date: { year, month, day }, barIndex: i });
          }
        }
      } else if (event.pattern === "weekly" && event.weekday != null) {
        if (d.getUTCDay() === event.weekday) {
          out.push({ event, date: { year, month, day }, barIndex: i });
        }
      }
    }
  }
  return out;
}

export function nextEconEvent(category: string): { event: EconEvent; daysUntil: number; date: Date } | null {
  const relevantEvents = ECON_EVENTS.filter((e) => e.affects.includes(category as Category));
  const now = new Date();
  let closest: { event: EconEvent; date: Date; daysUntil: number } | null = null;

  for (const event of relevantEvents) {
    let nextDate: Date | null = null;
    for (let offset = 0; offset < 60; offset++) {
      const test = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
      const year = test.getUTCFullYear();
      const month = test.getUTCMonth();
      const day = test.getUTCDate();
      let eventDay = -1;
      if (event.pattern === "monthly" && event.dayRule != null && event.dayRule > 0) {
        const maxDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const candidate = Math.min(event.dayRule, maxDays);
        const candidateDate = new Date(Date.UTC(year, month, candidate));
        if (candidateDate.getUTCDay() === 0 || candidateDate.getUTCDay() === 6) {
          eventDay = candidateDate.getUTCDay() === 0 ? candidate + 1 : candidate - 1;
        } else {
          eventDay = candidate;
        }
      } else if ((event.pattern === "monthly" || event.pattern === "quarterly") && event.weekday != null && event.weekOfMonth != null) {
        if (event.pattern === "quarterly") {
          const quarterMonths = [2, 5, 8, 11];
          if (!quarterMonths.includes(month)) continue;
        }
        eventDay = getNthWeekdayOfMonth(year, month, event.weekday, event.weekOfMonth);
      } else if (event.pattern === "weekly" && event.weekday != null) {
        if (test.getUTCDay() === event.weekday) {
          eventDay = day;
        }
      }
      if (eventDay === day) {
        nextDate = test;
        break;
      }
    }
    if (nextDate) {
      const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / 86_400_000);
      if (!closest || daysUntil < closest.daysUntil) {
        closest = { event, date: nextDate, daysUntil };
      }
    }
  }
  return closest;
}