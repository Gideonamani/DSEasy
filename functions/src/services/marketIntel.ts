import * as admin from "firebase-admin";
import { formatLargeNumber } from "../utils/helpers";
import { GAP_THRESHOLD_PCT } from "../constants";

export function generateSnapshotIntel(snapshot: any): string {
  if (!snapshot || !snapshot.stocks) return "";
  
  const stocks = Object.entries(snapshot.stocks).map(([symbol, data]) => ({
    symbol,
    ...(data as any)
  }));
  
  if (stocks.length === 0) return "";

  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;

  let strongestDemand = stocks[0];
  let maxDemandRatio = -1;

  let biggestSupply = stocks[0];
  let maxOfferQty = -1;

  stocks.forEach((s) => {
    if (s.change > 0) upCount++;
    else if (s.change < 0) downCount++;
    else flatCount++;

    const demandRatio = s.bestOfferQuantity === 0 && s.bestBidQuantity > 0 
      ? Infinity 
      : s.bestOfferQuantity > 0 ? s.bestBidQuantity / s.bestOfferQuantity : 0;
    
    if (demandRatio > maxDemandRatio || (demandRatio === Infinity && s.bestBidQuantity > (strongestDemand?.bestBidQuantity || 0))) {
      maxDemandRatio = demandRatio;
      strongestDemand = s;
    }

    if (s.bestOfferQuantity > maxOfferQty) {
      maxOfferQty = s.bestOfferQuantity;
      biggestSupply = s;
    }
  });

  const sentiment = upCount > downCount ? 'BULLISH' : downCount > upCount ? 'BEARISH' : 'NEUTRAL';
  
  // Use EAT strictly
  const capturedAtEat = new Date(snapshot.capturedAt).toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' });
  const d = new Date(capturedAtEat);
  const formattedTime = (d.getHours().toString().padStart(2, '0')) + ':' + (d.getMinutes().toString().padStart(2, '0'));
  
  let txt = `At **${formattedTime}**, the overall market sentiment is **${sentiment}** with ${downCount} stocks down and ${upCount} up. `;
  
  if (strongestDemand && strongestDemand.bestBidQuantity > 0) {
    txt += `The strongest demand is seen in **${strongestDemand.symbol}** (${formatLargeNumber(strongestDemand.bestBidQuantity)} shares bid vs ${formatLargeNumber(strongestDemand.bestOfferQuantity)} offered). `;
  }
  
  if (biggestSupply && biggestSupply.bestOfferQuantity > 0) {
    txt += `Conversely, **${biggestSupply.symbol}** is facing heavy supply pressure with ${formatLargeNumber(biggestSupply.bestOfferQuantity)} shares offered. `;
  }

  const maxedOut = stocks.filter(s => s.marketPrice === s.maxLimit && s.maxLimit > 0);
  if (maxedOut.length > 0) {
    txt += `Notably, ${maxedOut.map(s => `**${s.symbol}**`).join(", ")} reached their daily maximum circuit breaker limits.`;
  }

  return txt;
}

