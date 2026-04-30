import { onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

/**
 * HTTP Function to fetch the latest price for a given ticker.
 * Intended for use in Google Sheets custom functions.
 * 
 * Query Params:
 *  - ticker: The stock symbol (e.g., "NMB")
 *  - key: The API key for authentication
 */
export const getTickerPrice = onRequest(
  {
    region: "europe-west1",
    secrets: ["SHEETS_API_KEY"],
  },
  async (req, res) => {
    const ticker = (req.query.ticker as string || "").toUpperCase().trim();
    const providedKey = req.query.key as string;

    // 1. Basic Validation
    if (!ticker) {
      res.status(400).json({ error: "Missing 'ticker' parameter." });
      return;
    }

    // 2. API Key Validation
    // Note: In production, set this via: firebase functions:secrets:set SHEETS_API_KEY
    const validKey = process.env.SHEETS_API_KEY || "DSEasy-Temp-Key-2026";
    if (!providedKey || providedKey !== validKey) {
      console.warn(`Unauthorized access attempt for ticker ${ticker} with key: ${providedKey}`);
      res.status(401).json({ error: "Unauthorized. Invalid API key." });
      return;
    }

    try {
      // 3. Find the latest available date
      const configSnap = await db.collection("config").doc("app").get();
      const configData = configSnap.data();
      const availableDates: string[] = configData?.marketWatchDates || [];

      if (availableDates.length === 0) {
        res.status(404).json({ error: "No market data dates found in config." });
        return;
      }

      // Sort dates just in case they aren't chronological
      const sortedDates = [...availableDates].sort().reverse();
      const latestDate = sortedDates[0];

      // 4. Fetch the most recent snapshot for that date
      const snapshotQuery = await db
        .collection("marketWatch")
        .doc(latestDate)
        .collection("snapshots")
        .orderBy("capturedAt", "desc")
        .limit(1)
        .get();

      if (snapshotQuery.empty) {
        res.status(404).json({ error: `No snapshots found for latest date: ${latestDate}` });
        return;
      }

      const latestSnapshot = snapshotQuery.docs[0].data();
      const stocks = latestSnapshot.stocks || {};
      const stockData = stocks[ticker];

      if (!stockData) {
        res.status(404).json({ error: `Ticker '${ticker}' not found in latest snapshot (${latestDate}).` });
        return;
      }

      // 5. Return the price
      // marketPrice is the standard live price in the MarketWatchEntry type
      const price = stockData.marketPrice || 0;
      const change = stockData.change || 0;
      const capturedAt = latestSnapshot.capturedAt;

      res.json({
        symbol: ticker,
        price,
        change,
        date: latestDate,
        capturedAt,
        source: "marketWatch"
      });
    } catch (error) {
      console.error("Error fetching ticker price:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);
