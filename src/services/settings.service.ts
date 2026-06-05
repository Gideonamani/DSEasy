import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { Settings } from "../contexts/SettingsContext";

export async function fetchUserSettings(uid: string): Promise<Partial<Settings> | null> {
  const snap = await getDoc(doc(db, ...FirestorePaths.userSettings(uid)));
  if (!snap.exists()) return null;
  return snap.data() as Partial<Settings>;
}

export async function saveUserSettings(uid: string, settings: Settings, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  return new Promise<void>((resolve, reject) => {
    let completed = false;
    const onAbort = () => {
      if (completed) return;
      completed = true;
      reject(new DOMException("The user aborted a request.", "AbortError"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    setDoc(
      doc(db, ...FirestorePaths.userSettings(uid)),
      { ...settings, updatedAt: serverTimestamp() },
      { merge: true },
    )
      .then(() => {
        if (completed) return;
        completed = true;
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve();
      })
      .catch((err) => {
        if (completed) return;
        completed = true;
        if (signal) signal.removeEventListener("abort", onAbort);
        reject(err);
      });
  });
}
