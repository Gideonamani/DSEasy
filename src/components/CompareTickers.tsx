import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { useTickerSymbols, useTickerHistory, StockData } from "../hooks/useMarketQuery";
import { Line } from "react-chartjs-2";
import { getCommonChartOptions } from "../utils/chartTheme";
import { CustomSelect } from "./CustomSelect";
import { Loader2, GitCompare, Plus, X } from "lucide-react";
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

const parseSheetDate = (str: string): Date => {
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
    slots.forEach((slot) => slot.data.forEach((d) => dateSet.add(d.date)));
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const closeMap = new Map<string, number>(slot.data.map((d) => [d.date, d.close]));

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

  const chartOptions = useMemo(() => {
    const base = getCommonChartOptions(settings.theme) as any;
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
            label: (ctx: any) => {
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
            callback: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
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
    slots.forEach((slot) => slot.filtered.forEach((d) => dateSet.add(d.date)));
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const volSeries = calculateRollingVolatility(slot.full.map((d) => d.close));
      const volByDate = new Map<string, number | null>(
        slot.full.map((d, idx) => [d.date, volSeries[idx]])
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

  // Relative turnover chart data — each day's turnover as a multiple of that symbol's full-history average
  const turnoverChartData = useMemo(() => {
    const slots = selectedSymbols
      .map((symbol, i) => ({ symbol, full: rawSlots[i].data, filtered: allFiltered[i] }))
      .filter((s) => s.symbol && s.filtered.length > 0);

    if (slots.length < 2) return null;

    const dateSet = new Set<string>();
    slots.forEach((slot) => slot.filtered.forEach((d) => dateSet.add(d.date)));
    const allDates = Array.from(dateSet).sort(
      (a, b) => parseSheetDate(a).getTime() - parseSheetDate(b).getTime()
    );

    const labels = allDates.map((d) =>
      parseSheetDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    );

    const datasets = slots.map((slot, i) => {
      const validTurnovers = slot.full.map((d) => d.turnover || 0).filter((t) => t > 0);
      const avgTurnover =
        validTurnovers.length > 0
          ? validTurnovers.reduce((a, b) => a + b, 0) / validTurnovers.length
          : null;

      const turnoverByDate = new Map<string, number>(
        slot.filtered.map((d) => [d.date, d.turnover || 0])
      );

      const color = SYMBOL_COLORS[i];
      return {
        label: slot.symbol,
        data: allDates.map((date) => {
          const t = turnoverByDate.get(date);
          if (t == null || !avgTurnover) return null;
          return t / avgTurnover;
        }),
        borderColor: color,
        backgroundColor: color + "18",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        hitRadius: 20,
        tension: 0.2,
        spanGaps: false,
        fill: "origin",
      };
    });

    return { labels, datasets };
  }, [selectedSymbols, allFiltered, raw0, raw1, raw2]); // eslint-disable-line react-hooks/exhaustive-deps

  const volChartOptions = useMemo(() => {
    const base = getCommonChartOptions(settings.theme) as any;
    return {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...base.plugins,
        legend: { display: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (ctx: any) => {
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
            callback: (v: number) => `${v.toFixed(1)}%`,
          },
        },
      },
    };
  }, [settings.theme]);

  const turnoverChartOptions = useMemo(() => {
    const base = getCommonChartOptions(settings.theme) as any;
    return {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...base.plugins,
        legend: { display: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed.y;
              if (v == null) return `${ctx.dataset.label}: N/A`;
              return `${ctx.dataset.label}: ${v.toFixed(2)}x avg`;
            },
          },
        },
      },
      scales: {
        ...base.scales,
        y: {
          ...base.scales?.y,
          min: 0,
          ticks: {
            ...base.scales?.y?.ticks,
            callback: (v: number) => `${v.toFixed(1)}x`,
          },
        },
      },
    };
  }, [settings.theme]);

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
                  onChange={(date) => setCustomRange((prev) => ({ ...prev, start: date }))}
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
                  onChange={(date) => setCustomRange((prev) => ({ ...prev, end: date }))}
                  selectsEnd
                  startDate={customRange.start}
                  endDate={customRange.end}
                  minDate={customRange.start}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
          }}
        >
          <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" />
        </div>
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
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              Normalized to 0% at start of period
            </span>
          </div>

          <div style={{ height: "420px" }}>
            <Line data={chartData} options={chartOptions} />
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

      {/* Relative Turnover chart */}
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
                Relative Turnover
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.7, marginTop: "2px" }}>
                Daily turnover as multiple of own historical avg — 1x = normal activity
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
