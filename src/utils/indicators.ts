/**
 * Financial indicator calculations used by TickerTrends.
 *
 * All functions are pure and operate on aligned arrays of numeric series.
 * `null` / `undefined` / `NaN` entries are treated as missing data and
 * propagate to `null` outputs at the affected positions (or the entire
 * series for RSI, which cannot recover from a gap in its seed window).
 */

type MaybeNumber = number | null | undefined;

const isValid = (v: MaybeNumber): v is number =>
  v != null && !isNaN(v);

/**
 * Simple Moving Average over a fixed window.
 *
 * Returns `null` for the first `period - 1` positions (insufficient data) and
 * for any window that contains a missing value.
 */
export const calculateSMA = (
  closes: MaybeNumber[],
  period: number,
): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = closes[j];
      if (!isValid(v)) {
        valid = false;
        break;
      }
      sum += v;
    }
    result.push(valid ? sum / period : null);
  }
  return result;
};

/**
 * Wilder's Relative Strength Index.
 *
 * Uses a simple-average seed over the first `period` price changes, then
 * Wilder smoothing thereafter. Returns `null` for the first `period`
 * positions. If any of the seed-window values is missing the entire output
 * is `null` (the seed cannot be computed). After the seed, a missing value
 * yields a single `null` and continues with the prior averages.
 *
 * When `avgLoss` is zero the RSI is defined as 100 (no downward movement).
 */
export const calculateRSI = (
  closes: MaybeNumber[],
  period = 14,
): (number | null)[] => {
  const len = closes.length;
  if (len < period + 1) return Array(len).fill(null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (!isValid(prev) || !isValid(curr)) {
      return Array(len).fill(null);
    }
    const change = curr - prev;
    if (change >= 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  const result: (number | null)[] = Array(period).fill(null);
  const firstRS = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS));

  for (let i = period + 1; i < len; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (!isValid(prev) || !isValid(curr)) {
      result.push(null);
      continue;
    }
    const change = curr - prev;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }
  return result;
};

/**
 * Rolling Volume-Weighted Average Price over a trailing window.
 *
 * For each index i, sums `close * volume` across the trailing `period`
 * observations (or as many as exist from the start of the series) and
 * divides by the total volume. Observations with missing close, missing
 * volume, or non-positive volume are skipped. Returns `null` when no
 * usable volume exists in the window.
 */
export const calculateRollingVWAP = (
  closes: MaybeNumber[],
  volumes: MaybeNumber[],
  period: number,
): (number | null)[] => {
  return closes.map((_, i) => {
    const start = Math.max(0, i - period + 1);
    let pv = 0;
    let v = 0;
    for (let j = start; j <= i; j++) {
      const c = closes[j];
      const vol = volumes[j];
      if (isValid(c) && isValid(vol) && vol > 0) {
        pv += c * vol;
        v += vol;
      }
    }
    return v > 0 ? pv / v : null;
  });
};
