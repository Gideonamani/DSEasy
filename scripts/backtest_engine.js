/**
 * DSEasy Backtesting Engine
 * 
 * A rigorous backtesting framework for testing trading strategies on historical DSE data.
 * Generates an interactive HTML report with charts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const DATA_FILE = path.join(__dirname, '../src/data/crdb_historical.json');
const OUTPUT_FILE = path.join(__dirname, '../backtest_report.html');
const INITIAL_CAPITAL = 10_000_000; // TZS 10,000,000
const RISK_FREE_RATE = 0.05; // 5% annual T-bill rate assumption

// --- Data Loading ---
function loadData() {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const json = JSON.parse(raw);
    const data = json.data || json;
    // Sort by date ascending
    return data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
}

// --- Technical Indicators ---
function sma(data, period) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].closing_price;
        }
        result[i] = sum / period;
    }
    return result;
}

function _ema(data, period) {
    const result = new Array(data.length).fill(null);
    const k = 2 / (period + 1);
    // Seed with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].closing_price;
    }
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
        result[i] = data[i].closing_price * k + result[i - 1] * (1 - k);
    }
    return result;
}

function _rsi(data, period = 14) {
    const result = new Array(data.length).fill(null);
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].closing_price - data[i - 1].closing_price;
        if (change > 0) gains += change;
        else losses -= change;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].closing_price - data[i - 1].closing_price;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    return result;
}

function bollingerBands(data, period = 20, multiplier = 2) {
    const smaVals = sma(data, period);
    const upper = new Array(data.length).fill(null);
    const lower = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        let sumSq = 0;
        for (let j = 0; j < period; j++) {
            sumSq += Math.pow(data[i - j].closing_price - smaVals[i], 2);
        }
        const stdDev = Math.sqrt(sumSq / period);
        upper[i] = smaVals[i] + multiplier * stdDev;
        lower[i] = smaVals[i] - multiplier * stdDev;
    }
    return { middle: smaVals, upper, lower };
}

// --- Backtesting Engine ---
function backtest(data, signalFn, strategyName) {
    let cash = INITIAL_CAPITAL;
    let shares = 0;
    const equityCurve = [];
    const trades = [];

    for (let i = 0; i < data.length; i++) {
        const price = data[i].closing_price;
        const signal = signalFn(i, data);

        if (signal === 'BUY' && cash > 0) {
            shares = Math.floor(cash / price);
            const cost = shares * price;
            cash -= cost;
            trades.push({ date: data[i].trade_date, action: 'BUY', price, shares });
        } else if (signal === 'SELL' && shares > 0) {
            const revenue = shares * price;
            cash += revenue;
            trades.push({ date: data[i].trade_date, action: 'SELL', price, shares });
            shares = 0;
        }
        equityCurve.push({ date: data[i].trade_date, equity: cash + shares * price });
    }

    // Final liquidation
    const finalPrice = data[data.length - 1].closing_price;
    const finalEquity = cash + shares * finalPrice;

    return { strategyName, equityCurve, trades, finalEquity };
}

// --- Strategy Definitions ---
function createMACrossoverStrategy(shortPeriod, longPeriod) {
    let shortSma, longSma;
    return {
        name: `SMA Crossover (${shortPeriod}/${longPeriod})`,
        init: (data) => {
            shortSma = sma(data, shortPeriod);
            longSma = sma(data, longPeriod);
        },
        signal: (i) => {
            if (i < longPeriod || shortSma[i] === null || longSma[i] === null) return 'HOLD';
            const prevShort = shortSma[i - 1], prevLong = longSma[i - 1];
            if (prevShort !== null && prevLong !== null) {
                if (shortSma[i] > longSma[i] && prevShort <= prevLong) return 'BUY';
                if (shortSma[i] < longSma[i] && prevShort >= prevLong) return 'SELL';
            }
            return 'HOLD';
        },
        indicators: () => ({ shortSma, longSma })
    };
}

function createBollingerBounceStrategy(period, multiplier) {
    let bb;
    return {
        name: `Bollinger Bounce (${period}, ${multiplier}σ)`,
        init: (data) => {
            bb = bollingerBands(data, period, multiplier);
        },
        signal: (i, data) => {
            if (i < period || bb.lower[i] === null) return 'HOLD';
            const price = data[i].closing_price;
            const prevPrice = data[i - 1].closing_price;
            if (prevPrice <= bb.lower[i - 1] && price > bb.lower[i]) return 'BUY';
            if (prevPrice >= bb.upper[i - 1] && price < bb.upper[i]) return 'SELL';
            return 'HOLD';
        },
        indicators: () => bb
    };
}

// --- Performance Metrics ---
function calculateMetrics(equityCurve) {
    if (equityCurve.length < 2) return {};

    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
        returns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
    }

    const totalReturn = (equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const annualizedStdDev = stdDev * Math.sqrt(252);

    // Sharpe Ratio (annualized)
    const annualizedReturn = totalReturn * (252 / equityCurve.length);
    const sharpeRatio = annualizedStdDev === 0 ? 0 : (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev;

    // Max Drawdown
    let peak = equityCurve[0].equity;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity;
        const drawdown = (peak - point.equity) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // CAGR
    const years = equityCurve.length / 252;
    const cagr = Math.pow(equityCurve[equityCurve.length - 1].equity / equityCurve[0].equity, 1 / years) - 1;

    return {
        totalReturn: (totalReturn * 100).toFixed(2) + '%',
        annualizedReturn: (annualizedReturn * 100).toFixed(2) + '%',
        sharpeRatio: sharpeRatio.toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
        cagr: (cagr * 100).toFixed(2) + '%',
        volatility: (annualizedStdDev * 100).toFixed(2) + '%'
    };
}

// --- Buy & Hold Benchmark ---
function buyAndHold(data) {
    const initialPrice = data[0].closing_price;
    const shares = Math.floor(INITIAL_CAPITAL / initialPrice);
    const equityCurve = data.map(d => ({
        date: d.trade_date,
        equity: shares * d.closing_price
    }));
    const finalEquity = equityCurve[equityCurve.length - 1].equity;
    return { strategyName: 'Buy & Hold', equityCurve, trades: [], finalEquity };
}

// --- HTML Report Generation ---
function generateReport(data, results, benchmark) {
    const dates = data.map(d => d.trade_date.split('T')[0]);
    const prices = data.map(d => d.closing_price);

    const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    const equityDatasets = [benchmark, ...results].map((r, i) => ({
        label: r.strategyName,
        data: r.equityCurve.map(e => e.equity),
        borderColor: chartColors[i % chartColors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0
    }));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DSEasy Backtest Report - CRDB</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --accent: #3b82f6; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: #94a3b8; margin-bottom: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .card { background: var(--card); border-radius: 12px; padding: 1.5rem; }
        .card h2 { font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .metric { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
        .metric:last-child { border-bottom: none; }
        .metric-label { color: #94a3b8; }
        .metric-value { font-weight: 600; }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .chart-container { height: 400px; margin-bottom: 2rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
        th { color: #94a3b8; font-weight: 500; }
        .buy { color: #10b981; }
        .sell { color: #ef4444; }
    </style>
</head>
<body>
    <h1>🧪 DSEasy Backtest Report</h1>
    <p class="subtitle">CRDB Bank • ${dates[0]} to ${dates[dates.length - 1]} • Initial Capital: TZS ${INITIAL_CAPITAL.toLocaleString()}</p>

    <div class="grid">
        ${[benchmark, ...results].map(r => {
            const metrics = calculateMetrics(r.equityCurve);
            const isPositive = parseFloat(metrics.totalReturn) > 0;
            return `
            <div class="card">
                <h2>${r.strategyName}</h2>
                <div class="metric"><span class="metric-label">Total Return</span><span class="metric-value ${isPositive ? 'positive' : 'negative'}">${metrics.totalReturn}</span></div>
                <div class="metric"><span class="metric-label">CAGR</span><span class="metric-value">${metrics.cagr}</span></div>
                <div class="metric"><span class="metric-label">Sharpe Ratio</span><span class="metric-value">${metrics.sharpeRatio}</span></div>
                <div class="metric"><span class="metric-label">Max Drawdown</span><span class="metric-value negative">${metrics.maxDrawdown}</span></div>
                <div class="metric"><span class="metric-label">Volatility</span><span class="metric-value">${metrics.volatility}</span></div>
                <div class="metric"><span class="metric-label">Final Equity</span><span class="metric-value">TZS ${r.finalEquity.toLocaleString()}</span></div>
            </div>`;
        }).join('')}
    </div>

    <div class="card">
        <h2>Equity Curve</h2>
        <div class="chart-container"><canvas id="equityChart"></canvas></div>
    </div>

    <div class="card">
        <h2>Price with Moving Averages</h2>
        <div class="chart-container"><canvas id="priceChart"></canvas></div>
    </div>

    ${results.filter(r => r.trades.length > 0).map(r => `
    <div class="card">
        <h2>${r.strategyName} – Trade Log (${r.trades.length} trades)</h2>
        <table>
            <thead><tr><th>Date</th><th>Action</th><th>Price</th><th>Shares</th></tr></thead>
            <tbody>
                ${r.trades.slice(0, 20).map(t => `<tr><td>${t.date.split('T')[0]}</td><td class="${t.action.toLowerCase()}">${t.action}</td><td>TZS ${t.price.toLocaleString()}</td><td>${t.shares.toLocaleString()}</td></tr>`).join('')}
                ${r.trades.length > 20 ? `<tr><td colspan="4" style="color:#94a3b8">... and ${r.trades.length - 20} more trades</td></tr>` : ''}
            </tbody>
        </table>
    </div>
    `).join('')}

    <script>
        const dates = ${JSON.stringify(dates)};
        const prices = ${JSON.stringify(prices)};

        new Chart(document.getElementById('equityChart'), {
            type: 'line',
            data: { labels: dates, datasets: ${JSON.stringify(equityDatasets)} },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { display: false }, y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } },
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                interaction: { mode: 'index', intersect: false }
            }
        });

        new Chart(document.getElementById('priceChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    { label: 'Price', data: prices, borderColor: '#e2e8f0', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0 },
                    { label: 'SMA 20', data: ${JSON.stringify(sma(data, 20))}, borderColor: '#f59e0b', borderWidth: 1, pointRadius: 0 },
                    { label: 'SMA 50', data: ${JSON.stringify(sma(data, 50))}, borderColor: '#3b82f6', borderWidth: 1, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { display: false }, y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } },
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                interaction: { mode: 'index', intersect: false }
            }
        });
    </script>
</body>
</html>`;
    return html;
}

// --- Main Execution ---
console.log('📊 DSEasy Backtesting Engine');
console.log('Loading data...');

const data = loadData();
console.log(`Loaded ${data.length} data points for ${data[0]?.company || 'CRDB'}`);
console.log(`Date range: ${data[0].trade_date.split('T')[0]} to ${data[data.length - 1].trade_date.split('T')[0]}`);

// Define Strategies
const strategies = [
    createMACrossoverStrategy(20, 50),
    createBollingerBounceStrategy(20, 2)
];

// Run Backtests
const results = strategies.map(strategy => {
    strategy.init(data);
    return backtest(data, strategy.signal, strategy.name);
});

// Benchmark
const benchmark = buyAndHold(data);

// Generate Report
console.log('\nGenerating HTML report...');
const html = generateReport(data, results, benchmark);
fs.writeFileSync(OUTPUT_FILE, html);

console.log(`\n✅ Report saved to: ${OUTPUT_FILE}`);
console.log('\n--- Summary ---');
[benchmark, ...results].forEach(r => {
    const metrics = calculateMetrics(r.equityCurve);
    console.log(`${r.strategyName}: Total Return ${metrics.totalReturn}, Sharpe ${metrics.sharpeRatio}, Max DD ${metrics.maxDrawdown}`);
});
