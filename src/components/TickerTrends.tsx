import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "../utils/formatters";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext"; // Import useSettings
import { useTickerSymbols, useTickerHistory } from "../hooks/useMarketQuery";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { Line, Bar } from "react-chartjs-2";
import { TrendingUp, Loader2, BarChart3, Activity, DollarSign, Info, Calendar, Bell, LucideIcon } from "lucide-react";
import { SkeletonTrendCard, SkeletonMiniStat } from "./Skeleton";
import { METRIC_EXPLANATIONS } from "../data/metricExplanations";
import { AlertModal } from "./AlertModal";
import { CustomSelect } from "./CustomSelect";
import { getCommonChartOptions } from "../utils/chartTheme";
import type {
  ChartOptions,
  ChartData,
  ChartDataset,
  LegendItem,
} from "chart.js";
import type { StockData } from "../types/market";
// Chart.js registration handled globally in App.tsx

interface MetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const calculateRSI = (closes: (number | null | undefined)[], period = 14): (number | null)[] => {
  const len = closes.length;
  if (len < period + 1) return Array(len).fill(null);

  // Seed: compute initial avg gain/loss over first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev == null || curr == null || isNaN(prev as number) || isNaN(curr as number)) {
      return Array(len).fill(null);
    }
    const change = (curr as number) - (prev as number);
    if (change >= 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  const result: (number | null)[] = Array(period).fill(null);
  const firstRS = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS));

  for (let i = period + 1; i < len; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev == null || curr == null || isNaN(prev as number) || isNaN(curr as number)) {
      result.push(null);
      continue;
    }
    const change = (curr as number) - (prev as number);
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }
  return result;
};

const calculateSMA = (closes: (number | null | undefined)[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = closes[j];
      if (v == null || isNaN(v)) {
        valid = false;
        break;
      }
      sum += v;
    }
    result.push(valid ? sum / period : null);
  }
  return result;
};

const calculateRollingVWAP = (
  closes: (number | null | undefined)[],
  volumes: (number | null | undefined)[],
  period: number
): (number | null)[] => {
  return closes.map((_, i) => {
    const start = Math.max(0, i - period + 1);
    let pv = 0;
    let v = 0;
    for (let j = start; j <= i; j++) {
      const c = closes[j];
      const vol = volumes[j];
      if (c != null && !isNaN(c) && vol != null && !isNaN(vol) && vol > 0) {
        pv += c * vol;
        v += vol;
      }
    }
    return v > 0 ? pv / v : null;
  });
};

interface OverlayConfig {
  key: string;
  label: string;
  period: number;
  color: string;
  borderDash: [number, number];
}

const VWAP_OVERLAYS: { key: string; label: string; period: number; color: string; borderDash: [number, number] }[] = [
  { key: "vwap20", label: "20-day VWAP", period: 20, color: "rgba(168, 85, 247, 0.85)", borderDash: [3, 2] },
  { key: "vwap50", label: "50-day VWAP", period: 50, color: "rgba(236, 72, 153, 0.85)", borderDash: [5, 3] },
];

const SMA_OVERLAYS: OverlayConfig[] = [
  { key: "sma20", label: "20-day SMA", period: 20, color: "rgba(245, 158, 11, 0.85)", borderDash: [4, 2] },
  { key: "sma50", label: "50-day SMA", period: 50, color: "rgba(14, 165, 233, 0.85)", borderDash: [6, 3] },
];

// Available metrics for visualization
const METRICS: MetricConfig[] = [
  { key: "close", label: "Close Price", icon: DollarSign, color: "#6366f1" },
  { key: "volume", label: "Volume", icon: BarChart3, color: "#10b981" },
  { key: "turnover", label: "Turnover", icon: Activity, color: "#f59e0b" },
  { key: "deals", label: "Deals", icon: TrendingUp, color: "#ec4899" },
  { key: "high", label: "High", icon: TrendingUp, color: "#22c55e" },
  { key: "low", label: "Low", icon: TrendingUp, color: "#ef4444" },
  { key: "mcap", label: "Market Cap", icon: DollarSign, color: "#8b5cf6" },
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

interface TrendCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  explanation?: string;
}

