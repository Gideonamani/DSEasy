import { memo } from 'react';
import { StatCard } from "./StatCard";
import { MarketTable } from "./MarketTable";
import { PriceChangeChart, TurnoverChart } from "./StockChart";
import { DatePicker } from "./DatePicker";

export const Dashboard = memo(({ 
  marketData, 
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
  return (
    <>
      <div className="dashboard-header">
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
            Market Overview
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Data for{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
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

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Top Gainer"
          value={topGainer.symbol}
          change={topGainer.change}
          subtext={`Price: ${topGainer.close.toLocaleString()}`}
          type="success"
          to={`/trends/${topGainer.symbol}`}
        />
        <StatCard
          title="Top Loser"
          value={topLoser.symbol}
          change={topLoser.change}
          subtext={`Price: ${topLoser.close.toLocaleString()}`}
          type="danger"
          to={`/trends/${topLoser.symbol}`}
        />
        <StatCard
          title="Total Volume"
          value={formatLargeNumber(totalVolume)}
          change={null}
          subtext="Total Shares Traded"
          type="primary"
        />
        <StatCard
          title="Total Turnover"
          value={formatLargeNumber(totalTurnover)}
          change={null}
          subtext="TZS Turnover"
          type="neutral"
        />
      </div>

      {/* Stats Grid Row 2 */}
      <div className="stats-grid" style={{ marginTop: "16px" }}>
        <StatCard
          title="Total Deals"
          value={totalDeals.toLocaleString()}
          change={null}
          subtext="Trades Executed"
          type="neutral"
        />
        <StatCard
          title="Total Market Cap"
          value={formatLargeNumber(totalMcap)}
          change={null}
          subtext="TZS Market Cap"
          type="primary"
        />
        <StatCard
          title="Symbols Listed"
          value={activeSymbolsCount}
          change={null}
          subtext="Total Listed"
          type="neutral"
        />
        <StatCard
          title="Active Symbols"
          value={tradedSymbolsCount}
          change={null}
          subtext="Volume > 0"
          type="neutral"
        />
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <PriceChangeChart data={marketData} />
        <TurnoverChart data={marketData} />
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 className="section-title">Detailed Market Data</h3>
        <MarketTable data={marketData} />
      </div>
    </>
  );
});
