import React, { memo } from 'react';
import { StatCard } from "./StatCard";
import { MarketTable } from "./MarketTable";
import { PriceChangeChart, TurnoverChart } from "./StockChart";
import { DatePicker } from "./DatePicker";
import { StockData, MarketDate, MarketIndex } from "../hooks/useMarketQuery";

import { MarketEmptyState } from "./EmptyState";

export interface DashboardProps {
  marketData: StockData[];
  marketIndices: MarketIndex[] | null;
  topGainer: StockData;
  topLoser: StockData;
  totalVolume: number;
  totalTurnover: number;
  totalDeals: number;
  totalMcap: number;
  activeSymbolsCount: number;
  tradedSymbolsCount: number;
  formattedDate: string;
  selectedDate: string | null;
  availableDates: MarketDate[];
  loadingData: boolean;
  onDateChange: (date: string) => void;
  formatLargeNumber: (num: number) => string;
}

export const Dashboard: React.FC<DashboardProps> = memo(({ 
  marketData, 
  marketIndices,
  topGainer, 
  topLoser, 
  totalVolume, 
  totalTurnover, 
  totalDeals, 
  totalMcap,
  activeSymbolsCount,
  tradedSymbolsCount,
  formattedDate,
  selectedDate,
  availableDates,
  loadingData,
  onDateChange,
  formatLargeNumber 
}) => {
  const isDataEmpty = !loadingData && marketData.length === 0;

  return (
    <>
      <div className="dashboard-header">
        <div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-2)" }}>
            Market Overview
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Data for{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: "var(--font-semibold)" }}>
              {formattedDate}
            </span>
          </p>
        </div>

        <DatePicker
          selectedDate={selectedDate}
          availableDates={availableDates}
          loadingData={loadingData}
          onChange={onDateChange}
        />
      </div>

      {isDataEmpty ? (
        <MarketEmptyState selectedDate={selectedDate} availableDates={availableDates} />
      ) : (
        <>
          {marketIndices && marketIndices.length > 0 && (
            <>
              <h3 className="section-title">Market Indices</h3>
              <div className="stats-grid" style={{ marginBottom: "var(--space-6)" }}>
                {marketIndices.map((idx) => (
                  <StatCard
                    key={idx.Code}
                    title={idx.IndexDescription}
                    value={idx.ClosingPrice}
                    change={idx.Change?.toString() ?? null}
                    subtext={idx.Code}
                    type={(idx.Change ?? 0) > 0 ? "success" : (idx.Change ?? 0) < 0 ? "danger" : "neutral"}
                    to={`/trends`} // No specific symbol view for index yet, linking to trends generally
                  />
                ))}
              </div>
            </>
          )}

          {/* Stats Grid */}
          <div className="stats-grid">
            <StatCard
              title="Top Gainer"
              value={topGainer.symbol}
              change={topGainer.change}
              subtext={`Change: ${topGainer.pctChange !== undefined && topGainer.pctChange !== null ? topGainer.pctChange.toFixed(2) + "%" : "N/A"}`}
              type="success"
              to={`/trends/${topGainer.symbol}`}
            />
            <StatCard
              title="Top Loser"
              value={topLoser.symbol}
              change={topLoser.change}
              subtext={`Change: ${topLoser.pctChange !== undefined && topLoser.pctChange !== null ? topLoser.pctChange.toFixed(2) + "%" : "N/A"}`}
              type="danger"
              to={`/trends/${topLoser.symbol}`}
            />
            <StatCard
              title="Total Volume"
              value={formatLargeNumber(totalVolume)}
              change={null}
              subtext="Total number of shares traded"
              type="primary"
            />
            <StatCard
              title="Total Turnover"
              value={formatLargeNumber(totalTurnover)}
              change={null}
              subtext="Total value of trades in TZS"
              type="neutral"
            />
          </div>

          {/* Stats Grid Row 2 */}
          <div className="stats-grid" style={{ marginTop: "var(--space-4)" }}>
            <StatCard
              title="Total Deals"
              value={totalDeals.toLocaleString()}
              change={null}
              subtext="Total number of executed trades"
              type="neutral"
            />
            <StatCard
              title="Total Market Cap"
              value={formatLargeNumber(totalMcap)}
              change={null}
              subtext="Total market capitalization (TZS)"
              type="primary"
            />
            <StatCard
              title="Symbols Listed"
              value={activeSymbolsCount}
              change={null}
              subtext="Total number of listed symbols"
              type="neutral"
            />
            <StatCard
              title="Active Symbols"
              value={tradedSymbolsCount}
              change={null}
              subtext="Symbols with trading activity"
              type="neutral"
            />
          </div>

          {/* Charts Section */}
          <div className="charts-grid">
            <PriceChangeChart data={marketData} />
            <TurnoverChart data={marketData} />
          </div>

          <div style={{ marginBottom: "var(--space-8)" }}>
            <h3 className="section-title">Detailed Market Data</h3>
            <MarketTable data={marketData} />
          </div>
        </>
      )}
    </>
  );
});
