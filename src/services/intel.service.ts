import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { MarketIntel } from "../types/market";

export async function fetchMarketIntel(date: string): Promise<MarketIntel[]> {
  const ref = collection(db, ...FirestorePaths.marketWatchIntel(date));
  const q = query(ref, orderBy("capturedAt", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MarketIntel);
}
