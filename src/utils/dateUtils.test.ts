import { describe, it, expect } from "vitest";
import { parseSheetDate } from "./dateUtils";

describe("parseSheetDate", () => {
  it("parses valid DSE formats with and without spaces", () => {
    const d1 = parseSheetDate("26Jan2026");
    expect(d1?.getFullYear()).toBe(2026);
    expect(d1?.getMonth()).toBe(0);
    expect(d1?.getDate()).toBe(26);

    const d2 = parseSheetDate("26 Jan 2026");
    expect(d2?.getFullYear()).toBe(2026);
    expect(d2?.getMonth()).toBe(0);
    expect(d2?.getDate()).toBe(26);

    const d3 = parseSheetDate("01Feb2026");
    expect(d3?.getFullYear()).toBe(2026);
    expect(d3?.getMonth()).toBe(1);
    expect(d3?.getDate()).toBe(1);

    const d4 = parseSheetDate("1 Mar 2026");
    expect(d4?.getFullYear()).toBe(2026);
    expect(d4?.getMonth()).toBe(2);
    expect(d4?.getDate()).toBe(1);
  });

  it("parses valid ISO format dates", () => {
    const d1 = parseSheetDate("2026-01-26");
    expect(d1).not.toBeNull();
    expect(d1?.toISOString().slice(0, 10)).toBe("2026-01-26");

    const d2 = parseSheetDate("2024-12-31");
    expect(d2).not.toBeNull();
    expect(d2?.toISOString().slice(0, 10)).toBe("2024-12-31");
  });

  it("handles whitespace around and within the date string", () => {
    const d = parseSheetDate("   26   Jan   2026   ");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(26);
  });

  it("returns null for empty, null, and undefined inputs", () => {
    expect(parseSheetDate(null)).toBeNull();
    expect(parseSheetDate(undefined)).toBeNull();
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("   ")).toBeNull();
  });

  it("returns null for invalid month names", () => {
    expect(parseSheetDate("26Foo2026")).toBeNull();
    expect(parseSheetDate("10Xyz2025")).toBeNull();
  });

  it("returns null for out-of-range days and non-leap year Feb 29", () => {
    expect(parseSheetDate("32Jan2026")).toBeNull();
    expect(parseSheetDate("00Jan2026")).toBeNull();
    expect(parseSheetDate("29Feb2025")).toBeNull(); // 2025 is not a leap year
  });

  it("correctly parses Feb 29 on leap years", () => {
    const d = parseSheetDate("29Feb2024");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(1);
    expect(d?.getDate()).toBe(29);
  });

  it("returns null for invalid year formats or non-date strings", () => {
    expect(parseSheetDate("26Jan26")).toBeNull();
    expect(parseSheetDate("random string")).toBeNull();
    expect(parseSheetDate("2026-99-99")).toBeNull();
  });
});
