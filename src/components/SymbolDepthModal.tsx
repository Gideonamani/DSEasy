import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, Line } from "react-chartjs-2";
import {
  X,
  Layers,
  Info,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import type { ChartOptions, ChartData } from "chart.js";
import { useAllSnapshots } from "../hooks/useMarketWatch";
import { useSettings } from "../contexts/SettingsContext";
import { getCommonChartOptions, getChartTheme } from "../utils/chartTheme";
import { formatNumber, formatLargeNumber } from "../utils/formatters";
import type { MarketWatchStock } from "../types/market";

interface SymbolDepthModalProps {
  symbol: string | null;
  date?: string;
  onClose: () => void;
}

interface LadderLevel {
  price: number;
  lastQty: number;
  maxQty: number;
  samples: number;
  lastSeenAt: string;
}

interface SymbolSeries {
  capturedAt: string;
  stock: MarketWatchStock;
}

const EAT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Dar_es_Salaam",
};

type DepthScale = "linear" | "log";

const DEPTH_SCALE_KEY = "dseasy_depth_scale";

const symlog = (x: number): number =>
  Math.sign(x) * Math.log1p(Math.abs(x));

const symlogInverse = (y: number): number =>
  Math.sign(y) * (Math.exp(Math.abs(y)) - 1);

