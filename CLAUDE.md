# DSEasy – Claude Code Guidelines

## Branch Naming

Always branch off the latest `master` using this convention:

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feat/issue-<N>-<short-description>` | `feat/issue-4-ticker-comparison` |
| Bug fix | `fix/issue-<N>-<short-description>` | `fix/issue-12-volume-calc` |
| Other (docs, refactor, chore) | `chore/issue-<N>-<short-description>` | `chore/issue-7-docs-update` |

The short description should be kebab-case and summarise what the issue is about (2–3 words).

Never push directly to `master`.

## Commit Messages

Follow the same prefix convention:

```
feat(issue-3): add VWAP overlay to Ticker Trends chart
fix(issue-12): correct volume calculation for turnover chart
```

## Project Overview

- **Stack**: React + TypeScript (strict, no `allowJs`), Chart.js (`react-chartjs-2`), Firebase Firestore
- **Entry**: `src/main.tsx` — mounts React root; Chart.js globals registered via `src/lib/chartRegistry.ts`
- **Main page**: `src/components/TickerTrends.tsx` — historical trends, indicators, overlays
- **Data**: `src/hooks/useMarketQuery.ts` — Firestore queries (`trends/{symbol}/dailyClosingHistory`)
- **Shared types**: `src/types/market.ts` — canonical `RawStockDoc`, `StockData`, `MarketDate`, `MarketIndex`, `TrendDataPoint` — import from here, not from hooks
- **Env types**: `src/vite-env.d.ts` — declares all `VITE_FIREBASE_*` vars so `import.meta.env.*` is `string` (not `string | undefined`)
- **Charting helpers**: `src/utils/chartTheme.ts` (generic `getCommonChartOptions<T extends ChartType>`), `src/lib/chartRegistry.ts`

## Indicators & Overlays Pattern

New overlays on the Close Price chart follow this pattern:

1. Add a `calculate<Indicator>` function near the top of `TickerTrends.tsx`
2. Define a config constant (key, label, color, borderDash)
3. Compute a `<indicator>ByDate` map via `useMemo` over `timeseriesData` (full history, not filtered window)
4. Inject a dataset inside `getMetricData("close", ...)` when the overlay is active
5. Add a toggle button to the Overlays row (already rendered from a combined array)
6. Toggle state lives in `activeOverlays` (persisted to `localStorage` as `dseasy_chart_overlays`)
