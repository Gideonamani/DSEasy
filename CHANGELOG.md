# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
