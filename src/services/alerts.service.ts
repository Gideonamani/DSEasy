import {
  collection,
  deleteDoc,
  doc,
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

export async function deleteAlert(alertId: string): Promise<void> {
  await deleteDoc(doc(db, ...FirestorePaths.alert(alertId)));
}
