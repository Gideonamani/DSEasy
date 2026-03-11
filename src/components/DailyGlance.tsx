import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLatestSnapshot, useMarketIntel } from "../hooks/useMarketWatch";
import { useMarketWatchDates } from "../hooks/useMarketQuery";
import { DatePicker } from "./DatePicker";
import { StatCard } from "./StatCard";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ArrowUpDown,
  ShieldAlert,
  Target,
  Clock,
  Flag,
} from "lucide-react";
import { formatNumber, formatLargeNumber } from "../utils/formatters";

export const DailyGlance: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromUrl = searchParams.get("date");
  
  const { data: availableDates = [], isLoading: loadingDates } = useMarketWatchDates();
  
  const effectiveDate = useMemo(() => {
    if (dateFromUrl) return dateFromUrl;
    if (availableDates.length > 0) return availableDates[0].sheetName;
    return undefined;
  }, [dateFromUrl, availableDates]);

  const handleDateChange = (date: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (date) {
        newParams.set("date", date);
      } else {
        newParams.delete("date");
      }
      return newParams;
    });
  };

  const { data: snapshot, isLoading: isLoadingSnapshot, error } = useLatestSnapshot(effectiveDate);
  const { data: intelHistory, error: intelError } = useMarketIntel(effectiveDate);

  const isLoading = isLoadingSnapshot || loadingDates;

  const stocks = useMemo(() => {
    if (!snapshot?.stocks) return [];
    // Convert object to array
    return Object.entries(snapshot.stocks).map(([symbol, data]) => ({
      symbol,
      ...data,
    }));
  }, [snapshot]);

  // Derived Metrics
  const metrics = useMemo(() => {
    if (stocks.length === 0) return null;

    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;

    let strongestDemand = stocks[0];
    let maxDemandRatio = -1;

    let biggestSupply = stocks[0];
    let maxOfferQty = -1;

    stocks.forEach((s) => {
      // Sentiment
      if (s.change > 0) upCount++;
      else if (s.change < 0) downCount++;
      else flatCount++;

      // Demand (bid / offer ratio)
      // Guard against division by zero
      const demandRatio =
        s.bestOfferQuantity === 0 && s.bestBidQuantity > 0
          ? Infinity
          : s.bestOfferQuantity > 0
            ? s.bestBidQuantity / s.bestOfferQuantity
            : 0;

      if (
        demandRatio > maxDemandRatio ||
        (demandRatio === Infinity &&
          s.bestBidQuantity > (strongestDemand?.bestBidQuantity || 0))
      ) {
        maxDemandRatio = demandRatio;
        strongestDemand = s;
      }

      // Supply (absolute offer qty)
      if (s.bestOfferQuantity > maxOfferQty) {
        maxOfferQty = s.bestOfferQuantity;
        biggestSupply = s;
      }
    });

    const sentiment =
      upCount > downCount
        ? "BULLISH"
        : downCount > upCount
          ? "BEARISH"
          : "NEUTRAL";
    const totalTraded = upCount + downCount + flatCount;

    return {
      sentiment,
      upCount,
      downCount,
      totalTraded,
      strongestDemand,
      biggestSupply,
    };
  }, [stocks]);

  // Deal Finder array (scored)
  const rankedDeals = useMemo(() => {
    if (stocks.length === 0) return [];

    return stocks
      .map((s) => {
        let score = 0;
        let signal = "Neutral";
        let signalColor = "var(--text-secondary)";

        // Factor 1: Demand Imbalance
        if (s.bestBidQuantity > 0 && s.bestOfferQuantity === 0) {
          score += 50;
          signal = "Strong Buy P"; // Buy Pressure
          signalColor = "var(--accent-success)";
        } else if (s.bestOfferQuantity > 0 && s.bestBidQuantity === 0) {
          score -= 50;
          signal = "Strong Sell P";
          signalColor = "var(--accent-danger)";
        } else if (s.bestBidQuantity > s.bestOfferQuantity * 2) {
          score += 20;
          signal = "Accumulation";
          signalColor = "var(--accent-success)";
        } else if (s.bestOfferQuantity > s.bestBidQuantity * 2) {
          score -= 20;
          signal = "Distribution";
          signalColor = "var(--accent-danger)";
        }

        // Factor 2: Proximity to limits (Reversal or Cap)
        const range = s.maxLimit - s.minLimit;
        if (range > 0 && s.marketPrice > 0) {
          const pos = (s.marketPrice - s.minLimit) / range;
          if (pos < 0.1 && score > 0) {
            score += 30; // Near bottom, showing buy pressure
            signal = "Oversold Buy";
          } else if (pos > 0.9 && score < 0) {
            score -= 30; // Near top, showing sell pressure
            signal = "Overbought Sell";
          }
        }

        return { ...s, score, signal, signalColor };
      })
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score)); // Sort by strongest signal (positive or negative)
  }, [stocks]);

  const notableMovers = useMemo(() => {
    return [...stocks]
      .filter((s) => s.marketPrice > 0 && Math.abs(s.change) > 0)
      .map((s) => {
        const openingPrice = s.marketPrice - s.change;
        const pctChange = openingPrice > 0 ? (s.change / openingPrice) * 100 : 0;
        return { ...s, pctChange };
      })
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
      .slice(0, 8);
  }, [stocks]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <Activity
          size={48}
          className="animate-spin"
          color="var(--accent-primary)"
        />
        <p style={{ color: "var(--text-secondary)", marginTop: 16 }}>
          Scanning order books...
        </p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div
        className="error-container"
        style={{
          padding: 40,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <ShieldAlert
          size={48}
          color="var(--accent-danger)"
          style={{ marginBottom: 16 }}
        />
        <h3
          style={{
            fontSize: "var(--text-xl)",
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          Data Not Available
        </h3>
        <p style={{ color: "var(--text-secondary)", maxWidth: 500 }}>
          {error
            ? `Error: ${(error as Error).message}`
            : "Market watch snapshots are currently unavailable. The market may be closed or the scraper is initializing."}
        </p>
        <div style={{ marginTop: 24 }}>
          <DatePicker
            selectedDate={effectiveDate || null}
            availableDates={availableDates}
            loadingData={isLoading}
            onChange={handleDateChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        animation: "fadeIn 0.5s ease",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="dashboard-header"
        style={{
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 250 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                padding: 8,
                background:
                  "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                borderRadius: 8,
                color: "var(--accent-primary)",
              }}
            >
              <ArrowUpDown size={24} />
            </div>
            <h2
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--font-bold)",
                margin: 0,
              }}
            >
              Daily Glance
            </h2>
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Live order book intelligence and market pulse
          </p>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", flex: "0 0 auto" }}>
          <div
            style={{
              background: "var(--bg-elevated)",
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--glass-border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--text-sm)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-success)",
                boxShadow: "0 0 8px var(--accent-success)",
              }}
            />
            {snapshot && snapshot.capturedAt ? (
              <>
                Last updated:{" "}
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: "var(--font-semibold)",
                  }}
                >
                  {new Date(snapshot.capturedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" })} EAT
                </span>
              </>
            ) : (
              <span>Not available</span>
            )}
          </div>
          <DatePicker
            selectedDate={effectiveDate || null}
            availableDates={availableDates}
            loadingData={isLoading}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {metrics && (
        <>
          {/* Top Cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <StatCard
              title="Market Sentiment"
              value={metrics.sentiment}
              change={null}
              subtext={`${metrics.downCount}/${metrics.totalTraded} stocks down`}
              type={
                metrics.sentiment === "BULLISH"
                  ? "success"
                  : metrics.sentiment === "BEARISH"
                    ? "danger"
                    : "neutral"
              }
              icon={
                metrics.sentiment === "BULLISH" ? (
                  <TrendingUp size={20} />
                ) : metrics.sentiment === "BEARISH" ? (
                  <TrendingDown size={20} />
                ) : (
                  <Activity size={20} />
                )
              }
            />
            <StatCard
              title="Strongest Demand"
              value={metrics.strongestDemand.symbol}
              change={null}
              subtext={`${formatNumber(metrics.strongestDemand.bestBidQuantity)} bid / ${formatNumber(metrics.strongestDemand.bestOfferQuantity)} offer`}
              type="success"
              icon={<Zap size={20} />}
              to={`/trends/${metrics.strongestDemand.symbol}`}
            />
            <StatCard
              title="Biggest Supply"
              value={metrics.biggestSupply.symbol}
              change={null}
              subtext={`${formatNumber(metrics.biggestSupply.bestBidQuantity)} bid / ${formatNumber(metrics.biggestSupply.bestOfferQuantity)} offer`}
              type="danger"
              icon={<ShieldAlert size={20} />}
              to={`/trends/${metrics.biggestSupply.symbol}`}
            />
          </div>

          {/* Imbalance Heatmap */}
          <div
            className="glass-panel"
            style={{
              padding: 24,
              marginBottom: 24,
              borderRadius: "var(--radius-xl)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <h3 className="section-title" style={{ marginBottom: 16 }}>
              Order Book Heatmap
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 12,
              }}
            >
              {[...stocks]
                .sort((a, b) => {
                  // Sort logic: Strongest Buy (high Bid, 0 Offer) -> ... -> Neutral -> ... -> Strongest Sell (0 Bid, high Offer)
                  const getRatio = (s: any) => {
                    if (s.bestBidQuantity > 0 && s.bestOfferQuantity === 0)
                      return 1000 + s.bestBidQuantity; // Max Bull
                    if (s.bestOfferQuantity > 0 && s.bestBidQuantity === 0)
                      return -1000 - s.bestOfferQuantity; // Max Bear
                    if (s.bestOfferQuantity === 0 && s.bestBidQuantity === 0)
                      return 0; // Dead neutral
                    // Ratio: > 1 means bids > offers, < 1 means bids < offers
                    return s.bestBidQuantity / s.bestOfferQuantity;
                  };
                  return getRatio(b) - getRatio(a); // Descending (bull to bear)
                })
                .map((s) => {
                  let heatColor = "var(--bg-elevated)";
                  let textColor = "var(--text-secondary)";
                  let borderColor = "var(--glass-border)";

                  if (s.bestBidQuantity > 0 && s.bestOfferQuantity === 0) {
                    heatColor =
                      "color-mix(in srgb, var(--accent-success) 20%, transparent)";
                    borderColor =
                      "color-mix(in srgb, var(--accent-success) 40%, transparent)";
                    textColor = "var(--accent-success)";
                  } else if (
                    s.bestOfferQuantity > 0 &&
                    s.bestBidQuantity === 0
                  ) {
                    heatColor =
                      "color-mix(in srgb, var(--accent-danger) 20%, transparent)";
                    borderColor =
                      "color-mix(in srgb, var(--accent-danger) 40%, transparent)";
                    textColor = "var(--accent-danger)";
                  } else if (s.bestBidQuantity > s.bestOfferQuantity * 1.5) {
                    heatColor =
                      "color-mix(in srgb, var(--accent-success) 10%, transparent)";
                    textColor = "var(--text-primary)";
                  } else if (s.bestOfferQuantity > s.bestBidQuantity * 1.5) {
                    heatColor =
                      "color-mix(in srgb, var(--accent-danger) 10%, transparent)";
                    textColor = "var(--text-primary)";
                  }

                  return (
                    <div
                      key={s.symbol}
                      style={{
                        padding: "12px 16px",
                        background: heatColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "var(--radius-lg)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "var(--font-bold)",
                          color: textColor,
                        }}
                      >
                        {s.symbol}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                          marginTop: 4,
                        }}
                      >
                        {formatLargeNumber(s.bestBidQuantity)} B /{" "}
                        {formatLargeNumber(s.bestOfferQuantity)} S
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Notable Movers */}
          <div
            className="glass-panel"
            style={{
              padding: 24,
              marginBottom: 24,
              borderRadius: "var(--radius-xl)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                Notable Movers
              </h3>
              <Zap size={18} color="var(--accent-primary)" />
            </div>
            {notableMovers.length > 0 ? (
              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 400 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 4px" }}>Symbol</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Price</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Change (TZS)</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Change (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notableMovers.map((mover) => (
                      <tr key={mover.symbol} style={{ borderBottom: "1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)" }}>
                        <td style={{ padding: "12px 4px", fontWeight: "var(--font-medium)", color: "var(--text-primary)" }}>{mover.symbol}</td>
                        <td style={{ padding: "12px 4px", textAlign: "right", color: "var(--text-primary)" }}>{formatNumber(mover.marketPrice)}</td>
                        <td style={{ padding: "12px 4px", textAlign: "right", color: mover.change > 0 ? "var(--accent-success)" : "var(--accent-danger)", fontWeight: "var(--font-medium)" }}>
                          {mover.change > 0 ? "+" : ""}{formatNumber(mover.change)}
                        </td>
                        <td style={{ padding: "12px 4px", textAlign: "right", color: mover.pctChange > 0 ? "var(--accent-success)" : "var(--accent-danger)", fontWeight: "var(--font-medium)" }}>
                          {mover.pctChange > 0 ? "+" : ""}{mover.pctChange.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
                No significant price movements recorded yet today.
              </p>
            )}
          </div>

          {/* Two Panels Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
              marginBottom: 24,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Left: Circuit Breaker */}
            <div
              className="glass-panel"
              style={{
                padding: 24,
                borderRadius: "var(--radius-xl)",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <h3 className="section-title" style={{ marginBottom: 16 }}>
                Circuit Breaker Monitor
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {stocks
                  .filter((s) => s.minLimit > 0 && s.maxLimit > 0)
                  .sort((a, b) => {
                    const rangeA = a.maxLimit - a.minLimit;
                    const posA =
                      rangeA > 0 ? (a.marketPrice - a.minLimit) / rangeA : 0.5;
                    const extremeA = Math.abs(posA - 0.5);

                    const rangeB = b.maxLimit - b.minLimit;
                    const posB =
                      rangeB > 0 ? (b.marketPrice - b.minLimit) / rangeB : 0.5;
                    const extremeB = Math.abs(posB - 0.5);

                    return extremeB - extremeA; // Sort highest extremeness first
                  })
                  .slice(0, 8)
                  .map((s) => {
                    const range = s.maxLimit - s.minLimit;
                    const posPct = Math.max(
                      0,
                      Math.min(
                        100,
                        ((s.marketPrice - s.minLimit) / range) * 100,
                      ),
                    );

                    let barColor = "var(--accent-primary)";
                    let status = "Open";
                    let statusColor = "var(--text-secondary)";
                    let glowColor = "transparent";

                    if (posPct >= 99) {
                        barColor = "var(--accent-success)";
                        status = "Locked (Max)";
                        statusColor = "var(--accent-success)";
                        glowColor = "var(--accent-success)";
                    } else if (posPct <= 1) {
                        barColor = "var(--accent-danger)";
                        status = "Locked (Min)";
                        statusColor = "var(--accent-danger)";
                        glowColor = "var(--accent-danger)";
                    } else if (posPct >= 95) {
                        barColor = "color-mix(in srgb, var(--accent-success) 80%, var(--accent-primary))";
                        glowColor = "var(--accent-success)";
                    } else if (posPct <= 5) {
                        barColor = "color-mix(in srgb, var(--accent-danger) 80%, var(--accent-primary))";
                        glowColor = "var(--accent-danger)";
                    }
                    
                    const distToMax = s.marketPrice > 0 ? ((s.maxLimit - s.marketPrice) / s.marketPrice) * 100 : 0;
                    const distToMin = s.marketPrice > 0 ? ((s.marketPrice - s.minLimit) / s.marketPrice) * 100 : 0;
                    
                    // Volumetric Pressure
                    const totalVolume = s.bestBidQuantity + s.bestOfferQuantity;
                    const buyPressurePct = totalVolume > 0 ? (s.bestBidQuantity / totalVolume) * 100 : 50;

                    const tooltipText = `Dist to Max: ${distToMax.toFixed(2)}%\nDist to Min: ${distToMin.toFixed(2)}%\nVol Press (Bids): ${buyPressurePct.toFixed(1)}%`;

                    return (
                      <div key={s.symbol} style={{ width: "100%" }}>
                        <div
                          title={tooltipText}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "var(--text-sm)",
                            marginBottom: 6,
                            alignItems: "center"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  fontWeight: "var(--font-semibold)",
                                  color: "var(--text-primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                {s.symbol}
                                {/* Traffic Light Dot */}
                                {glowColor !== "transparent" && (
                                   <div style={{ width: 6, height: 6, borderRadius: "50%", background: glowColor, boxShadow: `0 0 6px ${glowColor}` }} />
                                )}
                              </span>
                              {status !== "Open" && (
                                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor, fontWeight: "var(--font-bold)" }}>
                                      {status}
                                  </span>
                              )}
                          </div>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {formatNumber(s.marketPrice)}
                          </span>
                        </div>
                        <div
                          title={tooltipText}
                          style={{
                            position: "relative",
                            height: 16,
                            background: "var(--bg-input)",
                            borderRadius: 8,
                            overflow: "hidden",
                            width: "100%",
                          }}
                        >
                          {/* Background fill based on posPct */}
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${posPct}%`,
                              background: `color-mix(in srgb, ${barColor} 20%, transparent)`,
                            }}
                          />
                          {/* The indicator line */}
                          <div
                            style={{
                              position: "absolute",
                              left: `${posPct}%`,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              background: barColor,
                              transform: "translateX(-50%)",
                              borderRadius: 2,
                              boxShadow: `0 0 6px ${barColor}`,
                            }}
                          />
                          {/* The percentage fill text inside the bar */}
                          <div style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            fontWeight: "var(--font-bold)",
                            color: "var(--text-primary)",
                            opacity: 0.9,
                            textShadow: "0 0 4px var(--bg-card)",
                            pointerEvents: "none"
                          }}>
                            {posPct.toFixed(1)}%
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            marginTop: 4,
                          }}
                        >
                          <span>Min: {formatNumber(s.minLimit)}</span>
                          <span title="Volumetric Pressure: Outstanding Bids vs Offers" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                             <div style={{ width: 40, height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                                <div style={{ height: "100%", width: `${buyPressurePct}%`, background: "var(--accent-success)" }} />
                                <div style={{ height: "100%", width: `${100 - buyPressurePct}%`, background: "var(--accent-danger)" }} />
                             </div>
                          </span>
                          <span>Max: {formatNumber(s.maxLimit)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right: Deal Finder */}
            <div
              className="glass-panel"
              style={{
                padding: 24,
                borderRadius: "var(--radius-xl)",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h3 className="section-title" style={{ margin: 0 }}>
                  Deal Finder
                </h3>
                <Target size={18} color="var(--accent-primary)" />
              </div>
              <div style={{ overflowX: "auto", width: "100%" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    minWidth: 300,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        color: "var(--text-tertiary)",
                        fontSize: "var(--text-xs)",
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "8px 4px", width: 40 }}>Rank</th>
                      <th style={{ padding: "8px 4px" }}>Symbol</th>
                      <th style={{ padding: "8px 4px" }}>Score</th>
                      <th style={{ padding: "8px 4px" }}>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedDeals.slice(0, 8).map((deal, idx) => (
                      <tr
                        key={deal.symbol}
                        style={{
                          borderBottom:
                            "1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 4px",
                            color: "var(--text-secondary)",
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          #{idx + 1}
                        </td>
                        <td
                          style={{
                            padding: "12px 4px",
                            fontWeight: "var(--font-medium)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {deal.symbol}
                        </td>
                        <td
                          style={{
                            padding: "12px 4px",
                            color:
                              deal.score > 0
                                ? "var(--accent-success)"
                                : deal.score < 0
                                  ? "var(--accent-danger)"
                                  : "var(--text-secondary)",
                          }}
                        >
                          {deal.score > 0 ? "+" : ""}
                          {deal.score}
                        </td>
                        <td
                          style={{
                            padding: "12px 4px",
                            color: deal.signalColor,
                            fontSize: "var(--text-sm)",
                            fontWeight: "var(--font-medium)",
                          }}
                        >
                          {deal.signal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Intel Timeline */}
          <div style={{ marginTop: 40, width: "100%", boxSizing: "border-box" }}>
            <h3 className="section-title" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={20} color="var(--text-primary)" />
              Market Timeline
            </h3>

            {intelError ? (
              <div style={{ padding: 24, borderRadius: "var(--radius-xl)", background: "color-mix(in srgb, var(--accent-danger) 10%, transparent)", border: "1px dashed var(--accent-danger)", textAlign: "center" }}>
                <p style={{ color: "var(--accent-danger)", margin: 0, fontWeight: "var(--font-medium)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <ShieldAlert size={16} />
                  Failed to load Market Timeline
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 8 }}>
                  {(intelError as Error).message}
                </p>
              </div>
            ) : (!intelHistory || intelHistory.length === 0) ? (
              <div style={{ padding: 24, borderRadius: "var(--radius-xl)", background: "var(--bg-elevated)", border: "1px dashed var(--glass-border)", textAlign: "center" }}>
                <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Waiting for first market snapshot of the day...</p>
              </div>
            ) : (
              <div style={{ position: "relative", paddingLeft: 12 }}>
                {/* Vertical Timeline Line */}
                <div style={{
                  position: "absolute",
                  left: 17,
                  top: 24,
                  bottom: 0,
                  width: 2,
                  background: "var(--glass-border)",
                  borderRadius: 2
                }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {intelHistory.map((intel, idx) => {
                    const isLatest = idx === intelHistory.length - 1;
                    const isClosing = intel.type === "closing";
                    const timeEat = new Date(intel.capturedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" });

                    return (
                      <div 
                        key={`${intel.capturedAt}-${intel.type}-${idx}`} 
                        style={{ position: "relative", paddingLeft: 32 }}
                      >
                        {/* Timeline Node/Dot */}
                        <div style={{
                          position: "absolute",
                          left: 0,
                          top: 20,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: isClosing ? "#f59e0b" : isLatest ? "var(--accent-primary)" : "var(--bg-body)",
                          border: isClosing || isLatest ? "none" : "2px solid var(--text-tertiary)",
                          boxShadow: isLatest && !isClosing ? "0 0 0 4px color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "none",
                          zIndex: 1,
                          transform: "translateX(-1px)"
                        }} />

                        {/* Content Card */}
                        <div style={{
                          padding: 20,
                          borderRadius: "var(--radius-xl)",
                          background: isClosing ? "color-mix(in srgb, #f59e0b 5%, var(--bg-elevated))" : "var(--bg-elevated)",
                          border: isClosing ? "1px solid color-mix(in srgb, #f59e0b 30%, transparent)" : "1px solid var(--glass-border)",
                          position: "relative",
                          overflow: "hidden",
                          transition: "all 0.2s ease"
                        }}>
                          {/* Accent glow for the newest item */}
                          {isLatest && !isClosing && (
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--accent-primary), transparent)" }} />
                          )}
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            {isClosing ? <Flag size={14} color="#f59e0b" /> : <Clock size={14} color="var(--text-tertiary)" />}
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", color: isClosing ? "#f59e0b" : "var(--text-secondary)", letterSpacing: "0.05em" }}>
                              {timeEat} EAT {isClosing ? "— CLOSING BELL" : ""}
                            </span>
                            {isLatest && !isClosing && (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "color-mix(in srgb, var(--accent-primary) 15%, transparent)", color: "var(--accent-primary)", fontWeight: "var(--font-semibold)", marginLeft: "auto" }}>
                                NEW
                              </span>
                            )}
                          </div>

                          <p style={{ color: "var(--text-primary)", lineHeight: 1.5, margin: 0, fontSize: "var(--text-sm)" }}
                             dangerouslySetInnerHTML={{ __html: intel.snapshotSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          
                          {/* Only render trend here if it's the daily close summary wrap-up */}
                          {isClosing && intel.trendSummary && (
                            <div style={{ 
                              marginTop: 12,
                              padding: "10px 14px", 
                              background: "color-mix(in srgb, #f59e0b 5%, transparent)", 
                              borderRadius: "var(--radius-md)",
                              borderLeft: "2px solid #f59e0b",
                            }}>
                              <p style={{ color: "var(--text-secondary)", lineHeight: 1.4, margin: 0, fontSize: "var(--text-sm)" }}
                                 dangerouslySetInnerHTML={{ __html: intel.trendSummary.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>') }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Standalone Latest Trend Intel Card (Only shown for intraday) */}
                  {intelHistory.length > 0 && intelHistory[intelHistory.length - 1].type !== 'closing' && intelHistory[intelHistory.length - 1].trendSummary && (
                      <div style={{ position: "relative", paddingLeft: 32 }}>
                        {/* Terminal Node */}
                        <div style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "var(--bg-body)",
                          border: "2px solid var(--glass-border)",
                          zIndex: 1,
                          transform: "translateY(-50%) translateX(-1px)"
                        }} />

                        <div 
                          style={{
                            padding: 20,
                            borderRadius: "var(--radius-xl)",
                            background: "transparent",
                            border: "1px dashed var(--glass-border)",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <TrendingUp size={16} color="var(--accent-primary)" />
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                              LATEST TREND INSIGHT
                            </span>
                          </div>

                          <div style={{ 
                            padding: "14px 16px", 
                            background: "color-mix(in srgb, var(--accent-primary) 5%, transparent)", 
                            borderRadius: "var(--radius-md)",
                            borderLeft: "2px solid var(--accent-primary)",
                          }}>
                            <p style={{ color: "var(--text-primary)", lineHeight: 1.5, margin: 0, fontSize: "var(--text-sm)" }}
                               dangerouslySetInnerHTML={{ __html: intelHistory[intelHistory.length - 1].trendSummary.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--accent-primary)">$1</strong>') }} />
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
