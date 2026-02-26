import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, messaging, db } from "../firebase";
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  User,
  UserCredential
} from "firebase/auth";
import { getToken } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export interface AuthContextType {
  currentUser: User | null;
  loginWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Register the current device's FCM token under the user's profile.
 * This enables multi-device push notifications.
 * Fire-and-forget — errors are logged but don't block auth.
 */
async function registerFcmToken(user: User): Promise<void> {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function loginWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  function logout(): Promise<void> {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setCurrentUser(user);
      setLoading(false);

      // Register FCM token whenever a user is authenticated
      if (user) {
        registerFcmToken(user);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
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
