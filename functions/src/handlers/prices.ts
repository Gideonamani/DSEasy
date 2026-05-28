import { onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

/**
 * HTTP Function to fetch the latest closing price for a given ticker.
 * Intended for use in Google Sheets custom functions.
 *
 * Reads from the authoritative daily-closing pipeline
 * (`dailyClosing/{date}/stocks/{ticker}` with dates from
 * `config/app.availableDates`) so the value matches what the DSEasy app and
 * dse.co.tz report. The intraday `marketWatch` snapshots are a separate,
 * lower-coverage source and must not be used here.
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
      // 3. Find the latest available daily-closing date.
      // availableDates are "YYYY-MM-DD" strings, so a lexical sort is chronological.
      const configSnap = await db.collection("config").doc("app").get();
      const configData = configSnap.data();
      const availableDates: string[] = configData?.availableDates || [];

      if (availableDates.length === 0) {
        res.status(404).json({ error: "No market data dates found in config." });
        return;
      }

      const sortedDates = [...availableDates].sort().reverse();
      const latestDate = sortedDates[0];

      // 4. Fetch the closing record for this ticker on the latest date.
      const stockSnap = await db
        .collection("dailyClosing")
        .doc(latestDate)
        .collection("stocks")
        .doc(ticker)
        .get();

      if (!stockSnap.exists) {
        res.status(404).json({ error: `Ticker '${ticker}' not found in latest close (${latestDate}).` });
        return;
      }

      const stockData = stockSnap.data() || {};

      // 5. Return the closing price — the same `close` value the app/site shows.
      const price = stockData.close ?? 0;
      const change = stockData.changeValue ?? 0;

      res.json({
        symbol: ticker,
        price,
        change,
        date: latestDate,
        source: "dailyClosing"
      });
    } catch (error) {
      console.error("Error fetching ticker price:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);
