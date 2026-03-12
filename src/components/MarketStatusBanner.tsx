import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, TrendingUp, Presentation } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MarketStatusBannerProps {
  latestAvailableDate: string | null;
  isDashboard: boolean;
}

type MarketPhase = 'LIVE' | 'HOLIDAY' | 'CLOSED';

export const MarketStatusBanner: React.FC<MarketStatusBannerProps> = ({ latestAvailableDate, isDashboard }) => {
  const [phase, setPhase] = useState<MarketPhase>('CLOSED');

  useEffect(() => {
    const evaluateMarketPhase = () => {
      const now = new Date();
      // Get EAT time for accurate day/hour checks
      const eatTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam" }));
      const eatDateStr = now.toLocaleDateString("en-CA", { timeZone: "Africa/Dar_es_Salaam" }); // YYYY-MM-DD
      
      const hours = eatTime.getHours();
      const minutes = eatTime.getMinutes();
      const day = eatTime.getDay(); // 0 is Sunday, 6 is Saturday

      const isActiveDay = day !== 0 && day !== 6;
      const timeInMinutes = hours * 60 + minutes;
      const isOpenTime = timeInMinutes >= (9 * 60 + 30); // >= 09:30
      const isBeforeClose = timeInMinutes < (16 * 60); // < 16:00
      
      const isMarketActive = isActiveDay && isOpenTime && isBeforeClose;
      const hasTodayData = latestAvailableDate === eatDateStr;

      if (isMarketActive) {
        if (hasTodayData) {
          setPhase('LIVE');
        } else {
          setPhase('HOLIDAY');
        }
      } else {
        setPhase('CLOSED');
      }
    };

    evaluateMarketPhase();
    // Re-evaluate every minute just to be safe
    const interval = setInterval(evaluateMarketPhase, 60000);
    return () => clearInterval(interval);
  }, [latestAvailableDate]);

  if (phase === 'LIVE') {
    if (isDashboard) {
      return (
        <div style={{
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--success-color) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--success-color) 20%, transparent)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "var(--space-6)"
        }}>
          <Clock size={18} color="var(--success-color)" />
          <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--success-color)", fontWeight: "var(--font-bold)" }}>Market OPEN. </span>
            The Dashboard displays end-of-day official closing numbers. <Link to="/glance" style={{ color: "var(--success-color)", textDecoration: "underline", fontWeight: "var(--font-medium)" }}>Check out the Daily Glance page for live intraday updates.</Link>
          </p>
        </div>
      );
    } else {
      // For Daily Glance during live market
      return (
        <div style={{
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--success-color) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--success-color) 20%, transparent)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "var(--space-6)"
        }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <div style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "var(--success-color)", animation: "pulse 2s infinite" }} />
             <Clock size={18} color="var(--success-color)" style={{ zIndex: 1 }} />
          </div>
          <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--success-color)", fontWeight: "var(--font-bold)" }}>Market OPEN. </span>
            Displaying live intraday market updates.
          </p>
        </div>
      );
    }
  }

  if (phase === 'HOLIDAY') {
    return (
      <div style={{
        padding: "12px 16px",
        background: "color-mix(in srgb, var(--danger-color) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--danger-color) 20%, transparent)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: "var(--space-6)"
      }}>
        <AlertTriangle size={18} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
          <span style={{ color: "var(--danger-color)", fontWeight: "var(--font-bold)" }}>Market Closed / Holiday. </span>
          It is within active trading hours, but no live data is available for today. Displaying the most recent closing data instead.
        </p>
      </div>
    );
  }

  if (phase === 'CLOSED') {
    if (isDashboard) {
      return (
        <div style={{
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--secondary-color) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--secondary-color) 20%, transparent)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "var(--space-6)"
        }}>
          <Clock size={18} color="var(--secondary-color)" />
          <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--secondary-color)", fontWeight: "var(--font-bold)" }}>Market Closed. </span>
            Displaying the latest official end-of-day closing numbers.
          </p>
        </div>
      );
    } else {
      // Daily Glance when closed
      return (
        <div style={{
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--secondary-color) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--secondary-color) 20%, transparent)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: "var(--space-6)"
        }}>
          <Clock size={18} color="var(--secondary-color)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ margin: 0, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--secondary-color)", fontWeight: "var(--font-bold)" }}>Market Closed. </span>
            Displaying the most recent intraday summary. You can wait for the next trading date, or explore:
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'var(--font-medium)' }}>
                <Presentation size={14} /> Official Closing Numbers
              </Link>
              <Link to="/trends" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'var(--font-medium)' }}>
                <TrendingUp size={14} /> Peruse Market Trends
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
};
