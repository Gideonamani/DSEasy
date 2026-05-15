import React, { useMemo, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  useSearchParams,
  useNavigationType,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { DailyGlance } from "./components/DailyGlance";
import { DerivedAnalytics } from "./components/DerivedAnalytics";
import { TickerTrends } from "./components/TickerTrends";
import { CompareTickers } from "./components/CompareTickers";
import { NotificationsManager } from "./components/NotificationsManager";
import { Loader2, Lock } from "lucide-react";
import { AuthModal } from "./components/AuthModal";
import { AuthModalProvider, useAuthModal } from "./contexts/AuthModalContext";
import { useSettings } from "./contexts/SettingsContext";
import { Settings } from "./components/Settings";
import {
  useMarketDates,
  useMarketData,
  useMarketIndices,
} from "./hooks/useMarketQuery";
import { formatLargeNumber } from "./utils/formatters";
import { useAuth } from "./contexts/AuthContext";
import { useNotificationsSync } from "./hooks/useNotificationsSync";
import { ForegroundNotifications } from "./components/ForegroundNotifications";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { StockData } from "./types/market";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** Gate screen shown to unauthenticated visitors on protected routes. */
function ProtectedRoute({ children }: ProtectedRouteProps): React.ReactElement {
  const { currentUser } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  if (currentUser) return <>{children}</>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 20,
        textAlign: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          padding: 20,
          borderRadius: "50%",
          background:
            "color-mix(in srgb, var(--accent-primary) 15%, transparent)",
          marginBottom: 8,
        }}
      >
        <Lock size={40} color="var(--accent-primary)" />
      </div>
      <h2
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--font-bold)",
          margin: 0,
          color: "var(--text-primary)",
        }}
      >
        Members Only
      </h2>
      <p
        style={{
          color: "var(--text-secondary)",
          maxWidth: 420,
          margin: 0,
          lineHeight: 1.6,
          fontSize: "var(--text-sm)",
        }}
      >
        Daily Glance contains live order-book intelligence and premium market
        insights. Please sign in to access this section.
      </p>
      <button
        onClick={openAuthModal}
        style={{
          marginTop: 8,
          padding: "12px 28px",
          background: "var(--accent-primary)",
          border: "none",
          borderRadius: "var(--radius-md)",
          color: "white",
          cursor: "pointer",
          fontWeight: "var(--font-semibold)",
          fontSize: "var(--text-sm)",
          transition: "opacity 0.2s",
        }}
      >
        Sign In
      </button>
    </div>
  );
}

type RoutePath =
  | "/"
  | "/glance"
  | "/analytics"
  | "/trends"
  | "/compare"
  | "/notifications"
  | "/settings";

type TabName =
  | "Dashboard"
  | "Daily Glance"
  | "Derived Analytics"
  | "Ticker Trends"
  | "Compare Tickers"
  | "Notifications"
  | "Settings";

const ROUTES: Record<RoutePath, TabName> = {
  "/": "Dashboard",
  "/glance": "Daily Glance",
  "/analytics": "Derived Analytics",
  "/trends": "Ticker Trends",
  "/compare": "Compare Tickers",
  "/notifications": "Notifications",
  "/settings": "Settings",
};

const TAB_TO_ROUTE: Record<TabName, RoutePath> = {
  Dashboard: "/",
  "Daily Glance": "/glance",
  "Derived Analytics": "/analytics",
  "Ticker Trends": "/trends",
  "Compare Tickers": "/compare",
  Notifications: "/notifications",
  Settings: "/settings",
};

const EMPTY_TICKER: StockData = {
  symbol: "-",
  change: 0,
  pctChange: 0,
  close: 0,
};

