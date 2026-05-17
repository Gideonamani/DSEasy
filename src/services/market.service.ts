import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { MarketIndex, RawStockDoc } from "../types/market";

export interface AppConfig {
  availableDates?: string[];
  marketWatchDates?: string[];
}

export async function fetchAppConfig(): Promise<AppConfig | null> {
  const snapshot = await getDoc(doc(db, ...FirestorePaths.appConfig()));
  if (!snapshot.exists()) return null;
  return snapshot.data() as AppConfig;
}

export interface RawStockEntry {
  id: string;
  data: RawStockDoc;
}

export async function fetchDailyClosingStocks(date: string): Promise<RawStockEntry[]> {
  const snapshot = await getDocs(collection(db, ...FirestorePaths.dailyClosingStocks(date)));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    data: entry.data() as RawStockDoc,
  }));
}

export async function fetchTickerSymbols(): Promise<string[]> {
  const snapshot = await getDocs(collection(db, ...FirestorePaths.trends()));
  return snapshot.docs.map((entry) => entry.id);
}

export async function fetchTickerHistory(symbol: string): Promise<RawStockEntry[]> {
  const snapshot = await getDocs(collection(db, ...FirestorePaths.tickerHistory(symbol)));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    data: entry.data() as RawStockDoc,
  }));
}

export async function fetchMarketIndices(): Promise<MarketIndex[] | null> {
  const snapshot = await getDoc(doc(db, ...FirestorePaths.marketIndicesCurrent()));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as { data?: MarketIndex[] };
  return data.data ?? [];
}
