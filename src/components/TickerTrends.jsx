import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "../utils/formatters";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext"; // Import useSettings
import { useTickerSymbols, useTickerHistory } from "../hooks/useMarketQuery";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { Line, Bar } from "react-chartjs-2";
import { TrendingUp, Loader2, BarChart3, Activity, DollarSign, Info, Calendar, Bell } from "lucide-react";
import { METRIC_EXPLANATIONS } from "../data/metricExplanations";
import { AlertModal } from "./AlertModal";
import { getCommonChartOptions } from "../utils/chartTheme";
import { Chart as ChartJS } from 'chart.js';

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
const TrendCard = ({ title, icon, children, explanation }) => {
  const MetricIcon = icon;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="glass-panel"
      style={{ padding: "var(--space-6)", borderRadius: "var(--radius-xl)", position: "relative" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-lg)",
              background: "rgba(99, 102, 241, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MetricIcon size={20} color="var(--accent-primary)" />
          </div>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>{title}</h3>
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
                  top: "100%", // Changed from bottom: 100% to top: 100% (appear below)
                  right: "-10px",
                  marginTop: "10px", // Added spacing from icon
                  width: "260px",
                  padding: "12px 16px",
                  background: "var(--bg-card)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 50,
                  fontSize: "var(--text-xs)",
                  lineHeight: "1.5",
                  color: "var(--text-secondary)",
                  pointerEvents: "none",
                }}
              >
                 {/* Arrow pointing UP */}
                 <div 
                    style={{
                      position: 'absolute',
                      top: '-6px', // Moved to top
                      right: '20px',
                      width: '12px',
                      height: '12px',
                      background: 'var(--bg-card)',
                      transform: 'rotate(45deg)',
                      borderLeft: '1px solid var(--glass-border)', // Changed borders for upward point
                      borderTop: '1px solid var(--glass-border)',
                    }}
                 />
                 <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: "4px", fontSize: "12px" }}>Expert Insight</strong>
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

const PERIODS = [
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
  { label: 'Custom', value: 'Custom' },
];

