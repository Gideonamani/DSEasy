export const METRIC_EXPLANATIONS = {
  close: "The final consensus value. In illiquid markets, flat price often means no trades, not stability. Watch for sudden regime changes.",
  volume: "Raw fuel of price movement. High volume + flat price = 'churning' or ownership transfer. High volume + price move = validated trend.",
  turnover: "Economic significance (Volume × Price). Better measure than volume for comparing impact across different stocks.",
  deals: "Trade count. High Volume/Deal ratio indicates institutional block buying; Low ratio suggests retail fragmentation.",
  high: "Intraday ceiling. If High >> Close, it indicates failed breakout or selling pressure overcoming early optimism.",
  low: "Intraday floor. If Close ≈ Low, implies bearish conviction sustained until the bell.",
  mcap: "Market Capitalization. Weights the stock's significance in the index. Small caps are generally less efficient/more volatile.",
  outstandingBid: "Unfilled demand in order book (leading indicator). Leading indicator of bullish pressure if Bids > Offers.",
  outstandingOffer: "Unfilled supply order book (leading indicator). A 'wall' of offers prevents price rise; if pulled, breakout often follows.",
  bidOffer: "Order Book Balance. Ratio > 1 implies bullish pressure (buyers waiting). Ratio < 1 implies bearish overhang.",
  spread: "High - Low. Proxy for intraday risk/uncertainty. Widening spread = disagreement on value; Tightening = consensus.",
  turnoverPct: "Dominance metric. If high (e.g., >80%), this stock is driving the entire exchange's sentiment today.",
  turnoverMcap: "Velocity. % of company changing hands. High = 'hot' stock/repricing. <0.1% = dormant/insider-held.",
  volDeal: "Avg trade size. High = Institutional/Smart Money. Low = Retail/Noise Traders.",
  turnoverDeal: "Avg trade value. Helps identify if big money is moving the stock or just small retail orders.",
  changeVol: "Amihud Illiquidity Proxy. Price impact measure. High = Thin market (small vol moves price). Low = Deep market (resilient)."
};
