import { describe, expect, it } from "vitest";
import {
  filterByTrendPeriod,
  parseMarketDate,
  toSortedMarketDates,
  toStartOfDay,
} from "./marketDates";

describe("parseMarketDate", () => {
  it("parses ISO dates", () => {
    expect(parseMarketDate("2026-01-26")?.toISOString().slice(0, 10)).toBe(
      "2026-01-26",
    );
  });

  it("parses sheet-style DSE dates", () => {
    const parsed = parseMarketDate("26Jan2026");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(26);
  });

  it("parses sheet-style dates with spaces", () => {
    const parsed = parseMarketDate("26 Jan 2026");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(26);
  });

  it("returns null for invalid dates", () => {
    expect(parseMarketDate("not-a-date")).toBeNull();
    expect(parseMarketDate("")).toBeNull();
  });
});

describe("toSortedMarketDates", () => {
  it("sorts valid dates newest first and keeps invalid entries last", () => {
    const result = toSortedMarketDates([
      "24Jan2026",
      "2026-01-26",
      "not-a-date",
      "25Jan2026",
    ]);

    expect(result.map((date) => date.sheetName)).toEqual([
      "2026-01-26",
      "25Jan2026",
      "24Jan2026",
      "not-a-date",
    ]);
  });
});

describe("filterByTrendPeriod", () => {
  const rows = [
    { date: "2025-12-31", close: 1 },
    { date: "01Jan2026", close: 2 },
    { date: "15Jan2026", close: 3 },
    { date: "not-a-date", close: 4 },
  ];

  it("filters custom ranges inclusively", () => {
    const result = filterByTrendPeriod(rows, "Custom", {
      start: new Date("2026-01-01"),
      end: new Date("2026-01-15"),
    });

    expect(result.map((row) => row.close)).toEqual([2, 3]);
  });

  it("filters relative periods from the supplied current date", () => {
    const result = filterByTrendPeriod(
      rows,
      "1M",
      { start: null, end: null },
      new Date("2026-01-31"),
    );

    expect(result.map((row) => row.close)).toEqual([1, 2, 3]);
  });

  it("returns all rows for ALL without reparsing", () => {
    expect(filterByTrendPeriod(rows, "ALL", { start: null, end: null })).toBe(
      rows,
    );
  });
});

describe("toStartOfDay", () => {
  it("normalizes a date without mutating the original", () => {
    const original = new Date("2026-01-26T12:34:56");
    const normalized = toStartOfDay(original);

    expect(normalized.getHours()).toBe(0);
    expect(original.getHours()).not.toBe(0);
  });
});
