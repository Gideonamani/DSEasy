import React from "react";
import {
  Moon,
  Layout,
  Maximize,
  Hash,
  DollarSign,
  Info,
  Trash2,
  Home,
  Bell,
  Cloud,
  LucideIcon,
} from "lucide-react";
import { useSettings, Settings as SettingsType } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { CustomSelect } from "./CustomSelect";

// Global declaration for Vite injects
declare global {
  const __APP_VERSION__: string;
}

interface SettingOption {
  value: string;
  label: string;
}

interface SettingItemBase {
  id: keyof SettingsType | string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface SettingItemSelect extends SettingItemBase {
  type: "select" | "toggle_group";
  options: SettingOption[];
}

interface SettingItemSwitch extends SettingItemBase {
  type: "switch";
}

interface SettingItemAction extends SettingItemBase {
  type: "action";
  actionLabel: string;
  onClick: () => void;
  danger?: boolean;
}

type SettingItem = SettingItemSelect | SettingItemSwitch | SettingItemAction;

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export function Settings(): React.ReactElement {
  const { settings, updateSetting, resetSettings, isSyncing } = useSettings();
  const { currentUser } = useAuth();

  const sections: SettingSection[] = [
    {
      title: "Appearance",
      items: [
        {
          id: "theme",
          label: "Theme",
          icon: Moon,
          type: "select",
          options: [
            { value: "dark", label: "Dark Mode" },
            { value: "light", label: "Light Mode" },
            { value: "system", label: "System Default" },
          ],
        },
        {
          id: "density",
          label: "Data Density",
          icon: Layout,
          type: "toggle_group",
          options: [
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ],
        },
      ],
    },
    {
      title: "Navigation",
      items: [
        {
          id: "landingPage",
          label: "Default Landing Page",
          icon: Home,
          type: "select",
          options: [
            { value: "/", label: "Dashboard" },
            { value: "/glance", label: "Daily Glance" },
            { value: "/analytics", label: "Derived Analytics" },
            { value: "/trends", label: "Ticker Trends" },
            { value: "/compare", label: "Compare Tickers" },
            { value: "/notifications", label: "Notifications" },
          ],
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          id: "notificationsEnabled",
          label: "Price Alert Notifications",
          icon: Bell,
          description: "Push notifications when your alerts trigger",
          type: "switch",
        },
      ],
    },
    {
      title: "Data Formatting",
      items: [
        {
          id: "numberFormat",
          label: "Number Format",
          icon: Hash,
          type: "select",
          options: [
            { value: "abbreviated", label: "Abbreviated (10.5B)" },
            { value: "full", label: "Full (10,500,000)" },
          ],
        },
        {
          id: "showCurrency",
          label: "Show Currency Symbol (TZS)",
          icon: DollarSign,
          type: "switch",
        },
      ],
    },
    {
        title: "Charts",
        items: [
            {
                id: "defaultChartRange",
                label: "Default Range",
                icon: Maximize,
                type: "select",
                options: [
                    { value: "1W", label: "1 Week" },
                    { value: "1M", label: "1 Month" },
                    { value: "3M", label: "3 Months" },
                    { value: "6M", label: "6 Months" },
                    { value: "1Y", label: "1 Year" },
                    { value: "YTD", label: "Year to Date" },
                    { value: "ALL", label: "All Time" },
                ]
            }
        ]
    },
    {
      title: "System",
      items: [
        {
          id: "clearCache",
          label: "Clear Data Cache",
          icon: Trash2,
          type: "action",
          actionLabel: "Clear",
          onClick: () => {
            alert("Cache cleared (Simulated). Refreshing page...");
            window.location.reload();
          },
          danger: true,
        },
        {
            id: "reset",
            label: "Reset All Settings",
            icon: Info,
            type: "action",
            actionLabel: "Reset",
            onClick: () => {
                if(window.confirm("Are you sure you want to reset all settings to default?")) {
                    resetSettings();
                }
            }
        }
      ],
    },
  ];

  return (
    <div className="settings-container" style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "48px" }}>
      <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-2)" }}>
        Settings
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        Customize your DSEasy experience.
      </p>

      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-8)",
        }}
      >
        <Cloud size={16} />
        {currentUser
          ? isSyncing
            ? "Syncing your settings…"
            : "Synced to your account."
          : "Sign in to sync settings across devices."}
      </div>

      <div className="settings-sections" style={{ display: 'flex', flexDirection: 'column', gap: '32px'}}>
        {sections.map((section) => (
          <section key={section.title} className="glass-panel" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--glass-border)", background: "var(--bg-elevated)" }}>
                <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>{section.title}</h3>
            </div>
            <div className="settings-list">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--glass-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        padding: "10px",
                        background: "rgba(99, 102, 241, 0.1)",
                        borderRadius: "10px",
                        color: "var(--accent-primary)",
                        flexShrink: 0,
                      }}
                    >
                      <item.icon size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: "var(--font-medium)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                      {item.description && (
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "2px" }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{ flexShrink: 0 }}>
                    {item.type === "select" && (
                      <div style={{ width: "200px" }}>
                        <CustomSelect
                            value={String(settings[item.id as keyof SettingsType])}
                            options={item.options}
                            onChange={(newValue) => {
                              const key = item.id as keyof SettingsType;
                              const current = settings[key];
                              const coerced = typeof current === "number" ? Number(newValue) : newValue;
                              updateSetting(key, coerced as any);
                            }}
                        />
                      </div>
                    )}

                    {item.type === "toggle_group" && (
                        <div style={{ display: "flex", gap: "4px", background: "var(--bg-elevated)", padding: "4px", borderRadius: "8px" }}>
                            {item.options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => updateSetting(item.id as keyof SettingsType, opt.value as any)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: settings[item.id as keyof SettingsType] === opt.value ? "var(--accent-primary)" : "transparent",
                                        color: settings[item.id as keyof SettingsType] === opt.value ? "#fff" : "var(--text-secondary)",
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {item.type === "switch" && (
                      <button
                        onClick={() => updateSetting(item.id as keyof SettingsType, !settings[item.id as keyof SettingsType] as any)}
                        role="switch"
                        aria-checked={Boolean(settings[item.id as keyof SettingsType])}
                        aria-label={item.label}
                        style={{
                          width: "48px",
                          height: "28px",
                          borderRadius: "14px",
                          background: settings[item.id as keyof SettingsType] ? "var(--accent-success)" : "var(--bg-main)",
                          position: "relative",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.3s",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            left: settings[item.id as keyof SettingsType] ? "24px" : "4px",
                            width: "20px",
                            height: "20px",
                            background: "#fff",
                            borderRadius: "50%",
                            transition: "left 0.3s",
                            boxShadow: "var(--shadow-sm)"
                          }}
                        />
                      </button>
                    )}

                    {item.type === "action" && (
                        <button
                            onClick={item.onClick}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                background: item.danger ? "rgba(239, 68, 68, 0.1)" : "var(--bg-elevated)",
                                color: item.danger ? "var(--accent-danger)" : "var(--text-primary)",
                                border: "1px solid transparent",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: 500,
                                borderColor: item.danger ? "rgba(239, 68, 68, 0.2)" : "var(--glass-border)"
                            }}
                        >
                            {item.actionLabel}
                        </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      
    </div>
  );
}
