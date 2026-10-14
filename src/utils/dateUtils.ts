/**
 * Parses a date string in DSE format ("26Jan2026", "26 Jan 2026") or ISO format ("2026-01-26")
 * into a valid JS Date object, returning null for invalid inputs.
 */
export const parseSheetDate = (str: string | undefined | null): Date | null => {
  if (!str) return null;

  const trimmed = str.trim();

  // 1. Check for standard ISO YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Check for DSE DDMonYYYY format (whitespace-tolerant)
  const match = trimmed.match(/^(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3], 10);

  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  if (!(monthStr in months)) return null;

  const d = new Date(year, months[monthStr], day);

  // Verify date validity (prevents invalid days like 32Jan2026 or 29Feb on non-leap years from wrapping)
  if (d.getFullYear() !== year || d.getMonth() !== months[monthStr] || d.getDate() !== day) {
    return null;
  }

  return isNaN(d.getTime()) ? null : d;
};
