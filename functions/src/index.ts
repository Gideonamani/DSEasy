import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
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

interface StockData {
  symbol: string;
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

  const monthNames: { [key: string]: string } = {
    January: "Jan",
    February: "Feb",
    March: "Mar",
    April: "Apr",
    May: "May",
    June: "Jun",
    July: "Jul",
    August: "Aug",
    September: "Sep",
    October: "Oct",
    November: "Nov",
    December: "Dec",
  };

  const month = monthNames[parts[0]];
  const day = parts[1];
  const year = parts[2];

  if (!month) return null;
  return `${day}${month}${year}`;
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
    const { data: html } = await axios.get(url, { timeout: 30000 });

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
      const mcap = parseNum(row[12]);

      // 8 Derived Metrics
      const changeValue = parseChangeValue(changeStr);
      const highLowSpread = high - low;
      const volPerDeal = deals > 0 ? volume / deals : 0;
      const turnoverPerDeal = deals > 0 ? turnover / deals : 0;
      const turnoverPerMcap = mcap > 0 ? turnover / (mcap * 1000000000) : 0;
      const turnoverPercent =
        dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0;
      const changePerVol = volume > 0 ? changeValue / volume : 0;
      const bidOfferRatio =
        outstandingOffer > 0 ? outstandingBid / outstandingOffer : 0;

      stocksData.push({
        symbol,
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

      // D. trends/{symbol}/history/{date}
      const historyRef = trendsRef.collection("history").doc(formattedDate);
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
// 1. Scheduled Function: Check Price Alerts
// Runs every 15 minutes Mon-Fri during market hours (09:30 - 16:15)
// ------------------------------------------------------------------
export const checkPriceAlerts = onSchedule(
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
    // Adding a buffer: 9:00 (540) to 17:00 (1020) to be safe with timezone edges
    if (totalMins < 540 || totalMins > 1020) {
      console.log("Outside market hours - skipping alert check.");
      return;
    }

    try {
      console.log("Starting alert check...");

      // A. Fetch Live Prices from DSE API
      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await axios.get(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        return;
      }

      // B. Create Price Map: Symbol -> Current Price
      const priceMap: { [symbol: string]: number } = {};

      marketData.forEach((item) => {
        const rawPrice = item.price
          ? parseFloat(item.price.replace(/,/g, ""))
          : 0;
        const symbol = item.company.trim();

        if (symbol && rawPrice > 0) {
          priceMap[symbol] = rawPrice;
        }
      });

      console.log(
        `Fetched prices for ${Object.keys(priceMap).length} symbols.`,
      );

      // Initialize batch early
      const batch = db.batch();

      // C. Save Live Prices to Firestore (Fix for missing updates)
      const timestamp = new Date().toISOString();
      // Use clean timestamp for document ID to avoid special chars if any, but ISO is fine usually.
      // Actually, let's use a simpler ID for readability if we want, but ISO is standard.
      const livePricesRef = db.collection("livePrices").doc(timestamp);

      const pricesPayload: {
        [symbol: string]: { price: number; change: number };
      } = {};

      marketData.forEach((item) => {
        const symbol = item.company.trim();
        const price = item.price ? parseFloat(item.price.replace(/,/g, "")) : 0;
        const change = item.change
          ? parseFloat(item.change.replace(/,/g, ""))
          : 0;

        if (symbol) {
          pricesPayload[symbol] = { price, change };
        }
      });

      batch.set(livePricesRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        prices: pricesPayload,
      });

      console.log(`Queued write to livePrices/${timestamp}`);

      // D. Fetch Active Alerts
      const alertsSnap = await db
        .collection("alerts")
        .where("status", "==", "ACTIVE")
        .get();

      if (alertsSnap.empty) {
        console.log("No active alerts found.");
        // Commit live prices even if no alerts
        if (Object.keys(pricesPayload).length > 0) {
          await batch.commit();
          console.log("Committed live prices (no alerts checked).");
        }
        return;
      }

      // E. Check Conditions
      // Batch already initialized
      const notifications: admin.messaging.Message[] = [];
      let triggeredCount = 0;

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

          // 2. Prepare Push Notification
          if (alert.fcmToken) {
            notifications.push({
              token: alert.fcmToken,
              notification: {
                title: `Price Alert: ${alert.symbol}`,
                body: `${alert.symbol} is now ${currentPrice} TZS (Target: ${alert.targetPrice})`,
              },
              data: {
                type: "PRICE_ALERT",
                symbol: alert.symbol,
                alertId: doc.id,
                price: String(currentPrice),
              },
            });
          }

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

      // F. Execute Batch Updates & Send Notifications
      await batch.commit();
      console.log(`Batch committed. Triggered ${triggeredCount} alerts.`);

      if (triggeredCount > 0 && notifications.length > 0) {
        const response = await admin.messaging().sendEach(notifications);
        console.log(
          `Sent ${response.successCount} push notifications. Failed: ${response.failureCount}`,
        );
      }
    } catch (error) {
      console.error("Error in checkPriceAlerts:", error);
    }
  },
);

// ------------------------------------------------------------------
// 1.1 HTTP Wrapper for checkPriceAlerts (Testing Only)
// ------------------------------------------------------------------
export const checkPriceAlertsHttp = onRequest(
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
      console.log("Manually triggering checkPriceAlerts logic...");

      // A. Fetch Live Prices from DSE API
      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await axios.get(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        res.json({ success: false, message: "No market data" });
        return;
      }

      // B. Create Price Map
      const priceMap: { [symbol: string]: number } = {};
      marketData.forEach((item) => {
        const rawPrice = item.price
          ? parseFloat(item.price.replace(/,/g, ""))
          : 0;
        const symbol = item.company.trim();
        if (symbol && rawPrice > 0) {
          priceMap[symbol] = rawPrice;
        }
      });

      // C. Save Live Prices to Firestore
      const db = admin.firestore();
      const batch = db.batch();

      const timestamp = new Date().toISOString();
      const livePricesRef = db.collection("livePrices").doc(timestamp);

      const pricesPayload: {
        [symbol: string]: { price: number; change: number };
      } = {};
      marketData.forEach((item) => {
        const symbol = item.company.trim();
        const price = item.price ? parseFloat(item.price.replace(/,/g, "")) : 0;
        const change = item.change
          ? parseFloat(item.change.replace(/,/g, ""))
          : 0;
        if (symbol) pricesPayload[symbol] = { price, change };
      });

      batch.set(livePricesRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        prices: pricesPayload,
      });

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
        message: "Executed checkPriceAlerts logic",
        pricesSaved: Object.keys(pricesPayload).length,
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
  { region: "africa-south1" },
  async (request) => {
    // A. Auth Check
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to create specific alerts.",
      );
    }

    const { symbol, targetPrice, condition, fcmToken } = request.data;
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
    try {
      const docRef = await db.collection("alerts").add({
        userId,
        userEmail: request.auth.token.email || "unknown",
        symbol: symbol.toUpperCase(),
        targetPrice,
        condition,
        fcmToken, // Store token to target device later
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
    const todayFormatted = now.format("DMMMYYYY"); // e.g., "9Feb2026"

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
