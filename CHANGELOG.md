# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.7] - 2026-04-30

### Added

- **Google Sheets Integration**: Re-introduced `google-scripts/` with a new `LatestPrice.gs` script, enabling real-time Firestore price lookups directly within Google Spreadsheets via custom functions.
- **Price Lookup API**: Created a secure `getTickerPrice` Firebase Cloud Function with API key validation to serve live and closing market prices to external consumers.
- **Manual Sheet Refresh**: Implemented a "Refresh All Prices" menu in Google Sheets to force-update portfolio valuations.

## [1.2.6] - 2026-04-30

### Added

- **Context-Aware Scraping**: The `scrapeDSEAndWriteToFirestore` function now accepts a `context` parameter to distinguish between scheduled and manual runs, enabling more precise logging and alerting.

### Changed

- **Urgent Missing Data Alerts**: Upgraded final end-of-day missing data notifications to "🚨 FINAL ALERT" with explicit "MANUAL ACTION REQUIRED" instructions to ensure data integrity.
- **Intelligent Scraper Alerts**: Scheduled scraper failures now include a note indicating it's an automated hourly attempt that will retry, preventing unnecessary manual interventions.

## [1.2.5] - 2026-03-26

### Fixed

- **DSE SSL Bypass**: Implemented a temporary `https.Agent` workaround to bypass the expired SSL certificate on `dse.co.tz`, restoring automated scraping functionality.
- **Market Status Logic**: Refined `MarketStatusBanner` and `DailyGlance` to use `marketWatchDates` for more reliable market phase evaluation.

### Added

- **Scraper Error Notifications**: Integrated `sendScraperAlert()` (email alerts via nodemailer) into all core scraper and monitor catch blocks to prevent silent failures.

### Changed

- **Complete Modular Refactor**: Fully eliminated the 1700-line monolithic `functions/src/index.ts`. All logic is now cleanly separated into `handlers/` and `services/`, with `index.ts` serving as a lean barrel export file.
- **Intraday Logic Consolidation**: Extracted core monitor logic into a shared `runIntradayMonitor()` function and migrated `monitorClosingAuction` to the modular `monitorIntraday.ts` handler.

## [1.2.4] - 2026-03-17

### Added

- **Comparative Closing Intel**: The daily closing summary now compares the final two market snapshots (e.g., 16:00 vs 16:05) to pinpoint late-session price surges or drops.

### Changed

- **Clean Timeline UI**: Filtered out all intraday market snapshots captured after 16:00 EAT from the visual timeline to prevent distortion, while keeping 16:00 as the final intraday entry.

## [1.2.3] - 2026-03-17

### Added

- **Robust Timezone Handling**: Switched to `moment-timezone` in all scheduled functions to ensure reliable EAT (Africa/Dar_es_Salaam) time calculations regardless of server environment.

### Changed

- **Market Capture Boundaries**: Expanded the intraday monitor window to 16:07 EAT to ensure the 16:05 closing snapshots are reliably captured even during minor scheduling drifts.

## [1.2.2] - 2026-03-17

### Fixed

- **Closing Bell Intel Type**: Corrected the `intel` document `type` field from `"close"` to `"closing"` in the daily summary function to ensure proper rendering on the frontend.

### Changed

- **Closing Bell UI**: Refined the `DailyGlance` timeline to display only the `trendSummary` for closing bell items, removing redundant snapshot data and streamlining the end-of-day view.

## [1.2.1] - 2026-03-13

### Fixed

- **Daily Glance UI**: Added the formatted date (e.g., "13 Mar") to the "Last updated" time to prevent confusion.
- **Market Status Logic**: Fixed `MarketStatusBanner` logic which incorrectly evaluated the market as closed/holiday due to a timezone date formatting mismatch when live data was present.

## [1.2.0] - 2026-03-12

### Changed

- **Cloud Functions Refactor**: Modularized the monolithic `functions/src/index.ts` file by extracting configuration, types, utilities, scrapers, and individual Cloud Function handlers into dedicated directories. This drastically improves code maintainability and testability without changing existing behavior.

### Removed

