import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

export type LandingPage = "/" | "/glance" | "/analytics" | "/trends" | "/compare" | "/notifications";

export interface Settings {
  theme: "dark" | "light" | "system";
  density: "comfortable" | "compact";
  numberFormat: "abbreviated" | "full";
  showCurrency: boolean;
  defaultChartRange: "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";
  landingPage: LandingPage;
  notificationsEnabled: boolean;
}

export interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  isSyncing: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  density: "comfortable",
  numberFormat: "abbreviated",
  showCurrency: true,
  defaultChartRange: "1M",
  landingPage: "/",
  notificationsEnabled: true,
};

const STORAGE_KEY = "dseasy-settings";

function readLocalSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<Settings>(() => readLocalSettings());
  const [isSyncing, setIsSyncing] = useState(false);
  // Tracks the uid whose settings are currently loaded so we don't write
  // before reading on first sign-in.
  const loadedUidRef = useRef<string | null>(null);

  // Apply Theme Side-Effect
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", "light");
    }
  }, [settings.theme]);

  // Persist to localStorage on every change (works for both auth + anon users)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Load settings from Firestore on sign-in; reset tracking on sign-out
  useEffect(() => {
    if (!currentUser) {
      loadedUidRef.current = null;
      return;
    }

    let cancelled = false;
    setIsSyncing(true);

    (async () => {
      try {
        const ref = doc(db, "users", currentUser.uid, "profile", "settings");
        const snap = await getDoc(ref);
        if (cancelled) return;

        if (snap.exists()) {
          const remote = snap.data() as Partial<Settings>;
          setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...remote }));
        } else {
          // First-time login: seed Firestore with whatever the user has locally
          const local = readLocalSettings();
          await setDoc(ref, { ...local, updatedAt: serverTimestamp() });
        }
        loadedUidRef.current = currentUser.uid;
      } catch (err) {
        console.error("Failed to load settings from Firestore:", err);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Persist to Firestore when authenticated and settings change after load
  useEffect(() => {
    if (!currentUser) return;
    if (loadedUidRef.current !== currentUser.uid) return;

    const ref = doc(db, "users", currentUser.uid, "profile", "settings");
    setDoc(ref, { ...settings, updatedAt: serverTimestamp() }, { merge: true })
      .catch((err) => console.error("Failed to persist settings:", err));
  }, [settings, currentUser]);

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSetting, resetSettings, isSyncing }),
    [settings, updateSetting, resetSettings, isSyncing],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
