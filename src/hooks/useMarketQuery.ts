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
import { parseMarketDate, toSortedMarketDates } from "../utils/marketDates";

export type { MarketDate, MarketIndex, StockData } from "../types/market";
export { normalizeMcap } from "../utils/normalizeMcap";

// config/app is written by the daily scraper and intraday handlers — at most
// a few times per trading day. Cache for 5 minutes and refetch on focus so an
// open tab picks up a new date without a hard reload.
const APP_CONFIG_STALE_TIME = 5 * 60 * 1000;

// Fetch available dates from config/app
export const useMarketDates = () => {
  return useQuery<AppConfig | null, Error, MarketDate[]>({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    select: (config) => toSortedMarketDates(config?.availableDates),
    staleTime: APP_CONFIG_STALE_TIME,
    refetchOnWindowFocus: "always",
  });
};

// Shares queryKey with useMarketDates — React Query deduplicates the network
// request; select runs client-side against the same cached snapshot.
export const useMarketWatchDates = () => {
  return useQuery<AppConfig | null, Error, MarketDate[]>({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    select: (config) => toSortedMarketDates(config?.marketWatchDates),
    staleTime: APP_CONFIG_STALE_TIME,
    refetchOnWindowFocus: "always",
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
        const dateA = parseMarketDate(a.date)?.getTime() || 0;
        const dateB = parseMarketDate(b.date)?.getTime() || 0;
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