export async function generateTrendIntel(dbInstance: admin.firestore.Firestore, dateStr: string, currentSnapshot: any): Promise<string> {
  if (!currentSnapshot || !currentSnapshot.stocks) return "";
  
  // Fetch the first snapshot of the day
  const openSnapQuery = await dbInstance.collection("marketWatch").doc(dateStr).collection("snapshots")
    .orderBy("capturedAt", "asc")
    .limit(1)
    .get();
    
  if (openSnapQuery.empty) return "";
  
  let startSnapshot = openSnapQuery.docs[0].data();
  
  // If the first snapshot IS the current snapshot, there is no trend yet
  if (startSnapshot.capturedAt === currentSnapshot.capturedAt) {
    return "";
  }

  let startUp = 0;
  let startDown = 0;
  Object.values(startSnapshot.stocks).forEach((s: any) => {
    if (s.change > 0) startUp++;
    else if (s.change < 0) startDown++;
  });
  const startSentiment = startUp > startDown ? 'BULLISH' : startDown > startUp ? 'BEARISH' : 'NEUTRAL';
  
  let currUp = 0;
  let currDown = 0;
  Object.values(currentSnapshot.stocks).forEach((s: any) => {
    if (s.change > 0) currUp++;
    else if (s.change < 0) currDown++;
  });
  const currSentiment = currUp > currDown ? 'BULLISH' : currDown > currUp ? 'BEARISH' : 'NEUTRAL';

  const startEat = new Date(startSnapshot.capturedAt).toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' });
  const startD = new Date(startEat);
  const startTime = (startD.getHours().toString().padStart(2, '0')) + ':' + (startD.getMinutes().toString().padStart(2, '0'));

  const currEat = new Date(currentSnapshot.capturedAt).toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' });
  const currD = new Date(currEat);
  const currTime = (currD.getHours().toString().padStart(2, '0')) + ':' + (currD.getMinutes().toString().padStart(2, '0'));
  
  let txt = "";
  if (startSentiment !== currSentiment) {
    txt += `The market opened **${startSentiment}** at 09:30 but has since turned **${currSentiment}** by ${currTime}. `;
  } else {
    txt += `Since the open at 09:30, the market has held a steady **${currSentiment}** posture. `;
  }

  let biggestMoverSymbol = "";
  let maxAbsMovePct = -1;
  let moveDir = "";
  let movePctVal = 0;

  const currentStocks = Object.entries(currentSnapshot.stocks);
  for (const [symbol, currDataAny] of currentStocks) {
    const currData = currDataAny as any;
    if (currData.marketPrice > 0 && currData.change !== 0) {
      const prevClose = currData.marketPrice - currData.change;
      if (prevClose > 0) {
         const pctMove = (currData.change / prevClose) * 100;
         const absMove = Math.abs(pctMove);
         if (absMove > maxAbsMovePct) {
            maxAbsMovePct = absMove;
            biggestMoverSymbol = symbol;
            moveDir = pctMove > 0 ? "gained" : "dropped";
            movePctVal = absMove;
         }
      }
    }
  }

  if (biggestMoverSymbol) {
    txt += `**${biggestMoverSymbol}** is today's notable mover so far, having ${moveDir} **${movePctVal.toFixed(2)}%**.`;
  } else if (startSentiment === currSentiment) {
    txt = `Since the open at ${startTime}, the market has held a steady **${currSentiment}** posture with no distinct price shifts.`;
  }

  return txt.trim();
}

/**
 * Detect opening gaps: compare today's opening prices with the most recent
 * daily closing prices. Flags stocks that opened ≥ GAP_THRESHOLD_PCT away
 * from yesterday's close. Only meaningful on the first snapshot of the day.
 */
export async function generateGapDetection(dbInstance: admin.firestore.Firestore, currentSnapshot: any): Promise<string> {
  if (!currentSnapshot || !currentSnapshot.stocks) return "";

  // Find the most recent dailyClosing doc (handles weekends/holidays)
  const closingQuery = await dbInstance.collection("dailyClosing")
    .orderBy("date", "desc")
    .limit(1)
    .get();

  if (closingQuery.empty) return "";

  const lastClosingDate = closingQuery.docs[0].data().date;
  const stocksSnap = await dbInstance.collection("dailyClosing").doc(lastClosingDate)
    .collection("stocks")
    .get();

  if (stocksSnap.empty) return "";

  // Build a map of yesterday's closing prices
  const prevCloseMap: { [symbol: string]: number } = {};
  stocksSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (data.close && data.close > 0) {
      prevCloseMap[data.symbol] = data.close;
    }
  });

  // Detect gaps
  const gaps: { symbol: string; gapPct: number; prevClose: number; openPrice: number }[] = [];

  for (const [symbol, dataAny] of Object.entries(currentSnapshot.stocks)) {
    const data = dataAny as any;
    const openPrice = data.openingPrice || data.marketPrice;
    const prevClose = prevCloseMap[symbol];

    if (prevClose && prevClose > 0 && openPrice > 0 && openPrice !== prevClose) {
      const gapPct = ((openPrice - prevClose) / prevClose) * 100;
      if (Math.abs(gapPct) >= GAP_THRESHOLD_PCT) {
        gaps.push({ symbol, gapPct, prevClose, openPrice });
      }
    }
  }

  if (gaps.length === 0) return "";

  // Sort by absolute gap size descending
  gaps.sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));

  const gapTexts = gaps.slice(0, 3).map(g => {
    const dir = g.gapPct > 0 ? "above" : "below";
    return `**${g.symbol}** opened ${Math.abs(g.gapPct).toFixed(1)}% ${dir} yesterday's close of ${formatLargeNumber(g.prevClose)}`;
  });

  return `Opening gaps detected: ${gapTexts.join("; ")}.`;
}
