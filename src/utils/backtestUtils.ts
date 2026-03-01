import { StockData } from '../hooks/useMarketQuery';

export interface Trade {
    date: string;
    action: 'BUY' | 'SELL';
    price: number;
    shares: number;
}

export interface EquityPoint {
    date: string;
    equity: number;
}

export interface BacktestResult {
    strategyName: string;
    equityCurve: EquityPoint[];
    trades: Trade[];
    finalEquity: number;
}

export interface Strategy {
    name: string;
    init: (data: StockData[]) => void;
    signal: (i: number, data: StockData[]) => 'BUY' | 'SELL' | 'HOLD';
    indicators?: () => any;
}

const INITIAL_CAPITAL = 10_000_000; // TZS 10,000,000
const RISK_FREE_RATE = 0.05; // 5% annual T-bill rate assumption

// --- Technical Indicators ---
export function sma(data: StockData[], period: number): (number | null)[] {
    const result: (number | null)[] = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result[i] = sum / period;
    }
    return result;
}

export function _ema(data: StockData[], period: number): (number | null)[] {
    const result: (number | null)[] = new Array(data.length).fill(null);
    if (data.length < period) return result;
    
    const k = 2 / (period + 1);
    // Seed with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].close;
    }
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
        const prev = result[i - 1];
        if (prev !== null) {
            result[i] = data[i].close * k + prev * (1 - k);
        }
    }
    return result;
}

export function _rsi(data: StockData[], period = 14): (number | null)[] {
    const result: (number | null)[] = new Array(data.length).fill(null);
    if (data.length <= period) return result;

    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    return result;
}

export function bollingerBands(data: StockData[], period = 20, multiplier = 2) {
    const smaVals = sma(data, period);
    const upper: (number | null)[] = new Array(data.length).fill(null);
    const lower: (number | null)[] = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        let sumSq = 0;
        const currentSma = smaVals[i];
        if (currentSma !== null) {
            for (let j = 0; j < period; j++) {
                sumSq += Math.pow(data[i - j].close - currentSma, 2);
            }
            const stdDev = Math.sqrt(sumSq / period);
            upper[i] = currentSma + multiplier * stdDev;
            lower[i] = currentSma - multiplier * stdDev;
        }
    }
    return { middle: smaVals, upper, lower };
}

// --- Backtesting Engine ---
export function runBacktest(data: StockData[], strategy: Strategy, initialCapital = INITIAL_CAPITAL): BacktestResult {
    let cash = initialCapital;
    let shares = 0;
    const equityCurve: EquityPoint[] = [];
    const trades: Trade[] = [];

    if (data.length === 0) {
        return { strategyName: strategy.name, equityCurve: [], trades: [], finalEquity: cash };
    }

    strategy.init(data);

    for (let i = 0; i < data.length; i++) {
        const price = data[i].close;
        const signal = strategy.signal(i, data);
        const dateStr = data[i].date ? (typeof data[i].date === 'string' ? data[i].date : (data[i].date as any).toISOString ? (data[i].date as any).toISOString() : new Date(data[i].date as any).toISOString()) : `Day ${i}`;

        if (signal === 'BUY' && cash >= price) { 
            // Only buy if we have enough cash for at least 1 share, use all available cash
            shares = Math.floor(cash / price);
            const cost = shares * price;
            cash -= cost;
            trades.push({ date: dateStr, action: 'BUY', price, shares });
        } else if (signal === 'SELL' && shares > 0) {
            const revenue = shares * price;
            cash += revenue;
            trades.push({ date: dateStr, action: 'SELL', price, shares });
            shares = 0; // Sell all shares
        }
        
        equityCurve.push({ date: dateStr, equity: cash + shares * price });
    }

    // Sell remaining shares at the end
    const finalPrice = data[data.length - 1].close;
    const finalEquity = cash + shares * finalPrice;

    return { strategyName: strategy.name, equityCurve, trades, finalEquity };
}

