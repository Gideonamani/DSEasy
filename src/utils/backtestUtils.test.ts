import { describe, expect, it } from "vitest";
import { StockData } from "../types/market";
import {
  buyAndHold,
  calculateMetrics,
  createMACrossoverStrategy,
  runBacktest,
  sma,
} from "./backtestUtils";

const makeSeries = (closes: number[]): StockData[] =>
  closes.map((close, i) => ({
    symbol: "TEST",
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    close,
    change: 0,
  }));

describe("sma", () => {
  it("returns null before a full window is available", () => {
    const result = sma(makeSeries([1, 2, 3, 4, 5]), 3);
    expect(result.slice(0, 2)).toEqual([null, null]);
  });

  it("computes the rolling mean once the window fills", () => {
    const result = sma(makeSeries([1, 2, 3, 4, 5]), 3);
    expect(result.slice(2)).toEqual([2, 3, 4]);
  });
});

describe("runBacktest", () => {
  it("returns the initial capital untouched when there is no data", () => {
    const strategy = createMACrossoverStrategy(2, 3);
    const result = runBacktest([], strategy, 1_000_000);
    expect(result.finalEquity).toBe(1_000_000);
    expect(result.trades).toEqual([]);
  });

  it("buys on a golden cross and sells on a death cross", () => {
    // Flat, then a sustained rise, then a sustained fall: forces the short
    // SMA to cross above the long SMA on the way up and back below on the
    // way down.
    const closes = [
      10, 10, 10, 10, 10, 10, 12, 14, 16, 18, 20, 18, 16, 14, 12, 10, 8, 6, 4,
      2,
    ];
    const data = makeSeries(closes);
    const strategy = createMACrossoverStrategy(2, 5);
    const result = runBacktest(data, strategy, 1_000_000);

    expect(result.trades).toEqual([
      expect.objectContaining({ date: "2026-01-07", action: "BUY" }),
      expect.objectContaining({ date: "2026-01-13", action: "SELL" }),
    ]);
    expect(result.equityCurve).toHaveLength(closes.length);
  });
});

describe("buyAndHold", () => {
  it("tracks the underlying price movement after entry fees", () => {
    const data = makeSeries([100, 110, 120]);
    const result = buyAndHold(data, 1_000_000);
    expect(result.trades).toHaveLength(1);
    expect(result.equityCurve[2].equity).toBeGreaterThan(
      result.equityCurve[0].equity,
    );
  });

  it("does not divide by zero when the first close is non-positive", () => {
    const data = makeSeries([0, 10, 20]);
    const result = buyAndHold(data, 1_000_000);
    expect(result.finalEquity).toBe(1_000_000);
  });
});

describe("calculateMetrics", () => {
  it("reports zeroed metrics for a flat or empty equity curve", () => {
    const metrics = calculateMetrics([]);
    expect(metrics.totalReturn).toBe("0.00%");
  });

  it("computes a positive total return for a rising equity curve", () => {
    const equityCurve = [
      { date: "2026-01-01", equity: 1_000_000 },
      { date: "2026-01-02", equity: 1_100_000 },
    ];
    const metrics = calculateMetrics(equityCurve);
    expect(parseFloat(metrics.totalReturn)).toBeCloseTo(10, 1);
  });
});
