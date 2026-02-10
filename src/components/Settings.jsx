import {
  Moon,
  Sun,
  Monitor,
  Layout,
  Maximize,
  Hash,
  DollarSign,
  Info,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { CustomSelect } from "./CustomSelect";

export function Settings() {
  const { settings, updateSetting, resetSettings } = useSettings();

  const sections = [
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
      title: "Data Formatting",
      items: [
        {
          id: "numberFormat",
          label: "Number Format",
          icon: Hash,
          description: "Choose how large numbers are displayed",
          type: "select",
          options: [
            { value: "abbreviated", label: "Abbreviated (10.5B)" },
            { value: "full", label: "Full (10,500,000)" },
          ],
        },
        {
          id: "showCurrency",
          label: "Show Currency Symbol",
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
            // Placeholder for cache clearing logic if we implement service workers or persistent data
            alert("Cache cleared (Simulated). Refreshing page...");
            window.location.reload();
          },
          danger: true,
        },
        {
            id: "reset",
            label: "Reset All Settings",
            icon: Info, // Generic icon
            type: "action",
            actionLabel: "Reset",
            onClick: () => {
                if(confirm("Are you sure you want to reset all settings to default?")) {
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
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Customize your DSEasy experience.
      </p>

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
                    justifyContent: "space-between",
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--glass-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      style={{
                        padding: "10px",
                        background: "rgba(99, 102, 241, 0.1)",
                        borderRadius: "10px",
                        color: "var(--accent-primary)",
                      }}
                    >
                      <item.icon size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: "var(--font-medium)" }}>{item.label}</div>
                      {item.description && (
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "4px" }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div>
                    {item.type === "select" && (
                      <div style={{ width: "200px" }}>
                        <CustomSelect
                            value={settings[item.id]}
                            options={item.options}
                            onChange={(newValue) => updateSetting(item.id, newValue)}
                        />
                      </div>
                    )}

                    {item.type === "toggle_group" && (
                        <div style={{ display: "flex", gap: "4px", background: "var(--bg-elevated)", padding: "4px", borderRadius: "8px" }}>
                            {item.options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => updateSetting(item.id, opt.value)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: settings[item.id] === opt.value ? "var(--accent-primary)" : "transparent",
                                        color: settings[item.id] === opt.value ? "#fff" : "var(--text-secondary)",
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
                        onClick={() => updateSetting(item.id, !settings[item.id])}
                        style={{
                          width: "48px",
                          height: "28px",
                          borderRadius: "14px",
                          background: settings[item.id] ? "var(--accent-success)" : "var(--bg-main)",
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
                            left: settings[item.id] ? "24px" : "4px",
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
      
      <div style={{ textAlign: "center", marginTop: "32px", color: "var(--text-secondary)", fontSize: "14px" }}>
        <p>DSEasy v{__APP_VERSION__} • Built with ❤️ by PuduKodkod</p>
        <p style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
             <a href="https://github.com/Gideonamani/DSEasy" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                 GitHub
             </a>
        </p>
      </div>
    </div>
  );
}
