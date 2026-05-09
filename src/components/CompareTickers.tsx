import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { useTickerSymbols, useTickerHistory, StockData } from "../hooks/useMarketQuery";
import { Line } from "react-chartjs-2";
import { getCommonChartOptions } from "../utils/chartTheme";
import { CustomSelect } from "./CustomSelect";
import { Loader2, GitCompare } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const SYMBOL_COLORS = ["#6366f1", "#10b981", "#f59e0b"];

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

  const urlSymbols = (searchParams.get("s") || "").split(",").filter(Boolean);
  const [symbol1, setSymbol1] = useState(urlSymbols[0] || "");
  const [symbol2, setSymbol2] = useState(urlSymbols[1] || "");
  const [symbol3, setSymbol3] = useState(urlSymbols[2] || "");

  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "6M");
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: searchParams.get("start") ? new Date(searchParams.get("start")!) : null,
    end: searchParams.get("end") ? new Date(searchParams.get("end")!) : null,
  });

  // Sync state back to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const symbols = [symbol1, symbol2, symbol3].filter(Boolean);
    if (symbols.length) params.set("s", symbols.join(","));
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
  }, [symbol1, symbol2, symbol3, selectedPeriod, customRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: symbols = [], isLoading: loadingSymbols } = useTickerSymbols();
  const symbolOptions = symbols.map((s) => ({ label: s, value: s }));

  const { data: raw1 = [], isLoading: loading1 } = useTickerHistory(symbol1);
  const { data: raw2 = [], isLoading: loading2 } = useTickerHistory(symbol2);
  const { data: raw3 = [], isLoading: loading3 } = useTickerHistory(symbol3);

  const isLoading =
    loadingSymbols ||
    (!!symbol1 && loading1) ||
    (!!symbol2 && loading2) ||
    (!!symbol3 && loading3);

  const filtered1 = useMemo(
    () => (symbol1 ? filterByPeriod(raw1, selectedPeriod, customRange) : []),
    [raw1, symbol1, selectedPeriod, customRange]
  );
  const filtered2 = useMemo(
    () => (symbol2 ? filterByPeriod(raw2, selectedPeriod, customRange) : []),
    [raw2, symbol2, selectedPeriod, customRange]
  );
  const filtered3 = useMemo(
    () => (symbol3 ? filterByPeriod(raw3, selectedPeriod, customRange) : []),
    [raw3, symbol3, selectedPeriod, customRange]
  );

  const chartData = useMemo(() => {
    const slots = [
      { symbol: symbol1, data: filtered1 },
      { symbol: symbol2, data: filtered2 },
      { symbol: symbol3, data: filtered3 },
    ].filter((s) => s.symbol && s.data.length > 0);

    if (slots.length < 2) return null;

    // Union of all dates across active symbols
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
        pointRadius: allDates.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [symbol1, symbol2, symbol3, filtered1, filtered2, filtered3]);

  const chartOptions = useMemo(() => {
    const base = getCommonChartOptions(settings.theme) as any;
    return {
      ...base,
      plugins: {
        ...base.plugins,
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

  // Build options for each picker, excluding symbols chosen in the other two slots
  const optionsFor = (self: string) =>
    symbolOptions.filter((o) => {
      const others = [symbol1, symbol2, symbol3].filter((s) => s !== self);
      return !others.includes(o.value as string);
    });

  const activeSymbolCount = [symbol1, symbol2, symbol3].filter(Boolean).length;

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
          {/* Symbol pickers */}
          {(
            [
              { label: "Symbol 1", value: symbol1, set: setSymbol1, emptyLabel: "Select symbol...", optional: false },
              { label: "Symbol 2", value: symbol2, set: setSymbol2, emptyLabel: "Select symbol...", optional: false },
              { label: "Symbol 3", value: symbol3, set: setSymbol3, emptyLabel: "None", optional: true },
            ] as { label: string; value: string; set: (v: string) => void; emptyLabel: string; optional: boolean }[]
          ).map(({ label, value, set, emptyLabel, optional }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  fontWeight: "var(--font-medium)",
                }}
              >
                {label}{optional && <span style={{ opacity: 0.6 }}> (optional)</span>}
              </div>
              <CustomSelect
                value={value}
                options={[{ label: emptyLabel, value: "" }, ...optionsFor(value)]}
                onChange={(v) => set(v as string)}
                placeholder={label}
              />
            </div>
          ))}

          {/* Visual divider */}
          <div
            style={{
              width: "1px",
              height: "40px",
              background: "var(--glass-border)",
              alignSelf: "flex-end",
              marginBottom: "2px",
            }}
          />

          {/* Period buttons */}
          <div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                fontWeight: "var(--font-medium)",
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
                    padding: "8px 12px",
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
          </div>

          {/* Custom date range pickers */}
          {selectedPeriod === "Custom" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
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
            Choose two or three tickers above to see their normalized price performance on the same
            chart.
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
    </div>
  );
};
