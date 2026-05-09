# DSEasy – Claude Code Guidelines

## Branch Naming

Always branch off the latest `main` using this convention:

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feat/issue-<N>-<short-description>` | `feat/issue-4-ticker-comparison` |
| Bug fix | `fix/issue-<N>-<short-description>` | `fix/issue-12-volume-calc` |
| Other (docs, refactor, chore) | `chore/issue-<N>-<short-description>` | `chore/issue-7-docs-update` |

The short description should be kebab-case and summarise what the issue is about (2–3 words).

Never push directly to `main`.

## Commit Messages

Follow the same prefix convention:

```
feat(issue-3): add VWAP overlay to Ticker Trends chart
fix(issue-12): correct volume calculation for turnover chart
```

## Project Overview

- **Stack**: React + TypeScript, Chart.js (`react-chartjs-2`), Firebase Firestore
- **Entry**: `src/main.jsx` — registers Chart.js globals via `chartRegistry.js`
- **Main page**: `src/components/TickerTrends.tsx` — historical trends, indicators, overlays
- **Data**: `src/hooks/useMarketQuery.ts` — Firestore queries (`trends/{symbol}/dailyClosingHistory`)
- **Charting helpers**: `src/utils/chartTheme.ts`, `src/lib/chartRegistry.js`

## Indicators & Overlays Pattern

New overlays on the Close Price chart follow this pattern:

1. Add a `calculate<Indicator>` function near the top of `TickerTrends.tsx`
2. Define a config constant (key, label, color, borderDash)
3. Compute a `<indicator>ByDate` map via `useMemo` over `timeseriesData` (full history, not filtered window)
4. Inject a dataset inside `getMetricData("close", ...)` when the overlay is active
5. Add a toggle button to the Overlays row (already rendered from a combined array)
6. Toggle state lives in `activeOverlays` (persisted to `localStorage` as `dseasy_chart_overlays`)