- **Google AppScripts**: Deleted the legacy `google-scripts` directory as the application has fully migrated to Firebase Cloud Functions and no longer relies on Google Sheets triggers.

## [1.1.9] - 2026-03-12

- **Hybrid Context Banners**: Deployed `<MarketStatusBanner />` on the Dashboard and Daily Glance pages.
  - Dynamically educates users on why they are viewing historical data outside of active market hours (09:30–16:00).
  - Cross-promotes the Dashboard metrics and Daily Glance live views based on the current market phase.

## [1.1.8] - 2026-03-12
### Fixed

- **Market Intel Display Logic**: 
  - Hardcoded "09:30" as the official market open time in the latest trend insight instead of using the timestamp of the first daily snapshot, which could be misleading.
  - Removed the redundant "Closing Wrap-Up" text from the newly added pre-open intel cards, as yesterday's close is already summarized in the main paragraph.

## [1.1.7] - 2026-03-12
### Added

- **Pre-Open Market Intel**: Added a new scheduled function (09:25 EAT) to summarize the previous day's closing sentiment and top movers before the market opens.
- **Gap Detection**: Implemented gap detection logic on the first intraday snapshot to flag significant (≥2%) price differences between yesterday's close and today's open.

### Changed

- **Trend Clarity**: Clarified intraday trend wording to explicitly state "strongest intraday momentum" instead of "most significant mover".
- **Scraper Timetable**: Aligned intraday scraper time gates (09:30–16:00) and closing summary schedules (16:15) strictly to the official DSE continuous trading phase.

## [1.1.6] - 2026-03-11
### Added

- **Circuit Breaker Enhancements**: Upgraded the `DailyGlance` circuit breaker monitor to show Distance to Limit (DTL) percentages, `Locked (Max/Min)` status badges, glowing traffic light proximity indicators, and a Volumetric Pressure bar (bids vs offers ratio).
- **Trends Chart Persistence**: Added `localStorage` support in `TickerTrends` to persist user chart visibility preferences.

### Changed

- **Decluttered Trends UI**: `TickerTrends` now hides less commonly used charts by default for a cleaner initial rendering, allowing users to opt into them via the customize menu.
- **Handling Data Gaps**: Configured `Chart.js` to intelligently bridge `null` values over holiday/gap periods on `TickerTrends` rather than aggressively dipping to 0.

### Fixed

- **MCAP Labels Validation**: Ensured consistent display of `(B)` suffix logic outside of `TickerTrends` after full-number normalization in the backend backend data model.

## [1.1.5] - 2026-03-11

### Fixed

- **MCAP UI Labels**: Removed redundant `(B)` suffix from MCap column headers and chart labels in `MarketTable` and `TickerTrends` to reflect full-number storage.
- **Total Market Cap Math**: Fixed redundant `1e9` scaling in the dashboard summary that caused astronomical totals.

## [1.1.4] - 2026-03-11

### Added

- **Data Source Tagging**: Added `source: 'scraper'` identifier to all daily closing scraper writes in Cloud Functions, matching the existing `source: 'api'` on historical API records.
- **MCAP Normalization Script**: Created `scripts/normalize_mcap.cjs` — a one-time migration script developed to expand Bilion-denominated MCAP values to full numbers and backfill data lineage.

### Changed

- **Backend MCAP Uniformity**: All MCAP values in Firestore are now stored as full numbers. The scraper explicitly expands values before writing to ensure consistency across sources.
- **Simplified Frontend**: Streamlined the `normalizeMcap()` utility in `useMarketQuery.ts`, as backend data is now guaranteed to be uniform.

### Fixed

- **Legacy Date Cleanup**: Moved 34 old-format date documents (e.g. `20Jan2026`) from `dailyClosing` to `legacyDailyClosing`, ensuring the active collection only contains clean ISO-format (`YYYY-MM-DD`) date IDs. Cleaned `config/app.availableDates` accordingly.

## [1.1.3] - 2026-03-05

### Added

- **Historical Daily Glance**: Added a `DatePicker` inside the Daily Glance to enable users to view live order book snapshots for past market watch dates.
- **MarketWatch Dates Sync**: Implemented a backend update strategy where the `monitorIntradayMarket` Cloud Function adds successfully scraped dates to the `marketWatchDates` array in the `config/app` document.
- Created `useMarketWatchDates` frontend hook to fetch these dates directly from Firestore.

