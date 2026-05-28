import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { useTickerSymbols, useTickerHistory, StockData } from "../hooks/useMarketQuery";
import { Line } from "react-chartjs-2";
import { getCommonChartOptions } from "../utils/chartTheme";
import type { ChartOptions, TooltipItem } from "chart.js";
import { CustomSelect } from "./CustomSelect";
import { GitCompare, Plus, X } from "lucide-react";
import { SkeletonChart } from "./Skeleton";
import { TickerLogo } from "./TickerLogo";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const SYMBOL_COLORS = ["#6366f1", "#10b981", "#f59e0b"];
const MIN_SYMBOLS = 2;
const MAX_SYMBOLS = 3;

const PERIOD_OPTIONS = [
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "ALL", value: "ALL" },
  { label: "Custom", value: "Custom" },
];

const parseSheetDate = (str: string | undefined): Date => {
  if (!str) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
  const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
  if (!match) return new Date(str);
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
};

// Rolling 20-day volatility (std dev of daily % returns), computed over full history
const calculateRollingVolatility = (closes: number[], period = 20): (number | null)[] => {
  const returns: (number | null)[] = [null];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    returns.push(prev > 0 ? ((curr - prev) / prev) * 100 : null);
  }

  return returns.map((_, i) => {
    if (i < period) return null;
    const window = returns.slice(i - period + 1, i + 1).filter((r): r is number => r != null);
    if (window.length < period) return null;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  });
};

const filterByPeriod = (
  data: StockData[],
  period: string,
  customRange: { start: Date | null; end: Date | null }
): StockData[] => {
  if (!data.length) return [];
  if (period === "ALL") return data;

  if (period === "Custom") {
    return data.filter((d) => {
      const itemDate = parseSheetDate(d.date);
      itemDate.setHours(0, 0, 0, 0);
      if (customRange.start) {
        const s = new Date(customRange.start);
        s.setHours(0, 0, 0, 0);
        if (itemDate < s) return false;
      }
      if (customRange.end) {
        const e = new Date(customRange.end);
        e.setHours(0, 0, 0, 0);
        if (itemDate > e) return false;
      }
      return true;
    });
  }

  const cutoff = new Date();
  switch (period) {
    case "1W": cutoff.setDate(cutoff.getDate() - 7); break;
    case "1M": cutoff.setMonth(cutoff.getMonth() - 1); break;
    case "3M": cutoff.setMonth(cutoff.getMonth() - 3); break;
    case "6M": cutoff.setMonth(cutoff.getMonth() - 6); break;
    case "1Y": cutoff.setFullYear(cutoff.getFullYear() - 1); break;
  }
  cutoff.setHours(0, 0, 0, 0);

  return data.filter((d) => {
    const itemDate = parseSheetDate(d.date);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate >= cutoff;
  });
};

