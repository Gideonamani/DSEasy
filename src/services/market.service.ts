import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { MarketIndex, RawStockDoc } from "../types/market";

export interface AppConfig {
  availableDates?: string[];
  marketWatchDates?: string[];
}

export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const snapshot = await getDoc(doc(db, ...FirestorePaths.appConfig()));
    if (!snapshot.exists()) return null;
    return snapshot.data() as AppConfig;
  } catch (error) {
    console.error("fetchAppConfig failed:", error);
    throw new Error("Failed to retrieve application configuration. Please check your network connection.");
  }
}

export interface RawStockEntry {
  id: string;
  data: RawStockDoc;
}

export async function fetchDailyClosingStocks(date: string): Promise<RawStockEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, ...FirestorePaths.dailyClosingStocks(date)));
    return snapshot.docs.map((entry) => {
      const raw = entry.data();
      // Defensive check against missing or invalid close/open fields
      const data: RawStockDoc = {
        ...raw,
        close: typeof raw.close === "number" ? raw.close : 0,
        open: typeof raw.open === "number" ? raw.open : 0,
        date: raw.date || entry.id,
      } as RawStockDoc;
      return {
        id: entry.id,
        data,
      };
    });
  } catch (error) {
    console.error(`fetchDailyClosingStocks failed for date ${date}:`, error);
    throw new Error(`Failed to retrieve market closing data for ${date}. Please check your connection.`);
  }
}

export async function fetchTickerSymbols(): Promise<string[]> {
  try {
    const snapshot = await getDocs(collection(db, ...FirestorePaths.trends()));
    return snapshot.docs.map((entry) => entry.id);
  } catch (error) {
    console.error("fetchTickerSymbols failed:", error);
    throw new Error("Failed to retrieve stock ticker symbols. Please try again later.");
  }
}

export async function fetchTickerHistory(symbol: string): Promise<RawStockEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, ...FirestorePaths.tickerHistory(symbol)));
    return snapshot.docs.map((entry) => {
      const raw = entry.data();
      // Defensive check against missing or invalid close/open fields
      const data: RawStockDoc = {
        ...raw,
        close: typeof raw.close === "number" ? raw.close : 0,
        open: typeof raw.open === "number" ? raw.open : 0,
        date: raw.date || entry.id,
      } as RawStockDoc;
      return {
        id: entry.id,
        data,
      };
    });
  } catch (error) {
    console.error(`fetchTickerHistory failed for symbol ${symbol}:`, error);
    throw new Error(`Failed to retrieve price history for ${symbol}. Please try again later.`);
  }
}

export async function fetchMarketIndices(): Promise<MarketIndex[] | null> {
  try {
    const snapshot = await getDoc(doc(db, ...FirestorePaths.marketIndicesCurrent()));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as { data?: MarketIndex[] };
    return data.data ?? [];
  } catch (error) {
    console.error("fetchMarketIndices failed:", error);
    throw new Error("Failed to retrieve current market indices. Please try again later.");
  }
}
