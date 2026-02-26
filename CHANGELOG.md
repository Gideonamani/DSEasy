# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