### Fixed

- Resolved "Encountered two children with the same key" React warnings inside the Market Timeline by formulating a unique combination key.

## [1.1.2] - 2026-03-05

### Fixed

- **Scroll Retention on Navigation**: Restored the standard SPA scroll-to-top behavior for menu navigations, while correctly preserving the exact scroll position on back/forward browser requests.

### Added

- **Daily Glance Protection**: The Daily Glance route (`/glance`) and its corresponding menu item have been restricted to authenticated users only. Unauthenticated visitors are presented with a gated 'Members Only' SignIn screen.

## [1.1.1] - 2026-03-05

### Added

- **Market Intel Timeline**: Implemented a rich, chronological backend-generated timeline on the Daily Glance page.
  - Snapshot summary paragraphs detailing market sentiment, demand/supply imbalances, and circuit breaker status.
  - Standalone **Latest Trend Insight** card with a "Fixed Open" comparison strategy anchored to the daily opening snapshot.
  - Visual timeline connectivity with nodes, vertical lines, and pulse animations for the current status.
- **Notable Movers Section**: Added a compact, high-signal table in Daily Glance showing the session's top percentage and absolute price movers.
- Added `useMarketIntel` hook to fetch chronological trend documents from Firestore.

### Changed

- Refactored `generateTrendIntel` Cloud Function to use a stable daily open reference point instead of a sliding window, providing a clearer market narrative ("Since the open at 09:30...").
- Enhanced backend trend messaging to handle "quiet/flat" market conditions more naturally.
- Moved all market summary logic from the frontend to the backend for better consistency and performance.

### Fixed

- Resolved an issue where market timeline was hidden due to missing Firestore read permissions for the `intel` subcollection.
- Handled potential UI loading/error states for the Market Intel feed with explicit error cards and ShieldAlert icons.

### Security

- Updated `firestore.rules` to allow public read access to `marketWatch/{date}/intel`.

### Chores

- Added deferred feature roadmap (anomaly flags, momentum score, watchlist integration) to `TODO.md`.

## [1.1.0] - 2026-03-04

### Added

- Developed **Daily Glance** live dashboard showcasing market sentiment, a bid/offer imbalance heatmap, circuit breaker position monitors, and a ranked deal finder.
- Added `useMarketWatch` React Query hook with 5-minute auto-refresh to fetch daily snapshots from Firestore.
- Added "Daily Glance" to sidebar navigation and registered the `/glance` application route.
- Integrated the new `api.dse.co.tz/api/market-data` endpoint within Cloud Functions to fetch richer live data containing market depth and limits.
- Made ticker symbols clickable within the Market Table to route users directly to ticker trends (from a previously unreleased commit).

### Changed

- Updated scheduled and HTTP Cloud Functions to store the new flattened data snapshots under the `marketWatch/{date}/snapshots/{timestamp}` collection in Firestore.

### Security

- Updated `firestore.rules` to grant public read-only access to the new `marketWatch` collection.

## [1.0.12] - 2026-03-04

### Changed

- Updated Dashboard "Top Gainer" and "Top Loser" logic to prioritize percentage changes over absolute price changes for more meaningful insights.

### Fixed

- Resolved `429 Too Many Requests` errors in Cloud Functions (`monitorIntradayMarket`, `scrapeDailyClosing`) caused by DSE rate-limiting GCP shared IP pools.
  - Added `fetchWithRetry()` helper with automatic retry and `retry-after` header parsing.
  - Spoofed browser-like HTTP headers (Chrome User-Agent, Sec-Fetch-\*) to avoid bot detection.
  - Added random jitter (1–30s) before API requests to reduce GCP IP collisions.

### Added

- Created `.agent/workflows/dvcp.md` — formalized DVCP workflow as a reusable workflow file.

## [1.0.11] - 2026-03-03

### Fixed

- Corrected a date formatting mismatch in `functions/src/index.ts` where `scrapeDailyClosing` used `DMMMYYYY` but checked against Firestore instances saved in ISO format `YYYY-MM-DD`. Updated to consistently use `YYYY-MM-DD`.

