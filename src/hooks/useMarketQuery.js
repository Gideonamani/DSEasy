import { useQuery } from "@tanstack/react-query";

const API_URL = "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec";
const SYMBOLS_API_URL = "https://script.google.com/macros/s/AKfycbwMbFZmHxoMbixaTPXRUWH_v_tgHiMANTpj9iFZdzIjmzPBUIctpoFZl1ogy0tmiIQz/exec";

// Fetch available dates
export const useMarketDates = () => {
    return useQuery({
        queryKey: ['marketDates'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}?action=getDates`);
            const dates = await res.json();
            
            // Normalization Logic
            const normalizedDates = dates.map(d => {
                if (typeof d === 'string') return { date: null, sheetName: d };
                return d;
             });
     
             // Sort
             if (normalizedDates.length > 0 && normalizedDates[0].date) {
                 normalizedDates.sort((a, b) => new Date(b.date) - new Date(a.date));
             }
             
             return normalizedDates;
        }
    });
};

// Fetch and transform market data for a specific date
export const useMarketData = (date) => {
    return useQuery({
        queryKey: ['marketData', date],
        queryFn: async () => {
            if (!date) return [];
            const url = `${API_URL}?action=getData&date=${encodeURIComponent(date)}`;
            const res = await fetch(url);
            return res.json();
        },
        enabled: !!date, // Only run if date is selected
        select: (rawData) => {
            // --- Data Cleaning Logic ---
            const rowMap = new Map();

            rawData.forEach((item) => {
                if (!item.symbol || item.symbol === "Co." || item.symbol === "---" || item.symbol === "Total") {
                    return;
                }

                if (rowMap.has(item.symbol)) {
                    const prev = rowMap.get(item.symbol);
                    rowMap.set(item.symbol, {
                        ...prev,
                        open: prev.open || item.open,
                        close: prev.close || item.close,
                        high: Math.max(prev.high || 0, item.high || 0),
                        low: prev.low && item.low ? Math.min(prev.low, item.low) : prev.low || item.low,
                        change: prev.change !== 0 ? prev.change : item.change,
                        volume: (prev.volume || 0) + (item.volume || 0),
                        turnover: (prev.turnover || 0) + (item.turnover || 0),
                        deals: (prev.deals || 0) + (item.deals || 0),
                        mcap: prev.mcap || item.mcap,
                    });
                } else {
                    rowMap.set(item.symbol, item);
                }
            });

            return Array.from(rowMap.values()).filter((item) => item.close > 0);
        }
    });
};

export const useTickerSymbols = () => {
    return useQuery({
        queryKey: ['tickerSymbols'],
        queryFn: async () => {
            const res = await fetch(`${SYMBOLS_API_URL}?action=getSymbols`);
            return res.json();
        }
    });
};

export const useTickerHistory = (symbol) => {
    return useQuery({
        queryKey: ['tickerHistory', symbol],
        queryFn: async () => {
            if (!symbol) return [];
            const url = `${SYMBOLS_API_URL}?action=getTimeseries&symbol=${encodeURIComponent(symbol)}`;
            const res = await fetch(url);
            return res.json();
        },
        enabled: !!symbol,
        staleTime: 1000 * 60 * 15, // Cache for 15 minutes (longer than market data)
        select: (data) => {
            if (!Array.isArray(data)) return [];
            
            // Sort by date ascending
            return [...data].sort((a, b) => {
                  const parseDate = (str) => {
                    const match = String(str).match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
                    if (!match) return new Date(str);
                    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
                    return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
                  };
                  return parseDate(a.date) - parseDate(b.date);
            });
        }
    });
};
