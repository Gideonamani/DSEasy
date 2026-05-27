import React, { useEffect, useState } from 'react';

interface TickerLogoProps {
  symbol: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Deterministic color generation based on symbol string
const getColorForSymbol = (symbol: string): string => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

type LogoStage = 'high-res' | 'low-res' | 'fallback';

const urlForStage = (symbol: string, stage: LogoStage): string => {
  // Normalize symbol (e.g., replace hyphens with spaces for file lookups)
  const normalized = symbol.replace(/-/g, ' ');
  const encoded = encodeURIComponent(normalized);
  if (stage === 'high-res') return `/logos/high-res/${encoded}.png`;
  return `/logos/${encoded}.png`;
};

export const TickerLogo: React.FC<TickerLogoProps> = ({
  symbol,
  size = 24,
  className = '',
  style = {}
}) => {
  const [stage, setStage] = useState<LogoStage>('high-res');

  // Reset stage when the symbol changes, otherwise a stale failed state
  // can persist across ticker switches.
  useEffect(() => {
    setStage('high-res');
  }, [symbol]);

  const cleanSymbol = symbol.replace(/-/g, ' ').replace(' ETF', '').trim();
  const initial = cleanSymbol ? cleanSymbol.charAt(0).toUpperCase() : '?';

  const isFallback = stage === 'fallback';

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: isFallback ? getColorForSymbol(symbol) : '#ffffff',
    padding: isFallback ? '0' : `${Math.max(1, Math.round(size * 0.1))}px`,
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: `${Math.max(10, size * 0.45)}px`,
    boxShadow: isFallback 
      ? '0 1px 3px rgba(0,0,0,0.1)' 
      : '0 2px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)',
    boxSizing: 'border-box',
    ...style
  };

  const handleError = () => {
    setStage((prev) =>
      prev === 'high-res' ? 'low-res' : 'fallback'
    );
  };

  return (
    <div className={`ticker-logo ${className}`} style={containerStyle} title={symbol}>
      {!isFallback ? (
        <img
          src={urlForStage(symbol, stage)}
          alt={`${symbol} logo`}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={handleError}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};

interface TickerLogoLabelProps {
  symbol: string;
  size?: number;
  gap?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Logo + symbol label in a flex row. Use this anywhere you'd otherwise
 * inline a `<div style={{ display: 'flex', gap }}>` around <TickerLogo>.
 * Pass `children` to override the label content (e.g. a clickable span).
 */
export const TickerLogoLabel: React.FC<TickerLogoLabelProps> = ({
  symbol,
  size = 24,
  gap = 12,
  children,
  style,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: `${gap}px`, ...style }}>
    <TickerLogo symbol={symbol} size={size} />
    {children ?? <span>{symbol}</span>}
  </div>
);
