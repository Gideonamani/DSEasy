# Project TODO List

## Financial Logic Improvements

- [ ] **Moving Averages (SMA/EMA)**: Implement 20/50-day Simple Moving Average overlay on Price Action chart.
- [ ] **Relative Strength Index (RSI)**: Add RSI (14-day) indicator chart to Ticker Trends.
- [ ] **VWAP**: Calculate and display Volume Weighted Average Price.
- [ ] **Comparative Performance**: Enable multi-symbol comparison on the same chart (normalized %).

## User Experience & Features

- [ ] **Better Loading Experience**: Improve initial load states and transitions.
- [ ] **User Authentication**: Implement real user login and remove the placeholder "Keon Top Trader".
- [ ] **PWA & Notifications**: Investigate and implement Progressive Web App capabilities and push notifications.
- [ ] **Settings Menu**: Explore and define functionality for the settings menu.

## Backlog

- [ ] Refactor API calls to use a dedicated service layer.
- [ ] Add unit tests for financial calculations.
- [ ] Type Safety: Missing Type System: Major. No TypeScript or PropTypes used, creating "Scalability Debt" as the team grows and interfaces evolve invisibly.
- [ ] **Footer**: Implement a consistent footer across all pages.
- [ ] **Alert Tabs**: Create UI components for managing user alerts.
- [ ] **Firebase Migration**: Transition the application backend and auth to Firebase.
- [ ] **Dark Mode**: Update dark mode color consistency for Trends symbols dropdown picker.
- [ ] **Level 2 Insights**: Develop more detailed Level 2 market data visualizations.

## Daily Glance Intel Innovations (Deferred)

- [ ] **Anomaly Flags**: Backend should detect and flag unusual intraday events — e.g. a stock's bid volume jumping 10x vs its own daily average — and embed them in the intel summary text.
- [ ] **Market Momentum Score**: Compute a scalar score (-100 to +100) per scrape cycle based on weighted up/down count and volume side pressure. Store alongside intel docs. Render as a sparkline gauge on the Glance page.
- [ ] **Watchlist Integration**: When generating trend intel, check if any stocks in a user's watchlist are notable (big movers, circuit breaker near, order book imbalance) and surface a separate personalised intel paragraph.
