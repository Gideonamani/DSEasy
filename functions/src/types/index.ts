export interface DSEMarketData {
  company: string;
  price: string;
  change: string;
}

export interface MarketWatchEntry {
  id: number;
  company: { symbol: string; name: string };
  companyDescription: string;
  marketPrice: number;
  openingPrice: number;
  change: number;
  percentageChange: number;
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
  time: string;
  security: {
    totalSharesIssued: number;
    securityType: string;
    marketSegmentID: string;
    symbol: string;
    securityDesc: string;
  };
}

export interface StockData {
  symbol: string;
  source: "api" | "scraper";
  open: number;
  prevClose: number;
  close: number;
  high: number;
  low: number;
  change: string;
  changeValue: number;
  turnover: number;
  deals: number;
  outstandingBid: number;
  outstandingOffer: number;
  volume: number;
  mcap: number;
  highLowSpread: number;
  volPerDeal: number;
  turnoverPerDeal: number;
  turnoverPerMcap: number;
  turnoverPercent: number;
  changePerVol: number;
  bidOfferRatio: number;
}
