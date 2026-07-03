import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { FirestorePaths } from "./firestorePaths";

export interface UserProfile {
  isAdmin?: boolean;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, ...FirestorePaths.userProfile(uid)));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}