function App(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const { settings } = useSettings();
  useNotificationsSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromUrl = searchParams.get("date");

  useEffect(() => {
    if (navType !== "POP") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navType]);

  // Honor the user's "Default Landing Page" setting on first app load only.
  const didApplyLandingRef = useRef(false);
  useEffect(() => {
    if (didApplyLandingRef.current) return;
    didApplyLandingRef.current = true;

    const target = settings.landingPage;
    if (
      target &&
      target !== "/" &&
      location.pathname === "/" &&
      !location.search &&
      !location.hash
    ) {
      navigate(target, { replace: true });
    }
  }, [
    settings.landingPage,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  const {
    data: availableDates = [],
    isLoading: loadingDates,
    error: datesError,
  } = useMarketDates();

  const effectiveDate = useMemo(() => {
    if (dateFromUrl) return dateFromUrl;
    if (availableDates.length > 0) return availableDates[0].sheetName;
    return "";
  }, [dateFromUrl, availableDates]);

  const {
    data: marketData = [],
    isLoading: loadingData,
    error: dataError,
  } = useMarketData(effectiveDate);
  const { data: marketIndices = null, isLoading: loadingIndices } =
    useMarketIndices();

  const error = datesError
    ? `Dates Error: ${datesError.message}`
    : dataError
    ? `Data Error: ${dataError.message}`
    : null;

  const activeTab = useMemo<TabName>(() => {
    const path = location.pathname as RoutePath;
    if (path in ROUTES) return ROUTES[path];
    if (location.pathname.startsWith("/trends")) return "Ticker Trends";
    return "Dashboard";
  }, [location.pathname]);

  const handleTabChange = (tab: string): void => {
    const route = TAB_TO_ROUTE[tab as TabName];
    if (route) {
      navigate(route);
    }
  };

  const handleDateChange = (date: string): void => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (date) {
        newParams.set("date", date);
      } else {
        newParams.delete("date");
      }
      return newParams;
    });
  };

  const topGainer = useMemo<StockData>(() => {
    if (!marketData.length) return EMPTY_TICKER;
    return marketData.reduce(
      (prev, curr) =>
        (prev.pctChange || 0) > (curr.pctChange || 0) ? prev : curr,
      marketData[0],
    );
  }, [marketData]);

  const topLoser = useMemo<StockData>(() => {
    if (!marketData.length) return EMPTY_TICKER;
    return marketData.reduce(
      (prev, curr) =>
        (prev.pctChange || 0) < (curr.pctChange || 0) ? prev : curr,
      marketData[0],
    );
  }, [marketData]);

  const totalVolume = useMemo(
    () => marketData.reduce((acc, curr) => acc + (curr.volume ?? 0), 0),
    [marketData],
  );

  const totalTurnover = useMemo(
    () => marketData.reduce((acc, curr) => acc + (curr.turnover ?? 0), 0),
    [marketData],
  );

  const totalDeals = useMemo(
    () => marketData.reduce((acc, curr) => acc + (curr.deals ?? 0), 0),
    [marketData],
  );

  const totalMcap = useMemo(
    () => marketData.reduce((acc, curr) => acc + (curr.mcap ?? 0), 0),
    [marketData],
  );

  const tradedSymbolsCount = useMemo(
    () => marketData.filter((item) => (item.volume ?? 0) > 0).length,
    [marketData],
  );

  const activeSymbolsCount = marketData.length;

  const currentDateObj = availableDates.find(
    (d) => d.sheetName === effectiveDate,
  );
  const formattedDate =
    currentDateObj && currentDateObj.date
      ? new Date(currentDateObj.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : effectiveDate;

  const formatLargeNumberDisplay = (
    num: number,
    spellOut = false,
  ): string => {
    if (!num) return "0";
    if (settings.numberFormat === "full") {
      return num.toLocaleString();
    }
    return formatLargeNumber(num, spellOut);
  };

  if (loadingDates) {
    return (
      <div className="loading-container">
        <Loader2 size={48} className="animate-spin" color="#6366f1" />
        <p style={{ fontFamily: "sans-serif", color: "#94a3b8" }}>
          Connecting to Market Data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <AuthModalProvider>
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        <ErrorBoundary>
          <div key={location.pathname} className="page-transition">
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    marketData={marketData}
                    marketIndices={marketIndices}
                    loadingIndices={loadingIndices}
                    topGainer={topGainer}
                    topLoser={topLoser}
                    totalVolume={totalVolume}
                    totalTurnover={totalTurnover}
                    totalDeals={totalDeals}
                    totalMcap={totalMcap}
                    activeSymbolsCount={activeSymbolsCount}
                    tradedSymbolsCount={tradedSymbolsCount}
                    formattedDate={formattedDate}
                    selectedDate={effectiveDate}
                    availableDates={availableDates}
                    loadingData={loadingData}
                    onDateChange={handleDateChange}
                    formatLargeNumber={formatLargeNumberDisplay}
                  />
                }
              />
              <Route
                path="/glance"
                element={
                  <ProtectedRoute>
                    <DailyGlance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <DerivedAnalytics
                    data={marketData}
                    selectedDate={effectiveDate}
                    formattedDate={formattedDate}
                    availableDates={availableDates}
                    loadingData={loadingData}
                    onDateChange={handleDateChange}
                  />
                }
              />
              <Route path="/trends/:symbol?" element={<TickerTrends />} />
              <Route path="/compare" element={<CompareTickers />} />
              <Route path="/notifications" element={<NotificationsManager />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </Layout>
      <AuthModal />
      <ForegroundNotifications />
    </AuthModalProvider>
  );
}

export default App;
