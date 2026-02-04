import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { DerivedAnalytics } from "./components/DerivedAnalytics";
import { TickerTrends } from "./components/TickerTrends";
import { NotificationsManager } from "./components/NotificationsManager";
import { Loader2 } from "lucide-react";
import { useSettings } from "./contexts/SettingsContext";
import { Settings } from "./components/Settings";

// API URL
const API_URL = "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec";

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
  
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  
  // Data for the CURRENTLY selected date
  const [marketData, setMarketData] = useState([]);
  
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

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
    setLoadingData(true);
    setSelectedDate(date);
  };

  // 1. Initial Load: Fetch Dates
  useEffect(() => {
    let ignore = false;
    
    fetch(`${API_URL}?action=getDates`)
      .then((res) => res.json())
      .then((dates) => {
        if (ignore) return;
        
        // Handle both old (string[]) and new ({date, sheetName}[]) API responses for backward compatibility
        const normalizedDates = dates.map(d => {
           if (typeof d === 'string') return { date: null, sheetName: d };
           return d;
        });

        // Sort if date objects exist, otherwise trust API order
        if (normalizedDates.length > 0 && normalizedDates[0].date) {
            normalizedDates.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        setAvailableDates(normalizedDates);
        
        // Auto-select the newest date (first in list)
        if (normalizedDates.length > 0) {
          if (normalizedDates[0]) setLoadingData(true); 
          setSelectedDate(normalizedDates[0].sheetName);
        }
        setLoadingDates(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Failed to fetch dates:", err);
        setError("Failed to load available dates.");
        setLoadingDates(false);
      });

    return () => { ignore = true; };
  }, []);

  // 2. Fetch Data when Date Changes
  useEffect(() => {
    if (!selectedDate) return;

    let ignore = false;
    
    // selectedDate is the sheetName
    const url = `${API_URL}?action=getData&date=${encodeURIComponent(selectedDate)}`;

    fetch(url)
      .then((res) => res.json())
      .then((rawData) => {
        if (ignore) return;
        
        // --- Data Cleaning Logic ---
        const rowMap = new Map();

        rawData.forEach((item) => {
          if (!item.symbol || item.symbol === "Co." || item.symbol === "---" || item.symbol === "Total") {
            return;
          }

          if (rowMap.has(item.symbol)) {
            const prev = rowMap.get(item.symbol);
            rowMap.set(item.symbol, {
              ...prev,
              open: prev.open || item.open,
              close: prev.close || item.close,
              high: Math.max(prev.high || 0, item.high || 0),
              low: prev.low && item.low ? Math.min(prev.low, item.low) : prev.low || item.low,
              change: prev.change !== 0 ? prev.change : item.change,
              volume: (prev.volume || 0) + (item.volume || 0),
              turnover: (prev.turnover || 0) + (item.turnover || 0),
              deals: (prev.deals || 0) + (item.deals || 0),
              mcap: prev.mcap || item.mcap,
            });
          } else {
            rowMap.set(item.symbol, item);
          }
        });

        const cleanList = Array.from(rowMap.values()).filter((item) => item.close > 0);
        
        setMarketData(cleanList);
        setLoadingData(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Failed to fetch day data:", err);
        setMarketData([]); 
        setLoadingData(false);
      });

    return () => { ignore = true; };
  }, [selectedDate]);

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
    return marketData.reduce((acc, curr) => acc + (curr.mcap || 0), 0);
  }, [marketData]);

  const tradedSymbolsCount = useMemo(() => {
    return marketData.filter((item) => item.volume > 0).length;
  }, [marketData]);

  const activeSymbolsCount = marketData.length;

  // Format selected date for display
  const currentDateObj = availableDates.find(d => d.sheetName === selectedDate);
  const formattedDate = currentDateObj && currentDateObj.date 
    ? new Date(currentDateObj.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : selectedDate; // Fallback to raw string if no date object or not found

  // Helper for large numbers
  const formatLargeNumber = (num) => {
    if (!num) return "0";
    if (settings.numberFormat === 'full') {
      return num.toLocaleString();
    }
    // Abbreviated
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toString();
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
      <Routes>
        <Route path="/" element={
           <Dashboard 
              marketData={marketData}
              topGainer={topGainer}
              topLoser={topLoser}
              totalVolume={totalVolume}
              totalTurnover={totalTurnover}
              totalDeals={totalDeals}
              totalMcap={totalMcap}
              activeSymbolsCount={activeSymbolsCount}
              tradedSymbolsCount={tradedSymbolsCount}
              formattedDate={formattedDate}
              selectedDate={selectedDate}
              availableDates={availableDates}
              loadingData={loadingData}
              onDateChange={handleDateChange}
              formatLargeNumber={formatLargeNumber}
           />
        } />
        <Route 
          path="/analytics" 
          element={
            <DerivedAnalytics 
              data={marketData}
              selectedDate={selectedDate}
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
    </Layout>
  );
}

export default App;
