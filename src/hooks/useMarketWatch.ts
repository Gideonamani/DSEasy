import { useQuery } from "@tanstack/react-query";
import {
  fetchAllSnapshots,
  fetchLatestSnapshot,
} from "../services/marketWatch.service";
import { fetchMarketIntel } from "../services/intel.service";
import type {
  MarketIntel,
  MarketWatchSnapshot,
  MarketWatchStock,
} from "../types/market";

export type { MarketIntel, MarketWatchSnapshot, MarketWatchStock };

/**
 * Get today's date string in YYYY-MM-DD format (EAT timezone)
 */
function getTodayDateStr(): string {
  const now = new Date();
  // Force EAT timezone
  const eatStr = now.toLocaleDateString("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
  }); // en-CA gives YYYY-MM-DD
  return eatStr;
}

/**
 * Fetch the latest (most recent) snapshot for a given date.
 * If no date provided, defaults to today (EAT).
 */
export function useLatestSnapshot(date?: string) {
  const dateStr = date || getTodayDateStr();

  return useQuery<MarketWatchSnapshot | null>({
    queryKey: ["marketWatch", "latest", dateStr],
    queryFn: () => fetchLatestSnapshot(dateStr),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch all snapshots for a given date (for timeline/comparison).
 */
export function useAllSnapshots(date?: string) {
  const dateStr = date || getTodayDateStr();

  return useQuery<MarketWatchSnapshot[]>({
    queryKey: ["marketWatch", "all", dateStr],
    queryFn: () => fetchAllSnapshots(dateStr),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all market intels for a given date.
 */
export function useMarketIntel(date?: string) {
  const dateStr = date || getTodayDateStr();

  return useQuery<MarketIntel[]>({
    queryKey: ["marketWatch", "intel", dateStr],
    queryFn: () => fetchMarketIntel(dateStr),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
