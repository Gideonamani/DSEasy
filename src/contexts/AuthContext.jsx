import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, messaging, db } from "../firebase";
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { getToken } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Register the current device's FCM token under the user's profile.
 * This enables multi-device push notifications.
 * Fire-and-forget — errors are logged but don't block auth.
 */
async function registerFcmToken(user) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission not granted, skipping FCM token registration.");
      return;
    }

    const token = await getToken(messaging);
    if (!token) {
      console.warn("No FCM token received.");
      return;
    }

    // Use the token itself as the doc ID for natural deduplication
    const tokenRef = doc(db, "users", user.uid, "fcmTokens", token);
    await setDoc(tokenRef, {
      token,
      lastRefreshed: serverTimestamp(),
    }, { merge: true });

    console.log("FCM token registered for multi-device notifications.");
  } catch (err) {
    // Non-fatal: don't break the auth flow
    console.error("FCM token registration failed:", err);
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);

      // Register FCM token whenever a user is authenticated
      if (user) {
        registerFcmToken(user);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