// --- Performance Metrics ---
export function calculateMetrics(equityCurve: EquityPoint[]) {
    if (equityCurve.length < 2) {
        return {
            totalReturn: '0.00%',
            annualizedReturn: '0.00%',
            sharpeRatio: '0.00',
            maxDrawdown: '0.00%',
            cagr: '0.00%',
            volatility: '0.00%'
        };
    }

    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
        const prevEquity = equityCurve[i - 1].equity;
        // avoid division by zero
        if (prevEquity > 0) {
             returns.push((equityCurve[i].equity - prevEquity) / prevEquity);
        } else {
             returns.push(0); 
        }
    }

    const startingEquity = equityCurve[0].equity;
    const endingEquity = equityCurve[equityCurve.length - 1].equity;
    const totalReturn = startingEquity > 0 ? (endingEquity - startingEquity) / startingEquity : 0;
    
    // Safety check for empty returns array
    if (returns.length === 0) {
        return { totalReturn: (totalReturn * 100).toFixed(2) + '%', annualizedReturn: '0%', sharpeRatio: '0', maxDrawdown: '0%', cagr: '0%', volatility: '0%' };
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const annualizedStdDev = stdDev * Math.sqrt(252);

    // Sharpe Ratio (annualized)
    const annualizedReturn = totalReturn * (252 / equityCurve.length);
    const sharpeRatio = annualizedStdDev === 0 ? 0 : (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev;

    // Max Drawdown
    let peak = startingEquity;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity;
        if (peak > 0) {
            const drawdown = (peak - point.equity) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }

    // CAGR (assuming ~252 trading days/year)
    const years = equityCurve.length / 252;
    // avoid negative root errors if equity dropped to 0
    let cagr = 0;
    if (years > 0 && endingEquity > 0 && startingEquity > 0) {
         cagr = Math.pow(endingEquity / startingEquity, 1 / years) - 1;
    }

    return {
        totalReturn: (totalReturn * 100).toFixed(2) + '%',
        annualizedReturn: (annualizedReturn * 100).toFixed(2) + '%',
        sharpeRatio: sharpeRatio.toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
        cagr: (cagr * 100).toFixed(2) + '%',
        volatility: (annualizedStdDev * 100).toFixed(2) + '%'
    };
}

// --- Benchmark ---
export function buyAndHold(data: StockData[], initialCapital = INITIAL_CAPITAL): BacktestResult {
    if (data.length === 0) return { strategyName: 'Buy & Hold', equityCurve: [], trades: [], finalEquity: initialCapital };
    
    const initialPrice = data[0].close;
    // Catch-all to avoid division by 0
    if (initialPrice <= 0) return { strategyName: 'Buy & Hold', equityCurve: [], trades: [], finalEquity: initialCapital };
    
    const shares = Math.floor(initialCapital / initialPrice);
    const cash = initialCapital - (shares * initialPrice);
    
    const equityCurve = data.map((d, i) => {
        const dateStr = d.date ? (typeof d.date === 'string' ? d.date : (d.date as any).toISOString ? (d.date as any).toISOString() : new Date(d.date as any).toISOString()) : `Day ${i}`;
        return {
            date: dateStr,
            equity: cash + (shares * d.close)
        };
    });
    
    const finalEquity = equityCurve[equityCurve.length - 1].equity;
    const trades: Trade[] = [{ date: equityCurve[0].date, action: 'BUY', price: initialPrice, shares }];
    return { strategyName: 'Buy & Hold', equityCurve, trades, finalEquity };
}

// --- Strategies ---

export function createMACrossoverStrategy(shortPeriod: number, longPeriod: number): Strategy {
    let shortSma: (number | null)[], longSma: (number | null)[];
    return {
        name: `SMA Crossover (${shortPeriod}/${longPeriod})`,
        init: (data: StockData[]) => {
            shortSma = sma(data, shortPeriod);
            longSma = sma(data, longPeriod);
        },
        signal: (i: number) => {
            if (i < longPeriod || shortSma[i] === null || longSma[i] === null) return 'HOLD';
            const prevShort = shortSma[i - 1];
            const prevLong = longSma[i - 1];
            const currShort = shortSma[i] as number;
            const currLong = longSma[i] as number;

            if (prevShort !== null && prevLong !== null) {
                if (currShort > currLong && prevShort <= prevLong) return 'BUY';
                if (currShort < currLong && prevShort >= prevLong) return 'SELL';
            }
            return 'HOLD';
        },
        indicators: () => ({ shortSma, longSma })
    };
}

export function createEMACrossoverStrategy(shortPeriod: number, longPeriod: number): Strategy {
    let shortEma: (number | null)[], longEma: (number | null)[];
    return {
        name: `EMA Crossover (${shortPeriod}/${longPeriod})`,
        init: (data: StockData[]) => {
            shortEma = _ema(data, shortPeriod);
            longEma = _ema(data, longPeriod);
        },
        signal: (i: number) => {
            if (i < longPeriod || shortEma[i] === null || longEma[i] === null) return 'HOLD';
            const prevShort = shortEma[i - 1];
            const prevLong = longEma[i - 1];
            const currShort = shortEma[i] as number;
            const currLong = longEma[i] as number;

            if (prevShort !== null && prevLong !== null) {
                if (currShort > currLong && prevShort <= prevLong) return 'BUY';
                if (currShort < currLong && prevShort >= prevLong) return 'SELL';
            }
            return 'HOLD';
        },
        indicators: () => ({ shortEma, longEma })
    };
}

export function createBreakoutStrategy(period: number): Strategy {
    return {
        name: `Price Breakout (${period}d)`,
        init: () => {}, 
        signal: (i: number, data: StockData[]) => {
            if (i < period) return 'HOLD';
            const currentPrice = data[i].close;
            let max = -Infinity;
            let min = Infinity;
            // Check the high/low of the previous `period` days
            for (let j = 1; j <= period; j++) {
                const p = data[i - j].close;
                if (p > max) max = p;
                if (p < min) min = p;
            }
            if (currentPrice > max) return 'BUY';
            if (currentPrice < min) return 'SELL';
            return 'HOLD';
        }
    };
}

export function createBollingerBounceStrategy(period: number, multiplier: number): Strategy {
    let bb: { middle: (number | null)[], upper: (number | null)[], lower: (number | null)[] };
    return {
        name: `Bollinger Bounce (${period}, ${multiplier}σ)`,
        init: (data: StockData[]) => {
            bb = bollingerBands(data, period, multiplier);
        },
        signal: (i: number, data: StockData[]) => {
            if (i < period || bb.lower[i] === null || bb.upper[i] === null) return 'HOLD';
            const price = data[i].close;
            const prevPrice = data[i - 1].close;
            const prevLower = bb.lower[i - 1] as number;
            const currLower = bb.lower[i] as number;
            const prevUpper = bb.upper[i - 1] as number;
            const currUpper = bb.upper[i] as number;

            if (prevPrice <= prevLower && price > currLower) return 'BUY';
            if (prevPrice >= prevUpper && price < currUpper) return 'SELL';
            return 'HOLD';
        },
        indicators: () => bb
    };
}

export function createRSIStrategy(period = 14, overbought = 70, oversold = 30): Strategy {
    let rsiVals: (number | null)[];
    return {
        name: `RSI (${period}, ${oversold}/${overbought})`,
        init: (data: StockData[]) => {
            rsiVals = _rsi(data, period);
        },
        signal: (i: number) => {
            if (i < period || rsiVals[i] === null || rsiVals[i - 1] === null) return 'HOLD';
            
            const currRSI = rsiVals[i] as number;
            const prevRSI = rsiVals[i - 1] as number;
            
            // Buy when recovering from oversold
            if (prevRSI <= oversold && currRSI > oversold) return 'BUY';
            // Sell when dropping from overbought
            if (prevRSI >= overbought && currRSI < overbought) return 'SELL';
            
            return 'HOLD';
        }
    }
}
