import { describe, it, expect } from "vitest";
import { runDcaSimulation } from "./dcaCalculator";
import type { TrendDataPoint, DividendEntry } from "../types/market";

describe("dcaCalculator", () => {
  const mockHistory: TrendDataPoint[] = [
    { symbol: "CRDB", date: "2023-01-01", close: 100, open: 100, change: 0 },
    { symbol: "CRDB", date: "2023-02-01", close: 110, open: 110, change: 10 },
    { symbol: "CRDB", date: "2023-03-01", close: 120, open: 120, change: 10 },
    { symbol: "CRDB", date: "2023-04-01", close: 100, open: 100, change: -20 },
    { symbol: "CRDB", date: "2023-05-01", close: 100, open: 100, change: 0 },
    { symbol: "CRDB", date: "2023-06-01", close: 150, open: 150, change: 50 },
    { symbol: "CRDB", date: "2023-07-01", close: 200, open: 200, change: 50 },
  ];

  const mockDividends: DividendEntry[] = [
    {
      id: "div-1",
      data: {
        exDate: "2023-03-15",
        paymentDate: "2023-04-15",
        amount: 10,
        type: "Final",
      },
    },
  ];

  it("calculates basic dca without DRIP correctly", () => {
    // Invest 1000 monthly, horizon 0.5 years (6 months)
    // Starting on earliest date: 2023-01-01
    // Contribution dates: 2023-01-01, 2023-02-01, 2023-03-01, 2023-04-01, 2023-05-01, 2023-06-01, 2023-07-01
    // Let's run with DRIP disabled (reinvestDividends = false)
    const result = runDcaSimulation(
      mockHistory,
      mockDividends,
      1000,
      "monthly",
      1, // 1 year horizon will trigger projection because mockHistory is only 6 months, but let's see historical part
      false
    );

    expect(result.totalContributed).toBeGreaterThan(0);
    expect(result.totalSharesOwned).toBeGreaterThan(0);

    // Let's verify details on a small, precise step-by-step
    // Let's construct a smaller history that matches exactly the horizon so we don't project
    const histShort: TrendDataPoint[] = [
      { symbol: "CRDB", date: "2023-01-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-02-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-03-01", close: 100, open: 100, change: 0 },
    ];
    // Horizon: 0.16 years (approx 2 months)
    const resultShort = runDcaSimulation(histShort, [], 1000, "monthly", 0.16, false);
    // Contributions on:
    // 2023-01-01: Buy 1000 / 100 = 10 shares
    // 2023-02-01: Buy 1000 / 100 = 10 shares
    // 2023-03-01: Buy 1000 / 100 = 10 shares
    // Total shares = 30
    // Total contributed = 3000
    // Final value = 30 * 100 = 3000
    expect(resultShort.totalSharesOwned).toBeCloseTo(30);
    expect(resultShort.totalContributed).toBe(3000);
    expect(resultShort.finalValue).toBe(3000);
  });

  it("applies 5% withholding tax and reinvests dividends under DRIP correctly", () => {
    // 2023-01-01: buy 10 shares for 1000 TZS at price 100
    // 2023-02-01: buy 10 shares for 1000 TZS at price 100
    // 2023-03-01: buy 10 shares for 1000 TZS at price 100 (Total shares owned = 30)
    // 2023-03-15: dividend exDate. Shares owned = 30. Amount = 10 per share.
    //             Gross dividend = 30 * 10 = 300.
    //             Net dividend = 300 * 0.95 = 285.
    // 2023-04-01: buy 10 shares for 1000 TZS at price 100 (Total shares = 40)
    // 2023-04-15: dividend payment. DRIP reinvests 285 TZS at close price of 2023-04-15
    //             (since no price exists on 2023-04-15, we use closest on or after: 2023-05-01 price is 100)
    //             Shares bought from DRIP = 285 / 100 = 2.85 shares.
    //             Total shares owned = 42.85 shares.
    // 2023-05-01: buy 10 shares for 1000 TZS at price 100 (Total shares owned = 52.85)
    const history: TrendDataPoint[] = [
      { symbol: "CRDB", date: "2023-01-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-02-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-03-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-04-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-05-01", close: 100, open: 100, change: 0 },
    ];

    const resultDrip = runDcaSimulation(
      history,
      mockDividends,
      1000,
      "monthly",
      0.33, // approx 4 months
      true // Reinvest dividends (DRIP)
    );

    // Total Contributed = 5000 (Jan, Feb, Mar, Apr, May contributions of 1000 each)
    expect(resultDrip.totalContributed).toBe(5000);
    // Total dividends received = 30 * 10 * 0.95 = 285
    expect(resultDrip.totalDividends).toBe(285);
    // Total shares owned = 50 (from contributions) + 2.85 (from DRIP) = 52.85
    expect(resultDrip.totalSharesOwned).toBeCloseTo(52.85);
    expect(resultDrip.finalValue).toBeCloseTo(52.85 * 100);
  });

  it("accumulates cash balance when DRIP is disabled", () => {
    const history: TrendDataPoint[] = [
      { symbol: "CRDB", date: "2023-01-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-02-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-03-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-04-01", close: 100, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-05-01", close: 100, open: 100, change: 0 },
    ];

    const resultNoDrip = runDcaSimulation(
      history,
      mockDividends,
      1000,
      "monthly",
      0.33,
      false // DRIP disabled
    );

    // Total shares = 50 (no drip reinvestment)
    expect(resultNoDrip.totalSharesOwned).toBeCloseTo(50);
    // Cash balance should have the 285 dividend
    const lastStep = resultNoDrip.timeline[resultNoDrip.timeline.length - 1];
    expect(lastStep.cashBalance).toBe(285);
    expect(resultNoDrip.finalValue).toBeCloseTo(50 * 100 + 285);
  });

  it("handles corrupted or NaN dividend fields gracefully without silent cascades", () => {
    const corruptedDividends: DividendEntry[] = [
      {
        id: "div-1",
        data: {
          exDate: "2023-03-15",
          paymentDate: "2023-04-15",
          amount: NaN,
        },
      },
      {
        id: "div-2",
        data: {
          exDate: "2023-04-15",
          paymentDate: "2023-05-15",
          amount: undefined as any,
        },
      },
      {
        id: "div-3",
        data: {
          exDate: "2023-05-15",
          paymentDate: "2023-06-15",
          amount: "invalid-number" as any,
        },
      },
    ];

    const result = runDcaSimulation(
      mockHistory,
      corruptedDividends,
      1000,
      "monthly",
      1,
      true
    );

    expect(Number.isNaN(result.totalDividends)).toBe(false);
    expect(Number.isFinite(result.totalDividends)).toBe(true);
    expect(result.totalDividends).toBe(0);

    expect(Number.isNaN(result.yieldOnCost)).toBe(false);
    expect(Number.isFinite(result.yieldOnCost)).toBe(true);

    expect(Number.isNaN(result.finalValue)).toBe(false);
    expect(Number.isFinite(result.finalValue)).toBe(true);

    expect(Number.isNaN(result.divYieldUsed)).toBe(false);
    expect(Number.isFinite(result.divYieldUsed)).toBe(true);
  });

  it("handles zero or non-positive close prices gracefully without division-by-zero or NaN output", () => {
    const zeroPriceHistory: TrendDataPoint[] = [
      { symbol: "CRDB", date: "2023-01-01", close: 0, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-02-01", close: -5, open: 100, change: 0 },
      { symbol: "CRDB", date: "2023-03-01", close: 100, open: 100, change: 0 },
    ];

    const result = runDcaSimulation(
      zeroPriceHistory,
      [],
      1000,
      "monthly",
      0.16,
      false
    );

    expect(Number.isNaN(result.totalContributed)).toBe(false);
    expect(Number.isFinite(result.totalContributed)).toBe(true);
    expect(Number.isNaN(result.totalSharesOwned)).toBe(false);
    expect(Number.isFinite(result.totalSharesOwned)).toBe(true);
    // Shares bought on Jan/Feb should be 0 instead of Infinity/NaN
    // Shares bought on Mar should be 1000 / 100 = 10
    expect(result.totalSharesOwned).toBe(10);
    expect(result.finalValue).toBe(1000);
  });
});
