import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { FirestorePaths } from "./firestorePaths";
import type { AlertDoc } from "../types/market";

export interface CreateAlertInput {
  symbol: string;
  targetPrice: number;
  condition: "ABOVE" | "BELOW";
}

export interface CreateAlertResult {
  success: boolean;
  error?: string;
}

export async function createAlert(input: CreateAlertInput): Promise<CreateAlertResult> {
  const fn = httpsCallable<CreateAlertInput, CreateAlertResult>(functions, "createAlert");
  const result = await fn(input);
  return result.data;
}

export interface UserAlertEntry {
  id: string;
  data: AlertDoc;
}

export function subscribeToUserAlerts(
  userId: string,
  onUpdate: (entries: UserAlertEntry[]) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  const ref = collection(db, ...FirestorePaths.alerts());
  const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onUpdate(
        snapshot.docs.map((d) => ({
          id: d.id,
          data: d.data() as AlertDoc,
        })),
      );
    },
    onError,
  );
}

export async function deleteAlert(alertId: string, currentUserId: string): Promise<void> {
  const docRef = doc(db, ...FirestorePaths.alert(alertId));
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Alert not found");
  }
  const data = docSnap.data() as AlertDoc;
  if (data.userId !== currentUserId) {
    throw new Error("Permission denied: You do not own this alert");
  }
  await deleteDoc(docRef);
}
