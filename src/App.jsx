import { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { StatCard } from "./components/StatCard";
import { MarketTable } from "./components/MarketTable";
import { PriceChangeChart, TurnoverChart } from "./components/StockChart";
import { DerivedAnalytics } from "./components/DerivedAnalytics";
import { TickerTrends } from "./components/TickerTrends";
import { Calendar, Loader2 } from "lucide-react";

// API URL
const API_URL = "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec";

function App() {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");
  
  // Data for the CURRENTLY selected date
  const [marketData, setMarketData] = useState([]);
  
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

  // 1. Initial Load: Fetch Dates
  useEffect(() => {
    let ignore = false;
    
    // setLoadingDates(true); // Initialized to true above
    fetch(`${API_URL}?action=getDates`)
      .then((res) => res.json())
      .then((dates) => {
        if (ignore) return;
        setAvailableDates(dates);
        
        // Auto-select the newest date (first in list)
        if (dates.length > 0) {
          // We trigger the loading state here because changing selectedDate 
          // will trigger the next effect
          if (dates[0]) setLoadingData(true); 
          setSelectedDate(dates[0]);
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
    // setLoadingData(true); // Handled in onChange/initialization
    
    // Construct URL for specific date
    const url = `${API_URL}?action=getData&date=${encodeURIComponent(selectedDate)}`;

    fetch(url)
      .then((res) => res.json())
      .then((rawData) => {
        if (ignore) return;
        
        // --- Data Cleaning Logic ---
        const rowMap = new Map();

        rawData.forEach((item) => {
          // Filter invalid symbols
          if (!item.symbol || item.symbol === "Co." || item.symbol === "---" || item.symbol === "Total") {
            return;
          }

          if (rowMap.has(item.symbol)) {
            const prev = rowMap.get(item.symbol);
            // Merge logic
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
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "Dashboard" && (
        <>
          <div className="dashboard-header">
            <div>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
                Market Overview
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>
                Data for{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {selectedDate ? new Date(selectedDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }) : "..."}
                </span>
              </p>
            </div>

            <div className="glass-panel date-picker-container">
              <Calendar size={18} color="var(--text-secondary)" />
              <select
                value={selectedDate}
                onChange={(e) => {
                  setLoadingData(true);
                  setSelectedDate(e.target.value);
                }}
                className="date-select"
                disabled={loadingData}
              >
                {availableDates.map((date) => (
                  <option key={date} value={date} style={{ background: "#1e293b" }}>
                    {date}
                  </option>
                ))}
              </select>
              {loadingData && <Loader2 size={16} className="animate-spin" style={{marginLeft: 8}}/>}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <StatCard
              title="Top Gainer"
              value={topGainer.symbol}
              change={topGainer.change}
              subtext={`Price: ${topGainer.close.toLocaleString()}`}
              type="success"
            />
            <StatCard
              title="Top Loser"
              value={topLoser.symbol}
              change={topLoser.change}
              subtext={`Price: ${topLoser.close.toLocaleString()}`}
              type="danger"
            />
            <StatCard
              title="Total Volume"
              value={totalVolume > 1000000000 ? (totalVolume / 1000000000).toFixed(2) + 'B' : (totalVolume / 1000000).toFixed(2) + 'M'}
              change={null}
              subtext="Total Shares Traded"
              type="primary"
            />
            <StatCard
              title="Total Turnover"
              value={
                totalTurnover > 1000000000
                  ? (totalTurnover / 1000000000).toFixed(2) + "B"
                  : (totalTurnover / 1000000).toFixed(2) + "M"
              }
              change={null}
              subtext="TZS Turnover"
              type="neutral"
            />
          </div>

          {/* Stats Grid Row 2 */}
          <div className="stats-grid" style={{ marginTop: "16px" }}>
            <StatCard
              title="Total Deals"
              value={totalDeals.toLocaleString()}
              change={null}
              subtext="Trades Executed"
              type="neutral"
            />
            <StatCard
              title="Total Market Cap"
              value={
                totalMcap > 1000000000000
                  ? (totalMcap / 1000000000000).toFixed(2) + "T"
                  : (totalMcap / 1000000000).toFixed(2) + "B"
              }
              change={null}
              subtext="TZS Market Cap"
              type="primary"
            />
            <StatCard
              title="Symbols Listed"
              value={activeSymbolsCount}
              change={null}
              subtext="Total Listed"
              type="neutral"
            />
            <StatCard
              title="Active Symbols"
              value={tradedSymbolsCount}
              change={null}
              subtext="Volume > 0"
              type="neutral"
            />
          </div>

          {/* Charts Section */}
          <div className="charts-grid">
            <PriceChangeChart data={marketData} />
            <TurnoverChart data={marketData} />
          </div>

          <div style={{ marginBottom: "32px" }}>
            <h3 className="section-title">Detailed Market Data</h3>
            <MarketTable data={marketData} />
          </div>
        </>
      )}

      {activeTab === "Derived Analytics" && (
        <DerivedAnalytics data={marketData} />
      )}

      {activeTab === "Ticker Trends" && (
        <TickerTrends />
      )}

      {activeTab === "Notifications" && (
        <div className="glass-panel" style={{ padding: "48px", textAlign: "center", borderRadius: "16px" }}>
          <h3 style={{ marginBottom: "12px" }}>Notifications</h3>
          <p style={{ color: "var(--text-secondary)" }}>No new notifications</p>
        </div>
      )}

      {activeTab === "Settings" && (
        <div className="glass-panel" style={{ padding: "48px", textAlign: "center", borderRadius: "16px" }}>
          <h3 style={{ marginBottom: "12px" }}>Settings</h3>
          <p style={{ color: "var(--text-secondary)" }}>Settings page coming soon</p>
        </div>
      )}
    </Layout>
  );
}

export default App;