export const CompareTickers: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();

  // Parse initial symbols from URL, pad to MIN_SYMBOLS
  const urlSymbols = (searchParams.get("s") || "").split(",").filter(Boolean);
  const initSymbols = [
    urlSymbols[0] || "",
    urlSymbols[1] || "",
    ...(urlSymbols[2] ? [urlSymbols[2]] : []),
  ];
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(initSymbols);

  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "6M");
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: searchParams.get("start") ? new Date(searchParams.get("start")!) : null,
    end: searchParams.get("end") ? new Date(searchParams.get("end")!) : null,
  });

  // Symbol slot management
  const addSymbol = () => {
    if (selectedSymbols.length < MAX_SYMBOLS) {
      setSelectedSymbols((prev) => [...prev, ""]);
    }
  };

  const removeSymbol = (index: number) => {
    setSelectedSymbols((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSymbol = (index: number, value: string) => {
    setSelectedSymbols((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  // Sync state back to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const activeSymbols = selectedSymbols.filter(Boolean);
    if (activeSymbols.length) params.set("s", activeSymbols.join(","));
    else params.delete("s");

    if (selectedPeriod === "6M") params.delete("period");
    else params.set("period", selectedPeriod);

    if (selectedPeriod === "Custom") {
      if (customRange.start) params.set("start", customRange.start.toISOString().split("T")[0]);
      if (customRange.end) params.set("end", customRange.end.toISOString().split("T")[0]);
    } else {
      params.delete("start");
      params.delete("end");
    }

    setSearchParams(params, { replace: true });
  }, [selectedSymbols, selectedPeriod, customRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: symbols = [], isLoading: loadingSymbols } = useTickerSymbols();
  const symbolOptions = symbols.map((s) => ({ label: s, value: s }));

  // Fixed hook calls for MAX_SYMBOLS slots — hooks must not be conditional
  const { data: raw0 = [], isLoading: loading0 } = useTickerHistory(selectedSymbols[0] || "");
  const { data: raw1 = [], isLoading: loading1 } = useTickerHistory(selectedSymbols[1] || "");
  const { data: raw2 = [], isLoading: loading2 } = useTickerHistory(selectedSymbols[2] || "");

  const rawSlots = [
    { data: raw0, isLoading: loading0 },
    { data: raw1, isLoading: loading1 },
    { data: raw2, isLoading: loading2 },
  ];

  const isLoading =
    loadingSymbols ||
    rawSlots.some((slot, i) => !!selectedSymbols[i] && slot.isLoading);

  const allFiltered = useMemo(
    () =>
      rawSlots.map((slot, i) =>
        selectedSymbols[i] ? filterByPeriod(slot.data, selectedPeriod, customRange) : []
      ),
    [raw0, raw1, raw2, selectedSymbols, selectedPeriod, customRange] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const chartData = useMemo(() => {
    const slots = selectedSymbols
      .map((symbol, i) => ({ symbol, data: allFiltered[i] }))
      .filter((s) => s.symbol && s.data.length > 0);

    if (slots.length < 2) return null;

    const dateSet = new Set<string>();
    slots.forEach((slot) =>
      slot.data.forEach((d) => {
        if (d.date) dateSet.add(d.date);
      }),
    );
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const closeMap = new Map<string, number>(
        slot.data
          .filter((d): d is StockData & { date: string } => Boolean(d.date))
          .map((d) => [d.date, d.close]),
      );

      let firstClose: number | null = null;
      for (const date of allDates) {
        const c = closeMap.get(date);
        if (c != null && c > 0) { firstClose = c; break; }
      }

      const values = allDates.map((date) => {
        const c = closeMap.get(date);
        if (c == null || c <= 0 || firstClose == null) return null;
        return ((c / firstClose) - 1) * 100;
      });

      const color = SYMBOL_COLORS[i];
      return {
        label: slot.symbol,
        data: values,
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        hitRadius: 20,
        tension: 0.3,
        spanGaps: true,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [selectedSymbols, allFiltered]);

  const chartOptions = useMemo<ChartOptions<"line">>(() => {
    const base = getCommonChartOptions<"line">(settings.theme);
    return {
      ...base,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        ...base.plugins,
        legend: { display: false }, // custom legend rendered manually
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const v = ctx.parsed.y;
              if (v == null) return `${ctx.dataset.label}: N/A`;
              return `${ctx.dataset.label}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        ...base.scales,
        y: {
          ...base.scales?.y,
          ticks: {
            ...base.scales?.y?.ticks,
            callback: (v: number | string) => {
              const n = Number(v);
              return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
            },
          },
        },
      },
    };
  }, [settings.theme]);

  // Rolling volatility chart data — computed over full history, displayed over filtered window
  const volChartData = useMemo(() => {
    const slots = selectedSymbols
      .map((symbol, i) => ({ symbol, full: rawSlots[i].data, filtered: allFiltered[i] }))
      .filter((s) => s.symbol && s.filtered.length > 0);

    if (slots.length < 2) return null;

    const dateSet = new Set<string>();
    slots.forEach((slot) =>
      slot.filtered.forEach((d) => {
        if (d.date) dateSet.add(d.date);
      }),
    );
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const volSeries = calculateRollingVolatility(slot.full.map((d) => d.close));
      const volByDate = new Map<string, number | null>(
        slot.full
          .map((d, idx) => [d.date, volSeries[idx]] as const)
          .filter((entry): entry is readonly [string, number | null] => Boolean(entry[0])),
      );
      const color = SYMBOL_COLORS[i];
      return {
        label: slot.symbol,
        data: allDates.map((date) => volByDate.get(date) ?? null),
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        hitRadius: 20,
        tension: 0.3,
        spanGaps: true,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [selectedSymbols, allFiltered, raw0, raw1, raw2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turnover chart data — normalized % change from period start (same approach as price chart)
  const turnoverChartData = useMemo(() => {
    const slots = selectedSymbols
      .map((symbol, i) => ({ symbol, filtered: allFiltered[i] }))
      .filter((s) => s.symbol && s.filtered.length > 0);

    if (slots.length < 2) return null;

    const dateSet = new Set<string>();
    slots.forEach((slot) =>
      slot.filtered.forEach((d) => {
        if (d.date) dateSet.add(d.date);
      }),
    );
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const turnoverMap = new Map<string, number>(
        slot.filtered
          .filter((d): d is StockData & { date: string } => Boolean(d.date))
          .map((d) => [d.date, d.turnover || 0]),
      );

      let firstTurnover: number | null = null;
      for (const date of allDates) {
        const t = turnoverMap.get(date);
        if (t != null && t > 0) { firstTurnover = t; break; }
      }

      const color = SYMBOL_COLORS[i];
      return {
        label: slot.symbol,
        data: allDates.map((date) => {
          const t = turnoverMap.get(date);
          if (t == null || t <= 0 || firstTurnover == null) return null;
          return ((t / firstTurnover) - 1) * 100;
        }),
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        hitRadius: 20,
        tension: 0.2,
        spanGaps: true,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [selectedSymbols, allFiltered]);

  const volChartOptions = useMemo<ChartOptions<"line">>(() => {
    const base = getCommonChartOptions<"line">(settings.theme);
    return {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...base.plugins,
        legend: { display: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const v = ctx.parsed.y;
              if (v == null) return `${ctx.dataset.label}: N/A`;
              return `${ctx.dataset.label}: ${v.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        ...base.scales,
        y: {
          ...base.scales?.y,
          ticks: {
            ...base.scales?.y?.ticks,
            callback: (v: number | string) => `${Number(v).toFixed(1)}%`,
          },
        },
      },
    };
  }, [settings.theme]);

  const turnoverChartOptions = useMemo<ChartOptions<"line">>(() => {
    const base = getCommonChartOptions<"line">(settings.theme);
    return {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...base.plugins,
        legend: { display: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const v = ctx.parsed.y;
              if (v == null) return `${ctx.dataset.label}: N/A`;
              return `${ctx.dataset.label}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        ...base.scales,
        y: {
          ...base.scales?.y,
          ticks: {
            ...base.scales?.y?.ticks,
            callback: (v: number | string) => {
              const n = Number(v);
              return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
            },
          },
        },
      },
    };
  }, [settings.theme]);

  const comparisonMatrix = useMemo(() => {
    const slots = selectedSymbols
      .map((symbol, i) => ({ symbol, full: rawSlots[i].data, filtered: allFiltered[i], color: SYMBOL_COLORS[i] }))
      .filter((s) => s.symbol && s.full.length > 0);

    if (slots.length < 2) return null;

    return slots.map((slot) => {
      const fullSorted = [...slot.full].sort(
        (a, b) => parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime()
      );
      
      const filteredSorted = [...slot.filtered].sort(
        (a, b) => parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime()
      );

      const latest = fullSorted[fullSorted.length - 1];
      const latestClose = latest ? latest.close : 0;

      // growth calculation helper
      const calculateGrowth = (days: number) => {
        if (fullSorted.length < 2 || !latest) return null;
        const latestDate = parseSheetDate(latest.date);
        if (isNaN(latestDate.getTime())) return null;

        const targetTime = latestDate.getTime() - days * 24 * 60 * 60 * 1000;
        
        let closest = fullSorted[0];
        let minDiff = Infinity;
        
        for (const d of fullSorted) {
          if (!d.date || d.close <= 0) continue;
          const dDate = parseSheetDate(d.date);
          if (isNaN(dDate.getTime())) continue;
          
          const diff = Math.abs(dDate.getTime() - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = d;
          }
        }
        
        if (closest && closest.close > 0 && closest !== latest) {
          return ((latestClose - closest.close) / closest.close) * 100;
        }
        return null;
      };

      // Filtered period growth, peak, trough, avg volatility, avg daily volume
      let selectedGrowth: number | null = null;
      let peakGrowth = -Infinity;
      let troughGrowth = Infinity;
      let avgVolatility: number | null = null;
      let avgTurnover: number | null = null;

      if (filteredSorted.length > 0) {
        const firstFiltered = filteredSorted[0];
        const firstFilteredClose = firstFiltered ? firstFiltered.close : 0;
        
        if (firstFilteredClose > 0) {
          selectedGrowth = ((latestClose - firstFilteredClose) / firstFilteredClose) * 100;
          
          filteredSorted.forEach((d) => {
            if (d.close > 0) {
              const relGrowth = ((d.close - firstFilteredClose) / firstFilteredClose) * 100;
              if (relGrowth > peakGrowth) peakGrowth = relGrowth;
              if (relGrowth < troughGrowth) troughGrowth = relGrowth;
            }
          });
        }

        // Calculate average volatility over the filtered period
        const volSeries = calculateRollingVolatility(fullSorted.map((d) => d.close));
        const volByDate = new Map<string, number | null>(
          fullSorted
            .map((d, idx) => [d.date, volSeries[idx]] as const)
            .filter((entry): entry is readonly [string, number | null] => Boolean(entry[0]))
        );

        let volSum = 0;
        let volCount = 0;
        let turnoverSum = 0;
        let turnoverCount = 0;

        filteredSorted.forEach((d) => {
          if (d.date) {
            const v = volByDate.get(d.date);
            if (v != null) {
              volSum += v;
              volCount++;
            }
            if (d.turnover != null && d.turnover > 0) {
              turnoverSum += d.turnover;
              turnoverCount++;
            }
          }
        });

        avgVolatility = volCount > 0 ? volSum / volCount : null;
        avgTurnover = turnoverCount > 0 ? turnoverSum / turnoverCount : null;
      }

      return {
        symbol: slot.symbol,
        color: slot.color,
        latestClose,
        growth1W: calculateGrowth(7),
        growth1M: calculateGrowth(30),
        growth3M: calculateGrowth(90),
        growth6M: calculateGrowth(180),
        growth1Y: calculateGrowth(365),
        selectedGrowth,
        peakGrowth: peakGrowth !== -Infinity ? peakGrowth : null,
        troughGrowth: troughGrowth !== Infinity ? troughGrowth : null,
        avgVolatility,
        avgTurnover,
      };
    });
  }, [selectedSymbols, allFiltered, raw0, raw1, raw2]);

  const renderPercentCell = (val: number | null, isWinner: boolean) => {
    if (val == null) return <span style={{ color: "var(--text-muted)" }}>N/A</span>;
    const isPos = val >= 0;
    const color = isPos ? "var(--accent-success)" : "var(--accent-danger)";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          color: color,
          fontWeight: isWinner ? "var(--font-bold)" : "var(--font-medium)",
          fontSize: "var(--text-sm)",
        }}
      >
        <span>{isPos ? "+" : ""}{val.toFixed(2)}%</span>
        {isWinner && <span style={{ fontSize: "11px" }}>🏆</span>}
      </div>
    );
  };

  // For each picker, exclude symbols chosen in other slots
  const optionsFor = (currentIndex: number) =>
    symbolOptions.filter((o) => {
      const othersSelected = selectedSymbols.filter((_, i) => i !== currentIndex);
      return !othersSelected.includes(o.value as string);
    });

  const activeSymbolCount = selectedSymbols.filter(Boolean).length;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-bold)",
            margin: "0 0 4px 0",
            color: "var(--text-primary)",
          }}
        >
          Compare Tickers
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-sm)" }}>
          Normalized % price performance from the start of the selected period
        </p>
      </div>

      {/* Controls */}
      <div
        className="glass-panel"
        style={{ padding: "20px", marginBottom: "24px", borderRadius: "var(--radius-xl)" }}
      >
        {/* Symbol pickers */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              fontWeight: "var(--font-medium)",
              marginBottom: "10px",
            }}
          >
            Symbols
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedSymbols.map((symbol, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Colored indicator dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: SYMBOL_COLORS[i],
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, maxWidth: "260px" }}>
                  <CustomSelect
                    value={symbol}
                    options={[{ label: "Select symbol...", value: "" }, ...optionsFor(i)]}
                    onChange={(v) => updateSymbol(i, v as string)}
                    placeholder={`Symbol ${i + 1}`}
                  />
                </div>
                {/* Remove button — only shown when above minimum */}
                {selectedSymbols.length > MIN_SYMBOLS && (
                  <button
                    onClick={() => removeSymbol(i)}
                    title="Remove symbol"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-danger, #ef4444)";
                      e.currentTarget.style.color = "var(--accent-danger, #ef4444)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--glass-border)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* Add symbol button — only shown when below maximum */}
            {selectedSymbols.length < MAX_SYMBOLS && (
              <button
                onClick={addSymbol}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  background: "transparent",
                  border: "1px dashed var(--glass-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-medium)",
                  transition: "all 0.2s",
                  alignSelf: "flex-start",
                  marginTop: "2px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-primary)";
                  e.currentTarget.style.color = "var(--accent-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--glass-border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <Plus size={13} />
                Add symbol
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--glass-border)", marginBottom: "20px" }} />

        {/* Period buttons */}
        <div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              fontWeight: "var(--font-medium)",
              marginBottom: "10px",
            }}
          >
            Period
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedPeriod(opt.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid",
                  borderColor:
                    selectedPeriod === opt.value ? "var(--accent-primary)" : "var(--glass-border)",
                  background:
                    selectedPeriod === opt.value
                      ? "rgba(99,102,241,0.15)"
                      : "var(--bg-elevated)",
                  color:
                    selectedPeriod === opt.value
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-medium)",
                  transition: "all 0.2s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range pickers */}
          {selectedPeriod === "Custom" && (
            <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  From
                </div>
                <DatePicker
                  selected={customRange.start}
                  onChange={(date: Date | null) => setCustomRange((prev) => ({ ...prev, start: date }))}
                  selectsStart
                  startDate={customRange.start}
                  endDate={customRange.end}
                  dateFormat="dd MMM yyyy"
                  placeholderText="Start date"
                  className="date-input"
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  To
                </div>
                <DatePicker
                  selected={customRange.end}
                  onChange={(date: Date | null) => setCustomRange((prev) => ({ ...prev, end: date }))}
                  selectsEnd
                  startDate={customRange.start}
                  endDate={customRange.end}
                  minDate={customRange.start ?? undefined}
                  dateFormat="dd MMM yyyy"
                  placeholderText="End date"
                  className="date-input"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      {isLoading ? (
        <>
          <SkeletonChart height={508} />
          <div style={{ marginTop: 24 }}>
            <SkeletonChart height={380} />
          </div>
          <div style={{ marginTop: 24 }}>
            <SkeletonChart height={380} />
          </div>
        </>
      ) : activeSymbolCount < 2 ? (
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            borderRadius: "var(--radius-xl)",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(99,102,241,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <GitCompare size={36} color="var(--accent-primary)" strokeWidth={1.5} />
          </div>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              margin: "0 0 8px 0",
              color: "var(--text-primary)",
            }}
          >
            Select at least 2 symbols to compare
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              margin: 0,
              maxWidth: "360px",
              lineHeight: 1.6,
            }}
          >
            Choose two tickers above to see their normalized price performance on the same chart.
          </p>
        </div>
      ) : !chartData ? (
        <div
          className="glass-panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            No data available for the selected period.
          </p>
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{ padding: "24px", borderRadius: "var(--radius-xl)" }}
        >
          {/* Custom legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {chartData.datasets.map((ds, i) => (
                <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "16px",
                      height: "3px",
                      background: SYMBOL_COLORS[i],
                      borderRadius: "2px",
                    }}
                  />
                  <TickerLogo symbol={ds.label || ""} size={20} />
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ds.label}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              Normalized to 0% at start of period
            </span>
          </div>

          <div style={{ height: "420px" }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Visual comparison breakdown matrix */}
      {!isLoading && activeSymbolCount >= 2 && comparisonMatrix && (
        <div
          className="glass-panel page-transition"
          style={{
            padding: "24px",
            borderRadius: "var(--radius-xl)",
            marginTop: "24px",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "var(--text-base)",
                fontWeight: "var(--font-bold)",
                margin: "0 0 6px 0",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <GitCompare size={18} color="var(--accent-primary)" />
              Performance & Metrics Breakdown
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-xs)" }}>
              Side-by-side growth percentages and key volatility metrics for the selected tickers
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontFamily: "var(--font-sans)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-bold)",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Horizon / Statistic
                  </th>
                  {comparisonMatrix.map((item) => (
                    <th
                      key={item.symbol}
                      style={{
                        padding: "12px 16px",
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--font-bold)",
                        color: "var(--text-primary)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: item.color,
                          }}
                        />
                        <TickerLogo symbol={item.symbol} size={18} />
                        <span>{item.symbol}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Latest Close Row */}
                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border)",
                    transition: "background 0.2s",
                  }}
                  className="hover-bg"
                >
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Latest Close Price
                  </td>
                  {comparisonMatrix.map((item) => (
                    <td
                      key={item.symbol}
                      style={{
                        padding: "14px 16px",
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--text-primary)",
                        textAlign: "center",
                      }}
                    >
                      TZS {item.latestClose.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                  ))}
                </tr>

                {/* Sub-periods Growth rows */}
                {[
                  { label: "1-Week Growth", key: "growth1W" },
                  { label: "1-Month Growth", key: "growth1M" },
                  { label: "3-Month Growth", key: "growth3M" },
                  { label: "6-Month Growth", key: "growth6M" },
                  { label: "1-Year Growth", key: "growth1Y" },
                  { label: `Selected Period Growth (${selectedPeriod})`, key: "selectedGrowth" },
                ].map((row) => {
                  // Find the maximum value in the row to award the crown
                  let maxVal = -Infinity;
                  comparisonMatrix.forEach((item) => {
                    const val = item[row.key as keyof typeof item] as number | null;
                    if (val != null && val > maxVal) {
                      maxVal = val;
                    }
                  });

                  return (
                    <tr
                      key={row.key}
                      style={{
                        borderBottom: "1px solid var(--glass-border)",
                        transition: "background 0.2s",
                      }}
                      className="hover-bg"
                    >
                      <td
                        style={{
                          padding: "14px 16px",
                          fontSize: "var(--text-sm)",
                          fontWeight: "var(--font-medium)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.label}
                      </td>
                      {comparisonMatrix.map((item) => {
                        const val = item[row.key as keyof typeof item] as number | null;
                        const isWinner = val != null && val === maxVal && comparisonMatrix.length > 1;
                        return (
                          <td key={item.symbol} style={{ padding: "14px 16px", textAlign: "center" }}>
                            {renderPercentCell(val, isWinner)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Period statistics */}
                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border)",
                    transition: "background 0.2s",
                  }}
                  className="hover-bg"
                >
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Peak Growth in Period
                  </td>
                  {comparisonMatrix.map((item) => {
                    let isWinner = false;
                    if (item.peakGrowth != null && comparisonMatrix.length > 1) {
                      const allPeaks = comparisonMatrix
                        .map((x) => x.peakGrowth)
                        .filter((v): v is number => v != null);
                      isWinner = item.peakGrowth === Math.max(...allPeaks);
                    }
                    return (
                      <td key={item.symbol} style={{ padding: "14px 16px", textAlign: "center" }}>
                        {renderPercentCell(item.peakGrowth, isWinner)}
                      </td>
                    );
                  })}
                </tr>

                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border)",
                    transition: "background 0.2s",
                  }}
                  className="hover-bg"
                >
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Trough Growth in Period
                  </td>
                  {comparisonMatrix.map((item) => {
                    let isWinner = false;
                    if (item.troughGrowth != null && comparisonMatrix.length > 1) {
                      const allTroughs = comparisonMatrix
                        .map((x) => x.troughGrowth)
                        .filter((v): v is number => v != null);
                      isWinner = item.troughGrowth === Math.max(...allTroughs); // highlight highest trough (best downside protection!)
                    }
                    return (
                      <td key={item.symbol} style={{ padding: "14px 16px", textAlign: "center" }}>
                        {renderPercentCell(item.troughGrowth, isWinner)}
                      </td>
                    );
                  })}
                </tr>

                {/* Average Volatility */}
                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border)",
                    transition: "background 0.2s",
                  }}
                  className="hover-bg"
                >
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Avg Daily Volatility (20D rolling)
                  </td>
                  {comparisonMatrix.map((item) => {
                    let isLowest = false;
                    if (item.avgVolatility != null && comparisonMatrix.length > 1) {
                      const allVols = comparisonMatrix
                        .map((x) => x.avgVolatility)
                        .filter((v): v is number => v != null);
                      isLowest = item.avgVolatility === Math.min(...allVols); // lowest volatility is winner (lowest risk)
                    }
                    return (
                      <td
                        key={item.symbol}
                        style={{
                          padding: "14px 16px",
                          fontSize: "var(--text-sm)",
                          fontWeight: isLowest ? "var(--font-bold)" : "var(--font-medium)",
                          color: "var(--text-primary)",
                          textAlign: "center",
                        }}
                      >
                        {item.avgVolatility != null ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                          >
                            <span>{item.avgVolatility.toFixed(2)}%</span>
                            {isLowest && (
                              <span
                                style={{ fontSize: "10px", color: "var(--accent-success)" }}
                                title="Lowest Risk (Beta/Volatility)"
                              >
                                🛡️
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>N/A</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Avg Daily Turnover */}
                <tr style={{ transition: "background 0.2s" }} className="hover-bg">
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Avg Daily Turnover in Period
                  </td>
                  {comparisonMatrix.map((item) => {
                    let isWinner = false;
                    if (item.avgTurnover != null && comparisonMatrix.length > 1) {
                      const allTurnovers = comparisonMatrix
                        .map((x) => x.avgTurnover)
                        .filter((v): v is number => v != null);
                      isWinner = item.avgTurnover === Math.max(...allTurnovers); // highest liquidity is winner
                    }
                    return (
                      <td
                        key={item.symbol}
                        style={{
                          padding: "14px 16px",
                          fontSize: "var(--text-sm)",
                          fontWeight: isWinner ? "var(--font-bold)" : "var(--font-medium)",
                          color: "var(--text-primary)",
                          textAlign: "center",
                        }}
                      >
                        {item.avgTurnover != null ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                          >
                            <span>
                              TZS {item.avgTurnover.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            {isWinner && (
                              <span
                                style={{ fontSize: "10px", color: "var(--accent-primary)" }}
                                title="Highest Liquidity"
                              >
                                💧
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>N/A</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rolling Volatility chart */}
      {!isLoading && activeSymbolCount >= 2 && volChartData && (
        <div
          className="glass-panel"
          style={{ padding: "24px", borderRadius: "var(--radius-xl)", marginTop: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {volChartData.datasets.map((ds, i) => (
                <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "3px",
                      background: SYMBOL_COLORS[i],
                      borderRadius: "2px",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ds.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                20-day Rolling Volatility
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.7, marginTop: "2px" }}>
                Std dev of daily % returns — higher = riskier
              </div>
            </div>
          </div>
          <div style={{ height: "280px" }}>
            <Line data={volChartData} options={volChartOptions} />
          </div>
        </div>
      )}

      {/* Turnover chart */}
      {!isLoading && activeSymbolCount >= 2 && turnoverChartData && (
        <div
          className="glass-panel"
          style={{ padding: "24px", borderRadius: "var(--radius-xl)", marginTop: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {turnoverChartData.datasets.map((ds, i) => (
                <div key={ds.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "3px",
                      background: SYMBOL_COLORS[i],
                      borderRadius: "2px",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ds.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Turnover Change
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.7, marginTop: "2px" }}>
                Normalized to 0% at start of period
              </div>
            </div>
          </div>
          <div style={{ height: "280px" }}>
            <Line data={turnoverChartData} options={turnoverChartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};