export const TickerTrends = () => {
  const { symbol: urlSymbol } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings(); // Use settings hook
  const chartTheme = getCommonChartOptions(settings.theme);

  
  // Track hidden metrics instead of single selected metric
  const [hiddenMetrics, setHiddenMetrics] = useState(new Set());
  
  // NEW: Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // 1. Fetch Symbols using Hook
  const { 
    data: symbols = [], 
    isLoading: loadingSymbols, 
    error: symbolsError 
  } = useTickerSymbols();

  // Derived state: current symbol comes from URL or defaults to first in list
  // Note: we can only default once symbols are loaded
  const currentSymbol = urlSymbol || (symbols.length > 0 ? symbols[0] : "");

  // 2. Fetch History using Hook (Cached!)
  const {
      data: timeseriesData = [],
      isLoading: loadingData,
      error: dataError
  } = useTickerHistory(currentSymbol);

  const error = symbolsError ? "Failed to load symbols" : (dataError ? "Failed to load ticker data" : null);

  // Handle symbol change - just navigate
  const handleSymbolChange = (newSymbol) => {
    navigate(`/trends/${newSymbol}`);
  };

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

  // --- Filtering Logic ---
  
  // State for period and custom dates - initialize from URL
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "ALL");
  const [customRange, setCustomRange] = useState({
    start: searchParams.get("start") ? new Date(searchParams.get("start")) : null,
    end: searchParams.get("end") ? new Date(searchParams.get("end")) : null,
  });

  // Sync URL when period/dates change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (selectedPeriod === "ALL") {
       params.delete("period");
       params.delete("start");
       params.delete("end");
    } else {
       params.set("period", selectedPeriod);
    }

    if (selectedPeriod === "Custom") {
      if (customRange.start) params.set("start", customRange.start.toISOString().split('T')[0]);
      if (customRange.end) params.set("end", customRange.end.toISOString().split('T')[0]);
    } else {
      // Clear dates if not custom
      params.delete("start");
      params.delete("end");
    }
    
    setSearchParams(params, { replace: true });
  }, [selectedPeriod, customRange, searchParams, setSearchParams]);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!timeseriesData.length) return [];
    if (selectedPeriod === "ALL") return timeseriesData;

    let cutoffDate = new Date();
    // Normalize today to start of day for comparison if needed, or just standard date calc
    
    // For Custom
    if (selectedPeriod === "Custom") {
        return timeseriesData.filter(d => {
            const normalizeDate = (date) => {
                 const d = new Date(date);
                 d.setHours(0,0,0,0);
                 return d;
            };

            const parseDate = (str) => {
                const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
                if (!match) return new Date(str);
                const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
                return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
            };
            const itemDate = normalizeDate(parseDate(d.date));

            let matchesStart = true;
            let matchesEnd = true;
            
            if (customRange.start) matchesStart = itemDate >= normalizeDate(customRange.start);
            if (customRange.end) matchesEnd = itemDate <= normalizeDate(customRange.end);
            
            return matchesStart && matchesEnd;
        });
    }

    // For Relative Periods
    // We need to base "1 Week" relative to the LATEST DATE in the data data? or Today?
    // Financial apps usually do relative to Today.
    
    switch (selectedPeriod) {
        case '1W': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
        case '1M': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
        case '3M': cutoffDate.setMonth(cutoffDate.getMonth() - 3); break;
        case '6M': cutoffDate.setMonth(cutoffDate.getMonth() - 6); break;
        case '1Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
        default: return timeseriesData;
    }
    
    // Normalize cutoff to start of day
    cutoffDate.setHours(0,0,0,0);

    return timeseriesData.filter(d => {
         const parseDate = (str) => {
            const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
            if (!match) return new Date(str);
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const date = new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
            return date;
         };
         const itemDate = parseDate(d.date);
         itemDate.setHours(0,0,0,0);
         return itemDate >= cutoffDate;
    });

  }, [timeseriesData, selectedPeriod, customRange]);

  const chartOptions = {
    ...chartTheme,
    plugins: {
        ...chartTheme.plugins,
        title: { display: false },
    },
    scales: {
      x: {
        ...chartTheme.scales.x,
        ticks: { 
          ...chartTheme.scales.x.ticks,
          maxTicksLimit: 10,
        },
      },
      y: {
        ...chartTheme.scales.y,
        ticks: { 
          ...chartTheme.scales.y.ticks,
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
    if (!filteredData.length) return null;

    // Special handling for Volume (Bar Chart with conditional colors)
    if (metricKey === "volume") {
      return {
        labels: filteredData.map((d) => d.date),
        datasets: [
          {
            label: "Volume",
            data: filteredData.map((d) => d.volume),
            backgroundColor: filteredData.map((d, i) => {
              if (i === 0) return "rgba(99, 102, 241, 0.7)";
              return d.close >= filteredData[i - 1].close
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
      labels: filteredData.map((d) => d.date),
      datasets: [
        {
          label: metricKey.charAt(0).toUpperCase() + metricKey.slice(1),
          data: filteredData.map((d) => metricKey === 'turnoverPct' ? (d[metricKey] || 0) * 100 : d[metricKey]),
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

  // Recalculate stats based on FILTERED data
  const stats = useMemo(() => {
    if (!filteredData.length) return null;
    
    const closes = filteredData.map((d) => d.close).filter((c) => c > 0);
    const latest = filteredData[filteredData.length - 1];
    const first = filteredData[0];
    const periodChange = first?.close ? ((latest?.close - first?.close) / first?.close) * 100 : 0;
    
    return {
      latest: latest?.close || 0,
      high: Math.max(...closes),
      low: Math.min(...closes),
      periodChange,
      avgVolume: filteredData.reduce((sum, d) => sum + d.volume, 0) / filteredData.length,
      dataPoints: filteredData.length,
    };
  }, [filteredData]);

  // Loading state (only for initial symbols load, not data switch)
  if (loadingSymbols && symbols.length === 0) {
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
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-2)" }}>
            {currentSymbol ? `${currentSymbol} Trends` : "Ticker Trends"}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            {currentSymbol 
              ? `Historical performance and trend analysis for ${currentSymbol}`
              : "Historical performance and trend analysis for individual tickers"}
          </p>
        </div>

        {/* Symbol Selector & Alert Button */}
        <div style={{ display: "flex", gap: "12px" }}>
             <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0", width: "42px", height: "42px", borderRadius: "12px", cursor: "pointer", border: "1px solid var(--glass-border)", color: "var(--accent-primary)" }} onClick={() => setIsAlertModalOpen(true)}>
                 <Bell size={20} />
             </div>

             <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 16px", borderRadius: "12px" }}>
              <TrendingUp size={18} color="var(--text-secondary)" />
              <select
                value={currentSymbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="date-select"
                disabled={loadingData}
                style={{ minWidth: "120px", background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
              >
                {/* If the current selected symbol isn't in the list yet (optimistic), show it anyway */}
                {currentSymbol && !symbols.includes(currentSymbol) && (
                     <option key={currentSymbol} value={currentSymbol} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                        {currentSymbol}
                     </option>
                )}
                {symbols.map((symbol) => (
                  <option key={symbol} value={symbol} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                    {symbol}
                  </option>
                ))}
              </select>
              {loadingData && <Loader2 size={16} className="animate-spin" />}
            </div>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal 
        isOpen={isAlertModalOpen} 
        onClose={() => setIsAlertModalOpen(false)}
        symbol={currentSymbol}
        currentPrice={stats?.latest || 0}
      />

      {/* Period Selector */}
      <div className="glass-panel" style={{ 
          padding: "8px", 
          borderRadius: "12px", 
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center"
      }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {PERIODS.map((period) => (
                <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: selectedPeriod === period.value ? "var(--accent-primary)" : "transparent",
                        color: selectedPeriod === period.value ? "#fff" : "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    {period.label}
                </button>
            ))}
          </div>

          {selectedPeriod === "Custom" && (
             <div style={{ display: "flex", gap: "8px", alignItems: "center", borderLeft: "1px solid var(--glass-border)", paddingLeft: "12px", marginLeft: "4px" }}>
                 <div style={{ position: 'relative' }}>
                    <DatePicker 
                        selected={customRange.start}
                        onChange={(date) => setCustomRange(prev => ({ ...prev, start: date }))}
                        selectsStart
                        startDate={customRange.start}
                        endDate={customRange.end}
                        placeholderText="Start Date"
                        className="custom-date-input"
                        popperPlacement="bottom-start"
                        popperContainer={({ children }) => createPortal(
                            <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>,
                            document.body
                        )}
                    />
                    <Calendar size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
                 </div>
                 <span style={{ color: "var(--text-secondary)" }}>-</span>
                 <div style={{ position: 'relative' }}>
                    <DatePicker 
                        selected={customRange.end}
                        onChange={(date) => setCustomRange(prev => ({ ...prev, end: date }))}
                        selectsEnd
                        startDate={customRange.start}
                        endDate={customRange.end}
                        minDate={customRange.start}
                        placeholderText="End Date"
                        className="custom-date-input"
                        popperPlacement="bottom-end"
                        popperContainer={({ children }) => createPortal(
                            <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>,
                            document.body
                        )}
                    />
                    <Calendar size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
                 </div>
                 
                 <style>{`
                    .custom-date-input {
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid var(--glass-border);
                        border-radius: 6px;
                        padding: 6px 28px 6px 10px;
                        color: white;
                        font-family: inherit;
                        font-size: 13px;
                        width: 110px;
                        cursor: pointer;
                    }
                    .react-datepicker {
                        background-color: var(--bg-card) !important;
                        border: 1px solid var(--glass-border) !important;
                        font-family: inherit !important;
                        z-index: 9999 !important;
                    }
                    .react-datepicker__header {
                        background-color: var(--bg-surface) !important;
                        border-bottom: 1px solid var(--glass-border) !important;
                    }
                    .react-datepicker__current-month, .react-datepicker__day-name {
                        color: var(--text-primary) !important;
                    }
                    .react-datepicker__day {
                        color: var(--text-secondary) !important;
                    }
                    .react-datepicker__day:hover {
                         background-color: var(--accent-primary) !important;
                         color: white !important;
                    }
                    .react-datepicker__day--selected, .react-datepicker__day--range-start, .react-datepicker__day--range-end {
                        background-color: var(--accent-primary) !important;
                    }
                    .react-datepicker__day--in-range {
                         background-color: rgba(99, 102, 241, 0.3) !important;
                    }
                 `}</style>
             </div>
          )}
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: "24px" }}>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Latest Close</p>
            <p style={{ fontSize: "24px", fontWeight: "bold" }}>{formatNumber(stats.latest)}</p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period Change</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: stats.periodChange >= 0 ? "var(--accent-success)" : "var(--accent-danger)" }}>
              {stats.periodChange >= 0 ? "+" : ""}{stats.periodChange.toFixed(2)}%
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period High</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-success)" }}>{formatNumber(stats.high)}</p>
          </div>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Period Low</p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-danger)" }}>{formatNumber(stats.low)}</p>
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

      {/* High-Low-Close Analysis Chart */}
      {filteredData.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <TrendCard 
            title="Price Action Analysis (High/Low/Close)" 
            icon={Activity}
            explanation="Visualizes the daily volatility range. The gray bars show the High-Low range, while the purple line shows the Close price. Long bars indicate high volatility."
          >
            <div style={{ height: "400px" }}>
              <Bar 
                data={{
                  labels: filteredData.map(d => d.date),
                  datasets: [
                    {
                      type: 'line',
                      label: 'Close Price',
                      data: filteredData.map(d => d.close),
                      borderColor: '#4f46e5', // Indigo-600
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.4,
                      yAxisID: 'y',
                      order: 1
                    },
                    {
                      type: 'bar',
                      label: 'High Deviation (Green)',
                      data: filteredData.map(d => [d.close, d.high]),
                      backgroundColor: 'rgba(16, 185, 129, 0.6)', // Green
                      borderColor: 'rgba(16, 185, 129, 1)',
                      borderWidth: { top: 1, right: 1, bottom: 0, left: 1 },
                      borderSkipped: false,
                      barPercentage: 0.3,
                      yAxisID: 'y',
                      grouped: false, // Prevent lateral offset
                      order: 2
                    },
                    {
                      type: 'bar',
                      label: 'Low Deviation (Red)',
                      data: filteredData.map(d => [d.low, d.close]),
                      backgroundColor: 'rgba(239, 68, 68, 0.6)', // Red
                      borderColor: 'rgba(239, 68, 68, 1)',
                      borderWidth: { top: 0, right: 1, bottom: 1, left: 1 },
                      borderSkipped: false,
                      barPercentage: 0.3,
                      yAxisID: 'y',
                      grouped: false, // Prevent lateral offset
                      order: 3
                    }
                  ]
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                    }
                  }
                }}
              />
            </div>
          </TrendCard>
        </div>
      )}

      {/* Data Summary */}
      {stats && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", marginTop: "24px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Showing <strong style={{ color: "var(--text-primary)" }}>{stats.dataPoints}</strong> data points for{" "}
            <strong style={{ color: "var(--accent-primary)" }}>{currentSymbol}</strong> |{" "}
            Avg Daily Volume: <strong style={{ color: "var(--text-primary)" }}>{formatNumber(stats.avgVolume)}</strong>
          </p>
        </div>
      )}
    </div>
  );
};
