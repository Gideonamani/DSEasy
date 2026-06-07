import { User } from "firebase/auth";
import { deleteToken, getToken } from "firebase/messaging";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, messaging } from "../firebase";
import { FirestorePaths } from "./firestorePaths";

/**
 * Resolve the app's existing (vite-plugin-pwa / workbox) service worker so
 * Firebase Messaging reuses it instead of registering its own
 * `/firebase-messaging-sw.js`. Two workers at scope "/" otherwise keep
 * replacing each other, which breaks token registration and leaves the PWA
 * stuck endlessly showing "Update Available". The workbox worker already
 * handles background messages via `importScripts(['/firebase-messaging-sw.js'])`.
 */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

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

    const serviceWorkerRegistration = await getSwRegistration();
    const token = await getToken(
      messaging,
      serviceWorkerRegistration ? { serviceWorkerRegistration } : undefined,
    );
    if (!token) return null;

    await setDoc(
      doc(db, ...FirestorePaths.userFcmToken(user.uid, token)),
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
    const serviceWorkerRegistration = await getSwRegistration();
    const token = await getToken(
      messaging,
      serviceWorkerRegistration ? { serviceWorkerRegistration } : undefined,
    ).catch(() => null);
    if (token) {
      await deleteDoc(doc(db, ...FirestorePaths.userFcmToken(user.uid, token))).catch(
        () => undefined,
      );
      await deleteToken(messaging).catch(() => undefined);
    }
  } catch (err) {
    console.error("FCM token unregistration failed:", err);
  }
}