## [1.0.10] - 2026-03-01

### Changed

- Updated Dashboard `StatCard` components to use intuitive unique icons instead of generic squiggly lines.
- Anchored the app header to be sticky for better navigation.
- Fixed Total Market Cap formatting to correctly display Trillions instead of Thousands.

## [1.0.9] - 2026-03-01

### Added

- Created `MarketEmptyState` component to gracefully handle weekends and public holidays.
- Integrated empty state detection in `Dashboard` and `DerivedAnalytics`.
- Added automatic weekend detection and "Go to Previous Trading Day" navigation.
- Implemented deep-linking via URL query parameters (`?date=YYYY-MM-DD`).

### Changed

- Enhanced `DatePicker` with Year and Month dropdowns for efficient multi-year navigation.
- Synchronized selected date with URL as the single source of truth for market data.
- Improved `DatePicker` dark mode visibility for month/year dropdowns.
- **Migration**: Refactored `App.jsx` and hooks to support dynamic date selection from URL, moving away from local state for date management.
- **Migration**: Standardized `dailyClosingHistory` paths across the frontend to align with the database migration.

## [1.0.8] - 2026-03-01

### Changed

- Renamed Firestore subcollection `trends/{symbol}/history` to `trends/{symbol}/dailyClosingHistory` for clarity and to differentiate from future intraday/API history collections.
- Updated `functions/src/index.ts` scraper write path to use `dailyClosingHistory`.
- Updated `src/hooks/useMarketQuery.ts` frontend read path to use `dailyClosingHistory`.
- Updated `scripts/migrate.cjs` historical import write path to use `dailyClosingHistory`.
- Updated `firestore.rules` security rules to allow reads on `dailyClosingHistory`.

### Added

- Added `scripts/migrate_paths.cjs` — one-time Firestore path migration script that copied 976 historical documents across 30 stock symbols from the old `history` path to `dailyClosingHistory`, then deleted the originals.

## [1.0.7] - 2026-02-27

### Changed

- Updated `Layout` to link the header notification bell icon directly to the Notifications tab.

## [1.0.6] - 2026-02-27

### Changed

- Enhanced `AlertModal` success state to automatically close after 4 seconds.
- Added thousand separators (commas) to the Price Alert input field for better readability.
- Improved "Round to nearest 5 TZS" logic to immediately round the current input value when the checkbox is toggled.

## [1.0.5] - 2026-02-26

### Added

- Added an optional "Round to nearest 5 TZS" toggle in `AlertModal` for more precise/conventional price alerts.

## [1.0.4] - 2026-02-26

### Added

- Added quick-select preset price pills (-10%, -5%, +5%, +10%) in `AlertModal` for faster target price setting.
- Implemented a summary message in the success state of `AlertModal` to confirm alert details.
- Added a direct link to the Notifications page from the success modal.

### Changed

- Enhanced `AlertModal` to automatically set the initial target price to the current ticker price on open.
- Improved loading state feedback with dynamic button text and a descriptive sub-text during alert creation.
- Added input validation to prevent creating alerts with a target price of zero or less.

## [1.0.3] - 2026-02-26

### Fixed

- Resolved layout shifting (FOUC) causing the sidebar menu to rapidly jump between open and closed on initial page load.
- Repaired TS/Vite compilation errors (`tsconfig.node.json` input file conflicts and JSON missing configurations).
- Fixed rollup warnings during build by explicitly defining `manualChunks` to code-split vendor dependencies (React, Firebase, Charts, UI) to optimize performance.

## [1.0.2] - 2026-02-26

### Changed

- Updated Dashboard StatCard components to display percentage change instead of absolute close price for Top Gainer and Top Loser.
- Reworded absolute metric footers for Total Volume, Turnover, and Market Cap for better clarity.

## [1.0.1] - 2026-02-26

### Added

- Created this `CHANGELOG.md` to track project updates.

### Changed

- Updated `.agent/agent.md` to establish formal AI coding assistant workflows, conventional commits, versioning strategy, and deployment guidelines for Vercel/Firestore.
