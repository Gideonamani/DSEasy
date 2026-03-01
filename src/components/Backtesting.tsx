import React, { useState, useMemo } from 'react';
import { useTickerSymbols, useTickerHistory } from '../hooks/useMarketQuery';
import { CustomSelect } from './CustomSelect';
import { 
    runBacktest, 
    buyAndHold, 
    calculateMetrics, 
    createMACrossoverStrategy, 
    createBollingerBounceStrategy, 
    createRSIStrategy, 
    Strategy, 
    BacktestResult
} from '../utils/backtestUtils';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Loader2, ArrowRightLeft, TrendingDown, AlertCircle, TrendingUp, BarChart2, Zap } from 'lucide-react';
import { EmptyState } from './EmptyState';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const STRATEGY_OPTIONS = [
    { value: 'sma', label: 'SMA Crossover (20/50)' },
    { value: 'bb', label: 'Bollinger Bounce (20, 2σ)' },
    { value: 'rsi', label: 'RSI Reversal (14)' }
];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Backtesting: React.FC = () => {
    const [selectedSymbol, setSelectedSymbol] = useState<string>('CRDB');
    const [initialCapital, setInitialCapital] = useState<number>(10_000_000);
    const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['sma']);

    const { data: symbolsList = [], isLoading: loadingSymbols } = useTickerSymbols();
    const { data: historyData = [], isLoading: loadingHistory, error: historyError } = useTickerHistory(selectedSymbol);

    const validData = useMemo(() => historyData.filter(d => d.close > 0), [historyData]);

    const strategies = useMemo(() => {
        const strats: Strategy[] = [];
        if (selectedStrategies.includes('sma')) strats.push(createMACrossoverStrategy(20, 50));
        if (selectedStrategies.includes('bb')) strats.push(createBollingerBounceStrategy(20, 2));
        if (selectedStrategies.includes('rsi')) strats.push(createRSIStrategy(14, 70, 30));
        return strats;
    }, [selectedStrategies]);

    const backtestResults = useMemo(() => {
        if (!validData || validData.length === 0) return [];
        const results: BacktestResult[] = [];
        results.push(buyAndHold(validData, initialCapital));
        for (const strategy of strategies) {
            results.push(runBacktest(validData, strategy, initialCapital));
        }
        return results;
    }, [validData, strategies, initialCapital]);

    const chartData = useMemo(() => {
        if (!backtestResults.length) return null;

        const labels = backtestResults[0].equityCurve.map(p => {
            try { return new Date(p.date).toLocaleDateString('en-GB') } catch { return p.date; }
        });

        const datasets = backtestResults.map((result, index) => {
            const isBenchmark = result.strategyName === 'Buy & Hold';
            const color = isBenchmark ? '#94a3b8' : CHART_COLORS[(index - 1) % CHART_COLORS.length];
            return {
                label: result.strategyName,
                data: result.equityCurve.map(p => p.equity),
                borderColor: color,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'transparent';
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, color + '40');
                    gradient.addColorStop(1, color + '00');
                    return gradient;
                },
                fill: true,
                borderWidth: isBenchmark ? 2 : 2.5,
                borderDash: isBenchmark ? [6, 4] : ([] as number[]),
                pointRadius: 0,
                tension: 0.3,
            };
        });

        return { labels, datasets };
    }, [backtestResults]);

    const handleStrategyToggle = (val: string) => {
        setSelectedStrategies(prev =>
            prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
        );
    };

    if (loadingSymbols) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem' }}>
                <Loader2 size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading configuration...</p>
            </div>
        );
    }

    const cardStyle: React.CSSProperties = {
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '1.25rem',
        padding: '1.75rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    };

    return (
        <div style={{ padding: '1.5rem 2rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── HERO HEADER ── */}
            <header style={{
                borderRadius: '1.5rem',
                padding: '2.5rem',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(99,102,241,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '2rem',
            }}>
                {/* Glow orbs */}
                <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', borderRadius: '999px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        <Zap size={12} />
                        Strategy Simulation
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.75rem 0', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                        Interactive Backtesting
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0, maxWidth: '500px', lineHeight: 1.6 }}>
                        Simulate quantitative trading strategies on real DSE historical data and compare performance against Buy &amp; Hold.
                    </p>
                </div>
                <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '1.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>
                    <BarChart2 style={{ color: '#818cf8', width: '56px', height: '56px' }} />
                </div>
            </header>

            {/* ── CONTROLS PANEL ── */}
            <div style={cardStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '2rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ticker Symbol</label>
                        <CustomSelect
                            options={symbolsList.map(s => ({ value: s, label: s }))}
                            value={selectedSymbol}
                            onChange={(val) => setSelectedSymbol(val as string)}
                            placeholder="Choose a ticker..."
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Initial Capital (TZS)</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, pointerEvents: 'none' }}>TZS</span>
                            <input
                                type="text"
                                value={initialCapital.toLocaleString()}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/\D/g, '');
                                    setInitialCapital(Number(rawValue) || 0);
                                }}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, padding: '10px 14px 10px 46px', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Strategies</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {STRATEGY_OPTIONS.map(opt => {
                                const isSelected = selectedStrategies.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleStrategyToggle(opt.value)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: isSelected ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--glass-border)',
                                            background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-input)',
                                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '0.8125rem', fontWeight: 600,
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: isSelected ? '0 0 16px rgba(99,102,241,0.15)' : 'none',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', boxShadow: isSelected ? '0 0 6px var(--accent-primary)' : 'none', flexShrink: 0 }} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RESULTS ── */}
            {loadingHistory ? (
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '4rem', flexDirection: 'column' }}>
                    <Loader2 size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Loading market history for {selectedSymbol}...</span>
                </div>
            ) : historyError ? (
                <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} /> Failed to fetch market history. Please try again later.
                </div>
            ) : validData.length < 50 ? (
                <EmptyState
                    icon={TrendingDown}
                    title="Insufficient Data"
                    description={`Not enough historical data for ${selectedSymbol}. Needs at least 50 trading days.`}
                />
            ) : (
                <>
                    {/* ── STRATEGY METRIC CARDS ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${backtestResults.length}, 1fr)`, gap: '1rem' }}>
                        {backtestResults.map((result, idx) => {
                            const metrics = calculateMetrics(result.equityCurve);
                            const isPositive = parseFloat(metrics.totalReturn) >= 0;
                            const isBenchmark = result.strategyName === 'Buy & Hold';
                            const color = isBenchmark ? '#94a3b8' : CHART_COLORS[(idx - 1) % CHART_COLORS.length];
                            const returnColor = isPositive ? '#10b981' : '#ef4444';

                            return (
                                <div key={idx} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                                    {/* Color bar */}
                                    <div style={{ height: '4px', background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                                    <div style={{ padding: '1.5rem' }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '0.625rem', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <TrendingUp size={16} style={{ color }} />
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{result.strategyName}</p>
                                                    {isBenchmark && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Reference</p>}
                                                </div>
                                            </div>
                                            <div style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', background: `${color}18`, color: color, fontSize: '0.7rem', fontWeight: 700 }}>
                                                {result.trades.length} trades
                                            </div>
                                        </div>

                                        {/* Big return number */}
                                        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Total Return</p>
                                            <p style={{ fontSize: '2rem', fontWeight: 900, color: returnColor, margin: 0, letterSpacing: '-0.02em' }}>
                                                {isPositive ? '+' : ''}{metrics.totalReturn}
                                            </p>
                                        </div>

                                        {/* Sub-metrics grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            {[
                                                { label: 'Final Equity', value: result.finalEquity.toLocaleString(), color: 'var(--text-primary)' },
                                                { label: 'CAGR', value: metrics.cagr, color: 'var(--text-primary)' },
                                                { label: 'Max Drawdown', value: metrics.maxDrawdown, color: '#ef4444' },
                                                { label: 'Sharpe Ratio', value: metrics.sharpeRatio, color: 'var(--accent-primary)' },
                                            ].map(m => (
                                                <div key={m.label} style={{ background: 'var(--bg-input)', borderRadius: '0.625rem', padding: '0.625rem 0.75rem' }}>
                                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.2rem 0' }}>{m.label}</p>
                                                    <p style={{ fontSize: '1rem', fontWeight: 800, color: m.color, margin: 0 }}>{m.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── EQUITY CURVE CHART ── */}
                    {chartData && (
                        <div style={{ ...cardStyle, padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '0.625rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <BarChart2 size={18} style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Equity Curve Comparison</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Portfolio value over time vs. Buy &amp; Hold</p>
                                </div>
                            </div>
                            <div style={{ height: '360px' }}>
                                <Line
                                    data={chartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        interaction: { mode: 'index', intersect: false },
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                                labels: { color: 'var(--text-secondary)' as string, usePointStyle: true, pointStyleWidth: 10, boxHeight: 7, font: { family: "'Inter', sans-serif", size: 12, weight: 600 } }
                                            },
                                            tooltip: {
                                                backgroundColor: 'var(--bg-card)' as string,
                                                borderColor: 'var(--glass-border)' as string,
                                                borderWidth: 1,
                                                titleColor: 'var(--text-primary)' as string,
                                                bodyColor: 'var(--text-secondary)' as string,
                                                callbacks: {
                                                    label: (context) => {
                                                        let label = context.dataset.label || '';
                                                        if (label) label += ': ';
                                                        if (context.parsed.y !== null) {
                                                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(context.parsed.y);
                                                        }
                                                        return label;
                                                    }
                                                }
                                            }
                                        },
                                        scales: {
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: 'var(--text-secondary)' as string, maxTicksLimit: 8, font: { family: "'Inter', sans-serif", size: 11 } },
                                                border: { display: false },
                                            },
                                            y: {
                                                grid: { color: 'var(--glass-border)' as string },
                                                ticks: {
                                                    color: 'var(--text-secondary)' as string,
                                                    font: { family: "'Inter', sans-serif", size: 11 },
                                                    callback: (val) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(val as number)
                                                },
                                                border: { display: false },
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── RECENT TRADES TABLE ── */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '0.625rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ArrowRightLeft size={16} style={{ color: 'var(--accent-success)' }} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Recent Strategy Signals</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Latest buy/sell executions from active strategies</p>
                                </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px', background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Last 15 Trades
                            </span>
                        </div>

                        {backtestResults.every(r => r.trades.length <= 1) ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No significant trading activity from current strategies.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid var(--glass-border)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--glass-border)' }}>
                                            {['Date', 'Strategy', 'Action', 'Unit Price', 'Value Impact'].map((h, i) => (
                                                <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: i >= 3 ? 'right' : i === 2 ? 'center' : 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backtestResults
                                            .filter(r => r.strategyName !== 'Buy & Hold')
                                            .flatMap(r => r.trades.map(t => ({ ...t, strategy: r.strategyName })))
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .slice(0, 15)
                                            .map((trade, i) => {
                                                const isBuy = trade.action === 'BUY';
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                            {new Date(trade.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{trade.strategy}</td>
                                                        <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em',
                                                                background: isBuy ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                                color: isBuy ? '#10b981' : '#ef4444',
                                                                border: isBuy ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)',
                                                            }}>
                                                                {trade.action}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                            TZS {trade.price.toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', fontWeight: 700, color: isBuy ? 'var(--text-primary)' : '#10b981', whiteSpace: 'nowrap' }}>
                                                            {isBuy ? '-' : '+'} TZS {(trade.price * trade.shares).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
