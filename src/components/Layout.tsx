import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  GitCompare,
  Settings,
  Bell,
  Search,
  ArrowUpDown,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAuthModal } from "../contexts/AuthModalContext";

declare global {
  // Already declared in Settings.tsx, but harmless to redeclare
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  active,
  onClick,
}) => {
  const Icon = icon;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        margin: "4px 8px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        backgroundColor: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
        color: active ? "var(--accent-primary)" : "var(--text-secondary)",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
      className="hover-effect"
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "10%",
            bottom: "10%",
            width: "3px",
            backgroundColor: "var(--accent-primary)",
            borderRadius: "0 4px 4px 0",
          }}
        />
      )}
      <Icon size={20} style={{ marginRight: "12px", zIndex: 1 }} />
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--font-medium)",
          zIndex: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
};

const UserProfileSection = () => {
  const { currentUser, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (currentUser) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName || "User"}
              referrerPolicy="no-referrer"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                marginRight: "12px",
                border: "1px solid var(--glass-border)",
              }}
            />
          ) : (
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--accent-primary)",
                marginRight: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={18} color="#fff" />
            </div>
          )}
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-medium)",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {currentUser.displayName || "User"}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {currentUser.email}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "8px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--text-sm)",
            transition: "all 0.2s",
          }}
          className="hover-bg"
        >
          <LogOut size={14} style={{ marginRight: "8px" }} />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={openAuthModal}
      style={{
        width: "100%",
        padding: "10px",
        background: "var(--accent-primary)",
        border: "none",
        borderRadius: "var(--radius-md)",
        color: "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "var(--font-medium)",
        transition: "opacity 0.2s",
      }}
    >
      <LogIn size={16} style={{ marginRight: "8px" }} />
      Sign In
    </button>
  );
};

export interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  const { currentUser } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const getMobile = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const getWide = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  const getShort = () =>
    typeof window !== "undefined" && window.matchMedia("(max-height: 500px)").matches;
  const [isMobile, setIsMobile] = useState(getMobile);
  const [isWide, setIsWide] = useState(getWide);
  const [isShort, setIsShort] = useState(getShort);
  // Sidebar open by default only on wide (≥1024px) viewports; collapsed on tablets/phones.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getWide());

  // Track viewport breakpoints via matchMedia so transient mobile-keyboard
  // resize events don't collapse the sidebar mid-typing.
  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const mqWide = window.matchMedia("(min-width: 1024px)");
    const mqShort = window.matchMedia("(max-height: 500px)");
    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleWide = (e: MediaQueryListEvent) => {
      setIsWide(e.matches);
      setIsSidebarOpen(e.matches);
    };
    const handleShort = (e: MediaQueryListEvent) => setIsShort(e.matches);
    mqMobile.addEventListener("change", handleMobile);
    mqWide.addEventListener("change", handleWide);
    mqShort.addEventListener("change", handleShort);
    return () => {
      mqMobile.removeEventListener("change", handleMobile);
      mqWide.removeEventListener("change", handleWide);
      mqShort.removeEventListener("change", handleShort);
    };
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div style={{ display: "flex", minHeight: "100dvh", position: "relative" }}>
      {/* Mobile Sidebar Overlay */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: "var(--z-overlay)",
          backdropFilter: "blur(4px)",
          opacity: !isWide && isSidebarOpen ? 1 : 0,
          pointerEvents: !isWide && isSidebarOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Sidebar */}
      <aside
        className="glass-panel"
        style={{
          width: "var(--sidebar-width)",
          height: "100dvh",
          position: "fixed",
          left: isSidebarOpen ? 0 : "calc(var(--sidebar-width) * -1)",
          top: 0,
          borderRight: "1px solid var(--glass-border)",
          borderTop: "none",
          borderBottom: "none",
          borderLeft: "none",
          display: "flex",
          flexDirection: "column",
          zIndex: "var(--z-sidebar)",
          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          background: "var(--bg-sidebar)",
        }}
      >
        <div
          style={{
            padding: isShort ? "12px 16px" : "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/icons/icon-48x48.png"
              alt="DSEasy Logo"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                marginRight: "12px",
                border: "1px solid var(--glass-border)",
              }}
            />
            <h1
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-bold)",
                margin: 0,
                letterSpacing: "-0.5px",
              }}
            >
              DSEasy
            </h1>
          </div>
          {isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div style={{ maxHeight: "100%", padding: "12px 0", overflowY: "auto" }}>
          {[
            "Dashboard",
            ...(currentUser ? ["Daily Glance"] : []),
            "Derived Analytics",
            "Ticker Trends",
            "Compare Tickers",
            "Notifications",
            "Settings",
          ].map((tab) => (
            <SidebarItem
              key={tab}
              icon={
                tab === "Dashboard"
                  ? LayoutDashboard
                  : tab === "Daily Glance"
                    ? ArrowUpDown
                  : tab === "Derived Analytics"
                    ? TrendingUp
                    : tab === "Ticker Trends"
                      ? LineChart
                      : tab === "Compare Tickers"
                        ? GitCompare
                        : tab === "Notifications"
                          ? Bell
                          : Settings
              }
              label={tab}
              active={activeTab === tab}
              onClick={() => {
                onTabChange(tab);
                if (!isWide) setIsSidebarOpen(false);
              }}
            />
          ))}
          </div>
          {/* Scroll hint fade — always rendered, only visible when items overflow */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "32px",
              background: "linear-gradient(to bottom, transparent, var(--bg-sidebar))",
              pointerEvents: "none",
            }}
          />
        </div>

        <div
          style={{
            padding: isShort ? "10px 16px" : "24px",
            paddingBottom: isShort
              ? "calc(10px + env(safe-area-inset-bottom))"
              : "calc(24px + env(safe-area-inset-bottom))",
            borderTop: "1px solid var(--glass-border)",
          }}
        >
          {/* Version Badge */}
          <div
            style={{
              marginBottom: "16px",
              padding: "0 8px",
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>DSEasy</span>
            <span
              style={{
                background: "var(--bg-elevated)",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--glass-border)",
              }}
            >
              v{__APP_VERSION__}
            </span>
          </div>
          <UserProfileSection />
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div
        style={{
          marginLeft: isWide && isSidebarOpen ? "var(--sidebar-width)" : "0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: "100%",
        }}
      >
        {/* Header */}
        <header
          className="glass-header"
          style={{
            padding: "0 24px",
            height: "var(--header-height)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={toggleSidebar}
              style={{
                marginRight: "16px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Menu size={24} />
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span
                style={{
                  marginRight: "8px",
                  display: isMobile ? "none" : "block",
                }}
              >
                Overview
              </span>
              <span style={{ display: isMobile ? "none" : "block" }}>/</span>
              <span
                style={{
                  marginLeft: isMobile ? "0" : "8px",
                  color: "var(--text-primary)",
                }}
              >
                {activeTab}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                position: "relative",
                display: isMobile ? "none" : "block",
              }}
            >
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-secondary)",
                }}
              />
              <input
                type="text"
                placeholder="Search..."
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "20px",
                  padding: "8px 16px 8px 36px",
                  color: "var(--text-primary)",
                  outline: "none",
                  width: "200px",
                  fontSize: "var(--text-sm)",
                }}
              />
            </div>
            <button
              onClick={() => onTabChange("Notifications")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <Bell size={20} />
            </button>

            {/* Sign-in shortcut — always reachable regardless of sidebar state or orientation */}
            {!currentUser && (
              <button
                onClick={openAuthModal}
                style={{
                  background: "var(--accent-primary)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-semibold)",
                  whiteSpace: "nowrap",
                }}
              >
                <LogIn size={14} />
                Sign In
              </button>
            )}

            {/* Mobile avatar when logged in */}
            {isMobile && currentUser && (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid var(--glass-border)",
                  flexShrink: 0,
                }}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "User"}
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "var(--accent-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <User size={16} color="#fff" />
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: isMobile ? "16px" : "32px", flex: 1 }}>
          {children}
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 32px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "13px",
        }}>
          DSEasy v{__APP_VERSION__} • Built by PuduKodkod •{" "}
          <a
            href="https://github.com/Gideonamani/DSEasy"
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            GitHub
          </a>
        </footer>
      </div>
    </div>
  );
};
