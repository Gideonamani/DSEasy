import { onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { normalizeSymbol } from "../utils/helpers";

// Beyond this age an intraday snapshot's `change` is treated as unusable and we
// fall back to the plain daily close. Covers the overnight post-close gap (the
// 16:05 closing snapshot stays valid until the next session) while rejecting a
// snapshot left behind by a stalled intraday monitor.
const INTRADAY_CHANGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface DailyClose {
  date: string;
  close: number;
}

interface IntradayChange {
  date: string;
  change: number;
  capturedAt: string;
}

// Latest daily close for a ticker. Daily-closing dates are "YYYY-MM-DD"
// strings, so a lexical sort is chronological. Only the most recent date is
// queried — walking older dates on a miss would mean one Firestore read per
// historical date for any ticker outside the equities scrape (e.g. ETFs),
// which blows past the Apps Script custom-function timeout.
async function getLatestDailyClose(
  availableDates: string[],
  ticker: string,
): Promise<DailyClose | null> {
  const latestDate = [...availableDates].sort().reverse()[0];
  const snap = await db
    .collection("dailyClosing")
    .doc(latestDate)
    .collection("stocks")
    .doc(ticker)
    .get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return { date: latestDate, close: data.close ?? 0 };
}

// Today's intraday change for a ticker from the most recent marketWatch
// snapshot. Returns null when the ticker isn't in the snapshot (the ~21-stock
// coverage gap) or no snapshot exists.
async function getLatestIntradayChange(
  marketWatchDates: string[],
  ticker: string,
): Promise<IntradayChange | null> {
  if (marketWatchDates.length === 0) return null;
  const latestDate = [...marketWatchDates].sort().reverse()[0];

  const query = await db
    .collection("marketWatch")
    .doc(latestDate)
    .collection("snapshots")
    .orderBy("capturedAt", "desc")
    .limit(1)
    .get();

  if (query.empty) return null;

  const snapshot = query.docs[0].data();
  const stock = (snapshot.stocks || {})[ticker];
  if (!stock || typeof stock.change !== "number") return null;

  return {
    date: latestDate,
    change: stock.change,
    capturedAt: snapshot.capturedAt,
  };
}

/**
 * HTTP Function to fetch the latest live price for a given ticker.
 * Intended for use in Google Sheets custom functions.
 *
 * During a trading session the live price is the latest daily close (the
 * official previous close) plus the day's intraday `change` from the most
 * recent `marketWatch` snapshot. Outside trading — and once the evening scrape
 * has published the day's close — it returns the daily close directly. The
 * source is chosen by recency (freshest-by-date): the intraday change is only
 * applied while the latest snapshot is newer than the latest published close,
 * which also covers the post-close gap before the evening scrape runs.
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
    const rawTicker = (req.query.ticker as string || "").toUpperCase().trim();
    const providedKey = req.query.key as string;

    // 1. Basic Validation
    if (!rawTicker) {
      res.status(400).json({ error: "Missing 'ticker' parameter." });
      return;
    }

    // Apply the same symbol mapping the scraper uses, so callers can pass the
    // dashed form (e.g. "IEACLC-ETF", "VERTEX-ETF") and still hit the canonical
    // Firestore doc id (e.g. "IEACLC ETF").
    const ticker = normalizeSymbol(rawTicker);

    // 2. API Key Validation
    // Note: In production, set this via: firebase functions:secrets:set SHEETS_API_KEY
    const validKey = process.env.SHEETS_API_KEY || "DSEasy-Temp-Key-2026";
    if (!providedKey || providedKey !== validKey) {
      console.warn(`Unauthorized access attempt for ticker ${ticker} with key: ${providedKey}`);
      res.status(401).json({ error: "Unauthorized. Invalid API key." });
      return;
    }

    try {
      const configSnap = await db.collection("config").doc("app").get();
      const configData = configSnap.data();
      const availableDates: string[] = configData?.availableDates || [];
      const marketWatchDates: string[] = configData?.marketWatchDates || [];

      if (availableDates.length === 0) {
        res.status(404).json({ error: "No market data dates found in config." });
        return;
      }

      // prevClose: latest published daily close — the live-price base and the
      // off-hours fallback. Fetched in parallel with the intraday snapshot.
      const [dailyClose, intraday] = await Promise.all([
        getLatestDailyClose(availableDates, ticker),
        getLatestIntradayChange(marketWatchDates, ticker),
      ]);

      if (!dailyClose) {
        res.status(404).json({ error: `Ticker '${ticker}' not found in daily closing data.` });
        return;
      }

      // Apply the intraday change only when the snapshot is genuinely newer
      // than the published close (freshest-by-date — avoids double-counting the
      // change once the close catches up) and recent enough to trust.
      const intradayIsFresher = !!intraday && intraday.date > dailyClose.date;
      const intradayIsRecent =
        !!intraday &&
        Date.now() - new Date(intraday.capturedAt).getTime() <
          INTRADAY_CHANGE_MAX_AGE_MS;

      if (intraday && intradayIsFresher && intradayIsRecent) {
        res.json({
          symbol: ticker,
          price: dailyClose.close + intraday.change,
          change: intraday.change,
          prevClose: dailyClose.close,
          date: intraday.date,
          asOf: intraday.capturedAt,
          source: "intraday",
        });
        return;
      }

      res.json({
        symbol: ticker,
        price: dailyClose.close,
        change: 0,
        prevClose: dailyClose.close,
        date: dailyClose.date,
        source: "dailyClosing",
      });
    } catch (error) {
      console.error("Error fetching ticker price:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);
