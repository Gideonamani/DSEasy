import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { auth } from "../firebase";
import { queryClient } from "../lib/queryClient";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  User,
  UserCredential
} from "firebase/auth";

export interface AuthContextType {
  currentUser: User | null;
  loginWithGoogle: () => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function loginWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function signUpWithEmail(email: string, password: string, displayName: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    // Force a refresh so currentUser picks up the new displayName
    setCurrentUser({ ...credential.user, displayName });
  }

  function signInWithEmail(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email);
  }

  async function logout(): Promise<void> {
    await signOut(auth);
    queryClient.clear();
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user === null) {
        queryClient.clear();
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loginWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading && (
        <div className="loading-container" style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
          <Loader2 size={48} className="animate-spin" color="#6366f1" />
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
