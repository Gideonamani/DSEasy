import React, { useMemo } from 'react';
import { useLatestSnapshot } from '../hooks/useMarketWatch';
import { StatCard } from './StatCard';
import { TrendingUp, TrendingDown, Activity, Zap, ArrowUpDown, ShieldAlert, Target } from 'lucide-react';
import { formatNumber, formatLargeNumber } from '../utils/formatters';

export const DailyGlance: React.FC = () => {
  const { data: snapshot, isLoading, error } = useLatestSnapshot();

  const stocks = useMemo(() => {
    if (!snapshot?.stocks) return [];
    // Convert object to array
    return Object.entries(snapshot.stocks).map(([symbol, data]) => ({
      symbol,
      ...data
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
      const demandRatio = s.bestOfferQuantity === 0 && s.bestBidQuantity > 0 
        ? Infinity 
        : s.bestOfferQuantity > 0 ? s.bestBidQuantity / s.bestOfferQuantity : 0;
      
      if (demandRatio > maxDemandRatio || (demandRatio === Infinity && s.bestBidQuantity > (strongestDemand?.bestBidQuantity || 0))) {
        maxDemandRatio = demandRatio;
        strongestDemand = s;
      }

      // Supply (absolute offer qty)
      if (s.bestOfferQuantity > maxOfferQty) {
        maxOfferQty = s.bestOfferQuantity;
        biggestSupply = s;
      }
    });

    const sentiment = upCount > downCount ? 'BULLISH' : downCount > upCount ? 'BEARISH' : 'NEUTRAL';
    const totalTraded = upCount + downCount + flatCount;

    return {
      sentiment, upCount, downCount, totalTraded,
      strongestDemand, biggestSupply
    };
  }, [stocks]);

  // Deal Finder array (scored)
  const rankedDeals = useMemo(() => {
    if (stocks.length === 0) return [];
    
    return stocks.map(s => {
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
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)); // Sort by strongest signal (positive or negative)
  }, [stocks]);


  if (isLoading) {
    return (
      <div className="loading-container">
        <Activity size={48} className="animate-spin" color="var(--accent-primary)" />
        <p style={{ color: "var(--text-secondary)", marginTop: 16 }}>Scanning order books...</p>
      </div>
    );
  }

  if (error || !snapshot) {
    console.error("Snapshot Error:", error);
    return (
      <div 
        className="error-container" 
        style={{ 
          padding: 40, 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh'
        }}
      >
        <ShieldAlert size={48} color="var(--accent-danger)" style={{ marginBottom: 16 }} />
        <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 8, color: 'var(--text-primary)' }}>Data Not Available</h3>
        <p style={{ color: "var(--text-secondary)", maxWidth: 500 }}>
          {error ? `Error: ${(error as Error).message}` : "Market watch snapshots are currently unavailable. The market may be closed or the scraper is initializing."}
        </p>
      </div>
    );
  }

  const formattedTime = new Date(snapshot.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

  // Generate automated summary text
  const generateSummary = () => {
    if (!metrics) return "";
    let txt = `At **${formattedTime}**, the overall market sentiment is **${metrics.sentiment}** with ${metrics.downCount} stocks down and ${metrics.upCount} up. `;
    
    if (metrics.strongestDemand && metrics.strongestDemand.bestBidQuantity > 0) {
      txt += `The strongest demand is seen in **${metrics.strongestDemand.symbol}** (${formatNumber(metrics.strongestDemand.bestBidQuantity)} shares bid vs ${formatNumber(metrics.strongestDemand.bestOfferQuantity)} offered). `;
    }
    
    if (metrics.biggestSupply && metrics.biggestSupply.bestOfferQuantity > 0) {
      txt += `Conversely, **${metrics.biggestSupply.symbol}** is facing heavy supply pressure with ${formatNumber(metrics.biggestSupply.bestOfferQuantity)} shares offered. `;
    }

    const maxedOut = stocks.filter(s => s.marketPrice === s.maxLimit && s.maxLimit > 0);
    if (maxedOut.length > 0) {
      txt += `Notably, ${maxedOut.map(s => `**${s.symbol}**`).join(", ")} reached their daily maximum circuit breaker limits.`;
    }

    return <span dangerouslySetInnerHTML={{ __html: txt.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>') }} />;
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease", width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      {/* Header */}
      <div className="dashboard-header" style={{ alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: '1 1 auto', minWidth: 250 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ padding: 8, background: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)', borderRadius: 8, color: 'var(--accent-primary)' }}>
              <ArrowUpDown size={24} />
            </div>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", margin: 0 }}>
              Daily Glance
            </h2>
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Live order book intelligence and market pulse
          </p>
        </div>
        <div style={{ 
          background: "var(--bg-elevated)", 
          padding: "8px 16px", 
          borderRadius: "var(--radius-full)",
          border: "1px solid var(--glass-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "var(--text-sm)",
          flex: '0 0 auto'
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-success)', boxShadow: '0 0 8px var(--accent-success)' }} />
          Last updated: <span style={{ color: "var(--text-primary)", fontWeight: "var(--font-semibold)" }}>{formattedTime} EAT</span>
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
              type={metrics.sentiment === 'BULLISH' ? 'success' : metrics.sentiment === 'BEARISH' ? 'danger' : 'neutral'}
              icon={metrics.sentiment === 'BULLISH' ? <TrendingUp size={20} /> : metrics.sentiment === 'BEARISH' ? <TrendingDown size={20} /> : <Activity size={20} />}
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
          <div className="glass-panel" style={{ padding: 24, marginBottom: 24, borderRadius: "var(--radius-xl)", width: "100%", boxSizing: "border-box" }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Order Book Heatmap</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
              gap: 12
            }}>
              {[...stocks]
                .sort((a, b) => {
                   // Sort logic: Strongest Buy (high Bid, 0 Offer) -> ... -> Neutral -> ... -> Strongest Sell (0 Bid, high Offer)
                   const getRatio = (s: any) => {
                     if (s.bestBidQuantity > 0 && s.bestOfferQuantity === 0) return 1000 + s.bestBidQuantity; // Max Bull
                     if (s.bestOfferQuantity > 0 && s.bestBidQuantity === 0) return -1000 - s.bestOfferQuantity; // Max Bear
                     if (s.bestOfferQuantity === 0 && s.bestBidQuantity === 0) return 0; // Dead neutral
                     // Ratio: > 1 means bids > offers, < 1 means bids < offers
                     return s.bestBidQuantity / s.bestOfferQuantity;
                   };
                   return getRatio(b) - getRatio(a); // Descending (bull to bear)
                })
                .map(s => {
                let heatColor = "var(--bg-elevated)";
                let textColor = "var(--text-secondary)";
                let borderColor = "var(--glass-border)";
                
                if (s.bestBidQuantity > 0 && s.bestOfferQuantity === 0) {
                  heatColor = "color-mix(in srgb, var(--accent-success) 20%, transparent)";
                  borderColor = "color-mix(in srgb, var(--accent-success) 40%, transparent)";
                  textColor = "var(--accent-success)";
                } else if (s.bestOfferQuantity > 0 && s.bestBidQuantity === 0) {
                  heatColor = "color-mix(in srgb, var(--accent-danger) 20%, transparent)";
                  borderColor = "color-mix(in srgb, var(--accent-danger) 40%, transparent)";
                  textColor = "var(--accent-danger)";
                } else if (s.bestBidQuantity > s.bestOfferQuantity * 1.5) {
                  heatColor = "color-mix(in srgb, var(--accent-success) 10%, transparent)";
                  textColor = "var(--text-primary)";
                } else if (s.bestOfferQuantity > s.bestBidQuantity * 1.5) {
                  heatColor = "color-mix(in srgb, var(--accent-danger) 10%, transparent)";
                  textColor = "var(--text-primary)";
                }

                return (
                  <div key={s.symbol} style={{
                    padding: "12px 16px",
                    background: heatColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "var(--radius-lg)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxSizing: "border-box"
                  }}>
                    <span style={{ fontWeight: "var(--font-bold)", color: textColor }}>{s.symbol}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                      {formatLargeNumber(s.bestBidQuantity)} B / {formatLargeNumber(s.bestOfferQuantity)} S
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two Panels Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24, width: "100%", boxSizing: "border-box" }}>
            
            {/* Left: Circuit Breaker */}
            <div className="glass-panel" style={{ padding: 24, borderRadius: "var(--radius-xl)", boxSizing: "border-box", overflow: "hidden" }}>
              <h3 className="section-title" style={{ marginBottom: 16 }}>Circuit Breaker Monitor</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {stocks
                  .filter(s => s.minLimit > 0 && s.maxLimit > 0)
                  .sort((a, b) => {
                    const rangeA = a.maxLimit - a.minLimit;
                    const posA = rangeA > 0 ? (a.marketPrice - a.minLimit) / rangeA : 0.5;
                    const extremeA = Math.abs(posA - 0.5);

                    const rangeB = b.maxLimit - b.minLimit;
                    const posB = rangeB > 0 ? (b.marketPrice - b.minLimit) / rangeB : 0.5;
                    const extremeB = Math.abs(posB - 0.5);

                    return extremeB - extremeA; // Sort highest extremeness first
                  })
                  .slice(0, 8)
                  .map(s => {
                  const range = s.maxLimit - s.minLimit;
                  const posPct = Math.max(0, Math.min(100, ((s.marketPrice - s.minLimit) / range) * 100));
                  
                  let barColor = "var(--accent-primary)";
                  if (posPct >= 95) barColor = "var(--accent-success)";
                  if (posPct <= 5) barColor = "var(--accent-danger)";

                  return (
                    <div key={s.symbol} style={{ width: "100%" }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: "var(--text-sm)", marginBottom: 6 }}>
                        <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>{s.symbol}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{formatNumber(s.marketPrice)}</span>
                      </div>
                      <div style={{ position: 'relative', height: 8, background: "var(--bg-input)", borderRadius: 4, overflow: 'hidden', width: "100%" }}>
                        <div style={{ 
                          position: 'absolute', 
                          left: `${posPct}%`, 
                          top: 0, 
                          bottom: 0, 
                          width: 4, 
                          background: barColor, 
                          transform: 'translateX(-50%)',
                          borderRadius: 2,
                          boxShadow: `0 0 6px ${barColor}`
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                        <span>Min: {formatNumber(s.minLimit)}</span>
                        <span>Max: {formatNumber(s.maxLimit)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Deal Finder */}
            <div className="glass-panel" style={{ padding: 24, borderRadius: "var(--radius-xl)", boxSizing: "border-box", overflow: "hidden" }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>Deal Finder</h3>
                  <Target size={18} color="var(--accent-primary)" />
               </div>
               <div style={{ overflowX: 'auto', width: "100%" }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 300 }}>
                   <thead>
                     <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                       <th style={{ padding: '8px 4px', width: 40 }}>Rank</th>
                       <th style={{ padding: '8px 4px' }}>Symbol</th>
                       <th style={{ padding: '8px 4px' }}>Score</th>
                       <th style={{ padding: '8px 4px' }}>Signal</th>
                     </tr>
                   </thead>
                   <tbody>
                     {rankedDeals.slice(0, 8).map((deal, idx) => (
                       <tr key={deal.symbol} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' }}>
                         <td style={{ padding: '12px 4px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>#{idx + 1}</td>
                         <td style={{ padding: '12px 4px', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>{deal.symbol}</td>
                         <td style={{ padding: '12px 4px', color: deal.score > 0 ? 'var(--accent-success)' : deal.score < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                           {deal.score > 0 ? '+' : ''}{deal.score}
                         </td>
                         <td style={{ padding: '12px 4px', color: deal.signalColor, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                           {deal.signal}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

          </div>

          {/* Market Intel Summary */}
          <div className="glass-panel" style={{ padding: 24, borderRadius: "var(--radius-xl)", background: "color-mix(in srgb, var(--bg-elevated) 60%, transparent)", borderLeft: "4px solid var(--accent-primary)", width: "100%", boxSizing: "border-box" }}>
            <h3 style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)", marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
               <Zap size={20} color="var(--accent-primary)"/> Market Intel Summary
            </h3>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {generateSummary()}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
