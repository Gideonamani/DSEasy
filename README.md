# DSEasy

**Making visualization of DSE listed-company performance easy.**

[Live Demo](https://ds-easy.vercel.app/)

DSEasy is a React dashboard for Dar es Salaam Stock Exchange (DSE) market
data. It turns Firestore market snapshots, ticker histories, derived metrics,
and notification settings into an interactive web app for market overview,
ticker trend analysis, comparisons, and alerts.

## What The App Does

- Shows a daily market overview with top gainers, top losers, volume, turnover,
  market cap, deals, listed symbols, and active symbols.
- Provides ticker trend charts with selectable date windows, technical
  overlays such as SMA and VWAP, RSI, and per-metric explanations.
- Compares tickers across normalized market metrics.
- Surfaces derived analytics and market-watch views from Firestore data.
- Supports authenticated alert/notification workflows through Firebase Auth,
  Firestore, FCM, and a shared PWA service worker.
- Builds as a Vite PWA and pre-renders static route shells for search/social
  metadata.

## Architecture

### Frontend

- **React + TypeScript**: `src/main.tsx` mounts the app and wires providers.
- **Routing**: `src/App.tsx` owns route selection, protected routes, and shared
  market summary calculations for dashboard routes.
- **Charts**: Chart.js globals are registered once in
  `src/lib/chartRegistry.ts`; reusable chart defaults live in
  `src/utils/chartTheme.ts`.
- **State and data fetching**: React Query handles Firestore reads through
  hooks in `src/hooks/useMarketQuery.ts`.
- **Shared market types**: Firestore and frontend shapes live in
  `src/types/market.ts`.

### Data Flow

The frontend reads from Firestore through `src/services/market.service.ts`.
Path construction is centralized in `src/services/firestorePaths.ts`.

Important collections/documents include:

- `config/app`: available dates and market-watch dates.
- `dailyClosing/{date}/stocks`: daily closing market rows.
- `trends/{symbol}/dailyClosingHistory`: ticker history used by trend charts.
- `marketIndices/current`: current market index summaries.
- user alert and FCM token paths used by notification services.

`useMarketQuery.ts` is the normalization boundary. The private `toStockData`
function maps raw Firestore document fields into the canonical `StockData`
shape consumed by components.

### PWA And Notifications

`vite-plugin-pwa` generates the app service worker. Firebase background
messaging is loaded through that generated worker using Workbox
`importScripts(['/firebase-messaging-sw.js'])`, and FCM token registration
reuses the existing service worker registration. Avoid registering
`/firebase-messaging-sw.js` directly from application startup, because a second
root-scope service worker can compete with the generated PWA worker.

## Key Files

- `src/components/Dashboard.tsx`: daily market overview.
- `src/components/TickerTrends.tsx`: ticker history, overlays, RSI, and trend
  chart presentation.
- `src/components/CompareTickers.tsx`: multi-symbol comparison.
- `src/components/NotificationsManager.tsx`: alert and notification UX.
- `src/hooks/useMarketQuery.ts`: Firestore query hooks and market data mapping.
- `src/utils/marketDates.ts`: DSE market date parsing, sorting, and trend
  period filtering.
- `functions/src`: Firebase Functions for scraper and market-intelligence
  workflows.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run verification before opening a PR:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```
