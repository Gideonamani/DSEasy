import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  useTickerSymbols,
  useTickerHistory,
  useTickerDividends,
} from "../hooks/useMarketQuery";
import { runDcaSimulation } from "../utils/dcaCalculator";
import { useSettings } from "../contexts/SettingsContext";
import { getCommonChartOptions } from "../utils/chartTheme";
import { StatCard } from "./StatCard";
import { CustomSelect } from "./CustomSelect";
import {
  Loader2,
  Calculator,
  Info,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Wallet,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function DCASimulator(): React.ReactElement {
  const { settings } = useSettings();
  const { data: symbols = [], isLoading: loadingSymbols } = useTickerSymbols();

  // Inputs state
  const [selectedSymbol, setSelectedSymbol] = useState("CRDB");
  const [contributionAmount, setContributionAmount] = useState(100000);
  const [horizonYears, setHorizonYears] = useState(10);
  const [periodicity, setPeriodicity] = useState<"monthly" | "quarterly">("monthly");
  const [reinvestDividends, setReinvestDividends] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Load history and dividends for active ticker
  const { data: history = [], isLoading: loadingHistory } = useTickerHistory(selectedSymbol);
  const { data: dividends = [], isLoading: loadingDividends } = useTickerDividends(selectedSymbol);

  const simulationResult = useMemo(() => {
    if (loadingHistory || loadingDividends || history.length === 0) {
      return null;
    }
    return runDcaSimulation(
      history,
      dividends,
      contributionAmount,
      periodicity,
      horizonYears,
      reinvestDividends
    );
  }, [history, dividends, contributionAmount, periodicity, horizonYears, reinvestDividends, loadingHistory, loadingDividends]);

  // Reset controls to defaults
  const handleReset = () => {
    setSelectedSymbol("CRDB");
    setContributionAmount(100000);
    setHorizonYears(10);
    setPeriodicity("monthly");
    setReinvestDividends(true);
    setCurrentPage(1);
  };

  // Symbols dropdown options
  const symbolOptions = useMemo(() => {
    return symbols.map((s) => ({ label: s, value: s }));
  }, [symbols]);

  // Format currencies as "TZS 100,000" or similar
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    })
      .format(value)
      .replace("TZS", "TZS ");
  };

  // Dual-line chart setup
  const chartOptions = useMemo(() => {
    const baseOptions = getCommonChartOptions<"line">(settings.theme);
    return {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales?.y,
          ticks: {
            ...baseOptions.scales?.y?.ticks,
            callback: (val: any) => {
              if (val >= 1e9) return (val / 1e9).toFixed(1) + "B TZS";
              if (val >= 1e6) return (val / 1e6).toFixed(1) + "M TZS";
              return val.toLocaleString() + " TZS";
            },
          },
        },
      },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseOptions.plugins?.tooltip,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || "";
              const value = context.parsed.y || 0;
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    };
  }, [settings.theme]);

  const chartData = useMemo(() => {
    if (!simulationResult) return null;
    const { timeline } = simulationResult;

    // Subsample timeline if it's too dense to render smoothly (e.g. >120 points)
    const stride = Math.max(1, Math.ceil(timeline.length / 100));
    const sampledTimeline = timeline.filter((_, idx) => idx % stride === 0 || idx === timeline.length - 1);

    return {
      labels: sampledTimeline.map((step) => step.date),
      datasets: [
        {
          label: "Total Contributions",
          data: sampledTimeline.map((step) => step.totalContributed),
          borderColor: "rgba(148, 163, 184, 0.8)", // slate-400
          borderWidth: 2,
          pointRadius: 0,
          borderDash: [5, 5],
          fill: false,
        },
        {
          label: "Portfolio Value",
          data: sampledTimeline.map((step) => step.portfolioValue),
          borderColor: "rgba(99, 102, 241, 1)", // indigo-500
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 3,
          pointRadius: 0,
          fill: true,
        },
      ],
    };
  }, [simulationResult]);

  // Pagination for transaction ledger
  const itemsPerPage = 10;
  const paginatedTimeline = useMemo(() => {
    if (!simulationResult) return [];
    const { timeline } = simulationResult;
    const start = (currentPage - 1) * itemsPerPage;
    return timeline.slice(start, start + itemsPerPage);
  }, [simulationResult, currentPage]);

  const totalPages = useMemo(() => {
    if (!simulationResult) return 1;
    return Math.ceil(simulationResult.timeline.length / itemsPerPage);
  }, [simulationResult]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const isLoading = loadingSymbols || loadingHistory || loadingDividends;

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "48px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-2)" }}>
            DCA Wealth Builder
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", maxWidth: "800px" }}>
            Simulate periodic Dollar-Cost Averaging (DCA) and retirement scenarios using DSE historical prices, dividend records, and Tanzanian withholding tax rules.
          </p>
        </div>
        <button
          onClick={handleReset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--glass-border)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            transition: "all 0.2s",
          }}
          className="hover-bg"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }} className="dca-grid">
        {/* Main Content Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 3fr", gap: "24px" }} className="dca-split-layout">
          
          {/* Left Controls Panel */}
          <aside className="glass-panel" style={{ padding: "24px", borderRadius: "var(--radius-xl)", height: "fit-content" }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calculator size={20} color="var(--accent-primary)" />
              Simulation Settings
            </h3>

            {/* Ticker Dropdown */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                Stock Ticker
              </label>
              {loadingSymbols ? (
                <div style={{ padding: "10px", background: "var(--bg-input)", borderRadius: "var(--radius-md)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  Loading tickers...
                </div>
              ) : (
                <CustomSelect
                  value={selectedSymbol}
                  options={symbolOptions}
                  onChange={(val) => {
                    setSelectedSymbol(String(val));
                    setCurrentPage(1);
                  }}
                />
              )}
            </div>

            {/* Periodic Contribution */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                Periodic Contribution
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  TZS
                </span>
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(Math.max(1000, Number(e.target.value)))}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 44px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Contribution Frequency */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                Frequency
              </label>
              <div style={{ display: "flex", gap: "8px", background: "var(--bg-input)", padding: "4px", borderRadius: "8px" }}>
                {(["monthly", "quarterly"] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => {
                      setPeriodicity(freq);
                      setCurrentPage(1);
                    }}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "6px",
                      border: "none",
                      background: periodicity === freq ? "var(--accent-primary)" : "transparent",
                      color: periodicity === freq ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textTransform: "capitalize",
                      transition: "all 0.2s",
                    }}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {/* Investment Horizon */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                Horizon (Years)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
                {[5, 10, 15, 20].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => {
                      setHorizonYears(yr);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "8px 4px",
                      borderRadius: "6px",
                      border: `1px solid ${horizonYears === yr ? "var(--accent-primary)" : "var(--glass-border)"}`,
                      background: horizonYears === yr ? "rgba(99, 102, 241, 0.15)" : "var(--bg-elevated)",
                      color: horizonYears === yr ? "var(--accent-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      transition: "all 0.2s",
                    }}
                  >
                    {yr} Yrs
                  </button>
                ))}
              </div>
              {/* Slider for custom years */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={horizonYears}
                  onChange={(e) => {
                    setHorizonYears(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ flex: 1, accentColor: "var(--accent-primary)" }}
                />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-bold)", minWidth: "48px", textAlign: "right" }}>
                  {horizonYears} Years
                </span>
              </div>
            </div>

            {/* DRIP Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--glass-border)", paddingTop: "var(--space-4)" }}>
              <div>
                <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)" }}>
                  Reinvest Dividends
                </span>
                <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  DRIP (net of 5% tax)
                </span>
              </div>
              <button
                onClick={() => {
                  setReinvestDividends(!reinvestDividends);
                  setCurrentPage(1);
                }}
                role="switch"
                aria-checked={reinvestDividends}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  background: reinvestDividends ? "var(--accent-success)" : "var(--border-subtle)",
                  position: "relative",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    left: reinvestDividends ? "24px" : "4px",
                    width: "20px",
                    height: "20px",
                    background: "#fff",
                    borderRadius: "50%",
                    transition: "left 0.3s",
                    boxShadow: "var(--shadow-sm)",
                  }}
                />
              </button>
            </div>
          </aside>

          {/* Right Results Dashboard */}
          <main style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {isLoading ? (
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "450px", borderRadius: "var(--radius-xl)" }}>
                <Loader2 size={48} className="animate-spin" color="var(--accent-primary)" />
                <p style={{ marginTop: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  Calculating wealth simulation models...
                </p>
              </div>
            ) : !simulationResult ? (
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "450px", borderRadius: "var(--radius-xl)", padding: "32px", textAlign: "center" }}>
                <Info size={48} color="var(--text-secondary)" style={{ marginBottom: "16px" }} />
                <h4 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", marginBottom: "8px" }}>No Historical Records</h4>
                <p style={{ color: "var(--text-secondary)", maxWidth: "400px", fontSize: "var(--text-sm)" }}>
                  We couldn't retrieve price records for {selectedSymbol}. Please select another ticker to simulate DCA.
                </p>
              </div>
            ) : (
              <>
                {/* 4 KPI Cards Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }} className="kpi-grid">
                  <StatCard
                    title="Total Investment"
                    value={formatCurrency(simulationResult.totalContributed)}
                    change={null}
                    subtext="Total principal capital contributed"
                    type="primary"
                    icon={<Wallet size={20} />}
                  />
                  <StatCard
                    title="Future Portfolio Value"
                    value={formatCurrency(simulationResult.finalValue)}
                    change={((simulationResult.finalValue - simulationResult.totalContributed) / simulationResult.totalContributed * 100).toFixed(1)}
                    changeSuffix="%"
                    subtext="Capital + reinvested dividends"
                    type={simulationResult.finalValue >= simulationResult.totalContributed ? "success" : "danger"}
                    icon={<TrendingUp size={20} />}
                  />
                  <StatCard
                    title="Net Dividends Earned"
                    value={formatCurrency(simulationResult.totalDividends)}
                    change={null}
                    subtext="Dividends paid (after 5% tax)"
                    type="success"
                    icon={<Coins size={20} />}
                  />
                  <StatCard
                    title="Yield on Cost (YOC)"
                    value={`${simulationResult.yieldOnCost.toFixed(2)}%`}
                    change={null}
                    subtext="Ending annualized dividend yield on principal"
                    type="primary"
                    icon={<DollarSign size={20} />}
                  />
                </div>

                {/* Performance Curve Chart */}
                <div className="glass-panel" style={{ padding: "24px", borderRadius: "var(--radius-xl)", minHeight: "400px" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "var(--text-base)", fontWeight: "var(--font-bold)", color: "var(--text-primary)" }}>
                    Portfolio Growth Curve
                  </h3>
                  {chartData && (
                    <div style={{ position: "relative", height: "320px" }}>
                      <Line options={chartOptions} data={chartData} />
                    </div>
                  )}
                </div>

                {/* Explanation Alerts and Projections Warning */}
                {simulationResult.hasProjections && (
                  <div className="glass-panel" style={{ padding: "16px 20px", borderRadius: "var(--radius-xl)", borderLeft: "4px solid var(--accent-primary)", display: "flex", gap: "16px", alignItems: "flex-start", background: "var(--bg-elevated)" }}>
                    <Info size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <h4 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", margin: "0 0 4px 0" }}>
                        Simulation Uses Future Projections
                      </h4>
                      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)", margin: 0, lineHeight: 1.5 }}>
                        The historical price dataset spans {simulationResult.historicalYears.toFixed(1)} years. To complete the requested {horizonYears}-year horizon, the simulation projected {simulationResult.projectedYears.toFixed(1)} years into the future using the ticker's historical baseline CAGR of {(simulationResult.cagrUsed * 100).toFixed(2)}% and an average annual dividend yield of {(simulationResult.divYieldUsed * 100).toFixed(2)}%.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tax Rules Explanation */}
                <div className="glass-panel" style={{ padding: "16px 20px", borderRadius: "var(--radius-xl)", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <Coins size={20} color="var(--accent-success)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", margin: "0 0 4px 0" }}>
                      Tanzanian Dividend Withholding Tax Applied
                    </h4>
                    <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)", margin: 0, lineHeight: 1.5 }}>
                      Dividends received in the simulator automatically have the local 5% Tanzanian withholding tax deducted (applicable to listed equities on the Dar es Salaam Stock Exchange). Net dividends are then accumulated or reinvested in full according to your DRIP configuration.
                    </p>
                  </div>
                </div>

                {/* Detailed Transactions Ledger Table */}
                <div className="glass-panel" style={{ padding: "24px", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "var(--text-base)", fontWeight: "var(--font-bold)", color: "var(--text-primary)" }}>
                    Transaction Ledger
                  </h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)" }}>Date</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)" }}>Type</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)", textAlign: "right" }}>Price (TZS)</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)", textAlign: "right" }}>Shares Bought</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)", textAlign: "right" }}>Total Shares</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)", textAlign: "right" }}>Cash Balance</th>
                          <th style={{ padding: "10px 8px", fontWeight: "var(--font-semibold)", textAlign: "right" }}>Portfolio Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTimeline.map((step, idx) => (
                          <tr key={`${step.date}-${idx}-${step.type}`} style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-primary)" }} className="hover-bg">
                            <td style={{ padding: "12px 8px" }}>{step.date}</td>
                            <td style={{ padding: "12px 8px" }}>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                textTransform: "uppercase",
                                fontSize: "9px",
                                fontWeight: 700,
                                background: step.type === "contribution" ? "rgba(99, 102, 241, 0.15)" : step.type === "drip" ? "rgba(16, 185, 129, 0.15)" : step.type === "projection" ? "rgba(234, 179, 8, 0.15)" : "rgba(148, 163, 184, 0.15)",
                                color: step.type === "contribution" ? "var(--accent-primary)" : step.type === "drip" ? "var(--accent-success)" : step.type === "projection" ? "var(--accent-warning, #eab308)" : "var(--text-secondary)",
                              }}>
                                {step.type === "drip" ? "DRIP Reinvest" : step.type}
                              </span>
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right" }}>{step.price ? step.price.toLocaleString() : "-"}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right" }}>{step.sharesBought ? step.sharesBought.toFixed(4) : "-"}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right" }}>{step.sharesOwned.toFixed(4)}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right" }}>{step.cashBalance ? formatCurrency(step.cashBalance) : "-"}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: "var(--font-semibold)" }}>{formatCurrency(step.portfolioValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "12px", borderTop: "1px solid var(--glass-border)" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => handlePageChange(currentPage - 1)}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "var(--radius-md)",
                            color: currentPage === 1 ? "var(--text-tertiary)" : "var(--text-primary)",
                            padding: "6px 12px",
                            cursor: currentPage === 1 ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <ChevronLeft size={14} /> Prev
                        </button>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => handlePageChange(currentPage + 1)}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "var(--radius-md)",
                            color: currentPage === totalPages ? "var(--text-tertiary)" : "var(--text-primary)",
                            padding: "6px 12px",
                            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
