# Futures Friend

Multi-timeframe trend direction and market-flow adviser for futures markets.
Live at https://friend.linebot.io

## Commands

- `npm run dev` — start dev server on http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, Next 16 style)
- `npm run typecheck` — `tsc --noEmit`

## Deploy

```bash
ssh -i ~/.ssh/ff_vps root@187.124.235.109 "cd /var/www/futures-friend && git pull && npm install --no-audit --no-fund && npm run build && pm2 restart futures-friend"
```

## Stack

- Next.js 16 (App Router, Turbopack) — read `node_modules/next/dist/docs/` before touching framework APIs; this version has breaking changes vs. older Next.
- React 19, TypeScript 5 (strict), Tailwind v4 (via `@tailwindcss/postcss`).
- Zustand with `persist` middleware (localStorage keys: `futures-friend-state`, `futures-friend-watchlist`, `futures-friend-journal`, `futures-friend-indicator-settings`).
- Live data via Yahoo Finance public API (no key needed, 15-20 min delayed for futures, realtime for crypto).
- Server route `/api/bars?symbol=&tf=` fetches from Yahoo, aggregates non-native TFs (3m/10m/15m/30s).

## Two apps

- **Swing Friend** (`/`) — 11 timeframes (1M→30s), EMA20/50/200 trend + flow, friend-voiced advisor, all 5 indicators, trade journal, Best Plays scanner, correlation matrix, backtest/replay.
- **Scalp Friend** (`/scalp`) — 7 sub-30m TFs, EMA9/21 cross triggers, GO/WAIT/NO-GO entry trigger, chop zone detection, ORB indicator, scalp-specific risk in ticks.

## Features (20+)

1. Live Yahoo data (20 symbols: rates, indices, energy, metals, ag, FX, crypto)
2. 11 timeframes with server-side aggregation for non-Yahoo-native TFs
3. Per-TF analysis: EMA, ATR, RSI, structure, flow, divergence detection
4. Friend-voiced advisor that names specific timeframes
5. Confluence matrix (direction × TF grid)
6. Trade plan generator (entry/stop/1R-2R-3R targets) + risk calculator (ticks → contracts → $)
7. Setup detector (EMA pullback, breakout, oversold bounce, EMA stack, range fade, RSI divergence)
8. Key S/R levels aggregated across TFs
9. Volatility + flow gauges per TF
10. SVG candlestick chart with EMA overlays + hover crosshair + trade plan levels + divergence markers
11. **Adaptive SuperTrend** (ported from Pine: k-means ATR clustering, stop-hunt diamonds, DCA ladder, trailing SL)
12. **Mean Reversion** (Bollinger Bands, Z-score, VWAP, snapback signals)
13. **ORB** (Opening Range Breakout: 0930-1000 ET session detection, ATR targets, volume spikes, EMA200)
14. **Indicators LEAD direction** — SuperTrend/stop-hunt/MR override lagging EMAs (priority: diamond > MR > SuperTrend > EMA)
15. Auto-refresh (30s-5m configurable) + watchlist (multi-symbol, selectable TF) + alerts (bias flip detection)
16. Backtest/replay mode (scrub through history, see advisor's call at each bar)
17. **Confluence grade** (A+ to F) combining all 5 indicators with weighted votes
18. **Trade journal** (log trades, track win rate/avg R/total R, advisor snapshot at entry)
19. **Daily risk lockout** (max loss in R + max trades, locks you out when hit)
20. **Pre-trade checklist** (bias/trigger/stop/size must all be confirmed)
21. **Best Plays scanner** (auto-scans all 20 symbols, ranks by grade, expandable cards with hold time + exit plan + invalidation)
22. **Correlation matrix** (Pearson correlation across watchlist, inverse/positive pair lists)
23. **Econ calendar** (FOMC/CPI/NFP/Treasury auctions, next event + recent events)
24. **Indicator settings panel** (tune all Pine defaults live: ST/stop-hunt/DCA/MR/ORB)
25. Mobile responsive (sidebar drawer, hamburger toggle)

## File layout

- `src/lib/types.ts` — Timeframe (12: 1M/1W/1D/4H/1H/30m/15m/10m/5m/3m/1m/30s), Bar, analysis types
- `src/lib/indicators.ts` — EMA, ATR, RSI, RSI series, swing points, market structure, flow pressure, divergence detection
- `src/lib/analyzer.ts` — swing TF analysis + confluence report + friend-voiced advisor (indicator-led direction)
- `src/lib/scalp.ts` — scalp TF analysis + GO/WAIT/NO-GO trigger + chop detection (indicator-led direction)
- `src/lib/adaptiveSt.ts` — Adaptive SuperTrend (k-means), stop-hunt diamonds, DCA ladder, trailing SL
- `src/lib/meanReversion.ts` — Bollinger Bands, Z-score, VWAP, mean reversion signals
- `src/lib/orb.ts` — Opening Range Breakout (session detection, ATR targets, volume spikes)
- `src/lib/confluence.ts` — unified confluence grade (combines all 5 indicators)
- `src/lib/correlation.ts` — Pearson correlation matrix
- `src/lib/econCalendar.ts` — economic event calendar (FOMC/CPI/NFP etc.)
- `src/lib/symbols.ts` — 20 tradable futures + Yahoo ticker mappings + aggregation helpers
- `src/store/analysis.ts` — main Zustand store (symbol, bars, report, live fetch)
- `src/store/watchlist.ts` — watchlist + alerts + auto-refresh settings
- `src/store/journal.ts` — trade journal + daily risk lockout
- `src/store/settings.ts` — indicator settings (tunable inputs)
- `src/app/page.tsx` — Swing Friend dashboard
- `src/app/scalp/page.tsx` — Scalp Friend dashboard
- `src/app/api/bars/route.ts` — Yahoo Finance proxy + aggregation
- `src/components/` — all UI components (20+)

## Later list (parked)

- Discord/Telegram webhook alerts (push GO triggers + bias flips to phone)
- Session markers (RTH vs ETH shading on equity index charts)
- Trade journal auto-populate from Best Plays scanner
- Win rate by grade tracking (do A+ setups actually win more?)
- Backtest the scanner (replay 3 months of grades)
- Light theme toggle
- Chart drawing tools (trend lines, fib levels)
- Export chart as image

## Disclaimer

Educational tool only — not financial advice. Futures trading involves substantial risk of loss.