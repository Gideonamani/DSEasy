import { describe, expect, it } from "vitest";
import { formatLargeNumber, formatNumber } from "./formatters";

describe("formatNumber", () => {
  it('returns "-" for null', () => {
    expect(formatNumber(null)).toBe("-");
  });

  it('returns "-" for undefined', () => {
    expect(formatNumber(undefined)).toBe("-");
  });

  it('returns "-" when called with no argument', () => {
    expect(formatNumber()).toBe("-");
  });

  it("formats zero as a numeric string, not a dash", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("groups thousands using toLocaleString", () => {
    // Compare against the platform's own locale grouping so the test stays
    // stable across CI locales.
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString());
  });

  it("forwards Intl.NumberFormat options", () => {
    const result = formatNumber(1234.5, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(result).toBe(
      (1234.5).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  });

  it("handles negative numbers", () => {
    expect(formatNumber(-42)).toBe((-42).toLocaleString());
  });
});

describe("formatLargeNumber", () => {
  it('returns "-" for null', () => {
    expect(formatLargeNumber(null)).toBe("-");
  });

  it('returns "-" for undefined', () => {
    expect(formatLargeNumber(undefined)).toBe("-");
  });

  it("formats zero through toLocaleString (below the K threshold)", () => {
    expect(formatLargeNumber(0)).toBe((0).toLocaleString());
  });

  it("uses K suffix at the thousand scale", () => {
    expect(formatLargeNumber(1_500)).toBe("1.50K");
  });

  it("uses M suffix at the million scale", () => {
    expect(formatLargeNumber(2_500_000)).toBe("2.50M");
  });

  it("uses B suffix at the billion scale", () => {
    expect(formatLargeNumber(3_750_000_000)).toBe("3.75B");
  });

  it("uses T suffix at the trillion scale", () => {
    expect(formatLargeNumber(4_200_000_000_000)).toBe("4.20T");
  });

  it("spells out the suffix when requested", () => {
    expect(formatLargeNumber(1_500, true)).toBe("1.50 Thousand");
    expect(formatLargeNumber(2_500_000, true)).toBe("2.50 Million");
    expect(formatLargeNumber(3_750_000_000, true)).toBe("3.75 Billion");
    expect(formatLargeNumber(4_200_000_000_000, true)).toBe("4.20 Trillion");
  });

  it("handles negative numbers by suffix-scaling the magnitude", () => {
    expect(formatLargeNumber(-2_500_000)).toBe("-2.50M");
  });

  it("falls back to toLocaleString for values below 1,000", () => {
    expect(formatLargeNumber(999)).toBe((999).toLocaleString());
  });
});
