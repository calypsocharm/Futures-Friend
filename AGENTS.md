# Futures Friend

Multi-timeframe trend direction and market-flow adviser for futures markets.

## Commands

- `npm run dev` — start dev server on http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, Next 16 style)
- `npm run typecheck` — `tsc --noEmit`

## Stack

- Next.js 16 (App Router, Turbopack) — read `node_modules/next/dist/docs/` before touching framework APIs; this version has breaking changes vs. older Next.
- React 19, TypeScript 5 (strict), Tailwind v4 (via `@tailwindcss/postcss`).
- Zustand with `persist` middleware (localStorage key: `futures-friend-state`).
- No data API — sample bars are seeded in-browser; users can paste OHLC bars per timeframe to override.

## Layout

- `src/lib/types.ts` — Timeframe, Bar, analysis result types. Timeframes: 1M, 1W, 1D, 4H, 1H, 30m, 10m, 5m, 3m, 1m, 30s.
- `src/lib/indicators.ts` — EMA, ATR, RSI, swing points, market structure, flow pressure.
- `src/lib/analyzer.ts` — per-timeframe analysis + cross-timeframe confluence report + advisor text.
- `src/lib/symbols.ts` — tradable futures list (M2KU2026 first; indices, rates, energy, metals, ag, FX, crypto).
- `src/store/analysis.ts` — Zustand store: symbol, barsByTimeframe, report.
- `src/components/` — SymbolPicker, AdvisorBanner, TimeframeCard, BarInput.
- `src/app/page.tsx` — dashboard.

## Disclaimer

Educational tool only — not financial advice. Futures trading involves substantial risk of loss.