# Feature: Optimize Page Load Times (Lighthouse recommendations)

## 1. Objective
Optimize the application load times by implementing key Lighthouse performance recommendations, including dynamic imports (code splitting), React lazy loading, bundle size reduction, asset compression, and optimizing fonts/icons.

## 2. Technical Approach
- **Dynamic Imports & Code Splitting**:
  - Implement React `lazy` and `Suspense` for heavy route components (e.g. `TickerTrends`, `CompareTickers`, `DerivedAnalytics`, `DailyGlance`, `Settings`).
  - Currently, all these components are imported statically in `App.tsx` or similar routing files.
  - Wrap these in `Suspense` with an elegant glassmorphic `Skeleton` loading state.
- **Bundle Optimization**:
  - Review `vite.config.js` to configure build-time chunks and split vendor libraries (like `react-chartjs-2`, `chart.js`, `lucide-react`, `firebase`).
- **Asset Optimization**:
  - Compress or lazy-load heavy media/assets in the `public` or `src/assets` directory.
  - Implement caching headers or offline caching using Service Workers if appropriate.
- **Icons & Font Optimization**:
  - Review if imports from `lucide-react` are using tree-shaking properly.
