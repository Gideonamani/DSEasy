import { useQuery } from "@tanstack/react-query";
import {
  fetchAppConfig,
  fetchDailyClosingStocks,
  fetchMarketIndices,
  fetchTickerHistory,
  fetchTickerSymbols,
  type AppConfig,
  type RawStockEntry,
} from "../services/market.service";
import type {
  MarketDate,
  MarketIndex,
  RawStockDoc,
  StockData,
} from "../types/market";
import { normalizeMcap } from "../utils/normalizeMcap";

export type { MarketDate, MarketIndex, StockData } from "../types/market";
export { normalizeMcap } from "../utils/normalizeMcap";

// Helper: Parse "26Jan2026" or "2024-01-26" -> Date Object
const parseSheetDate = (sheetName: string): Date | null => {
  if (!sheetName) return null;

  // Check for standard ISO YYYY-MM-DD date first
  if (/^\d{4}-\d{2}-\d{2}$/.test(sheetName)) {
    return new Date(sheetName);
  }

  const match = sheetName.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3]);

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return new Date(year, months[monthStr], day);
};

const toSortedMarketDates = (raw: string[] | undefined): MarketDate[] => {
  const dates: MarketDate[] = (raw ?? []).map((d) => ({
    sheetName: d,
    date: parseSheetDate(d),
  }));
  dates.sort((a, b) => {
    const dateA = a.date ? a.date.getTime() : 0;
    const dateB = b.date ? b.date.getTime() : 0;
    return dateB - dateA;
  });
  return dates;
};

// Fetch available dates from config/app
export const useMarketDates = () => {
  return useQuery<AppConfig | null, Error, MarketDate[]>({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    select: (config) => toSortedMarketDates(config?.availableDates),
  });
};

// Shares queryKey with useMarketDates — React Query deduplicates the network
// request; select runs client-side against the same cached snapshot.
export const useMarketWatchDates = () => {
  return useQuery<AppConfig | null, Error, MarketDate[]>({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    select: (config) => toSortedMarketDates(config?.marketWatchDates),
  });
};

// Map a raw Firestore stock doc to the frontend-friendly StockData shape.
const toStockData = (raw: RawStockDoc, symbol: string): StockData => {
  const open = raw.open ?? 0;
  const close = raw.close ?? 0;
  return {
    symbol,
    date: raw.date,
    open,
    close,
    high: raw.high,
    low: raw.low,
    volume: raw.volume,
    deals: raw.deals,
    turnover: raw.turnover,
    prevClose: raw.prevClose ?? 0,
    change: raw.ChangeAbs ?? close - open,
    originalChange: raw.change,
    pctChange:
      raw.ChangePer ??
      raw.changeValue ??
      (open > 0 ? ((close - open) / open) * 100 : 0),
    mcap: normalizeMcap(raw.mcap),
    outstandingBid: raw.outstandingBid ?? 0,
    outstandingOffer: raw.outstandingOffer ?? 0,
    turnoverPct: raw.turnoverPercent ?? 0,
    bidOffer: raw.bidOfferRatio ?? 0,
    yearHigh: raw.yearHigh ?? 0,
    yearLow: raw.yearLow ?? 0,
    spread: raw.highLowSpread ?? 0,
    turnoverMcap: raw.turnoverPerMcap ?? 0,
    volDeal: raw.volPerDeal ?? 0,
    turnoverDeal: raw.turnoverPerDeal ?? 0,
    changeVol: raw.changePerVol ?? 0,
  };
};

// Fetch daily closing data from dailyClosing/{date}/stocks
export const useMarketData = (date: string) => {
  return useQuery<StockData[]>({
    queryKey: ["marketData", date],
    queryFn: async () => {
      if (!date) return [];
      const entries: RawStockEntry[] = await fetchDailyClosingStocks(date);
      return entries.map((entry) => toStockData(entry.data, entry.id));
    },
    enabled: !!date,
    select: (data) => data.filter((item) => item.close > 0 && item.symbol !== "Total"),
  });
};

// Fetch all symbols from 'trends' collection
export const useTickerSymbols = () => {
  return useQuery<string[]>({
    queryKey: ["tickerSymbols"],
    queryFn: fetchTickerSymbols,
  });
};

export type TrendDataPoint = StockData & { date: string };

// Fetch history from trends/{symbol}/dailyClosingHistory
export const useTickerHistory = (symbol: string) => {
  return useQuery<TrendDataPoint[]>({
    queryKey: ["tickerHistory", symbol],
    queryFn: async () => {
      if (!symbol) return [];
      const entries: RawStockEntry[] = await fetchTickerHistory(symbol);
      return entries.map((entry) => {
        const result = toStockData(
          { ...entry.data, date: entry.data.date ?? entry.id },
          symbol,
        );
        return result as TrendDataPoint;
      });
    },
    enabled: !!symbol,
    staleTime: 1000 * 60 * 15,
    select: (data) => {
      return [...data].sort((a, b) => {
        const dateA = parseSheetDate(a.date)?.getTime() || 0;
        const dateB = parseSheetDate(b.date)?.getTime() || 0;
        return dateA - dateB;
      });
    },
  });
};

// Fetch current market indices
export const useMarketIndices = () => {
  return useQuery<MarketIndex[] | null>({
    queryKey: ["marketIndices"],
    queryFn: fetchMarketIndices,
    refetchInterval: 1000 * 60 * 15,
  });
};
