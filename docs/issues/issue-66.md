# Feature: Compare Tickers Breakdown Matrix

## 1. Objective
Add a visual, responsive side-by-side comparison breakdown matrix inside `CompareTickers` to outline growth percentages and key statistics for selected tickers (2 to 3 symbols) across standard sub-periods (1W, 1M, 3M, 6M, 1Y) and the selected period.

## 2. Technical Approach
- Define a table or grid display under the price comparison chart.
- For each selected ticker, calculate:
  - Latest close price.
  - Percentage growth over standard periods: 1W, 1M, 3M, 6M, 1Y, and the active selected period.
  - Statistics for the selected period:
    - Peak growth (%) relative to the start of the period.
    - Lowest growth (%) relative to the start of the period.
    - Average 20-day rolling volatility in the selected period.
    - Average daily volume or average daily turnover.
- Present these metrics in a beautiful glassmorphic table or card matrix with:
  - Color-coded badges for growth (green for positive, red for negative).
  - Highlighting for the best-performing ticker in each row.
  - Interactive, hoverable rows with detailed tooltips or clean spacing.

## 3. Calculation Logic
For a given history `data` (sorted oldest to newest):
- `latestClose`: `data[data.length - 1].close`
- `growth(subPeriod)`:
  - Calculate date cutoff (e.g. `now - 7 days` for 1W).
  - Find the closest data point near the cutoff.
  - `startPrice = dataPoint.close`
  - `growth% = ((latestClose - startPrice) / startPrice) * 100`
- `selectedPeriodGrowth%`: Already computed as the last value of `values` in `chartData` or `((latestClose - startPrice) / startPrice) * 100` where `startPrice` is the first non-zero close in the selected period.
- `peakGrowth%`: Max of `((close - startPrice) / startPrice) * 100` for all closes in the filtered selected period.
- `troughGrowth%`: Min of `((close - startPrice) / startPrice) * 100` for all closes in the filtered selected period.
- `avgVolatility%`: Average of rolling volatility in the filtered selected period.
