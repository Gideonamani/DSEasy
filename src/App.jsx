import { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { StatCard } from "./components/StatCard";
import { MarketTable } from "./components/MarketTable";
import { PriceChangeChart, TurnoverChart } from "./components/StockChart";
import { Calendar, Loader2 } from "lucide-react";

// Fallback data structure for initial load
const initialData = {};

function App() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const availableDates = Object.keys(data).sort().reverse(); // Newest first
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(
      "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec",
    )
      .then((res) => res.json())
      .then((fetchedData) => {
        if (ignore) return;

        // Cleaning and Merging Data Logic
        const cleanData = {};
        Object.keys(fetchedData).forEach((date) => {
          const rowMap = new Map();

          fetchedData[date].forEach((item) => {
            // Filter invalid symbols
            if (
              !item.symbol ||
              item.symbol === "Co." ||
              item.symbol === "---" ||
              item.symbol === "Total"
            )
              return;

            if (rowMap.has(item.symbol)) {
              const prev = rowMap.get(item.symbol);
              // Merge logic: Check if new item has better data (non-zero) or sum up volumes
              rowMap.set(item.symbol, {
                ...prev,
                open: prev.open || item.open,
                close: prev.close || item.close,
                high: Math.max(prev.high || 0, item.high || 0),
                low:
                  prev.low && item.low
                    ? Math.min(prev.low, item.low)
                    : prev.low || item.low,
                change: prev.change !== 0 ? prev.change : item.change,
                volume: (prev.volume || 0) + (item.volume || 0),
                turnover: (prev.turnover || 0) + (item.turnover || 0),
                mcap: prev.mcap || item.mcap,
              });
            } else {
              rowMap.set(item.symbol, item);
            }
          });

          // Final filter for valid price
          cleanData[date] = Array.from(rowMap.values()).filter(
            (item) => item.close > 0,
          );
        });

        setData(cleanData);

        // Automatically select the newest date
        const dates = Object.keys(cleanData).sort().reverse();
        if (dates.length > 0) {
          setSelectedDate((prev) => prev || dates[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Failed to fetch market data:", err);
        setError("Failed to load market data.");
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const currentData = useMemo(() => {
    return data[selectedDate] || [];
  }, [data, selectedDate]);

  // Calculate Market Stats
  const topGainer = useMemo(() => {
    if (!currentData.length) return { symbol: "-", change: 0, close: 0 };
    return currentData.reduce(
      (prev, current) => (prev.change > current.change ? prev : current),
      currentData[0],
    );
  }, [currentData]);

  const topLoser = useMemo(() => {
    if (!currentData.length) return { symbol: "-", change: 0, close: 0 };
    return currentData.reduce(
      (prev, current) => (prev.change < current.change ? prev : current),
      currentData[0],
    );
  }, [currentData]);

  const totalVolume = useMemo(() => {
    return currentData.reduce((acc, curr) => acc + curr.volume, 0);
  }, [currentData]);

  const totalTurnover = useMemo(() => {
    return currentData.reduce((acc, curr) => acc + curr.turnover, 0);
  }, [currentData]);

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 size={48} className="animate-spin" color="#6366f1" />
        <p style={{ fontFamily: "sans-serif", color: "#94a3b8" }}>
          Loading Market Data...
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
    <Layout>
      <div className="dashboard-header">
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Market Overview
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Data for{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {new Date(selectedDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>
        </div>

        <div className="glass-panel date-picker-container">
          <Calendar size={18} color="var(--text-secondary)" />
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-select"
          >
            {availableDates.map((date) => (
              <option key={date} value={date} style={{ background: "#1e293b" }}>
                {date}
              </option>
            ))}
          </select>
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
          change={0}
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
          change={0}
          subtext="TZS Turnover"
          type="neutral"
        />
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <PriceChangeChart data={currentData} />
        <TurnoverChart data={currentData} />
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 className="section-title">Detailed Market Data</h3>
        <MarketTable data={currentData} />
      </div>
    </Layout>
  );
}

export default App;
