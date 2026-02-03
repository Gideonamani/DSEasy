import { createContext, useContext, useState, useEffect } from "react";

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  theme: "dark", // 'dark' | 'light' | 'system'
  density: "comfortable", // 'comfortable' | 'compact'
  numberFormat: "abbreviated", // 'abbreviated' (10.5B) | 'full' (10,500,000,000)
  showCurrency: true, // true | false
  defaultChartRange: "1M", // '1W', '1M', '3M', '6M', '1Y', 'YTD', 'ALL'
};

export function SettingsProvider({ children }) {
  // Load from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
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
  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const value = {
    settings,
    updateSetting,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
