import type { CorporateAction, StockData } from "../types/market";
import { parseMarketDate } from "./marketDates";

export interface SplitAdjustmentFactors {
  price: number;
  quantity: number;
}

const isActiveSplit = (
  action: CorporateAction,
  symbol: string,
  observationDate: string,
  asOfDate: string,
) =>
  action.status === "approved" &&
  action.ticker === symbol &&
  action.ratioNew > 0 &&
  action.ratioOld > 0 &&
  action.effectiveDate <= asOfDate &&
  observationDate < action.effectiveDate;

export const getDateInTimeZone = (
  date: Date,
  timeZone: string,
): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const getSplitAdjustmentFactors = (
  actions: CorporateAction[],
  symbol: string,
  observationDate: string,
  asOfDate: string,
): SplitAdjustmentFactors =>
  actions.reduce<SplitAdjustmentFactors>((factors, action) => {
    if (!isActiveSplit(action, symbol, observationDate, asOfDate)) {
      return factors;
    }
    return {
      price: factors.price * (action.ratioOld / action.ratioNew),
      quantity: factors.quantity * (action.ratioNew / action.ratioOld),
    };
  }, { price: 1, quantity: 1 });

const scale = (value: number | undefined, factor: number) =>
  value === undefined ? undefined : value * factor;

export const adjustStockDataForCorporateActions = <T extends StockData>(
  point: T,
  actions: CorporateAction[],
  asOfDate: string,
): T => {
  if (!point.date) return { ...point };
  const factors = getSplitAdjustmentFactors(
    actions,
    point.symbol,
    point.date,
    asOfDate,
  );
  if (factors.price === 1 && factors.quantity === 1) return { ...point };

  return {
    ...point,
    open: scale(point.open, factors.price),
    close: point.close * factors.price,
    high: scale(point.high, factors.price),
    low: scale(point.low, factors.price),
    prevClose: scale(point.prevClose, factors.price),
    change: point.change * factors.price,
    yearHigh: scale(point.yearHigh, factors.price),
    yearLow: scale(point.yearLow, factors.price),
    spread: scale(point.spread, factors.price),
    volume: scale(point.volume, factors.quantity),
    outstandingBid: scale(point.outstandingBid, factors.quantity),
    outstandingOffer: scale(point.outstandingOffer, factors.quantity),
    volDeal: scale(point.volDeal, factors.quantity),
    // changeVol is an Amihud illiquidity proxy (absolute price change per
    // share traded): both the price-change numerator and the volume
    // denominator scale, so the factor is price/quantity, not 1/quantity.
    changeVol: scale(point.changeVol, factors.price / factors.quantity),
  };
};

export const getCorporateActionsForSymbol = (
  actions: CorporateAction[],
  symbol: string,
) => actions
  .filter((action) => action.ticker === symbol && action.status !== "cancelled")
  .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

const addIsoDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const getVisibleSuspensionDates = (
  actions: CorporateAction[],
  symbol: string,
  asOfDate: string,
): string[] => {
  const dates = new Set<string>();
  for (const action of getCorporateActionsForSymbol(actions, symbol)) {
    if (!action.suspensionStart || !action.suspensionEnd) continue;
    if (action.suspensionStart > asOfDate) continue;
    for (
      let date = action.suspensionStart;
      date <= action.suspensionEnd && date <= asOfDate;
      date = addIsoDays(date, 1)
    ) {
      dates.add(date);
    }
  }
  return [...dates].sort();
};

export const insertSuspensionGaps = <T extends StockData>(
  data: T[],
  actions: CorporateAction[],
  symbol: string,
  asOfDate: string,
): T[] => {
  if (data.length < 2) return data;
  const timestamps = data
    .map((point) => parseMarketDate(point.date)?.getTime())
    .filter((value): value is number => value !== undefined);
  if (timestamps.length < 2) return data;

  const first = Math.min(...timestamps);
  const last = Math.max(...timestamps);
  const existingDates = new Set(data.map((point) => point.date));
  const gaps = getVisibleSuspensionDates(actions, symbol, asOfDate)
    .filter((date) => {
      const timestamp = parseMarketDate(date)?.getTime();
      return timestamp !== undefined &&
        timestamp >= first &&
        timestamp <= last &&
        !existingDates.has(date);
    })
    .map((date) => ({
      symbol,
      date,
      close: Number.NaN,
      change: Number.NaN,
    }) as T);

  return [...data, ...gaps].sort((a, b) =>
    (parseMarketDate(a.date)?.getTime() ?? 0) -
    (parseMarketDate(b.date)?.getTime() ?? 0),
  );
};
