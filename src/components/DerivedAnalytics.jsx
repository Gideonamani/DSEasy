import { useMemo } from "react";

import { Bar, Bubble, Doughnut, Scatter } from "react-chartjs-2";
import { Activity, TrendingUp, Zap, PieChart, ScatterChart } from "lucide-react";
import { DatePicker } from "./DatePicker";

import { formatNumber, formatLargeNumber } from "../utils/formatters";

// Reusable section card component
const AnalyticsCard = ({ title, icon, children, subtitle }) => {
  const Icon = icon;
  return (
    <div
      className="glass-panel"
      style={{ padding: "24px", borderRadius: "16px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: subtitle ? "8px" : "20px",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "rgba(99, 102, 241, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color="var(--accent-primary)" />
        </div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{title}</h3>
      </div>
      {subtitle && (
        <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "16px", marginLeft: "52px" }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};

import { Link } from "react-router-dom";

// Ranking table component for derived metrics
const RankingTable = ({
  data,
  valueKey,
  label,
  formatter = (v) => v.toFixed(2),
}) => {
  const sorted = useMemo(() => {
    return [...data]
      .filter((d) => d[valueKey] && d[valueKey] !== 0)
      .sort((a, b) => b[valueKey] - a[valueKey])
      .slice(0, 10);
  }, [data, valueKey]);

  if (sorted.length === 0) {
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        No data available
      </p>
    );
  }

  return (
    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <th
              style={{
                textAlign: "left",
                padding: "8px 12px",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              #
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "8px 12px",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Symbol
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 12px",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              {label}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => (
            <tr
              key={item.symbol}
              style={{ borderBottom: "1px solid var(--glass-border)" }}
            >
              <td
                style={{ padding: "10px 12px", color: "var(--text-secondary)" }}
              >
                {idx + 1}
              </td>
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                <Link 
                    to={`/trends/${item.symbol}`}
                    style={{ 
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        display: 'inline-block'
                    }}
                    onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                    {item.symbol}
                </Link>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  color: "var(--accent-primary)",
                }}
              >
                {formatter(item[valueKey])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const DerivedAnalytics = ({ 
  data, 
  selectedDate, 
  formattedDate, 
  availableDates, 
  loadingData, 
  onDateChange 
}) => {
  // Volatility Chart: High/Low Spread
  const volatilityData = useMemo(() => {
    const sorted = [...data]
      .filter((d) => d.highLowSpread && d.highLowSpread > 0)
      .sort((a, b) => b.highLowSpread - a.highLowSpread)
      .slice(0, 10);

    return {
      labels: sorted.map((d) => d.symbol),
      datasets: [
        {
          label: "High/Low Spread (%)",
          data: sorted.map((d) => d.highLowSpread * 100),
          backgroundColor: sorted.map(
            (_, i) => `hsla(${280 - i * 20}, 70%, 60%, 0.8)`,
          ),
          borderRadius: 6,
        },
      ],
    };
  }, [data]);

  // Bid/Offer Ratio Chart
  const bidOfferData = useMemo(() => {
    const filtered = [...data]
      .filter((d) => d.bidOfferRatio && d.bidOfferRatio !== 0)
      .sort(
        (a, b) => Math.abs(b.bidOfferRatio - 1) - Math.abs(a.bidOfferRatio - 1),
      )
      .slice(0, 10);

    return {
      labels: filtered.map((d) => d.symbol),
      datasets: [
        {
          label: "Bid/Offer Ratio",
          data: filtered.map((d) => d.bidOfferRatio),
          backgroundColor: filtered.map((d) =>
            d.bidOfferRatio > 1
              ? "rgba(16, 185, 129, 0.8)"
              : "rgba(239, 68, 68, 0.8)",
          ),
          borderRadius: 6,
        },
      ],
    };
  }, [data]);

  // Market Share: Turnover % Daily (Doughnut)
  const marketShareData = useMemo(() => {
    const sorted = [...data]
      .filter((d) => d.turnoverPctDaily && d.turnoverPctDaily > 0)
      .sort((a, b) => b.turnoverPctDaily - a.turnoverPctDaily)
      .slice(0, 8);

    const othersTotal = data
      .filter((d) => !sorted.includes(d) && d.turnoverPctDaily)
      .reduce((sum, d) => sum + d.turnoverPctDaily, 0);

    const labels = [...sorted.map((d) => d.symbol), "Others"];
    const values = [
      ...sorted.map((d) => d.turnoverPctDaily * 100),
      othersTotal * 100,
    ];

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#6366f1",
            "#8b5cf6",
            "#a855f7",
            "#d946ef",
            "#ec4899",
            "#f43f5e",
            "#10b981",
            "#06b6d4",
            "#475569",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [data]);

  // ========== SCATTER PLOT DATA ==========

  // 1. Risk vs Return (Bubble plot) - Volatility vs Change, sized by MCAP
  const riskReturnBubbleData = useMemo(() => {
    const filtered = data.filter(d => d.highLowSpread && d.mcap > 0);
    // Calculate min/max for better scaling
    const mcaps = filtered.map(d => d.mcap);
    const minMcap = Math.min(...mcaps);
    const maxMcap = Math.max(...mcaps);
    
    return {
      datasets: [{
        label: 'Stocks',
        data: filtered.map(d => {
          // Normalize MCAP to 0-1 range, then apply power function for more variance
          const normalized = (d.mcap - minMcap) / (maxMcap - minMcap || 1);
          const bubbleSize = 8 + Math.pow(normalized, 0.5) * 40; // Range: 8-48px
          return {
            x: d.highLowSpread * 100, // Volatility as percentage
            y: d.change, // Price change in TZS
            r: bubbleSize,
            symbol: d.symbol,
            mcap: d.mcap,
          };
        }),
        backgroundColor: filtered.map(d => 
          d.change > 0 ? 'rgba(16, 185, 129, 0.6)' : 
          d.change < 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(100, 116, 139, 0.6)'
        ),
        borderColor: filtered.map(d => 
          d.change > 0 ? 'rgba(16, 185, 129, 1)' : 
          d.change < 0 ? 'rgba(239, 68, 68, 1)' : 'rgba(100, 116, 139, 1)'
        ),
        borderWidth: 1,
      }]
    };
  }, [data]);


  // 2. Volume vs Change
  const volumeChangeData = useMemo(() => {
    const filtered = data.filter(d => d.volume > 0);
    return {
      datasets: [{
        label: 'Stocks',
        data: filtered.map(d => ({
          x: d.volume,
          y: d.change,
          symbol: d.symbol,
        })),
        backgroundColor: filtered.map(d => 
          d.change > 0 ? 'rgba(16, 185, 129, 0.7)' : 
          d.change < 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(100, 116, 139, 0.7)'
        ),
        pointRadius: 8,
      }]
    };
  }, [data]);

  // 3. Vol/Deal vs Turnover/Deal
  const tradePatternData = useMemo(() => {
    const filtered = data.filter(d => d.volPerDeal > 0 && d.turnoverPerDeal > 0);
    return {
      datasets: [{
        label: 'Stocks',
        data: filtered.map(d => ({
          x: d.volPerDeal,
          y: d.turnoverPerDeal / 1000000, // In millions
          symbol: d.symbol,
        })),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        pointRadius: 8,
      }]
    };
  }, [data]);

  // 4. Bid/Offer Ratio vs Change
  const pressureOutcomeData = useMemo(() => {
    const filtered = data.filter(d => d.bidOfferRatio && d.bidOfferRatio !== 0);
    return {
      datasets: [{
        label: 'Stocks',
        data: filtered.map(d => ({
          x: d.bidOfferRatio,
          y: d.change,
          symbol: d.symbol,
        })),
        backgroundColor: filtered.map(d => 
          d.change > 0 ? 'rgba(16, 185, 129, 0.7)' : 
          d.change < 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(100, 116, 139, 0.7)'
        ),
        pointRadius: 8,
      }]
    };
  }, [data]);

  // 5. High/Low Spread vs Turnover
  const volatilityActivityData = useMemo(() => {
    const filtered = data.filter(d => d.highLowSpread && d.turnover > 0);
    return {
      datasets: [{
        label: 'Stocks',
        data: filtered.map(d => ({
          x: d.highLowSpread * 100, // Percentage
          y: d.turnover / 1000000, // In millions
          symbol: d.symbol,
        })),
        backgroundColor: 'rgba(168, 85, 247, 0.7)',
        pointRadius: 8,
      }]
    };
  }, [data]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "var(--glass-border)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#94a3b8",
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#94a3b8",
          font: { size: 11 },
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw.toFixed(2)}%`,
        },
      },
    },
    cutout: "65%",
  };

  // Scatter plot options with symbol tooltip
  const scatterOptions = (xLabel, yLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(99, 102, 241, 0.5)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#94a3b8",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (ctx) => ctx[0]?.raw?.symbol || '',
          label: (ctx) => {
            const lines = [
              `${xLabel}: ${typeof ctx.raw.x === 'number' ? ctx.raw.x.toLocaleString(undefined, {maximumFractionDigits: 2}) : ctx.raw.x}`,
              `${yLabel}: ${typeof ctx.raw.y === 'number' ? ctx.raw.y.toLocaleString(undefined, {maximumFractionDigits: 2}) : ctx.raw.y}`,
            ];
            // Add MCAP if available
            if (ctx.raw.mcap) {
              lines.push(`Market Cap: ${formatLargeNumber(ctx.raw.mcap)} TZS`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#64748b", font: { size: 11 } },
        title: { display: true, text: xLabel, color: "#94a3b8", font: { size: 12 } },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#64748b", font: { size: 11 } },
        title: { display: true, text: yLabel, color: "#94a3b8", font: { size: 12 } },
      },
    },
  });

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Derived Analytics
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Data for{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {formattedDate || "..."}
            </span>
            {" "}&bull; Advanced metrics for liquidity, volatility, and trade patterns
          </p>
        </div>

        <DatePicker
          selectedDate={selectedDate}
          availableDates={availableDates}
          loadingData={loadingData}
          onChange={onDateChange}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        <AnalyticsCard title="Volatility: High/Low Spread" icon={Activity}>
          <div style={{ height: "280px" }}>
            {volatilityData.labels.length > 0 ? (
              <Bar data={volatilityData} options={chartOptions} />
            ) : (
              <p
                style={{
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No volatility data available
              </p>
            )}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Order Book Pressure: Bid/Offer" icon={TrendingUp}>
          <div style={{ height: "280px" }}>
            {bidOfferData.labels.length > 0 ? (
              <Bar
                data={bidOfferData}
                options={{
                  ...chartOptions,
                  indexAxis: "y",
                  scales: {
                    ...chartOptions.scales,
                    x: {
                      ...chartOptions.scales.x,
                      min: 0,
                    },
                  },
                }}
              />
            ) : (
              <p
                style={{
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No bid/offer data available
              </p>
            )}
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "12px",
            }}
          >
            <span style={{ color: "var(--accent-success)" }}>Green</span> = More
            buyers | <span style={{ color: "var(--accent-danger)" }}>Red</span>{" "}
            = More sellers
          </p>
        </AnalyticsCard>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid">
        <AnalyticsCard title="Market Share: Turnover %" icon={PieChart}>
          <div style={{ height: "280px" }}>
            {marketShareData.labels.length > 0 ? (
              <Doughnut data={marketShareData} options={doughnutOptions} />
            ) : (
              <p
                style={{
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No turnover data available
              </p>
            )}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Liquidity: Turnover / MCAP" icon={Zap}>
          <RankingTable
            data={data}
            valueKey="turnoverMcapRatio"
            label="Ratio"
            formatter={(v) => (v * 100).toFixed(4) + "%"}
          />
        </AnalyticsCard>
      </div>

      {/* ========== CORRELATION SCATTER PLOTS ========== */}
      <h3 className="section-title" style={{ marginTop: "32px", marginBottom: "24px" }}>
        Correlation Analysis
      </h3>

      {/* Bubble Plot: Risk vs Return */}
      <div className="charts-grid">
        <AnalyticsCard 
          title="Risk vs Return" 
          icon={ScatterChart}
          subtitle="Bubble size = Market Cap, color = gain (green) / loss (red)"
        >
          <div style={{ height: "320px" }}>
            {riskReturnBubbleData.datasets[0].data.length > 0 ? (
              <Bubble 
                data={riskReturnBubbleData} 
                options={scatterOptions("Volatility: High/Low Spread (%)", "Price Change (TZS)")} 
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "100px" }}>
                No data available
              </p>
            )}
          </div>
        </AnalyticsCard>

        <AnalyticsCard 
          title="Price Sensitivity" 
          icon={ScatterChart}
          subtitle="Do high-volume stocks move more?"
        >
          <div style={{ height: "320px" }}>
            {volumeChangeData.datasets[0].data.length > 0 ? (
              <Scatter 
                data={volumeChangeData} 
                options={scatterOptions("Volume (Shares)", "Change (TZS)")} 
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "100px" }}>
                No data available
              </p>
            )}
          </div>
        </AnalyticsCard>
      </div>

      {/* Row 2: Trade Patterns & Pressure */}
      <div className="charts-grid" style={{ marginTop: "8px" }}>
        <AnalyticsCard 
          title="Trade Patterns" 
          icon={ScatterChart}
          subtitle="Institutional (high both) vs Retail (low both)"
        >
          <div style={{ height: "320px" }}>
            {tradePatternData.datasets[0].data.length > 0 ? (
              <Scatter 
                data={tradePatternData} 
                options={scatterOptions("Vol/Deal (Shares)", "Turnover/Deal (M TZS)")} 
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "100px" }}>
                No data available
              </p>
            )}
          </div>
        </AnalyticsCard>

        <AnalyticsCard 
          title="Pressure vs Outcome" 
          icon={ScatterChart}
          subtitle="Does buy pressure predict gains?"
        >
          <div style={{ height: "320px" }}>
            {pressureOutcomeData.datasets[0].data.length > 0 ? (
              <Scatter 
                data={pressureOutcomeData} 
                options={scatterOptions("Bid/Offer Ratio", "Change (TZS)")} 
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "100px" }}>
                No data available
              </p>
            )}
          </div>
        </AnalyticsCard>
      </div>

      {/* Row 3: Volatility vs Activity */}
      <div className="charts-grid" style={{ marginTop: "8px" }}>
        <AnalyticsCard 
          title="Volatility vs Activity" 
          icon={ScatterChart}
          subtitle="Are volatile stocks traded more?"
        >
          <div style={{ height: "320px" }}>
            {volatilityActivityData.datasets[0].data.length > 0 ? (
              <Scatter 
                data={volatilityActivityData} 
                options={scatterOptions("High/Low Spread (%)", "Turnover (M TZS)")} 
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "100px" }}>
                No data available
              </p>
            )}
          </div>
        </AnalyticsCard>
      </div>

      {/* Rankings Row */}
      <h3 className="section-title" style={{ marginTop: "32px", marginBottom: "24px" }}>
        Rankings
      </h3>
      
      <div className="charts-grid">
        <AnalyticsCard title="Trade Size: Vol/Deal" icon={Activity}>
          <RankingTable
            data={data}
            valueKey="volPerDeal"
            label="Shares/Deal"
            formatter={(v) =>
              v.toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
          />
        </AnalyticsCard>

        <AnalyticsCard title="Deal Value: Turnover/Deal" icon={TrendingUp}>
          <RankingTable
            data={data}
            valueKey="turnoverPerDeal"
            label="TZS/Deal"
            formatter={(v) => formatLargeNumber(v)}
          />
        </AnalyticsCard>
      </div>

      {/* Momentum Row */}
      <div
        className="stats-grid"
        style={{ marginTop: "8px", gridTemplateColumns: "1fr" }}
      >
        <AnalyticsCard title="Momentum: Price Change / Volume" icon={Zap}>
          <RankingTable
            data={data}
            valueKey="changePerVol"
            label="Change/Vol"
            formatter={(v) => v.toExponential(2)}
          />
        </AnalyticsCard>
      </div>
    </div>
  );
};
