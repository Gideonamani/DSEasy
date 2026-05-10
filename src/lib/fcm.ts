import { User } from "firebase/auth";
import { deleteToken, getToken } from "firebase/messaging";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, messaging } from "../firebase";

/**
 * Register the current device's FCM token under the user's profile.
 * Returns the token if registration succeeded.
 */
export async function registerFcmToken(user: User): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }

    const token = await getToken(messaging);
    if (!token) return null;

    const tokenRef = doc(db, "users", user.uid, "fcmTokens", token);
    await setDoc(
      tokenRef,
      { token, lastRefreshed: serverTimestamp() },
      { merge: true },
    );
    return token;
  } catch (err) {
    console.error("FCM token registration failed:", err);
    return null;
  }
}

/**
 * Delete the current device's FCM token from Firestore and from the
 * messaging instance, so this device stops receiving pushes.
 */
export async function unregisterFcmToken(user: User): Promise<void> {
  try {
    const token = await getToken(messaging).catch(() => null);
    if (token) {
      await deleteDoc(doc(db, "users", user.uid, "fcmTokens", token)).catch(() => undefined);
      await deleteToken(messaging).catch(() => undefined);
    }
  } catch (err) {
    console.error("FCM token unregistration failed:", err);
  }
}
