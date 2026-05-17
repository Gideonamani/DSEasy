/**
 * Shared Firestore document shapes used across the app.
 *
 * `RawStockDoc` mirrors the snake/PascalCase fields stored in Firestore,
 * while `StockData` is the normalised frontend-friendly shape produced by
 * `useMarketQuery`. Keep them separate so consumers of `StockData` don't
 * see Firestore-only fields.
 */

export interface MarketDate {
  sheetName: string;
  date: Date | null;
}

export interface RawStockDoc {
  symbol?: string;
  date?: string;
  open?: number;
  close?: number;
  high?: number;
  low?: number;
  volume?: number;
  deals?: number;
  turnover?: number;
  mcap?: number | string;
  change?: string;
  ChangeAbs?: number;
  ChangePer?: number;
  changeValue?: number;
  prevClose?: number;
  outstandingBid?: number;
  outstandingOffer?: number;
  turnoverPercent?: number;
  bidOfferRatio?: number;
  yearHigh?: number;
  yearLow?: number;
  highLowSpread?: number;
  turnoverPerMcap?: number;
  volPerDeal?: number;
  turnoverPerDeal?: number;
  changePerVol?: number;
}

export interface StockData {
  symbol: string;
  date?: string;
  open?: number;
  close: number;
  high?: number;
  low?: number;
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
  spread?: number;
  turnoverMcap?: number;
  volDeal?: number;
  turnoverDeal?: number;
  changeVol?: number;
  volume?: number;
  deals?: number;
  turnover?: number;
  mcap?: number;
}

export interface MarketIndex {
  Code: string;
  IndexDescription: string;
  ClosingPrice: number;
  Change?: number;
  PreviousClose?: number;
  PercentChange?: number;
}

// Flattened shape stored in marketWatch/{date}/snapshots/{timestamp}.stocks
export interface MarketWatchStock {
  marketPrice: number;
  openingPrice: number;
  change: number;
  bestBidPrice: number;
  bestBidQuantity: number;
  bestOfferPrice: number;
  bestOfferQuantity: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  minLimit: number;
  maxLimit: number;
  totalSharesIssued: number;
  companyDescription: string;
  marketSegment: string;
}

export interface MarketWatchSnapshot {
  capturedAt: string;
  stockCount: number;
  stocks: { [symbol: string]: MarketWatchStock };
  // Firestore Timestamp; typed loosely here so the shared type does not
  // require consumers to import firebase.
  timestamp: { toDate(): Date; seconds: number; nanoseconds: number };
}

export interface MarketIntel {
  capturedAt: string;
  type: "intraday" | "closing" | "pre-open";
  snapshotSummary: string;
  trendSummary: string;
}

export interface AlertDoc {
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  status: string;
  userId: string;
  // Firestore Timestamp shape, typed loosely to avoid leaking firebase types.
  createdAt?: { toDate(): Date };
}

export interface Alert extends AlertDoc {
  id: string;
  created: string;
}
