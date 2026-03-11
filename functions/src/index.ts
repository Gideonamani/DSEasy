import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios, { AxiosError } from "axios";
import * as nodemailer from "nodemailer";
import * as moment from "moment-timezone";

admin.initializeApp();
const db = admin.firestore();

// Types
interface DSEMarketData {
  company: string;
  price: string;
  change: string;
}

// Rich market data from api.dse.co.tz/api/market-data
interface MarketWatchEntry {
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

interface StockData {
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

// Symbol Normalization Mappings (from Constants.js)
const SYMBOL_MAPPINGS: { [key: string]: string } = {
  "VERTEX-ETF": "VERTEX ETF",
  "IEACLC-ETF": "IEACLC ETF",
  "ITRUST ETF": "IEACLC ETF",
};

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------

// Browser-like headers to avoid bot detection by DSE's Nginx rate limiter.
// Cloud Functions default User-Agent ('axios/x.x.x') is easily flagged.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  Connection: "keep-alive",
};

/**
 * Fetch a URL with automatic retry on 429 (Too Many Requests) errors.
 * - Uses browser-like headers to reduce bot detection.
 * - Parses the `retry-after` response header (seconds) from the server.
 * - Falls back to exponential backoff if no retry-after header is present.
 * @param url - The URL to fetch
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeout - Request timeout in ms (default: 30000)
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  timeout = 30000,
): Promise<{ data: any }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout,
      });
      return response;
    } catch (error) {
      const axiosErr = error as AxiosError;

      // Only retry on 429 (rate limit) errors
      if (axiosErr.response?.status === 429 && attempt < maxRetries) {
        // Parse retry-after header (in seconds), default to exponential backoff
        const retryAfterHeader = axiosErr.response.headers["retry-after"];
        const retryAfterSecs = retryAfterHeader
          ? parseInt(String(retryAfterHeader), 10)
          : Math.pow(2, attempt + 1); // 2s, 4s, 8s fallback

        const waitMs = (isNaN(retryAfterSecs) ? 5 : retryAfterSecs) * 1000;

        console.warn(
          `[fetchWithRetry] 429 on ${url} (attempt ${attempt + 1}/${maxRetries}). ` +
            `Waiting ${waitMs / 1000}s before retry...`,
        );

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Non-429 error or exhausted retries — rethrow
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs a return
  throw new Error(
    `[fetchWithRetry] All ${maxRetries} retries exhausted for ${url}`,
  );
}

/**
 * Random jitter delay (1-30 seconds) to avoid hitting rate limits
 * at the same time as other GCP users on shared IP pools.
 */
async function randomJitter(): Promise<void> {
  const jitterMs = Math.floor(Math.random() * 29000) + 1000; // 1s to 30s
  console.log(
    `[Jitter] Waiting ${(jitterMs / 1000).toFixed(1)}s before making requests...`,
  );
  await new Promise((resolve) => setTimeout(resolve, jitterMs));
}

function normalizeSymbol(rawSymbol: string): string {
  if (!rawSymbol) return "";
  const trimmed = rawSymbol.trim();
  return SYMBOL_MAPPINGS[trimmed] || trimmed;
}

function parseNum(val: string | number | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = val.toString().replace(/,/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseChangeValue(str: string): number {
  if (!str) return 0;
  // Match number at the end: "-▼ -2.48" -> -2.48
  const matches = str.match(/[-+]?\d*\.?\d+/g);
  if (matches && matches.length > 0) {
    return parseFloat(matches[matches.length - 1]);
  }
  return 0;
}

// Convert "February 7, 2026" -> "7Feb2026"
function formatDateForSheet(longDateStr: string): string | null {
  const parts = longDateStr.replace(/,/g, "").split(" "); // ["February", "7", "2026"]
  if (parts.length < 3) return null;

  const monthNumbers: { [key: string]: string } = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };

  const month = monthNumbers[parts[0]];
  const day = parts[1].padStart(2, "0");
  const year = parts[2];

  if (!month) return null;
  return `${year}-${month}-${day}`;
}

// ------------------------------------------------------------------
// CORE SCRAPER LOGIC
// ------------------------------------------------------------------

async function scrapeDSEAndWriteToFirestore(): Promise<{
  success: boolean;
  message: string;
  date?: string;
  stockCount?: number;
}> {
  const url = "https://dse.co.tz";

  try {
    console.log("Fetching DSE homepage...");
    const { data: html } = await fetchWithRetry(url);

    // 1. EXTRACT DATE
    const dateRegex =
      /Market Summary\s*:\s*<\/h5>\s*<h5[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/h5>/i;
    const dateMatch = html.match(dateRegex);

    if (!dateMatch) {
      console.error("Could not find Market Summary date on DSE homepage.");
      return { success: false, message: "Date not found in HTML" };
    }

    const rawDateStr = dateMatch[1].trim();
    const formattedDate = formatDateForSheet(rawDateStr);

    if (!formattedDate) {
      console.error(`Could not parse date: ${rawDateStr}`);
      return { success: false, message: `Date parse failed: ${rawDateStr}` };
    }

    console.log(`Found date: ${rawDateStr} -> ${formattedDate}`);

    // 2. CHECK IF ALREADY EXISTS
    const dailyDocRef = db.collection("dailyClosing").doc(formattedDate);
    const existingDoc = await dailyDocRef.get();

    if (existingDoc.exists) {
      console.log(
        JSON.stringify({
          event: "DAILY_CLOSING_SKIP",
          reason: "ALREADY_EXISTS",
          date: formattedDate,
          message: `Data for ${formattedDate} already exists. Skipping.`,
        }),
      );
      return { success: true, message: "Already exists", date: formattedDate };
    }

    // 3. EXTRACT TABLE DATA
    const tableStartRegex = /id="equity-watch"[^>]*>[\s\S]*?<tbody[^>]*>/i;
    const tableStartMatch = html.match(tableStartRegex);

    if (!tableStartMatch) {
      console.error("Could not find Equity table in HTML.");
      return { success: false, message: "Equity table not found" };
    }

    const tableContentStart = tableStartMatch.index + tableStartMatch[0].length;
    const htmlAfterTableStart = html.substring(tableContentStart);
    const tbodyEndIndex = htmlAfterTableStart.indexOf("</tbody>");

    if (tbodyEndIndex === -1) {
      console.error("Could not find end of Equity table.");
      return { success: false, message: "Table end not found" };
    }

    const tbodyContent = htmlAfterTableStart.substring(0, tbodyEndIndex);

    // 4. PARSE ROWS
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    const parsedRows: string[][] = [];

    while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
      const rowInnerHtml = rowMatch[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowInnerHtml)) !== null) {
        let content = cellMatch[1];
        content = content.replace(/<[^>]+>/g, ""); // Remove HTML tags
        content = content.replace(/\s+/g, " ").trim(); // Clean whitespace
        cells.push(content);
      }

      if (cells.length > 0) {
        parsedRows.push(cells);
      }
    }

    if (parsedRows.length === 0) {
      console.error("No data rows found in the table.");
      return { success: false, message: "No data rows found" };
    }

    console.log(`Parsed ${parsedRows.length} stock rows.`);

    // 5. CALCULATE DAY TOTAL TURNOVER (for turnoverPercent)
    let dayTotalTurnover = 0;
    for (const row of parsedRows) {
      if (row.length >= 13 && row[0] !== "Total") {
        dayTotalTurnover += parseNum(row[7]);
      }
    }

    // 6. BUILD STOCK DATA WITH DERIVED METRICS
    const stocksData: StockData[] = [];

    for (const row of parsedRows) {
      if (row.length < 13) continue;
      const symbol = normalizeSymbol(row[0]);
      if (!symbol || symbol === "Total" || symbol === "Co.") continue;

      const open = parseNum(row[1]);
      const prevClose = parseNum(row[2]);
      const close = parseNum(row[3]);
      const high = parseNum(row[4]);
      const low = parseNum(row[5]);
      const changeStr = row[6];
      const turnover = parseNum(row[7]);
      const deals = parseNum(row[8]);
      const outstandingBid = parseNum(row[9]);
      const outstandingOffer = parseNum(row[10]);
      const volume = parseNum(row[11]);
      let mcap = parseNum(row[12]);

      // DSE website reports MCAP in Billions (e.g. 1.23 = 1.23B TZS).
      // Expand to full number for uniform storage across all sources.
      if (mcap > 0 && Math.abs(mcap) < 1000000) {
        mcap = mcap * 1000000000;
      }

      // 8 Derived Metrics
      const changeValue = parseChangeValue(changeStr);
      const highLowSpread = high - low;
      const volPerDeal = deals > 0 ? volume / deals : 0;
      const turnoverPerDeal = deals > 0 ? turnover / deals : 0;
      const turnoverPerMcap = mcap > 0 ? turnover / mcap : 0;
      const turnoverPercent =
        dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0;
      const changePerVol = volume > 0 ? changeValue / volume : 0;
      const bidOfferRatio =
        outstandingOffer > 0 ? outstandingBid / outstandingOffer : 0;

      stocksData.push({
        symbol,
        source: "scraper" as const,
        open,
        prevClose,
        close,
        high,
        low,
        change: changeStr,
        changeValue,
        turnover,
        deals,
        outstandingBid,
        outstandingOffer,
        volume,
        mcap,
        highLowSpread,
        volPerDeal,
        turnoverPerDeal,
        turnoverPerMcap,
        turnoverPercent,
        changePerVol,
        bidOfferRatio,
      });
    }

    console.log(`Writing ${stocksData.length} stocks to Firestore...`);

    // 7. BATCH WRITE TO FIRESTORE
    const batch = db.batch();

    // A. dailyClosing/{date} document
    batch.set(dailyDocRef, {
      date: formattedDate,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      stockCount: stocksData.length,
    });

    for (const stock of stocksData) {
      // B. dailyClosing/{date}/stocks/{symbol}
      const stockRef = dailyDocRef.collection("stocks").doc(stock.symbol);
      batch.set(stockRef, stock);

      // C. trends/{symbol} - update lastUpdated
      const trendsRef = db.collection("trends").doc(stock.symbol);
      batch.set(
        trendsRef,
        {
          symbol: stock.symbol,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // D. trends/{symbol}/dailyClosingHistory/{date}
      const historyRef = trendsRef
        .collection("dailyClosingHistory")
        .doc(formattedDate);
      batch.set(historyRef, {
        date: formattedDate,
        ...stock,
      });
    }

    await batch.commit();
    console.log("Batch write complete.");

    // 8. UPDATE CONFIG/APP.AVAILABLEDATES
    const configRef = db.collection("config").doc("app");
    await configRef.set(
      {
        availableDates: admin.firestore.FieldValue.arrayUnion(formattedDate),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(
      JSON.stringify({
        event: "DAILY_CLOSING_SUCCESS",
        date: formattedDate,
        stockCount: stocksData.length,
        message: `Successfully imported ${stocksData.length} stocks for ${formattedDate}`,
      }),
    );

    return {
      success: true,
      message: `Imported ${stocksData.length} stocks`,
      date: formattedDate,
      stockCount: stocksData.length,
    };
  } catch (error) {
    console.error("Error in scrapeDSEAndWriteToFirestore:", error);
    return { success: false, message: `Error: ${error}` };
  }
}

// ------------------------------------------------------------------
// MARKET INTEL HELPERS
// ------------------------------------------------------------------
function formatLargeNumber(num: number): string {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return new Intl.NumberFormat("en-US").format(num);
}

function generateSnapshotIntel(snapshot: any): string {
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

async function generateTrendIntel(dbInstance: admin.firestore.Firestore, dateStr: string, currentSnapshot: any): Promise<string> {
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
    txt += `The market opened **${startSentiment}** at ${startTime} but has since turned **${currSentiment}** by ${currTime}. `;
  } else {
    txt += `Since the open at ${startTime}, the market has held a steady **${currSentiment}** posture. `;
  }

  let biggestMoverSymbol = "";
  let maxAbsMovePct = -1;
  let moveDir = "";
  let movePctVal = 0;

  const currentStocks = Object.entries(currentSnapshot.stocks);
  for (const [symbol, currDataAny] of currentStocks) {
    const currData = currDataAny as any;
    const startData = startSnapshot.stocks[symbol];
    if (startData && currData.marketPrice > 0 && startData.marketPrice > 0) {
      if (currData.marketPrice !== startData.marketPrice) {
        const pctMove = ((currData.marketPrice - startData.marketPrice) / startData.marketPrice) * 100;
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
    txt += `**${biggestMoverSymbol}** is the most significant mover, having ${moveDir} **${movePctVal.toFixed(2)}%** since the open.`;
  } else if (startSentiment === currSentiment) {
    txt = `Since the open at ${startTime}, the market has held a steady **${currSentiment}** posture with no distinct price shifts.`;
  }

  return txt.trim();
}

// ------------------------------------------------------------------
// 1. Scheduled Function: Monitor Intraday Market
// Runs every 15 minutes Mon-Fri during market hours (09:30 - 16:15)
// Scrapes live prices, saves to Firestore, and checks alerts.
// ------------------------------------------------------------------
export const monitorIntradayMarket = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1", // Cloud Scheduler not available in africa-south1
  },
  async (event) => {
    const now = new Date();

    // Convert to EAT (UTC+3) explicitly to ensure correct market hour checks
    // Cloud Functions run in UTC by default
    const eatTimeStr = now.toLocaleString("en-US", {
      timeZone: "Africa/Dar_es_Salaam",
    });
    const eatDate = new Date(eatTimeStr);

    const day = eatDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = eatDate.getHours();
    const mins = eatDate.getMinutes();
    const totalMins = hour * 60 + mins;

    // Validation: Run only Mon-Fri (1-5)
    if (day === 0 || day === 6) {
      console.log("Weekend - skipping alert check.");
      return;
    }

    // Validation: Run only between 09:30 (570) and 16:15 (975)
    if (totalMins < 540 || totalMins > 975) {
      console.log("Outside market hours - skipping alert check.");
      return;
    }

    try {
      console.log("Starting alert check...");

      // Jitter: random 1-30s delay to avoid shared GCP IP collisions
      await randomJitter();

      // A. Fetch Live Prices from DSE API
      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await fetchWithRetry(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        return;
      }

      // B. Create Price Map: Symbol -> Current Price
      const priceMap: { [symbol: string]: number } = {};

      marketData.forEach((item) => {
        const basePrice = item.price
          ? parseFloat(String(item.price).replace(/,/g, ""))
          : 0;
        const changeValue = item.change
          ? parseFloat(String(item.change).replace(/,/g, ""))
          : 0;

        const currentPrice = basePrice + changeValue;
        const symbol = item.company.trim();

        if (symbol && currentPrice > 0) {
          priceMap[symbol] = currentPrice;
        }
      });

      console.log(
        `Fetched prices for ${Object.keys(priceMap).length} symbols.`,
      );

      // Initialize batch early
      const batch = db.batch();

      // C. Save Live Prices to Firestore (Fix for missing updates)
      const timestamp = new Date().toISOString();

      // C.1.5 Fetch Rich Market Data from new API and store in marketWatch
      try {
        const marketWatchUrl =
          "https://api.dse.co.tz/api/market-data?isBond=false";
        const { data: marketWatchRaw } = await axios.get(marketWatchUrl, {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
        });

        const marketWatchData: MarketWatchEntry[] = Array.isArray(marketWatchRaw)
          ? marketWatchRaw
          : [];

        if (marketWatchData.length > 0) {
          // Build flattened snapshot for Firestore
          const snapshot: { [symbol: string]: Record<string, unknown> } = {};

          marketWatchData.forEach((item) => {
            const symbol =
              item.company?.symbol ||
              item.security?.symbol ||
              "";
            if (!symbol) return;

            snapshot[symbol] = {
              marketPrice: item.marketPrice || 0,
              openingPrice: item.openingPrice || 0,
              change: item.change || 0,
              bestBidPrice: item.bestBidPrice || 0,
              bestBidQuantity: item.bestBidQuantity || 0,
              bestOfferPrice: item.bestOfferPrice || 0,
              bestOfferQuantity: item.bestOfferQuantity || 0,
              high: item.high || 0,
              low: item.low || 0,
              volume: item.volume || 0,
              marketCap: item.marketCap || 0,
              minLimit: item.minLimit || 0,
              maxLimit: item.maxLimit || 0,
              totalSharesIssued: item.security?.totalSharesIssued || 0,
              companyDescription:
                item.companyDescription ||
                item.security?.securityDesc ||
                symbol,
              marketSegment: item.security?.marketSegmentID || "",
            };

            // Update priceMap with more accurate data from new API
            if (item.marketPrice && item.marketPrice > 0) {
              priceMap[symbol] = item.marketPrice;
            }
          });

          // Date string for document path: marketWatch/{date}/snapshots/{timestamp}
          const dateStr = eatDate
            .toISOString()
            .split("T")[0]; // YYYY-MM-DD
          const snapshotRef = db
            .collection("marketWatch")
            .doc(dateStr)
            .collection("snapshots")
            .doc(timestamp);

          batch.set(snapshotRef, {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            capturedAt: timestamp,
            stockCount: Object.keys(snapshot).length,
            stocks: snapshot,
          });

          // Update available dates for Market Watch
          const configAppRef = db.collection("config").doc("app");
          batch.set(configAppRef, {
            marketWatchDates: admin.firestore.FieldValue.arrayUnion(dateStr),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          console.log(
            `Queued write to marketWatch/${dateStr}/snapshots/${timestamp} with ${Object.keys(snapshot).length} stocks.`,
          );

          // C.1.6 Generate and store Market Intel
          try {
            const currentSnapPayload = {
               capturedAt: timestamp,
               stockCount: Object.keys(snapshot).length,
               stocks: snapshot,
            };
            const snapshotSummary = generateSnapshotIntel(currentSnapPayload);
            const trendSummary = await generateTrendIntel(db, dateStr, currentSnapPayload);
            
            const intelRef = db
              .collection("marketWatch")
              .doc(dateStr)
              .collection("intel")
              .doc(timestamp);

            batch.set(intelRef, {
              capturedAt: timestamp,
              type: "intraday",
              snapshotSummary,
              trendSummary,
            });
            console.log(`Queued market intel for ${dateStr}/${timestamp}`);
          } catch (intelError) {
            console.error("Failed to generate market intel:", intelError);
          }
        } else {
          console.warn("New market-data API returned no data.");
        }
      } catch (marketWatchError) {
        console.error(
          "Failed to fetch from api.dse.co.tz market-data:",
          marketWatchError,
        );
        // Continue execution
      }

      // C.2 Fetch Market Indices (TSI, DSEI)
      try {
        const indicesUrl = "https://dse.co.tz/get/last/traded/indices";
        const { data: indicesResponse } = await fetchWithRetry(indicesUrl);
        if (
          indicesResponse &&
          indicesResponse.success &&
          indicesResponse.data
        ) {
          const currentIndicesRef = db
            .collection("marketIndices")
            .doc("current");
          const historyIndicesRef = db
            .collection("marketIndices")
            .doc("history")
            .collection("records")
            .doc(timestamp);

          const indicesPayload = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            data: indicesResponse.data,
          };

          batch.set(currentIndicesRef, indicesPayload);
          batch.set(historyIndicesRef, indicesPayload);
          console.log(
            `Queued write to marketIndices/current and history for ${indicesResponse.data.length} indices.`,
          );
        }
      } catch (indicesError) {
        console.error("Failed to fetch market indices:", indicesError);
        // Continue execution, we still want to process alerts
      }

      // D. Fetch Active Alerts
      const alertsSnap = await db
        .collection("alerts")
        .where("status", "==", "ACTIVE")
        .get();

      if (alertsSnap.empty) {
        console.log("No active alerts found.");
        // Commit market data even if no alerts
        if (Object.keys(priceMap).length > 0) {
          await batch.commit();
          console.log("Committed market data (no alerts checked).");
        }
        return;
      }

      // E. Check Conditions
      // Batch already initialized
      // Track triggered alerts and the userIds that need notifications
      let triggeredCount = 0;
      const triggeredAlerts: {
        userId: string;
        symbol: string;
        currentPrice: number;
        targetPrice: number;
        alertId: string;
      }[] = [];

      alertsSnap.forEach((doc) => {
        const alert = doc.data();
        const currentPrice = priceMap[alert.symbol];

        if (currentPrice === undefined) return;

        let triggered = false;

        if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice) {
          triggered = true;
        } else if (
          alert.condition === "BELOW" &&
          currentPrice <= alert.targetPrice
        ) {
          triggered = true;
        }

        if (triggered) {
          triggeredCount++;
          console.log(
            `Alert triggered: ${alert.symbol} is ${currentPrice} (${alert.condition} ${alert.targetPrice})`,
          );

          // 1. Mark as TRIGGERED in Firestore
          batch.update(doc.ref, {
            status: "TRIGGERED",
            triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
            triggeredPrice: currentPrice,
          });

          // 2. Track for multi-device notification lookup
          triggeredAlerts.push({
            userId: alert.userId,
            symbol: alert.symbol,
            currentPrice,
            targetPrice: alert.targetPrice,
            alertId: doc.id,
          });

          // 3. Log to History
          const notifRef = db.collection("notifications").doc();
          batch.set(notifRef, {
            userId: alert.userId,
            type: "PRICE_ALERT",
            title: `Price Alert: ${alert.symbol}`,
            body: `${alert.symbol} reached ${currentPrice} TZS`,
            data: {
              symbol: alert.symbol,
              triggeredPrice: currentPrice,
              alertId: doc.id,
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      // F. Execute Batch Updates
      await batch.commit();
      console.log(`Batch committed. Triggered ${triggeredCount} alerts.`);

      // G. Send Multi-Device Push Notifications
      if (triggeredAlerts.length > 0) {
        // Collect unique userIds to look up tokens
        const uniqueUserIds = [
          ...new Set(triggeredAlerts.map((a) => a.userId)),
        ];

        // Fetch all FCM tokens for each user
        const userTokensMap: { [userId: string]: string[] } = {};
        for (const userId of uniqueUserIds) {
          const tokensSnap = await db
            .collection("users")
            .doc(userId)
            .collection("fcmTokens")
            .get();
          userTokensMap[userId] = tokensSnap.docs.map(
            (d) => d.data().token as string,
          );
        }

        // Build notification messages for ALL devices of each triggered alert
        const notifications: admin.messaging.Message[] = [];
        // Track which token corresponds to which index for stale cleanup
        const tokenRefs: { userId: string; token: string }[] = [];

        for (const alert of triggeredAlerts) {
          const tokens = userTokensMap[alert.userId] || [];
          for (const token of tokens) {
            notifications.push({
              token,
              notification: {
                title: `Price Alert: ${alert.symbol}`,
                body: `${alert.symbol} is now ${alert.currentPrice} TZS (Target: ${alert.targetPrice})`,
              },
              data: {
                type: "PRICE_ALERT",
                symbol: alert.symbol,
                alertId: alert.alertId,
                price: String(alert.currentPrice),
              },
            });
            tokenRefs.push({ userId: alert.userId, token });
          }
        }

        if (notifications.length > 0) {
          const response = await admin.messaging().sendEach(notifications);
          console.log(
            `Sent ${response.successCount} push notifications to ${notifications.length} devices. Failed: ${response.failureCount}`,
          );

          // Clean up stale/unregistered tokens
          const staleDeletes: Promise<FirebaseFirestore.WriteResult>[] = [];
          response.responses.forEach((resp, idx) => {
            if (
              resp.error &&
              (resp.error.code ===
                "messaging/registration-token-not-registered" ||
                resp.error.code === "messaging/invalid-registration-token")
            ) {
              const { userId, token } = tokenRefs[idx];
              console.log(`Removing stale FCM token for user ${userId}`);
              staleDeletes.push(
                db
                  .collection("users")
                  .doc(userId)
                  .collection("fcmTokens")
                  .doc(token)
                  .delete(),
              );
            }
          });
          if (staleDeletes.length > 0) {
            await Promise.all(staleDeletes);
            console.log(`Cleaned up ${staleDeletes.length} stale FCM tokens.`);
          }
        }
      }
    } catch (error) {
      console.error("Error in monitorIntradayMarket:", error);
    }
  },
);

// ------------------------------------------------------------------
// 1.1 HTTP Wrapper for monitorIntradayMarket (Testing Only)
// ------------------------------------------------------------------
export const monitorIntradayMarketHttp = onRequest(
  {
    region: "europe-west1",
  },
  async (req, res) => {
    // Only allow in emulator
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      res
        .status(403)
        .json({ error: "This endpoint is only available in the emulator." });
      return;
    }

    try {
      console.log("Manually triggering monitorIntradayMarket logic...");

      // A. Fetch Live Prices from DSE API
      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await fetchWithRetry(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        res.json({ success: false, message: "No market data" });
        return;
      }

      // B. Create Price Map
      const priceMap: { [symbol: string]: number } = {};
      marketData.forEach((item) => {
        const basePrice = item.price
          ? parseFloat(String(item.price).replace(/,/g, ""))
          : 0;
        const changeValue = item.change
          ? parseFloat(String(item.change).replace(/,/g, ""))
          : 0;

        const currentPrice = basePrice + changeValue;
        const symbol = item.company.trim();
        if (symbol && currentPrice > 0) {
          priceMap[symbol] = currentPrice;
        }
      });

      const db = admin.firestore();
      const batch = db.batch();

      const timestamp = new Date().toISOString();

      // C.1.5 Fetch Rich Market Data from new API and store in marketWatch
      let marketWatchCount = 0;
      try {
        const marketWatchUrl =
          "https://api.dse.co.tz/api/market-data?isBond=false";
        const { data: marketWatchRaw } = await axios.get(marketWatchUrl, {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
        });

        const marketWatchData: MarketWatchEntry[] = Array.isArray(marketWatchRaw)
          ? marketWatchRaw
          : [];

        if (marketWatchData.length > 0) {
          const snapshot: { [symbol: string]: Record<string, unknown> } = {};

          marketWatchData.forEach((item) => {
            const symbol =
              item.company?.symbol ||
              item.security?.symbol ||
              "";
            if (!symbol) return;

            snapshot[symbol] = {
              marketPrice: item.marketPrice || 0,
              openingPrice: item.openingPrice || 0,
              change: item.change || 0,
              bestBidPrice: item.bestBidPrice || 0,
              bestBidQuantity: item.bestBidQuantity || 0,
              bestOfferPrice: item.bestOfferPrice || 0,
              bestOfferQuantity: item.bestOfferQuantity || 0,
              high: item.high || 0,
              low: item.low || 0,
              volume: item.volume || 0,
              marketCap: item.marketCap || 0,
              minLimit: item.minLimit || 0,
              maxLimit: item.maxLimit || 0,
              totalSharesIssued: item.security?.totalSharesIssued || 0,
              companyDescription:
                item.companyDescription ||
                item.security?.securityDesc ||
                symbol,
              marketSegment: item.security?.marketSegmentID || "",
            };

            // Update priceMap with more accurate data from new API
            if (item.marketPrice && item.marketPrice > 0) {
              priceMap[symbol] = item.marketPrice;
            }
          });

          const now = new Date();
          const eatTimeStr = now.toLocaleString("en-US", {
            timeZone: "Africa/Dar_es_Salaam",
          });
          const eatDate = new Date(eatTimeStr);
          const dateStr = eatDate
            .toISOString()
            .split("T")[0];
          const snapshotRef = db
            .collection("marketWatch")
            .doc(dateStr)
            .collection("snapshots")
            .doc(timestamp);

          batch.set(snapshotRef, {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            capturedAt: timestamp,
            stockCount: Object.keys(snapshot).length,
            stocks: snapshot,
          });

          marketWatchCount = Object.keys(snapshot).length;
          console.log(
            `Queued write to marketWatch/${dateStr}/snapshots/${timestamp} with ${marketWatchCount} stocks.`,
          );
        }
      } catch (marketWatchError) {
        console.error(
          "Failed to fetch from api.dse.co.tz market-data:",
          marketWatchError,
        );
      }

      // C.2 Fetch Market Indices (TSI, DSEI)
      try {
        const indicesUrl = "https://dse.co.tz/get/last/traded/indices";
        const { data: indicesResponse } = await fetchWithRetry(indicesUrl);
        if (
          indicesResponse &&
          indicesResponse.success &&
          indicesResponse.data
        ) {
          const currentIndicesRef = db
            .collection("marketIndices")
            .doc("current");
          const historyIndicesRef = db
            .collection("marketIndices")
            .doc("history")
            .collection("records")
            .doc(timestamp);

          const indicesPayload = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            data: indicesResponse.data,
          };

          batch.set(currentIndicesRef, indicesPayload);
          batch.set(historyIndicesRef, indicesPayload);
          console.log(
            `(HTTP Test) Queued write to marketIndices/current and history for ${indicesResponse.data.length} indices.`,
          );
        }
      } catch (indicesError) {
        console.error("Failed to fetch market indices:", indicesError);
        // Continue execution, we still want to process alerts
      }

      // D. Check Alerts (Simplified for HTTP test - just check, don't necessarily send push if we want to avoid spam, but let's keep consistency)
      const alertsSnap = await db
        .collection("alerts")
        .where("status", "==", "ACTIVE")
        .get();

      let triggeredCount = 0;
      if (!alertsSnap.empty) {
        alertsSnap.forEach((doc) => {
          const alert = doc.data();
          const currentPrice = priceMap[alert.symbol];
          if (currentPrice === undefined) return;

          let triggered = false;
          if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice)
            triggered = true;
          else if (
            alert.condition === "BELOW" &&
            currentPrice <= alert.targetPrice
          )
            triggered = true;

          if (triggered) {
            triggeredCount++;
            batch.update(doc.ref, {
              status: "TRIGGERED",
              triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
              triggeredPrice: currentPrice,
            });
            // Skip push for HTTP test to avoid noise, or keep it. Let's keep it minimal.
            console.log(`(HTTP Test) Alert triggered: ${alert.symbol}`);
          }
        });
      }

      await batch.commit();
      res.json({
        success: true,
        message: "Executed monitorIntradayMarket logic",
        pricesSaved: Object.keys(priceMap).length,
        alertsTriggered: triggeredCount,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: String(error) });
    }
  },
);

// ------------------------------------------------------------------
// 2. Callable Function: Create Alert
// Secure way for frontend to create alerts with validation
// ------------------------------------------------------------------
export const createAlert = onCall(
  { region: "europe-west1", cors: true },
  async (request) => {
    // A. Auth Check
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to create specific alerts.",
      );
    }

    const { symbol, targetPrice, condition } = request.data;
    const userId = request.auth.uid;

    // B. Validation
    if (!symbol || typeof symbol !== "string") {
      throw new HttpsError("invalid-argument", "Valid symbol is required.");
    }
    if (!targetPrice || typeof targetPrice !== "number" || targetPrice <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Positive target price is required.",
      );
    }
    if (!["ABOVE", "BELOW"].includes(condition)) {
      throw new HttpsError(
        "invalid-argument",
        "Condition must be ABOVE or BELOW.",
      );
    }

    // C. Write to Firestore
    // FCM tokens are now stored in users/{uid}/fcmTokens, not on individual alerts
    try {
      const docRef = await db.collection("alerts").add({
        userId,
        userEmail: request.auth.token.email || "unknown",
        symbol: symbol.toUpperCase(),
        targetPrice,
        condition,
        status: "ACTIVE",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // Initial check metadata
        lastCheckedAt: null,
      });

      console.log(`Alert created: ${docRef.id} for ${symbol} by ${userId}`);
      return { success: true, alertId: docRef.id };
    } catch (error) {
      console.error("Error creating alert:", error);
      throw new HttpsError("internal", "Failed to save alert.");
    }
  },
);

// ------------------------------------------------------------------
// 3. Scheduled Function: Scrape Daily Closing Data
// Runs hourly from 17:00 to 23:00 EAT Mon-Fri
// ------------------------------------------------------------------
async function sendScraperAlert(subject: string, body: string) {
  const email = process.env.SMTP_EMAIL;
  const password = process.env.SMTP_PASSWORD;
  const recipient = process.env.ALERT_RECIPIENT;

  if (!email || !password || !recipient) {
    console.warn("Skipping email alert: SMTP credentials missing in env.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: email,
      pass: password,
    },
  });

  try {
    await transporter.sendMail({
      from: `"DSE Scraper" <${email}>`,
      to: recipient,
      subject: subject,
      text: body,
    });
    console.log("Alert email sent successfully.");
  } catch (error) {
    console.error("Failed to send alert email:", error);
  }
}

export const scrapeDailyClosing = onSchedule(
  {
    schedule: "0 17-23 * * 1-5", // Every hour from 17:00 to 23:00 Mon-Fri
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    // 1. Check if data for TODAY already exists
    const now = moment().tz("Africa/Dar_es_Salaam");
    const todayFormatted = now.format("YYYY-MM-DD"); // e.g., "2026-03-09"

    // Check Firestore directly first to avoid unnecessary scraping
    const docRef = db.collection("dailyClosing").doc(todayFormatted);
    const doc = await docRef.get();

    if (doc.exists) {
      console.log(
        `Data for ${todayFormatted} already exists. Skipping scrape.`,
      );
      return;
    }

    console.log(`Data for ${todayFormatted} missing. Attempting scrape...`);

    // 2. Attempt Scrape
    const result = await scrapeDSEAndWriteToFirestore();
    console.log("scrapeDailyClosing result:", result);

    // 3. Check for Failure / Stale Data
    // Logic: If the scraped date is NOT today, it means DSE hasn't updated yet.
    if (result.success && result.date === todayFormatted) {
      console.log("Scrape successful and data matches today.");
      return;
    }

    // 4. Send Alert if Last Run (23:00)
    // event.scheduleTime is ISO string, but we can verify current hour
    const currentHour = now.hour();
    console.log(
      `Scrape finished but data is old or failed. Current hour: ${currentHour}`,
    );

    if (currentHour >= 23) {
      console.log("Last attempt of the day failed. Sending alert...");
      const subject = `⚠️ DSE Data Missing for ${todayFormatted}`;
      const body =
        `The scraper ran at ${now.format("HH:mm")} and could not find data for today.\n\n` +
        `Scraper Result: ${result.message}\n` +
        `Last Scraped Date: ${result.date || "Unknown"}\n\n` +
        `Please check https://dse.co.tz manually.`;

      await sendScraperAlert(subject, body);
    }
  },
);

// ------------------------------------------------------------------
// 4. HTTP Function: Manual Trigger for Testing (Emulator Only)
// Use: curl http://localhost:5001/PROJECT_ID/europe-west1/scrapeDailyClosingHttp
// ------------------------------------------------------------------
export const scrapeDailyClosingHttp = onRequest(
  {
    region: "europe-west1",
  },
  async (req, res) => {
    // Only allow in emulator
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      res
        .status(403)
        .json({ error: "This endpoint is only available in the emulator." });
      return;
    }

    const result = await scrapeDSEAndWriteToFirestore();
    res.json(result);
  },
);

// ------------------------------------------------------------------
// 5. Scheduled Function: Market Intel Closing Summary
// ------------------------------------------------------------------
export const generateDailyCloseSummary = onSchedule(
  {
    schedule: "45 16 * * 1-5",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    const now = moment().tz("Africa/Dar_es_Salaam");
    const dateStr = now.format("YYYY-MM-DD");
    
    try {
      // Get last snapshot of the day
      const lastSnapQuery = await db.collection("marketWatch").doc(dateStr).collection("snapshots")
        .orderBy("capturedAt", "desc")
        .limit(1)
        .get();
        
      if (lastSnapQuery.empty) {
        console.log(`No snapshots found for ${dateStr} closing summary.`);
        return;
      }
      
      const lastSnapshot = lastSnapQuery.docs[0].data();
      const snapshotSummary = generateSnapshotIntel(lastSnapshot);
      
      let trendSummary = await generateTrendIntel(db, dateStr, lastSnapshot);
      
      // Compare daily open vs close
      const firstSnapQuery = await db.collection("marketWatch").doc(dateStr).collection("snapshots")
        .orderBy("capturedAt", "asc")
        .limit(1)
        .get();
        
      if (!firstSnapQuery.empty && firstSnapQuery.docs[0].id !== lastSnapQuery.docs[0].id) {
         const firstSnapshot = firstSnapQuery.docs[0].data();
         
         let firstUp = 0; let firstDown = 0;
         Object.values(firstSnapshot.stocks).forEach((s: any) => { if (s.change > 0) firstUp++; else if (s.change < 0) firstDown++; });
         const firstSentiment = firstUp > firstDown ? 'BULLISH' : firstDown > firstUp ? 'BEARISH' : 'NEUTRAL';
         
         let lastUp = 0; let lastDown = 0;
         Object.values(lastSnapshot.stocks).forEach((s: any) => { if (s.change > 0) lastUp++; else if (s.change < 0) lastDown++; });
         const lastSentiment = lastUp > lastDown ? 'BULLISH' : lastDown > lastUp ? 'BEARISH' : 'NEUTRAL';
         
         let txt = `Overall for the day, the market opened **${firstSentiment}** and closed **${lastSentiment}**. `;
         
         let biggestMoverSymbol = "";
         let maxAbsMovePct = -1;
         let movePctVal = 0;
         let moveDir = "";
         
         for (const [symbol, currDataAny] of Object.entries(lastSnapshot.stocks)) {
            const currData = currDataAny as any;
            const startData = firstSnapshot.stocks[symbol];
            if (startData && currData.marketPrice > 0 && startData.marketPrice > 0 && currData.marketPrice !== startData.marketPrice) {
               const pctMove = ((currData.marketPrice - startData.marketPrice) / startData.marketPrice) * 100;
               const absMove = Math.abs(pctMove);
               if (absMove > maxAbsMovePct) {
                  maxAbsMovePct = absMove;
                  biggestMoverSymbol = symbol;
                  moveDir = pctMove > 0 ? "gained" : "dropped";
                  movePctVal = absMove;
               }
            }
         }
         if (biggestMoverSymbol && maxAbsMovePct > 0) {
            txt += `**${biggestMoverSymbol}** was today's notable mover, having ${moveDir} **${movePctVal.toFixed(2)}%** from the open.`;
         }
         trendSummary = txt;
      }
      
      const timestamp = new Date().toISOString();
      const intelRef = db
        .collection("marketWatch")
        .doc(dateStr)
        .collection("intel")
        .doc(timestamp);

      await intelRef.set({
        capturedAt: lastSnapshot.capturedAt, 
        type: "closing",
        snapshotSummary,
        trendSummary: `Closing Wrap-Up: ${trendSummary}`,
      });
      console.log(`Successfully generated closing intel for ${dateStr}`);
    } catch (e) {
      console.error("Error generating daily close summary:", e);
    }
  }
);