function buildLadder(
  series: SymbolSeries[],
  side: "bid" | "offer",
): LadderLevel[] {
  const map = new Map<number, LadderLevel>();
  for (const { capturedAt, stock } of series) {
    const price =
      side === "bid" ? stock.bestBidPrice : stock.bestOfferPrice;
    const qty =
      side === "bid" ? stock.bestBidQuantity : stock.bestOfferQuantity;
    if (!price || !qty) continue;
    const existing = map.get(price);
    if (existing) {
      existing.lastQty = qty;
      existing.maxQty = Math.max(existing.maxQty, qty);
      existing.samples += 1;
      existing.lastSeenAt = capturedAt;
    } else {
      map.set(price, {
        price,
        lastQty: qty,
        maxQty: qty,
        samples: 1,
        lastSeenAt: capturedAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.price - a.price);
}

export const SymbolDepthModal: React.FC<SymbolDepthModalProps> = ({
  symbol,
  date,
  onClose,
}) => {
  const { settings } = useSettings();
  const { data: snapshots, isLoading, error } = useAllSnapshots(date);

  const [isSmallPhone, setIsSmallPhone] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 479px)").matches,
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 599px)").matches,
  );
  const [depthScale, setDepthScale] = useState<DepthScale>(() => {
    if (typeof window === "undefined") return "linear";
    return window.localStorage.getItem(DEPTH_SCALE_KEY) === "log"
      ? "log"
      : "linear";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DEPTH_SCALE_KEY, depthScale);
  }, [depthScale]);

  useEffect(() => {
    const phoneMq = window.matchMedia("(max-width: 479px)");
    const narrowMq = window.matchMedia("(max-width: 599px)");
    const phoneHandler = (e: MediaQueryListEvent) => setIsSmallPhone(e.matches);
    const narrowHandler = (e: MediaQueryListEvent) =>
      setIsNarrowViewport(e.matches);
    phoneMq.addEventListener("change", phoneHandler);
    narrowMq.addEventListener("change", narrowHandler);
    return () => {
      phoneMq.removeEventListener("change", phoneHandler);
      narrowMq.removeEventListener("change", narrowHandler);
    };
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!symbol) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [symbol]);

  // ESC to close
  useEffect(() => {
    if (!symbol) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [symbol, onClose]);

  const symbolSeries: SymbolSeries[] = useMemo(() => {
    if (!symbol || !snapshots) return [];
    return snapshots
      .map((snap) => {
        const stock = snap.stocks?.[symbol];
        return stock ? { capturedAt: snap.capturedAt, stock } : null;
      })
      .filter((s): s is SymbolSeries => s !== null);
  }, [symbol, snapshots]);

  const latest = symbolSeries[symbolSeries.length - 1]?.stock;

  const bidLadder = useMemo(
    () => buildLadder(symbolSeries, "bid"),
    [symbolSeries],
  );
  const offerLadder = useMemo(
    () => buildLadder(symbolSeries, "offer"),
    [symbolSeries],
  );

  const ladderRows = useMemo(() => {
    const prices = new Set<number>();
    bidLadder.forEach((l) => prices.add(l.price));
    offerLadder.forEach((l) => prices.add(l.price));
    const bidByPrice = new Map(bidLadder.map((l) => [l.price, l]));
    const offerByPrice = new Map(offerLadder.map((l) => [l.price, l]));
    return Array.from(prices)
      .sort((a, b) => b - a)
      .map((price) => ({
        price,
        bid: bidByPrice.get(price) || null,
        offer: offerByPrice.get(price) || null,
      }));
  }, [bidLadder, offerLadder]);

  const baseBarOptions = getCommonChartOptions<"bar">(settings.theme);
  const baseLineOptions = getCommonChartOptions<"line">(settings.theme);
  const { textColorHex, fontFamily } = getChartTheme(settings.theme);

  // Largest queue size across both sides — drives log-mode axis ticks/extent.
  const maxLadderQty = useMemo(() => {
    let max = 0;
    for (const r of ladderRows) {
      if (r.bid) max = Math.max(max, r.bid.lastQty);
      if (r.offer) max = Math.max(max, r.offer.lastQty);
    }
    return max;
  }, [ladderRows]);

  // Depth chart: horizontal bars, one row per unique price level
  // Bid quantity shown as negative (left of zero), offer as positive (right).
  // In log mode each value is symlog-transformed so small queues stay legible
  // next to a dominant level. Tick + tooltip callbacks invert the transform.
  const depthChartData: ChartData<"bar"> = useMemo(() => {
    const xform = (qty: number) =>
      depthScale === "log" ? symlog(qty) : qty;
    const labels = ladderRows.map((r) => formatNumber(r.price));
    const isLight = settings.theme === "light";
    return {
      labels,
      datasets: [
        {
          label: "Bid (last qty)",
          data: ladderRows.map((r) => (r.bid ? xform(-r.bid.lastQty) : 0)),
          backgroundColor: isLight ? "rgba(5, 150, 105, 0.65)" : "rgba(16, 185, 129, 0.65)",
          borderColor: isLight ? "#059669" : "#10b981",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Offer (last qty)",
          data: ladderRows.map((r) => (r.offer ? xform(r.offer.lastQty) : 0)),
          backgroundColor: isLight ? "rgba(220, 38, 38, 0.65)" : "rgba(239, 68, 68, 0.65)",
          borderColor: isLight ? "#dc2626" : "#ef4444",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [ladderRows, depthScale, settings.theme]);

  const depthChartOptions: ChartOptions<"bar"> = useMemo(() => ({
    ...baseBarOptions,
    indexAxis: "y" as const,
    plugins: {
      ...baseBarOptions.plugins,
      legend: {
        ...baseBarOptions.plugins?.legend,
        position: "top" as const,
      },
      tooltip: {
        ...baseBarOptions.plugins?.tooltip,
        callbacks: {
          label: (ctx) => {
            const transformed = ctx.raw as number;
            const real =
              depthScale === "log" ? symlogInverse(transformed) : transformed;
            const qty = Math.abs(Math.round(real));
            return `${ctx.dataset.label}: ${formatNumber(qty)} shares`;
          },
        },
      },
    },
    scales: {
      x: {
        ...baseBarOptions.scales?.x,
        ...(depthScale === "log" && maxLadderQty > 0
          ? (() => {
              // Pin axis to nice decade ticks (…, 100, 1K, 10K, …) so users
              // read the log axis as decimal magnitudes instead of the raw
              // symlog grid (147, 22.02K, etc).
              const upperDecade = Math.floor(
                Math.log10(Math.max(maxLadderQty, 10)),
              );
              const decades: number[] = [];
              for (let p = 1; p <= upperDecade; p++) {
                decades.push(Math.pow(10, p));
              }
              const axisExtent = symlog(maxLadderQty) * 1.05;
              return {
                min: -axisExtent,
                max: axisExtent,
                afterBuildTicks: (axis: { ticks: { value: number }[] }) => {
                  const pos = decades.map((d) => symlog(d));
                  const neg = pos.slice().reverse().map((v) => -v);
                  axis.ticks = [...neg, 0, ...pos].map((value) => ({ value }));
                },
              };
            })()
          : {}),
        ticks: {
          ...baseBarOptions.scales?.x?.ticks,
          autoSkip: false,
          callback: (value) => {
            const real =
              depthScale === "log"
                ? symlogInverse(Number(value))
                : Number(value);
            return formatLargeNumber(Math.round(Math.abs(real)));
          },
        },
        title: {
          display: true,
          text:
            depthScale === "log"
              ? "Queue size — log scale (bid ◄ │ ► offer)"
              : "Queue size (bid ◄ │ ► offer)",
          color: textColorHex,
          font: { family: fontFamily, size: 11 },
        },
      },
      y: {
        ...baseBarOptions.scales?.y,
        title: {
          display: true,
          text: "Price (TZS)",
          color: textColorHex,
          font: { family: fontFamily, size: 11 },
        },
      },
    },
  }), [baseBarOptions, textColorHex, fontFamily, depthScale, maxLadderQty]);

  // Spread timeline
  const spreadChartData: ChartData<"line"> = useMemo(() => {
    const labels = symbolSeries.map((s) =>
      new Date(s.capturedAt).toLocaleTimeString("en-GB", EAT_TIME_FORMAT),
    );
    const isLight = settings.theme === "light";
    return {
      labels,
      datasets: [
        {
          label: "Best Bid",
          data: symbolSeries.map((s) => s.stock.bestBidPrice || null),
          borderColor: isLight ? "rgba(5, 150, 105, 0.55)" : "rgba(16, 185, 129, 0.5)",
          backgroundColor: isLight ? "rgba(5, 150, 105, 0.08)" : "rgba(16, 185, 129, 0.08)",
          pointBackgroundColor: isLight ? "rgba(5, 150, 105, 0.85)" : "rgba(16, 185, 129, 0.85)",
          tension: 0.25,
          pointRadius: 2,
          spanGaps: true,
        },
        {
          label: "Best Offer",
          data: symbolSeries.map((s) => s.stock.bestOfferPrice || null),
          borderColor: isLight ? "rgba(220, 38, 38, 0.55)" : "rgba(239, 68, 68, 0.5)",
          backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(239, 68, 68, 0.08)",
          pointBackgroundColor: isLight ? "rgba(220, 38, 38, 0.85)" : "rgba(239, 68, 68, 0.85)",
          tension: 0.25,
          pointRadius: 2,
          spanGaps: true,
        },
        {
          label: "Market Price",
          data: symbolSeries.map((s) => s.stock.marketPrice || null),
          borderColor: isLight ? "#7c3aed" : "#a78bfa",
          backgroundColor: isLight ? "rgba(124, 58, 237, 0.1)" : "rgba(167, 139, 250, 0.1)",
          borderDash: [8, 6],
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          pointBackgroundColor: isLight ? "#7c3aed" : "#a78bfa",
          spanGaps: true,
        },
      ],
    };
  }, [symbolSeries, settings.theme]);

  const spreadChartOptions: ChartOptions<"line"> = useMemo(() => ({
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      legend: {
        ...baseLineOptions.plugins?.legend,
        position: "top" as const,
      },
    },
    scales: {
      x: {
        ...baseLineOptions.scales?.x,
        title: {
          display: true,
          text: "Time (EAT)",
          color: textColorHex,
          font: { family: fontFamily, size: 11 },
        },
      },
      y: {
        ...baseLineOptions.scales?.y,
        title: {
          display: true,
          text: "Price (TZS)",
          color: textColorHex,
          font: { family: fontFamily, size: 11 },
        },
      },
    },
  }), [baseLineOptions, textColorHex, fontFamily]);

  if (!symbol) return null;

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(5px)",
    display: "flex",
    zIndex: "var(--z-modal)" as unknown as number,
    ...(isSmallPhone
      ? { alignItems: "flex-end", justifyContent: "stretch", padding: 0 }
      : { alignItems: "center", justifyContent: "center", padding: 16 }),
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    padding: "var(--space-6)",
    position: "relative",
    background: settings.theme === "light" ? "#ffffff" : "var(--glass-bg)",
    backdropFilter: settings.theme === "light" ? "none" : "blur(12px)",
    border: settings.theme === "light" ? "1px solid var(--border-subtle)" : "1px solid var(--glass-border)",
    boxShadow: settings.theme === "light" ? "var(--shadow-xl)" : "var(--shadow-lg)",
    ...(isSmallPhone
      ? {
          maxWidth: "100%",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom))",
          maxHeight: "92dvh",
          overflowY: "auto",
        }
      : {
          maxWidth: 920,
          borderRadius: "var(--radius-xl)",
          maxHeight: "90vh",
          overflowY: "auto",
        }),
  };

  const change = latest?.change ?? 0;
  const openingPrice = latest ? latest.marketPrice - latest.change : 0;
  const pctChange =
    openingPrice > 0 ? (change / openingPrice) * 100 : 0;
  const changeColor =
    change > 0
      ? "var(--accent-success)"
      : change < 0
        ? "var(--accent-danger)"
        : "var(--text-secondary)";

  return createPortal(
    <div onClick={onClose} style={backdropStyle}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
      >
        <button
          onClick={onClose}
          aria-label="Close depth view"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 4,
            zIndex: 2,
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20, paddingRight: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                padding: 8,
                background:
                  "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                borderRadius: 8,
                color: "var(--accent-primary)",
                display: "flex",
              }}
            >
              <Layers size={20} />
            </div>
            <h2
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                margin: 0,
                color: "var(--text-primary)",
              }}
            >
              {symbol} — Order Book Depth
            </h2>
            {latest && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  background: `color-mix(in srgb, ${changeColor} 15%, transparent)`,
                  color: changeColor,
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-bold)",
                }}
              >
                {change > 0 ? (
                  <TrendingUp size={12} />
                ) : change < 0 ? (
                  <TrendingDown size={12} />
                ) : (
                  <Activity size={12} />
                )}
                {change > 0 ? "+" : ""}
                {formatNumber(change)} ({pctChange > 0 ? "+" : ""}
                {pctChange.toFixed(2)}%)
              </span>
            )}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            Bid / offer activity reconstructed from {symbolSeries.length}{" "}
            intraday snapshot{symbolSeries.length === 1 ? "" : "s"}
            {latest ? ` · last price ${formatNumber(latest.marketPrice)}` : ""}
          </p>
          <p
            title="DSE publishes only the best bid and best offer per snapshot. The ladder is reconstructed by collecting every distinct price level seen across today's intraday snapshots — it approximates depth rather than reflecting a live multi-level book."
            style={{
              margin: "6px 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              fontStyle: "italic",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "help",
            }}
          >
            <Info size={12} style={{ flexShrink: 0 }} />
            Depth is approximated — DSE publishes only top-of-book per snapshot.
          </p>
        </div>

        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 60,
              gap: 12,
              color: "var(--text-secondary)",
            }}
          >
            <Loader2 size={20} className="animate-spin" />
            Loading intraday snapshots...
          </div>
        ) : error ? (
          <div
            style={{
              padding: 24,
              borderRadius: "var(--radius-md)",
              background:
                "color-mix(in srgb, var(--accent-danger) 10%, transparent)",
              border: "1px dashed var(--accent-danger)",
              color: "var(--accent-danger)",
              fontSize: "var(--text-sm)",
            }}
          >
            Failed to load snapshots: {(error as Error).message}
          </div>
        ) : symbolSeries.length === 0 ? (
          <div
            style={{
              padding: 24,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-elevated)",
              border: "1px dashed var(--glass-border)",
              color: "var(--text-tertiary)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
            }}
          >
            No intraday snapshots available for {symbol} on this date.
          </div>
        ) : (
          <>
            {/* Quick stats */}
            {latest && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <StatPill
                  label="Best Bid"
                  value={
                    latest.bestBidPrice && latest.bestBidQuantity
                      ? formatNumber(latest.bestBidPrice)
                      : "—"
                  }
                  sub={
                    latest.bestBidPrice && latest.bestBidQuantity
                      ? `${formatLargeNumber(latest.bestBidQuantity)} qty`
                      : "No resting bids"
                  }
                  accent={
                    latest.bestBidPrice && latest.bestBidQuantity
                      ? "var(--accent-success)"
                      : undefined
                  }
                />
                <StatPill
                  label="Best Offer"
                  value={
                    latest.bestOfferPrice && latest.bestOfferQuantity
                      ? formatNumber(latest.bestOfferPrice)
                      : "—"
                  }
                  sub={
                    latest.bestOfferPrice && latest.bestOfferQuantity
                      ? `${formatLargeNumber(latest.bestOfferQuantity)} qty`
                      : "No resting offers"
                  }
                  accent={
                    latest.bestOfferPrice && latest.bestOfferQuantity
                      ? "var(--accent-danger)"
                      : undefined
                  }
                />
                <StatPill
                  label="Spread"
                  value={
                    latest.bestBidPrice && latest.bestOfferPrice
                      ? formatNumber(latest.bestOfferPrice - latest.bestBidPrice)
                      : "—"
                  }
                  sub={
                    latest.bestBidPrice && latest.bestOfferPrice
                      ? "Bid → Offer"
                      : "One side empty"
                  }
                />
                <StatPill
                  label="Day Range"
                  value={`${formatNumber(latest.low)} – ${formatNumber(latest.high)}`}
                  sub={`Limits ${formatNumber(latest.minLimit)} – ${formatNumber(latest.maxLimit)}`}
                />
              </div>
            )}

            {/* Depth Chart */}
            <SectionHeader title="Depth (intraday levels seen)" />
            <div
              style={{
                position: "relative",
                height: Math.max(220, Math.min(420, ladderRows.length * 28 + 80)),
                marginBottom: 8,
              }}
            >
              {ladderRows.length > 0 ? (
                <Bar options={depthChartOptions} data={depthChartData} />
              ) : (
                <EmptyHint text="No bid/offer activity recorded yet." />
              )}
            </div>
            {ladderRows.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 28,
                }}
              >
                <div
                  role="group"
                  aria-label="Depth chart scale"
                  style={{
                    display: "inline-flex",
                    padding: 3,
                    background: settings.theme === "light" ? "var(--bg-input)" : "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-full)",
                    gap: 2,
                  }}
                >
                  <ScalePill
                    label="Linear"
                    active={depthScale === "linear"}
                    onClick={() => setDepthScale("linear")}
                  />
                  <ScalePill
                    label="Log"
                    active={depthScale === "log"}
                    onClick={() => setDepthScale("log")}
                  />
                </div>
              </div>
            )}

            {/* Ladder Table */}
            <SectionHeader title="Bid / Offer Ladder" />
            <div
              style={{
                marginBottom: 28,
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--text-sm)",
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: settings.theme === "light" ? "var(--bg-input)" : "var(--bg-elevated)",
                      color: "var(--text-tertiary)",
                      fontSize: "var(--text-xs)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={ladderTh}>Bid Qty</th>
                    {!isNarrowViewport && (
                      <th style={ladderThSamples}>Bid n</th>
                    )}
                    <th style={{ ...ladderTh, textAlign: "center" }}>Price</th>
                    {!isNarrowViewport && (
                      <th style={ladderThSamples}>Offer n</th>
                    )}
                    <th style={ladderTh}>Offer Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {ladderRows.map((row) => {
                    const isLatestBid =
                      latest && row.bid && latest.bestBidPrice === row.price;
                    const isLatestOffer =
                      latest && row.offer && latest.bestOfferPrice === row.price;
                    const isLiveRow = isLatestBid || isLatestOffer;
                    const bidSamples = row.bid ? row.bid.samples : null;
                    const offerSamples = row.offer ? row.offer.samples : null;
                    return (
                      <tr
                        key={row.price}
                        style={{
                          borderTop: "1px solid var(--border-subtle)",
                          background: isLiveRow
                            ? "color-mix(in srgb, var(--accent-primary) 7%, transparent)"
                            : undefined,
                        }}
                      >
                        <td
                          title={
                            isLatestBid
                              ? "Current best bid (latest snapshot)"
                              : bidSamples
                                ? `Seen in ${bidSamples} snapshot${bidSamples === 1 ? "" : "s"}`
                                : undefined
                          }
                          style={{
                            ...ladderTd,
                            color: row.bid
                              ? "var(--accent-success)"
                              : "var(--text-tertiary)",
                            fontWeight: isLatestBid
                              ? "var(--font-bold)"
                              : "var(--font-medium)",
                          }}
                        >
                          {row.bid ? (
                            <>
                              {formatNumber(row.bid.lastQty)}
                              {isNarrowViewport && bidSamples && bidSamples > 1 && (
                                <SamplesBadge n={bidSamples} />
                              )}
                              {isLatestBid && (
                                <LiveDot color="var(--accent-success)" />
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        {!isNarrowViewport && (
                          <td style={ladderTdSamples}>
                            {bidSamples ?? "—"}
                          </td>
                        )}
                        <td
                          style={{
                            ...ladderTd,
                            textAlign: "center",
                            color: "var(--text-primary)",
                            fontWeight: "var(--font-bold)",
                            background:
                              "color-mix(in srgb, var(--accent-primary) 5%, transparent)",
                          }}
                        >
                          {formatNumber(row.price)}
                        </td>
                        {!isNarrowViewport && (
                          <td style={ladderTdSamples}>
                            {offerSamples ?? "—"}
                          </td>
                        )}
                        <td
                          title={
                            isLatestOffer
                              ? "Current best offer (latest snapshot)"
                              : offerSamples
                                ? `Seen in ${offerSamples} snapshot${offerSamples === 1 ? "" : "s"}`
                                : undefined
                          }
                          style={{
                            ...ladderTd,
                            color: row.offer
                              ? "var(--accent-danger)"
                              : "var(--text-tertiary)",
                            fontWeight: isLatestOffer
                              ? "var(--font-bold)"
                              : "var(--font-medium)",
                          }}
                        >
                          {row.offer ? (
                            <>
                              {isLatestOffer && (
                                <LiveDot color="var(--accent-danger)" leading />
                              )}
                              {formatNumber(row.offer.lastQty)}
                              {isNarrowViewport && offerSamples && offerSamples > 1 && (
                                <SamplesBadge n={offerSamples} />
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Spread Timeline */}
            <SectionHeader title="Intraday Best Bid / Offer" />
            <div
              style={{
                position: "relative",
                height: 240,
                marginBottom: 8,
              }}
            >
              {symbolSeries.length > 1 ? (
                <Line options={spreadChartOptions} data={spreadChartData} />
              ) : (
                <EmptyHint text="Need at least two snapshots to draw a timeline." />
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3
    className="section-title"
    style={{
      fontSize: "var(--text-sm)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--text-tertiary)",
      margin: "0 0 12px",
    }}
  >
    {title}
  </h3>
);

const StatPill: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}> = ({ label, value, sub, accent }) => {
  const { settings } = useSettings();
  return (
    <div
      style={{
        padding: "10px 12px",
        background: settings.theme === "light" ? "var(--bg-input)" : "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--font-bold)",
          color: accent || "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-tertiary)",
      fontSize: "var(--text-sm)",
      border: "1px dashed var(--glass-border)",
      borderRadius: "var(--radius-md)",
    }}
  >
    {text}
  </div>
);

const ScalePill: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    style={{
      padding: "4px 14px",
      borderRadius: "var(--radius-full)",
      border: "none",
      background: active ? "var(--accent-primary)" : "transparent",
      color: active ? "white" : "var(--text-secondary)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--font-semibold)",
      cursor: "pointer",
      transition: "background 0.15s ease, color 0.15s ease",
    }}
  >
    {label}
  </button>
);

const LiveDot: React.FC<{ color: string; leading?: boolean }> = ({
  color,
  leading,
}) => (
  <span
    aria-label="Latest snapshot"
    title="Latest snapshot — current touch"
    style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}`,
      marginLeft: leading ? 0 : 6,
      marginRight: leading ? 6 : 0,
      verticalAlign: "middle",
    }}
  />
);

const SamplesBadge: React.FC<{ n: number }> = ({ n }) => (
  <sup
    style={{
      marginLeft: 4,
      fontSize: 9,
      color: "var(--text-tertiary)",
      fontWeight: "var(--font-medium)",
    }}
    title={`Seen in ${n} snapshots`}
  >
    ×{n}
  </sup>
);

const ladderTh: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "right",
  fontWeight: "var(--font-semibold)",
};

const ladderThSamples: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "right",
  fontWeight: "var(--font-semibold)",
  width: 60,
};

const ladderTd: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "right",
};

const ladderTdSamples: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "right",
  color: "var(--text-tertiary)",
  fontSize: "var(--text-xs)",
};
