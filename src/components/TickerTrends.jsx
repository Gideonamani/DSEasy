import { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { TrendingUp, Loader2, BarChart3, Activity, DollarSign, Info } from "lucide-react";
import { METRIC_EXPLANATIONS } from "../data/metricExplanations";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Symbols Timeseries API URL - UPDATE THIS AFTER DEPLOYMENT
const SYMBOLS_API_URL = "https://script.google.com/macros/s/AKfycbwMbFZmHxoMbixaTPXRUWH_v_tgHiMANTpj9iFZdzIjmzPBUIctpoFZl1ogy0tmiIQz/exec";

// Available metrics for visualization
const METRICS = [
  { key: "close", label: "Close Price", icon: DollarSign, color: "#6366f1" },
  { key: "volume", label: "Volume", icon: BarChart3, color: "#10b981" },
  { key: "turnover", label: "Turnover", icon: Activity, color: "#f59e0b" },
  { key: "deals", label: "Deals", icon: TrendingUp, color: "#ec4899" },
  { key: "high", label: "High", icon: TrendingUp, color: "#22c55e" },
  { key: "low", label: "Low", icon: TrendingUp, color: "#ef4444" },
  { key: "mcap", label: "MCAP (B)", icon: DollarSign, color: "#8b5cf6" },
  { key: "outstandingBid", label: "Outstanding Bid", icon: TrendingUp, color: "#0ea5e9" },
  { key: "outstandingOffer", label: "Outstanding Offer", icon: TrendingUp, color: "#f43f5e" },
  { key: "bidOffer", label: "Bid/Offer Ratio", icon: Activity, color: "#d946ef" },
  { key: "spread", label: "High/Low Spread", icon: Activity, color: "#eab308" },
  { key: "turnoverPct", label: "Turnover %", icon: Activity, color: "#14b8a6" },
  { key: "turnoverMcap", label: "Turnover/MCAP", icon: Activity, color: "#6366f1" },
  { key: "volDeal", label: "Vol/Deal", icon: BarChart3, color: "#10b981" },
  { key: "turnoverDeal", label: "Turnover/Deal", icon: Activity, color: "#f59e0b" },
  { key: "changeVol", label: "Change/Vol", icon: TrendingUp, color: "#ec4899" },
];

// Reusable card component
// eslint-disable-next-line no-unused-vars
// Reusable card component
const TrendCard = ({ title, icon: Icon, children, explanation }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="glass-panel"
      style={{ padding: "24px", borderRadius: "16px", position: "relative" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(99, 102, 241, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={20} color="var(--accent-primary)" />
          </div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{title}</h3>
        </div>
        
        {explanation && (
          <div 
            className="info-tooltip-wrapper"
            style={{ position: "relative" }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div
              style={{
                cursor: "help",
                padding: "8px",
                borderRadius: "50%",
                color: showTooltip ? "var(--accent-primary)" : "var(--text-secondary)",
                transition: "color 0.2s",
                background: showTooltip ? "rgba(99, 102, 241, 0.1)" : "transparent",
              }}
            >
              <Info size={18} />
            </div>

            {/* Custom Tooltip */}
            {showTooltip && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: "-10px",
                  marginBottom: "8px",
                  width: "260px",
                  padding: "12px 16px",
                  background: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                  zIndex: 50,
                  fontSize: "13px",
                  lineHeight: "1.5",
                  color: "#94a3b8",
                  pointerEvents: "none", // Prevent flickering if mouse touches tooltip
                }}
              >
                 {/* Arrow */}
                 <div 
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      right: '20px',
                      width: '12px',
                      height: '12px',
                      background: 'rgba(15, 23, 42, 0.95)',
                      transform: 'rotate(45deg)',
                      borderRight: '1px solid var(--glass-border)',
                      borderBottom: '1px solid var(--glass-border)',
                    }}
                 />
                 <strong style={{ display: "block", color: "#f8fafc", marginBottom: "4px", fontSize: "12px" }}>Expert Insight</strong>
                 {explanation}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

export const TickerTrends = () => {
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [timeseriesData, setTimeseriesData] = useState([]);
  
  // Track hidden metrics instead of single selected metric
  const [hiddenMetrics, setHiddenMetrics] = useState(new Set());
  
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

  // Toggle metric visibility
  const toggleMetric = (key) => {
    setHiddenMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 1. Fetch available symbols on mount
  useEffect(() => {
    let ignore = false;

    fetch(`${SYMBOLS_API_URL}?action=getSymbols`)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        if (data.error) {
          setError(data.error);
          setLoadingSymbols(false);
          return;
        }
        setSymbols(data);
        // Auto-select first symbol
        if (data.length > 0) {
          setSelectedSymbol(data[0]);
          setLoadingData(true);
        }
        setLoadingSymbols(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Failed to fetch symbols:", err);
        setError("Failed to load symbols. Check API URL.");
        setLoadingSymbols(false);
      });

    return () => { ignore = true; };
  }, []);

  // 2. Fetch timeseries data when symbol changes
  useEffect(() => {
    if (!selectedSymbol) return;

    let ignore = false;
    
    const url = `${SYMBOLS_API_URL}?action=getTimeseries&symbol=${encodeURIComponent(selectedSymbol)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        if (data.error) {
          setTimeseriesData([]);
          setLoadingData(false);
          return;
        }
        // Sort by date ascending for proper charting
        const sorted = [...data].sort((a, b) => {
          const parseDate = (str) => {
            const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
            if (!match) return new Date(str);
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
          };
          return parseDate(a.date) - parseDate(b.date);
        });
        setTimeseriesData(sorted);
        setLoadingData(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Failed to fetch timeseries:", err);
        setTimeseriesData([]);
        setLoadingData(false);
      });

    return () => { ignore = true; };
  }, [selectedSymbol]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "var(--glass-border)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#94a3b8",
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: "#64748b", 
          font: { size: 10 },
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { 
          color: "#64748b", 
          font: { size: 11 },
          callback: (value) => {
            if (value >= 1000000000) return (value / 1000000000).toFixed(1) + "B";
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
  };

  // Helper to generate chart data for any metric
  const getMetricData = (metricKey, color) => {
    if (!timeseriesData.length) return null;

    // Special handling for Volume (Bar Chart with conditional colors)
    if (metricKey === "volume") {
      return {
        labels: timeseriesData.map((d) => d.date),
        datasets: [
          {
            label: "Volume",
            data: timeseriesData.map((d) => d.volume),
            backgroundColor: timeseriesData.map((d, i) => {
              if (i === 0) return "rgba(99, 102, 241, 0.7)";
              return d.close >= timeseriesData[i - 1].close
                ? "rgba(16, 185, 129, 0.7)"
                : "rgba(239, 68, 68, 0.7)";
            }),
            borderRadius: 4,
          },
        ],
      };
    }

    // Default Line chart for others
    return {
      labels: timeseriesData.map((d) => d.date),
      datasets: [
        {
          label: metricKey.charAt(0).toUpperCase() + metricKey.slice(1),
          data: timeseriesData.map((d) => d[metricKey]),
          borderColor: color,
          backgroundColor: `${color}20`,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  // Summary stats
  const stats = useMemo(() => {
    if (!timeseriesData.length) return null;
    
    const closes = timeseriesData.map((d) => d.close).filter((c) => c > 0);
    const latest = timeseriesData[timeseriesData.length - 1];
    const first = timeseriesData[0];
    const periodChange = first?.close ? ((latest?.close - first?.close) / first?.close) * 100 : 0;
    
    return {
      latest: latest?.close || 0,
      high: Math.max(...closes),
      low: Math.min(...closes),
      periodChange,
      avgVolume: timeseriesData.reduce((sum, d) => sum + d.volume, 0) / timeseriesData.length,
      dataPoints: timeseriesData.length,
    };
  }, [timeseriesData]);

  // Loading state
  if (loadingSymbols) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={48} className="animate-spin" color="#6366f1" />
        <p style={{ color: "var(--text-secondary)" }}>Loading symbols...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", borderRadius: "16px" }}>
        <h3 style={{ marginBottom: "12px", color: "var(--accent-danger)" }}>Error</h3>
        <p style={{ color: "var(--text-secondary)" }}>{error}</p>
        <p style={{ color: "var(--text-secondary", fontSize: "12px", marginTop: "16px" }}>
          Make sure to update SYMBOLS_API_URL in TickerTrends.jsx
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
            Ticker Trends
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Historical performance and trend analysis for individual tickers
          </p>
        </div>

        {/* Symbol Selector */}
        <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 16px", borderRadius: "12px" }}>
          <TrendingUp size={18} color="var(--text-secondary)" />
          <select
            value={selectedSymbol}
            onChange={(e) => {
              setLoadingData(true);
              setSelectedSymbol(e.target.value);
            }}
            className="date-select"
            disabled={loadingData}
            style={{ minWidth: "120px" }}
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol} style={{ background: "#1e293b" }}>
                {symbol}
              </option>
            ))}
          </select>
          {loadingData && <Loader2 size={16} className="animate-spin" />}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: "24px" }}>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Latest Close</p>
            <p style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.latest.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period Change</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: stats.periodChange >= 0 ? "var(--accent-success)" : "var(--accent-danger)" }}>
              {stats.periodChange >= 0 ? "+" : ""}{stats.periodChange.toFixed(2)}%
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period High</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-success)" }}>{stats.high.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period Low</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-danger)" }}>{stats.low.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Metric Visibility Toggles */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {METRICS.map((metric) => {
            const isHidden = hiddenMetrics.has(metric.key);
            return (
              <button
                key={metric.key}
                onClick={() => toggleMetric(metric.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: isHidden ? "1px dashed var(--text-secondary)" : "1px solid var(--glass-border)",
                  background: isHidden ? "transparent" : metric.color,
                  color: isHidden ? "var(--text-secondary)" : "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                  textDecoration: isHidden ? "line-through" : "none",
                  opacity: isHidden ? 0.6 : 1
                }}
              >
                {metric.label}
              </button>
            )
        })}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {METRICS.map((metric) => {
          if (hiddenMetrics.has(metric.key)) return null;
          
          const data = getMetricData(metric.key, metric.color);
          const ChartComponent = metric.key === "volume" ? Bar : Line;

          return (
            <TrendCard 
              key={metric.key} 
              title={`${metric.label} Trend`} 
              icon={metric.icon}
              explanation={METRIC_EXPLANATIONS[metric.key]}
            >
               <div style={{ height: "320px" }}>
                  {data ? (
                     <ChartComponent data={data} options={chartOptions} />
                  ) : (
                     <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
                      {loadingData ? <Loader2 size={32} className="animate-spin" /> : "No data available"}
                    </div>
                  )}
               </div>
            </TrendCard>
          );
        })}
      </div>

      {/* Data Summary */}
      {stats && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", marginTop: "24px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Showing <strong style={{ color: "var(--text-primary)" }}>{stats.dataPoints}</strong> data points for{" "}
            <strong style={{ color: "var(--accent-primary)" }}>{selectedSymbol}</strong> |{" "}
            Avg Daily Volume: <strong style={{ color: "var(--text-primary)" }}>{stats.avgVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </p>
        </div>
      )}
    </div>
  );
};
