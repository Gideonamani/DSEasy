import { describe, expect, it } from "vitest";
import { normalizeMcap } from "./normalizeMcap";

describe("normalizeMcap", () => {
  it("returns 0 for null", () => {
    expect(normalizeMcap(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(normalizeMcap(undefined)).toBe(0);
  });

  it("returns 0 for an empty string", () => {
    expect(normalizeMcap("")).toBe(0);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(normalizeMcap("not-a-number")).toBe(0);
  });

  it("passes numeric input through unchanged", () => {
    expect(normalizeMcap(1234)).toBe(1234);
    expect(normalizeMcap(0)).toBe(0);
    expect(normalizeMcap(-42)).toBe(-42);
  });

  it("parses numeric strings", () => {
    expect(normalizeMcap("1234.56")).toBeCloseTo(1234.56, 10);
  });

  it("strips commas from formatted strings", () => {
    expect(normalizeMcap("1,234,567")).toBe(1234567);
    expect(normalizeMcap("1,234.56")).toBeCloseTo(1234.56, 10);
  });

  it("coerces boolean and object inputs to 0 when not numeric", () => {
    // Number(true) === 1, Number(false) === 0 — the helper documents that it
    // forwards `Number(...)`, so we pin those down to prevent regression.
    expect(normalizeMcap(true)).toBe(1);
    expect(normalizeMcap(false)).toBe(0);
    expect(normalizeMcap({})).toBe(0);
    expect(normalizeMcap([1, 2])).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(normalizeMcap(NaN)).toBe(0);
  });
});
