import { useQuery } from "@tanstack/react-query";


import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Helper: Parse "26Jan2026" -> Date Object
const parseSheetDate = (sheetName) => {
    if (!sheetName) return null;
    const match = sheetName.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
    if (!match) return null;
    
    const day = parseInt(match[1]);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3]);
    
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(year, months[monthStr], day);
};

// Fetch available dates from config/app
export const useMarketDates = () => {
    return useQuery({
        queryKey: ['marketDates'],
        queryFn: async () => {
            const docRef = doc(db, 'config', 'app');
            const snapshot = await getDoc(docRef);
            
            if (!snapshot.exists()) return [];
            
            const data = snapshot.data();
            // data.availableDates is array of strings ["26Jan2026", ...]
            
            const dates = (data.availableDates || []).map(d => ({
                sheetName: d,
                date: parseSheetDate(d)
            }));
            
            // Sort Descending
            dates.sort((a, b) => b.date - a.date);
            return dates;
        }
    });
};

// Fetch daily closing data from dailyClosing/{date}/stocks
export const useMarketData = (date) => {
    return useQuery({
        queryKey: ['marketData', date],
        queryFn: async () => {
            if (!date) return [];
            
            const colRef = collection(db, 'dailyClosing', date, 'stocks');
            const snapshot = await getDocs(colRef);
            
            const stocks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    change: data.changeValue || 0, // Normalize change to be the numeric value
                    originalChange: data.change // Keep original text if needed
                };
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
    return useQuery({
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
export const useTickerHistory = (symbol) => {
    return useQuery({
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
                    change: data.changeValue || 0, // Normalize change to be the numeric value
                    originalChange: data.change // Keep original text if needed
                };
            });
            return history;
        },
        enabled: !!symbol,
        staleTime: 1000 * 60 * 15, 
        select: (data) => {
            // Sort by date ascending
            return [...data].sort((a, b) => {
                 const dateA = parseSheetDate(a.date);
                 const dateB = parseSheetDate(b.date);
                 return dateA - dateB;
            });
        }
    });
};
