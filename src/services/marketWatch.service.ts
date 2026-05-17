import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { MarketWatchSnapshot } from "../types/market";

export async function fetchLatestSnapshot(date: string): Promise<MarketWatchSnapshot | null> {
  const ref = collection(db, ...FirestorePaths.marketWatchSnapshots(date));
  const q = query(ref, orderBy("capturedAt", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as MarketWatchSnapshot;
}

export async function fetchAllSnapshots(date: string): Promise<MarketWatchSnapshot[]> {
  const ref = collection(db, ...FirestorePaths.marketWatchSnapshots(date));
  const q = query(ref, orderBy("capturedAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MarketWatchSnapshot);
}
