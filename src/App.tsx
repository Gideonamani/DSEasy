import React, { useMemo, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
  useNavigationType,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { Loader2, Lock } from "lucide-react";
import { AuthModal } from "./components/AuthModal";
import { AuthModalProvider, useAuthModal } from "./contexts/AuthModalContext";
import { useSettings } from "./contexts/SettingsContext";

// Lazy load route components to optimize page load times using React lazy + Suspense
const Dashboard = React.lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const DailyGlance = React.lazy(() => import("./components/DailyGlance").then(m => ({ default: m.DailyGlance })));
const DerivedAnalytics = React.lazy(() => import("./components/DerivedAnalytics").then(m => ({ default: m.DerivedAnalytics })));
const TickerTrends = React.lazy(() => import("./components/TickerTrends").then(m => ({ default: m.TickerTrends })));
const CompareTickers = React.lazy(() => import("./components/CompareTickers").then(m => ({ default: m.CompareTickers })));
const Backtesting = React.lazy(() => import("./components/Backtesting").then(m => ({ default: m.Backtesting })));
const NotificationsManager = React.lazy(() => import("./components/NotificationsManager").then(m => ({ default: m.NotificationsManager })));
const Settings = React.lazy(() => import("./components/Settings").then(m => ({ default: m.Settings })));

const LoadingFallback = (): React.ReactElement => (
  <div className="loading-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
    <Loader2 size={48} className="animate-spin" color="#6366f1" />
  </div>
);
import {
  useMarketDates,
  useMarketData,
  useMarketIndices,
} from "./hooks/useMarketQuery";
import { formatLargeNumber } from "./utils/formatters";
import { useAuth } from "./contexts/AuthContext";
import { useIsOwner } from "./hooks/useUserProfile";
import { useNotificationsSync } from "./hooks/useNotificationsSync";
import { ForegroundNotifications } from "./components/ForegroundNotifications";
import PWAPrompt from "./components/PWAPrompt";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
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

interface OwnerRouteProps {
  children: React.ReactNode;
}

/** Restricts a route to the Firestore-flagged owner; everyone else is bounced to the dashboard. */
function OwnerRoute({ children }: OwnerRouteProps): React.ReactElement {
  const isOwner = useIsOwner();
  if (!isOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}

type RoutePath =
  | "/"
  | "/glance"
  | "/analytics"
  | "/trends"
  | "/compare"
  | "/backtesting"
  | "/notifications"
  | "/settings";

type TabName =
  | "Dashboard"
  | "Daily Glance"
  | "Derived Analytics"
  | "Ticker Trends"
  | "Compare Tickers"
  | "Backtesting"
  | "Notifications"
  | "Settings";

const ROUTES: Record<RoutePath, TabName> = {
  "/": "Dashboard",
  "/glance": "Daily Glance",
  "/analytics": "Derived Analytics",
  "/trends": "Ticker Trends",
  "/compare": "Compare Tickers",
  "/backtesting": "Backtesting",
  "/notifications": "Notifications",
  "/settings": "Settings",
};

const TAB_TO_ROUTE: Record<TabName, RoutePath> = {
  Dashboard: "/",
  "Daily Glance": "/glance",
  "Derived Analytics": "/analytics",
  "Ticker Trends": "/trends",
  "Compare Tickers": "/compare",
  Backtesting: "/backtesting",
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
            <React.Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <RouteErrorBoundary featureName="Dashboard">
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
                        selectedDate={effectiveDate}
                        availableDates={availableDates}
                        loadingData={loadingData}
                        onDateChange={handleDateChange}
                        formatLargeNumber={formatLargeNumberDisplay}
                      />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/glance"
                  element={
                    <ProtectedRoute>
                      <RouteErrorBoundary featureName="Daily Glance">
                        <DailyGlance />
                      </RouteErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <RouteErrorBoundary featureName="Derived Analytics">
                      <DerivedAnalytics
                        data={marketData}
                        selectedDate={effectiveDate}
                        formattedDate={formattedDate}
                        availableDates={availableDates}
                        loadingData={loadingData}
                        onDateChange={handleDateChange}
                      />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/trends/:symbol?"
                  element={
                    <RouteErrorBoundary featureName="Ticker Trends">
                      <TickerTrends />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/compare"
                  element={
                    <RouteErrorBoundary featureName="Compare Tickers">
                      <CompareTickers />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/backtesting"
                  element={
                    <OwnerRoute>
                      <RouteErrorBoundary featureName="Backtesting">
                        <Backtesting />
                      </RouteErrorBoundary>
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RouteErrorBoundary featureName="Notifications Manager">
                      <NotificationsManager />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RouteErrorBoundary featureName="Settings">
                      <Settings />
                    </RouteErrorBoundary>
                  }
                />
              </Routes>
            </React.Suspense>
          </div>
        </ErrorBoundary>
      </Layout>
      <AuthModal />
      <ForegroundNotifications />
      <PWAPrompt />
    </AuthModalProvider>
  );
}

export default App;
