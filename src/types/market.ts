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
