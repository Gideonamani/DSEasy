import { describe, expect, it } from "vitest";
import {
  calculateRSI,
  calculateRollingVWAP,
  calculateSMA,
} from "./indicators";

describe("calculateSMA", () => {
  it("returns null for positions before a full window is available", () => {
    const result = calculateSMA([1, 2, 3, 4, 5], 3);
    expect(result.slice(0, 2)).toEqual([null, null]);
  });

  it("computes the rolling mean once the window fills", () => {
    const result = calculateSMA([1, 2, 3, 4, 5], 3);
    // (1+2+3)/3 = 2, (2+3+4)/3 = 3, (3+4+5)/3 = 4
    expect(result.slice(2)).toEqual([2, 3, 4]);
  });

  it("returns null for windows that include a missing value", () => {
    const result = calculateSMA([1, 2, null, 4, 5, 6], 3);
    // Every window that overlaps index 2 (the null) is spoiled; the trailing
    // window [4, 5, 6] is clean -> mean 5.
    expect(result).toEqual([null, null, null, null, null, 5]);
  });

  it("treats undefined and NaN the same as null", () => {
    const result = calculateSMA([1, undefined, 3, NaN, 5, 6, 7], 3);
    expect(result).toEqual([null, null, null, null, null, null, 6]);
  });

  it("returns an empty array for empty input", () => {
    expect(calculateSMA([], 5)).toEqual([]);
  });

  it("returns all nulls when the series is shorter than the period", () => {
    expect(calculateSMA([1, 2], 5)).toEqual([null, null]);
  });

  it("handles a period of 1 as a passthrough", () => {
    expect(calculateSMA([5, 10, 15], 1)).toEqual([5, 10, 15]);
  });
});

describe("calculateRSI", () => {
  it("returns all nulls when the series is shorter than period + 1", () => {
    expect(calculateRSI([1, 2, 3], 14)).toEqual([null, null, null]);
  });

  it("returns 100 when there are no losses in the seed window", () => {
    // 15 strictly increasing closes -> avgLoss = 0 -> RSI = 100
    const closes = Array.from({ length: 15 }, (_, i) => i + 1);
    const result = calculateRSI(closes, 14);
    expect(result.slice(0, 14)).toEqual(Array(14).fill(null));
    expect(result[14]).toBe(100);
  });

  it("returns 0 when there are no gains in the seed window", () => {
    // 15 strictly decreasing closes -> avgGain = 0 -> RS = 0 -> RSI = 0
    const closes = Array.from({ length: 15 }, (_, i) => 15 - i);
    const result = calculateRSI(closes, 14);
    expect(result[14]).toBe(0);
  });

  it("computes ~50 for a perfectly alternating series", () => {
    // Alternating +1/-1 gives equal avgGain and avgLoss -> RS = 1 -> RSI = 50
    const closes: number[] = [];
    let v = 50;
    for (let i = 0; i < 30; i++) {
      closes.push(v);
      v += i % 2 === 0 ? 1 : -1;
    }
    const result = calculateRSI(closes, 14);
    // After the seed, the value should be very close to 50.
    expect(result[14]).toBeCloseTo(50, 5);
  });

  it("matches a hand-computed Wilder RSI for a known series", () => {
    // Classic Wilder example: 15 closes -> first RSI value at index 14.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
      45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
    ];
    const result = calculateRSI(closes, 14);
    // Reference value (Wilder smoothing, seeded on the first 14 changes).
    // Independently verified to ~2 decimal places.
    expect(result[14]).toBeCloseTo(70.46, 1);
  });

  it("returns all nulls when the seed window contains a gap", () => {
    const closes: (number | null)[] = Array(15).fill(1);
    closes[5] = null;
    expect(calculateRSI(closes, 14)).toEqual(Array(15).fill(null));
  });

  it("emits a single null for an isolated gap after the seed window", () => {
    const closes: (number | null)[] = Array.from({ length: 20 }, (_, i) => i + 1);
    // Drop a single observation past the seed; the entry at that index and
    // the next one (which depends on the dropped close as `prev`) are null,
    // and the remaining values resume as numbers.
    closes[17] = null;
    const result = calculateRSI(closes, 14);
    expect(result[16]).not.toBeNull();
    expect(result[17]).toBeNull();
    expect(result[18]).toBeNull();
    expect(result[19]).not.toBeNull();
  });

  it("uses the default period of 14 when none is supplied", () => {
    const closes = Array.from({ length: 16 }, (_, i) => i + 1);
    const withDefault = calculateRSI(closes);
    const explicit = calculateRSI(closes, 14);
    expect(withDefault).toEqual(explicit);
  });
});

describe("calculateRollingVWAP", () => {
  it("computes VWAP across the trailing window", () => {
    const closes = [10, 20, 30, 40];
    const volumes = [1, 1, 1, 1];
    const result = calculateRollingVWAP(closes, volumes, 2);
    // i=0: only one observation -> 10
    // i=1: (10*1 + 20*1) / 2 = 15
    // i=2: (20*1 + 30*1) / 2 = 25
    // i=3: (30*1 + 40*1) / 2 = 35
    expect(result).toEqual([10, 15, 25, 35]);
  });

  it("weights closes by volume", () => {
    const closes = [100, 110, 120];
    const volumes = [1, 9, 0];
    // Window of 3 at i=2: (100*1 + 110*9 + 120*0) / (1+9+0) = 1090/10 = 109
    const result = calculateRollingVWAP(closes, volumes, 3);
    expect(result[2]).toBeCloseTo(109, 10);
  });

  it("returns null when no usable volume exists in the window", () => {
    const closes = [10, 20, 30];
    const volumes = [0, 0, 0];
    expect(calculateRollingVWAP(closes, volumes, 3)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("skips entries with missing close, missing volume, or non-positive volume", () => {
    const closes = [10, null, 30, 40];
    const volumes: (number | null)[] = [1, 5, null, 2];
    // Window of 4 at i=3: only (10*1) and (40*2) are usable
    // -> (10 + 80) / 3 = 30
    const result = calculateRollingVWAP(closes, volumes, 4);
    expect(result[3]).toBeCloseTo(30, 10);
  });

  it("treats zero and negative volume as no contribution", () => {
    const closes = [10, 20];
    const volumes = [0, -5];
    expect(calculateRollingVWAP(closes, volumes, 2)).toEqual([null, null]);
  });
});
