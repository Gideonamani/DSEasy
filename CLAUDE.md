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

## Merging PRs

Always ask before squash-merging a PR, regardless of commit count. Default to a regular merge or rebase unless I confirm squash.

## Commit Messages

Follow the same prefix convention:

```
feat(issue-3): add VWAP overlay to Ticker Trends chart
fix(issue-12): correct volume calculation for turnover chart
```
## GitHub CLI (`gh`) Guidelines

The agent sandbox environment pre-configures a placeholder `GITHUB_TOKEN`. To successfully run `gh` CLI commands (e.g., checking issues, tracking PRs) using the user's active local keyring, you must clear this placeholder variable before running the command:
*   **PowerShell (Windows)**: `$env:GITHUB_TOKEN = $null; gh <command>`
*   **Bash/Zsh (Unix)**: `GITHUB_TOKEN="" gh <command>`

## Development Hygiene & PR Workflow

For active code changes, we follow a strict branching, testing, and pull request workflow:
1.  **Dedicated Branches**: Always branch off the latest `master` using the convention:
    *   Features: `feat/issue-<N>-<short-description>`
    *   Bug Fixes: `fix/issue-<N>-<short-description>`
2.  **No Direct Commits to `master`**: All feature and bug work must be developed on branches and merged back into `master` via pull requests.
3.  **Strict Type & Lint Guards**: Before submitting any PR or staging code, run type and lint checks to prevent strict build errors:
    *   Type Check: `npx tsc --noEmit`
    *   Lint: `npm run lint`
4.  **Unit Testing**: If you write or modify core utilities (e.g. indicators, formatters, metrics), write matching unit tests under `src/utils/*.test.ts` and verify with:
    *   Test: `npm run test`
5.  **Atomic, Conventional Commits**: Commit changes in atomic units matching the Conventional Commit format (e.g., `fix(issue-54): resolve contrast in dark mode`).
6.  **Detailed PR Descriptions**: Always supply a detailed description of the changes made, verification results, and acceptance criteria in the final pull request.

## Project Overview

- **Stack**: React + TypeScript (strict, no `allowJs`), Chart.js (`react-chartjs-2`), Firebase Firestore
- **Entry**: `src/main.tsx` — mounts React root; Chart.js globals registered via `src/lib/chartRegistry.ts`
- **Main page**: `src/components/TickerTrends.tsx` — historical trends, indicators, overlays
- **Data**: `src/hooks/useMarketQuery.ts` — Firestore queries (`trends/{symbol}/dailyClosingHistory`). The private `toStockData(raw, symbol)` function is the single mapping point from `RawStockDoc` → `StockData`; all field renames happen there and nowhere else.

## Data conventions

**`StockData` field names** — canonical names follow the labels used in `TickerTrends` and `src/data/metricExplanations.ts` (e.g. `spread`, `bidOffer`, `turnoverPct`, `volDeal`). The raw Firestore names (e.g. `highLowSpread`, `bidOfferRatio`) live only in `RawStockDoc`. Never add a duplicate field to `StockData` that maps to the same raw value under a different name.

**`config/app` Firestore document** — `useMarketDates` and `useMarketWatchDates` share `queryKey: ["appConfig"]` so React Query issues one network request regardless of how many components call either hook. If you need a third field from this document, add it to the `AppConfig` interface in `useMarketQuery.ts` and supply a new `select` using the same key — do not create a separate `queryFn`.
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