// Reusable card component
const TrendCard: React.FC<TrendCardProps> = ({ title, icon, children, explanation }) => {
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

export const TickerTrends: React.FC = () => {
  const { symbol: urlSymbol } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings(); // Use settings hook
  const chartTheme = getCommonChartOptions<"line">(settings.theme);
  const themeScales = chartTheme.scales ?? {};
  const themePluginOptions = chartTheme.plugins ?? {};

  
  // Track hidden metrics and persist to localStorage
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dseasy_hidden_metrics");
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to parse saved metrics state");
    }
    // Default: Show only Close Price, Volume, and Turnover. Hide the rest.
    return new Set(
      METRICS.map(m => m.key).filter(k => !['close', 'volume', 'turnover'].includes(k))
    );
  });

  // Auto-save hidden metrics whenever they change
  useEffect(() => {
    localStorage.setItem("dseasy_hidden_metrics", JSON.stringify(Array.from(hiddenMetrics)));
  }, [hiddenMetrics]);

  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dseasy_chart_overlays");
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {
      console.warn("Failed to parse saved overlay state");
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem("dseasy_chart_overlays", JSON.stringify(Array.from(activeOverlays)));
  }, [activeOverlays]);

  const [showRsi, setShowRsi] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("dseasy_show_rsi");
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true;
  });

  useEffect(() => {
    localStorage.setItem("dseasy_show_rsi", JSON.stringify(showRsi));
  }, [showRsi]);

  const toggleOverlay = (key: string): void => {
    setActiveOverlays(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
  const handleSymbolChange = (newSymbol: string): void => {
    navigate(`/trends/${newSymbol}`);
  };

  // Toggle metric visibility
  const toggleMetric = (key: string): void => {
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
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "6M");
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: searchParams.get("start") ? new Date(searchParams.get("start")!) : null,
    end: searchParams.get("end") ? new Date(searchParams.get("end")!) : null,
  });

  // Sync URL when period/dates change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (selectedPeriod === "6M") {
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
            const normalizeDate = (date: string | Date): Date => {
                 const d = new Date(date);
                 d.setHours(0,0,0,0);
                 return d;
            };

            const parseDate = (str: string): Date => {
                // ISO YYYY-MM-DD (standard) or DDMonYYYY (legacy fallback)
                if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
                const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
                if (!match) return new Date(str);
                const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
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
         const parseDate = (str: string): Date => {
            // ISO YYYY-MM-DD (standard) or DDMonYYYY (legacy fallback)
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
            const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
            if (!match) return new Date(str);
            const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const date = new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
            return date;
         };
         const itemDate = parseDate(d.date);
         itemDate.setHours(0,0,0,0);
         return itemDate >= cutoffDate;
    });

  }, [timeseriesData, selectedPeriod, customRange]);

  // SMA values are computed over the FULL history so the visible window
  // shows correct values even when the period start has fewer than N prior days.
  const smaByDate = useMemo(() => {
    const closes = timeseriesData.map(d => d.close);
    const result: Record<string, Map<string, number | null>> = {};
    SMA_OVERLAYS.forEach(overlay => {
      const series = calculateSMA(closes, overlay.period);
      const map = new Map<string, number | null>();
      timeseriesData.forEach((d, i) => map.set(d.date, series[i]));
      result[overlay.key] = map;
    });
    return result;
  }, [timeseriesData]);

  const vwapByDate = useMemo(() => {
    const closes = timeseriesData.map(d => d.close);
    const volumes = timeseriesData.map(d => d.volume);
    const result: Record<string, Map<string, number | null>> = {};
    VWAP_OVERLAYS.forEach(overlay => {
      const series = calculateRollingVWAP(closes, volumes, overlay.period);
      const map = new Map<string, number | null>();
      timeseriesData.forEach((d, i) => map.set(d.date, series[i]));
      result[overlay.key] = map;
    });
    return result;
  }, [timeseriesData]);

  // RSI computed over full history so the visible window shows correct warm-up values
  const rsiByDate = useMemo(() => {
    const closes = timeseriesData.map(d => d.close);
    const series = calculateRSI(closes);
    const map = new Map<string, number | null>();
    timeseriesData.forEach((d, i) => map.set(d.date, series[i]));
    return map;
  }, [timeseriesData]);

  const rsiData = useMemo(() => {
    if (!filteredData.length) return null;
    const labels = filteredData.map(d => d.date);
    const rsiValues = filteredData.map(d => rsiByDate.get(d.date) ?? null);
    if (!rsiValues.some(v => v !== null)) return null;
    return {
      labels,
      datasets: [
        {
          label: "RSI (14)",
          data: rsiValues,
          borderColor: "#a855f7",
          backgroundColor: "rgba(168, 85, 247, 0.08)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
          borderWidth: 2,
          order: 1,
        },
        {
          label: "Overbought (70)",
          data: Array(labels.length).fill(70),
          borderColor: "rgba(239, 68, 68, 0.7)",
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 2,
        },
        {
          label: "Oversold (30)",
          data: Array(labels.length).fill(30),
          borderColor: "rgba(16, 185, 129, 0.7)",
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 3,
        },
      ],
    };
  }, [filteredData, rsiByDate]);

  const hasActiveOverlay = activeOverlays.size > 0;

  const chartOptions = {
    ...chartTheme,
    plugins: {
        ...chartTheme.plugins,
        title: { display: false },
    },
    scales: {
      x: {
        ...themeScales.x,
        ticks: {
          ...themeScales.x?.ticks,
          maxTicksLimit: 10,
        },
      },
      y: {
        ...themeScales.y,
        ticks: {
          ...themeScales.y?.ticks,
          callback: (value: number | string) => {
            const v = Number(value);
            if (v >= 1000000000) return (v / 1000000000).toFixed(1) + "B";
            if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
            if (v >= 1000) return (v / 1000).toFixed(1) + "K";
            return value;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  const rsiChartOptions = {
    ...chartTheme,
    plugins: {
      ...themePluginOptions,
      title: { display: false },
      legend: {
        ...themePluginOptions.legend,
        labels: {
          ...themePluginOptions.legend?.labels,
          filter: (item: LegendItem) => item.text === "RSI (14)",
        },
      },
    },
    scales: {
      x: {
        ...themeScales.x,
        ticks: { ...themeScales.x?.ticks, maxTicksLimit: 10 },
      },
      y: {
        ...themeScales.y,
        min: 0,
        max: 100,
        ticks: { ...themeScales.y?.ticks, stepSize: 20 },
      },
    },
    interaction: { intersect: false, mode: "index" as const },
  };

  // Helper to generate chart data for any metric
  const getMetricData = (metricKey: string, color: string) => {
    if (!filteredData.length) return null;

    // Special handling for Close Price: pointRadius pinned to 1 to honour
    // the discrete daily-snapshot affordance, with optional SMA overlays.
    if (metricKey === "close") {
      const datasets: ChartDataset<"line", Array<number | null>>[] = [
        {
          label: "Close",
          data: filteredData.map((d) => (d.close === undefined || d.close === null) ? null : d.close),
          borderColor: color,
          backgroundColor: `${color}20`,
          fill: !hasActiveOverlay,
          tension: 0.3,
          pointRadius: 1,
          pointHoverRadius: 5,
          spanGaps: true,
          order: 1,
        },
      ];
      SMA_OVERLAYS.forEach(overlay => {
        if (!activeOverlays.has(overlay.key)) return;
        const map = smaByDate[overlay.key];
        datasets.push({
          label: overlay.label,
          data: filteredData.map((d) => map?.get(d.date) ?? null),
          borderColor: overlay.color,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: overlay.borderDash,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
          order: 2,
        });
      });
      VWAP_OVERLAYS.forEach(overlay => {
        if (!activeOverlays.has(overlay.key)) return;
        const map = vwapByDate[overlay.key];
        datasets.push({
          label: overlay.label,
          data: filteredData.map((d) => map?.get(d.date) ?? null),
          borderColor: overlay.color,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: overlay.borderDash,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
          order: 2,
        });
      });
      return {
        labels: filteredData.map((d) => d.date),
        datasets,
      };
    }

    // Special handling for Volume (Bar Chart with conditional colors)
    if (metricKey === "volume") {
      return {
        labels: filteredData.map((d) => d.date),
        datasets: [
          {
            label: "Volume",
            data: filteredData.map((d) => d.volume !== undefined && d.volume !== null ? d.volume : null),
            backgroundColor: filteredData.map((d, i) => {
              if (i === 0) return "rgba(99, 102, 241, 0.7)";
              const prevClose = filteredData[i - 1].close;
              const currClose = d.close;
              if (currClose == null || prevClose == null) return "rgba(99, 102, 241, 0.7)"; // Neutral color if comparison unavailable
              return currClose >= prevClose
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
          data: filteredData.map((d) => {
             const val = d[metricKey as keyof StockData];
             if (val === undefined || val === null || typeof val !== "number") return null;
             return metricKey === 'turnoverPct' ? val * 100 : val;
          }),
          borderColor: color,
          backgroundColor: `${color}20`,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
          spanGaps: true, // Interpolate lines across gaps resulting from missing data
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
      avgVolume: filteredData.reduce((sum, d) => sum + (d.volume ?? 0), 0) / filteredData.length,
      dataPoints: filteredData.length,
    };
  }, [filteredData]);

  // Loading state (only for initial symbols load, not data switch)
  if (loadingSymbols && symbols.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: "var(--space-8)" }}>
          <div className="skeleton" style={{ width: "220px", height: "28px", marginBottom: "var(--space-2)" }} />
          <div className="skeleton" style={{ width: "340px", height: "16px" }} />
        </div>
        <div className="charts-grid">
          <SkeletonTrendCard />
          <SkeletonTrendCard />
          <SkeletonTrendCard />
        </div>
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
              <CustomSelect
                value={currentSymbol}
                options={[
                  ...(currentSymbol && !symbols.includes(currentSymbol)
                    ? [{ label: currentSymbol, value: currentSymbol }]
                    : []),
                  ...symbols.map((s) => ({ label: s, value: s })),
                ]}
                onChange={(v) => handleSymbolChange(v as string)}
              />
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
                        onChange={(date: Date | null) => setCustomRange(prev => ({ ...prev, start: date }))}
                        selectsStart
                        startDate={customRange.start ?? undefined}
                        endDate={customRange.end ?? undefined}
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
                        onChange={(date: Date | null) => setCustomRange(prev => ({ ...prev, end: date }))}
                        selectsEnd
                        startDate={customRange.start ?? undefined}
                        endDate={customRange.end ?? undefined}
                        minDate={customRange.start ?? undefined}
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

      {/* Hero stats — skeleton reserves space while data loads to prevent CLS */}
      {loadingData ? (
        <div className="stats-grid" style={{ marginBottom: "24px" }}>
          {Array.from({ length: 4 }, (_, i) => <SkeletonMiniStat key={i} />)}
        </div>
      ) : stats ? (
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
      ) : null}

      {/* Metric Visibility Toggles */}
      <details className="glass-panel" style={{ padding: "16px", borderRadius: "12px", marginBottom: "24px", transition: "all 0.3s ease" }}>
        <summary style={{ cursor: "pointer", fontWeight: "var(--font-semibold)", display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", outline: "none" }}>
           <BarChart3 size={18} color="var(--accent-primary)" />
           <span>Customize Visible Charts</span>
        </summary>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap", paddingLeft: "26px" }}>
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
          {/* RSI indicator toggle */}
          <button
            onClick={() => setShowRsi(v => !v)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: showRsi ? "1px solid var(--glass-border)" : "1px dashed var(--text-secondary)",
              background: showRsi ? "#a855f7" : "transparent",
              color: showRsi ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              transition: "all 0.2s ease",
              textDecoration: showRsi ? "none" : "line-through",
              opacity: showRsi ? 1 : 0.6,
            }}
          >
            RSI (14)
          </button>
        </div>
      </details>

      {/* Charts Grid */}
      <div className="charts-grid">
        {METRICS.map((metric) => {
          if (hiddenMetrics.has(metric.key)) return null;

          const data = getMetricData(metric.key, metric.color);
          const isVolume = metric.key === "volume";

          return (
            <TrendCard
              key={metric.key}
              title={`${metric.label} Trend`}
              icon={metric.icon}
              explanation={(METRIC_EXPLANATIONS as Record<string, string>)[metric.key]}
            >
               <div style={{ height: "320px" }}>
                  {data ? (
                     isVolume ? (
                       <Bar data={data as ChartData<"bar">} options={chartOptions as ChartOptions<"bar">} />
                     ) : (
                       <Line data={data as ChartData<"line">} options={chartOptions} />
                     )
                  ) : (
                    loadingData
                      ? <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)" }} />
                      : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>No data available</div>
                  )}
               </div>
               {metric.key === "close" && (
                 <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                   <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, marginRight: "4px" }}>Overlays:</span>
                   {[...SMA_OVERLAYS, ...VWAP_OVERLAYS].map(overlay => {
                     const active = activeOverlays.has(overlay.key);
                     const fillColor = overlay.color.replace(/[\d.]+\)$/, "0.18)");
                     return (
                       <button
                         key={overlay.key}
                         onClick={() => toggleOverlay(overlay.key)}
                         style={{
                           padding: "4px 12px",
                           borderRadius: "16px",
                           border: active ? `1px solid ${overlay.color}` : "1px dashed var(--text-secondary)",
                           background: active ? fillColor : "transparent",
                           color: active ? "var(--text-primary)" : "var(--text-secondary)",
                           fontSize: "12px",
                           fontWeight: 500,
                           cursor: "pointer",
                           transition: "all 0.2s ease",
                           opacity: active ? 1 : 0.7,
                         }}
                       >
                         {overlay.label}
                       </button>
                     );
                   })}
                 </div>
               )}
            </TrendCard>
          );
        })}
      </div>

      {/* RSI Sub-chart */}
      {showRsi && (
        <div style={{ marginTop: "24px" }}>
          <TrendCard
            title="RSI – Relative Strength Index (14)"
            icon={Activity}
            explanation="RSI measures momentum on a 0–100 scale over a 14-day lookback period — Wilder's original choice, representing half a 28-day market cycle. Each value reflects the average gain vs. average loss across the prior 14 closes. Readings above 70 suggest the asset may be overbought; below 30 suggests oversold."
          >
            <div style={{ height: "200px" }}>
              {rsiData ? (
                <Line data={rsiData} options={rsiChartOptions as ChartOptions<"line">} />
              ) : (
                loadingData
                  ? <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)" }} />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: "13px" }}>Not enough data — RSI requires at least 15 closing prices</div>
              )}
            </div>
            {rsiData && (
              <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px", color: "var(--text-secondary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "20px", borderTop: "2px dashed rgba(239,68,68,0.7)" }} />
                  Overbought (70)
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "20px", borderTop: "2px dashed rgba(16,185,129,0.7)" }} />
                  Oversold (30)
                </span>
              </div>
            )}
          </TrendCard>
        </div>
      )}

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
                      data: filteredData.map(d => d.close !== undefined && d.close !== null ? d.close : null),
                      borderColor: '#4f46e5', // Indigo-600
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.4,
                      yAxisID: 'y',
                      order: 1,
                      spanGaps: true
                    },
                    {
                      type: 'bar',
                      label: 'High Deviation (Green)',
                      data: filteredData.map(d => (d.close == null || d.high == null) ? null : [d.close, d.high]),
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
                      data: filteredData.map(d => (d.close == null || d.low == null) ? null : [d.low, d.close]),
                      backgroundColor: 'rgba(239, 68, 68, 0.6)', // Red
                      borderColor: 'rgba(239, 68, 68, 1)',
                      borderWidth: { top: 0, right: 1, bottom: 1, left: 1 },
                      borderSkipped: false,
                      barPercentage: 0.3,
                      yAxisID: 'y',
                      grouped: false, // Prevent lateral offset
                      order: 3
                    }
                  ] as ChartData<"bar">["datasets"],
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
                } as ChartOptions<"bar">}
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
