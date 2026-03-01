import { useMemo } from "react";
import { Routes, Route, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { DerivedAnalytics } from "./components/DerivedAnalytics";
import { TickerTrends } from "./components/TickerTrends";
import { NotificationsManager } from "./components/NotificationsManager";
import { Loader2 } from "lucide-react";
import { useSettings } from "./contexts/SettingsContext";
import { Settings } from "./components/Settings";
import { useMarketDates, useMarketData, useMarketIndices } from "./hooks/useMarketQuery";
import { formatLargeNumber } from "./utils/formatters";

import { ErrorBoundary } from "./components/ErrorBoundary";

// Route configuration
const ROUTES = {
  "/": "Dashboard",
  "/analytics": "Derived Analytics",
  "/trends": "Ticker Trends",
  "/notifications": "Notifications",
  "/settings": "Settings",
};

const TAB_TO_ROUTE = {
  "Dashboard": "/",
  "Derived Analytics": "/analytics",
  "Ticker Trends": "/trends",
  "Notifications": "/notifications",
  "Settings": "/settings",
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromUrl = searchParams.get("date");
  
  // React Query Hooks
  const { data: availableDates = [], isLoading: loadingDates, error: datesError } = useMarketDates();
  
  // Effective date: Either the one from URL, or the latest available
  const effectiveDate = useMemo(() => {
    if (dateFromUrl) return dateFromUrl;
    if (availableDates.length > 0) return availableDates[0].sheetName;
    return "";
  }, [dateFromUrl, availableDates]);

  const { data: marketData = [], isLoading: loadingData, error: dataError } = useMarketData(effectiveDate);
  const { data: marketIndices = null } = useMarketIndices();
  
  const error = datesError ? `Dates Error: ${datesError.message}` : dataError ? `Data Error: ${dataError.message}` : null;

  // Get active tab from current route
  const activeTab = useMemo(() => {
    // Exact match
    if (ROUTES[location.pathname]) return ROUTES[location.pathname];
    
    // Sub-route match (e.g. /trends/CRDB -> Ticker Trends)
    if (location.pathname.startsWith("/trends")) return "Ticker Trends";
    
    return "Dashboard";
  }, [location.pathname]);

  // Handle tab change via navigation
  const handleTabChange = (tab) => {
    const route = TAB_TO_ROUTE[tab];
    if (route) {
      navigate(route);
    }
  };

  // Handle date change
  const handleDateChange = (date) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (date) {
        newParams.set("date", date);
      } else {
        newParams.delete("date");
      }
      return newParams;
    });
  };

  // Derived Stats
  const topGainer = useMemo(() => {
    if (!marketData.length) return { symbol: "-", change: 0, close: 0 };
    return marketData.reduce((prev, curr) => (prev.change > curr.change ? prev : curr), marketData[0]);
  }, [marketData]);

  const topLoser = useMemo(() => {
    if (!marketData.length) return { symbol: "-", change: 0, close: 0 };
    return marketData.reduce((prev, curr) => (prev.change < curr.change ? prev : curr), marketData[0]);
  }, [marketData]);

  const totalVolume = useMemo(() => {
    return marketData.reduce((acc, curr) => acc + curr.volume, 0);
  }, [marketData]);

  const totalTurnover = useMemo(() => {
    return marketData.reduce((acc, curr) => acc + curr.turnover, 0);
  }, [marketData]);

  const totalDeals = useMemo(() => {
    return marketData.reduce((acc, curr) => acc + (curr.deals || 0), 0);
  }, [marketData]);

  const totalMcap = useMemo(() => {
    // Market cap is stored in Billions, so multiply by 1,000,000,000 to get actual TZS value
    return marketData.reduce((acc, curr) => acc + (curr.mcap || 0), 0) * 1e9;
  }, [marketData]);

  const tradedSymbolsCount = useMemo(() => {
    return marketData.filter((item) => item.volume > 0).length;
  }, [marketData]);

  const activeSymbolsCount = marketData.length;

  // Format selected date for display
  const currentDateObj = availableDates.find(d => d.sheetName === effectiveDate);
  const formattedDate = currentDateObj && currentDateObj.date 
    ? new Date(currentDateObj.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : effectiveDate; // Fallback to raw string if no date object or not found

  // Helper for large numbers
  const formatLargeNumberDisplay = (num, spellOut = false) => {
    if (!num) return "0";
    if (settings.numberFormat === 'full') {
      return num.toLocaleString();
    }
    return formatLargeNumber(num, spellOut);
  };

  // Loading State (Initial)
  if (loadingDates) {
    return (
      <div className="loading-container">
        <Loader2 size={48} className="animate-spin" color="#6366f1" />
        <p style={{ fontFamily: "sans-serif", color: "#94a3b8" }}>Connecting to Market Data...</p>
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
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={
            <Dashboard 
               marketData={marketData}
               marketIndices={marketIndices}
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
        } />
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
        <Route path="/notifications" element={<NotificationsManager />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
