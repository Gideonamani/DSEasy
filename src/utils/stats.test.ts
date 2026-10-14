import { describe, it, expect } from "vitest";
import { calculateTickerStats } from "./stats";

describe("calculateTickerStats", () => {
  it("returns null for an empty array", () => {
    expect(calculateTickerStats([])).toBeNull();
  });

  it("handles a stock list with all zero close prices gracefully without returning Infinity", () => {
    const mockData = [
      { close: 0, volume: 100 },
      { close: 0, volume: 200 }
    ];
    const stats = calculateTickerStats(mockData);
    expect(stats).not.toBeNull();
    expect(stats?.high).toBe(0);
    expect(stats?.low).toBe(0);
  });

  it("calculates statistics correctly for valid historical entries", () => {
    const mockData = [
      { close: 100, volume: 1000 },
      { close: 120, volume: 2000 },
      { close: 110, volume: 1500 }
    ];
    const stats = calculateTickerStats(mockData);
    expect(stats).toEqual({
      latest: 110,
      high: 120,
      low: 100,
      periodChange: 10,
      avgVolume: 1500,
      dataPoints: 3
    });
  });
});
