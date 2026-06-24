import type { MarketDate } from "../types/market";

const MONTHS: Record<string, number> = {
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

export type TrendPeriod = "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL" | "Custom";

export interface CustomDateRange {
  start: Date | null;
  end: Date | null;
}

export function parseMarketDate(value: string | undefined): Date | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value);
  }

  const match = value.match(/^(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})$/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number.parseInt(match[3], 10);
  if (month === undefined) return null;

  return new Date(year, month, day);
}

export function toStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function toSortedMarketDates(raw: string[] | undefined): MarketDate[] {
  const dates: MarketDate[] = (raw ?? []).map((sheetName) => ({
    sheetName,
    date: parseMarketDate(sheetName),
  }));
  dates.sort((a, b) => {
    const dateA = a.date ? a.date.getTime() : 0;
    const dateB = b.date ? b.date.getTime() : 0;
    return dateB - dateA;
  });
  return dates;
}

export function filterByTrendPeriod<T extends { date?: string }>(
  data: T[],
  period: TrendPeriod,
  customRange: CustomDateRange,
  now: Date = new Date(),
): T[] {
  if (!data.length || period === "ALL") return data;

  if (period === "Custom") {
    const startDay = customRange.start ? toStartOfDay(customRange.start) : null;
    const endDay = customRange.end ? toStartOfDay(customRange.end) : null;
    return data.filter((item) => {
      const parsedDate = parseMarketDate(item.date);
      if (!parsedDate) {
        // Unparseable rows pass when no bound rejects them, matching the
        // original inline filter so a Custom view with no dates set still
        // shows everything.
        return !startDay && !endDay;
      }
      const itemDate = toStartOfDay(parsedDate);

      if (startDay && itemDate < startDay) return false;
      if (endDay && itemDate > endDay) return false;
      return true;
    });
  }

  const cutoffDate = toStartOfDay(now);

  switch (period) {
    case "1W":
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      break;
    case "1M":
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      break;
    case "3M":
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      break;
    case "6M":
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      break;
    case "1Y":
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      break;
    case "5Y":
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
      break;
  }

  return data.filter((item) => {
    const parsedDate = parseMarketDate(item.date);
    return parsedDate ? toStartOfDay(parsedDate) >= cutoffDate : false;
  });
}
