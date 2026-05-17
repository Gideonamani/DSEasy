import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { Settings } from "../contexts/SettingsContext";

export async function fetchUserSettings(uid: string): Promise<Partial<Settings> | null> {
  const snap = await getDoc(doc(db, ...FirestorePaths.userSettings(uid)));
  if (!snap.exists()) return null;
  return snap.data() as Partial<Settings>;
}

export async function saveUserSettings(uid: string, settings: Settings): Promise<void> {
  await setDoc(
    doc(db, ...FirestorePaths.userSettings(uid)),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
