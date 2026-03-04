import { useQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

// Interface matching the flattened Firestore schema in marketWatch/{date}/snapshots/{timestamp}
export interface MarketWatchStock {
  marketPrice: number;
  openingPrice: number;
  change: number;
  bestBidPrice: number;
  bestBidQuantity: number;
  bestOfferPrice: number;
  bestOfferQuantity: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  minLimit: number;
  maxLimit: number;
  totalSharesIssued: number;
  companyDescription: string;
  marketSegment: string;
}

export interface MarketWatchSnapshot {
  capturedAt: string;
  stockCount: number;
  stocks: { [symbol: string]: MarketWatchStock };
  timestamp: any; // Firestore server timestamp
}

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
    queryFn: async () => {
      // Get the most recent snapshot by ordering capturedAt descending
      const snapshotsRef = collection(
        db,
        "marketWatch",
        dateStr,
        "snapshots"
      );
      const q = query(snapshotsRef, orderBy("capturedAt", "desc"), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) return null;

      const doc = snap.docs[0];
      return doc.data() as MarketWatchSnapshot;
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes during market hours
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
    queryFn: async () => {
      const snapshotsRef = collection(
        db,
        "marketWatch",
        dateStr,
        "snapshots"
      );
      const q = query(snapshotsRef, orderBy("capturedAt", "asc"));
      const snap = await getDocs(q);

      return snap.docs.map((doc) => doc.data() as MarketWatchSnapshot);
    },
    staleTime: 5 * 60 * 1000,
  });
}
