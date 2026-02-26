import { useQuery } from "@tanstack/react-query";


import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export interface MarketDate {
    sheetName: string;
    date: Date | null;
}

export interface StockData {
    symbol: string;
    open?: number;
    close: number;
    change: number;
    originalChange?: string;
    pctChange?: number;
    prevClose?: number;
    outstandingBid?: number;
    outstandingOffer?: number;
    turnoverPct?: number;
    bidOffer?: number;
    yearHigh?: number;
    yearLow?: number;
    highLowSpread?: number;
    bidOfferRatio?: number;
    turnoverPctDaily?: number;
    turnoverMcapRatio?: number;
    volPerDeal?: number;
    turnoverPerDeal?: number;
    changePerVol?: number;
    volume?: number;
    deals?: number;
    turnover?: number;
    mcap?: number;
    [key: string]: any; // Catch-all for other fields
}

export interface MarketIndex {
    Code: string;
    IndexDescription: string;
    ClosingPrice: number;
    Change?: number;
    [key: string]: any;
}

// Helper: Parse "26Jan2026" -> Date Object
const parseSheetDate = (sheetName: string): Date | null => {
    if (!sheetName) return null;
    const match = sheetName.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
    if (!match) return null;
    
    const day = parseInt(match[1]);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3]);
    
    const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(year, months[monthStr], day);
};

// Fetch available dates from config/app
export const useMarketDates = () => {
    return useQuery<MarketDate[]>({
        queryKey: ['marketDates'],
        queryFn: async () => {
            const docRef = doc(db, 'config', 'app');
            const snapshot = await getDoc(docRef);
            
            if (!snapshot.exists()) return [];
            
            const data = snapshot.data();
            // data.availableDates is array of strings ["26Jan2026", ...]
            
            const dates: MarketDate[] = (data.availableDates || []).map((d: string) => ({
                sheetName: d,
                date: parseSheetDate(d)
            }));
            
            // Sort Descending
            dates.sort((a, b) => {
                const dateA = a.date ? a.date.getTime() : 0;
                const dateB = b.date ? b.date.getTime() : 0;
                return dateB - dateA;
            });
            return dates;
        }
    });
};

// Fetch daily closing data from dailyClosing/{date}/stocks
export const useMarketData = (date: string) => {
    return useQuery<StockData[]>({
        queryKey: ['marketData', date],
        queryFn: async () => {
            if (!date) return [];
            
            const colRef = collection(db, 'dailyClosing', date, 'stocks');
            const snapshot = await getDocs(colRef);
            
            const stocks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    symbol: doc.id,
                    open: data.open ?? 0,
                    prevClose: data.prevClose ?? 0,
                    change: data.ChangeAbs ?? ((data.close ?? 0) - (data.open ?? 0)), // Absolute change
                    originalChange: data.change, // String representation
                    pctChange: data.ChangePer ?? data.changeValue ?? 0, // Scraper originally stored % in changeValue
                    // Map Firestore keys to frontend expected keys
                    outstandingBid: data.outstandingBid || 0,
                    outstandingOffer: data.outstandingOffer || 0,
                    // Keys used by TickerTrends (mapped names)
                    turnoverPct: data.turnoverPercent || 0,
                    bidOffer: data.bidOfferRatio || 0,
                    yearHigh: data.yearHigh || 0,
                    yearLow: data.yearLow || 0,
                    // Keys used by DerivedAnalytics (raw Firestore names)
                    highLowSpread: data.highLowSpread || 0,
                    bidOfferRatio: data.bidOfferRatio || 0,
                    turnoverPctDaily: data.turnoverPercent || 0,
                    turnoverMcapRatio: data.turnoverPerMcap || 0,
                    volPerDeal: data.volPerDeal || 0,
                    turnoverPerDeal: data.turnoverPerDeal || 0,
                    changePerVol: data.changePerVol || 0,
                } as StockData;
            });
            return stocks;
        },
        enabled: !!date,
        select: (data) => {
            // Keep filter logic used previously if needed
            return data.filter(item => item.close > 0 && item.symbol !== 'Total');
        }
    });
};

// Fetch all symbols from 'trends' collection
export const useTickerSymbols = () => {
    return useQuery<string[]>({
        queryKey: ['tickerSymbols'],
        queryFn: async () => {
            const colRef = collection(db, 'trends');
            const snapshot = await getDocs(colRef);
            
            const symbols = snapshot.docs.map(doc => doc.id);

            return symbols;
        }
    });
};

// Fetch history from trends/{symbol}/history
export const useTickerHistory = (symbol: string) => {
    return useQuery<StockData[]>({
        queryKey: ['tickerHistory', symbol],
        queryFn: async () => {
            if (!symbol) return [];
            
            const colRef = collection(db, 'trends', symbol, 'history');
            // We can't orderBy document ID easily if meaningful (IDs are dates). 
            // But we stored 'date' field inside documents too.
            const snapshot = await getDocs(colRef);
            
            const history = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    // doc.id might be date, keep symbol as prop
                    symbol: symbol, 
                    open: data.open ?? 0,
                    close: data.close || 0, // Ensure 'close' exists as per interface
                    change: data.ChangeAbs ?? ((data.close ?? 0) - (data.open ?? 0)), // Absolute change
                    originalChange: data.change, // String representation
                    pctChange: data.ChangePer ?? data.changeValue ?? 0, // Scraper originally stored % in changeValue
                    // Map Firestore keys to frontend expected keys
                    bidOffer: data.bidOfferRatio || 0,
                    spread: data.highLowSpread || 0,
                    turnoverPct: data.turnoverPercent || 0,
                    turnoverMcap: data.turnoverPerMcap || 0,
                    volDeal: data.volPerDeal || 0,
                    turnoverDeal: data.turnoverPerDeal || 0,
                    changeVol: data.changePerVol || 0,
                    outstandingBid: data.outstandingBid || 0,
                    outstandingOffer: data.outstandingOffer || 0,
                } as StockData;
            });
            return history;
        },
        enabled: !!symbol,
        staleTime: 1000 * 60 * 15, 
        select: (data) => {
            // Sort by date ascending
            return [...data].sort((a, b) => {
                 const dateA = a.date ? parseSheetDate(a.date)?.getTime() || 0 : 0;
                 const dateB = b.date ? parseSheetDate(b.date)?.getTime() || 0 : 0;
                 return dateA - dateB;
            });
        }
    });
};

// Fetch current market indices
export const useMarketIndices = () => {
    return useQuery<MarketIndex[] | null>({
        queryKey: ['marketIndices'],
        queryFn: async () => {
            const docRef = doc(db, 'marketIndices', 'current');
            const snapshot = await getDoc(docRef);
            
            if (!snapshot.exists()) return null;
            return (snapshot.data().data as MarketIndex[]) || []; // indicesResponse.data
        },
        // Refetch often since it's intraday data
        refetchInterval: 1000 * 60 * 15 // 15 minutes
    });
};
