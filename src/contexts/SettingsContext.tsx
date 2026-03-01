import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export interface Settings {
  theme: "dark" | "light" | "system";
  density: "comfortable" | "compact";
  numberFormat: "abbreviated" | "full";
  showCurrency: boolean;
  defaultChartRange: "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";
}

export interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: "dark", 
  density: "comfortable", 
  numberFormat: "abbreviated", 
  showCurrency: true, 
  defaultChartRange: "1M", 
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Load from localStorage or use defaults
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem("dseasy-settings");
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return DEFAULT_SETTINGS;
  });

  // Apply Theme Side-Effect
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      // Remove data-theme to fallback to default (dark) variables in :root
      root.removeAttribute("data-theme");
    } else {
      // Set data-theme="light" to activate light mode overrides
      root.setAttribute("data-theme", "light");
    }
  }, [settings.theme]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("dseasy-settings", JSON.stringify(settings));
  }, [settings]);

  // Update a single setting
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const value = useMemo(() => ({
    settings,
    updateSetting,
    resetSettings,
  }), [settings]);

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
