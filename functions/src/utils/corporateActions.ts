import type { CorporateAction } from "../types";

export function getSplitAdjustedValue(
  value: number,
  ticker: string,
  observationDate: string,
  asOfDate: string,
  actions: CorporateAction[],
): number {
  return actions.reduce((adjusted, action) => {
    if (
      action.status !== "approved" ||
      action.ticker !== ticker ||
      action.ratioNew <= 0 ||
      action.ratioOld <= 0 ||
      action.effectiveDate > asOfDate ||
      observationDate >= action.effectiveDate
    ) {
      return adjusted;
    }
    return adjusted * (action.ratioOld / action.ratioNew);
  }, value);
}

export function getDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = parts.reduce<{ [key: string]: string }>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${values.year}-${values.month}-${values.day}`;
}
