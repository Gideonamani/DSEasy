"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeDailyClosingHttp = exports.scrapeDailyClosing = exports.createAlert = exports.checkPriceAlerts = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios_1 = require("axios");
admin.initializeApp();
const db = admin.firestore();
// Symbol Normalization Mappings (from Constants.js)
const SYMBOL_MAPPINGS = {
    "VERTEX-ETF": "VERTEX ETF",
    "IEACLC-ETF": "IEACLC ETF",
    "ITRUST ETF": "IEACLC ETF",
};
// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------
function normalizeSymbol(rawSymbol) {
    if (!rawSymbol)
        return "";
    const trimmed = rawSymbol.trim();
    return SYMBOL_MAPPINGS[trimmed] || trimmed;
}
function parseNum(val) {
    if (typeof val === "number")
        return val;
    if (!val)
        return 0;
    const clean = val.toString().replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}
function parseChangeValue(str) {
    if (!str)
        return 0;
    // Match number at the end: "-▼ -2.48" -> -2.48
    const matches = str.match(/[-+]?\d*\.?\d+/g);
    if (matches && matches.length > 0) {
        return parseFloat(matches[matches.length - 1]);
    }
    return 0;
}
// Convert "February 7, 2026" -> "7Feb2026"
function formatDateForSheet(longDateStr) {
    const parts = longDateStr.replace(/,/g, "").split(" "); // ["February", "7", "2026"]
    if (parts.length < 3)
        return null;
    const monthNames = {
        January: "Jan", February: "Feb", March: "Mar", April: "Apr",
        May: "May", June: "Jun", July: "Jul", August: "Aug",
        September: "Sep", October: "Oct", November: "Nov", December: "Dec",
    };
    const month = monthNames[parts[0]];
    const day = parts[1];
    const year = parts[2];
    if (!month)
        return null;
    return `${day}${month}${year}`;
}
// ------------------------------------------------------------------
// CORE SCRAPER LOGIC
// ------------------------------------------------------------------
async function scrapeDSEAndWriteToFirestore() {
    const url = "https://dse.co.tz";
    try {
        console.log("Fetching DSE homepage...");
        const { data: html } = await axios_1.default.get(url, { timeout: 30000 });
        // 1. EXTRACT DATE
        const dateRegex = /Market Summary\s*:<\/h5>\s*<h5[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/h5>/i;
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
            console.log(`Data for ${formattedDate} already exists. Skipping.`);
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
        const parsedRows = [];
        while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
            const rowInnerHtml = rowMatch[1];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
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
        const stocksData = [];
        for (const row of parsedRows) {
            if (row.length < 13)
                continue;
            const symbol = normalizeSymbol(row[0]);
            if (!symbol || symbol === "Total" || symbol === "Co.")
                continue;
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
            const turnoverPercent = dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0;
            const changePerVol = volume > 0 ? changeValue / volume : 0;
            const bidOfferRatio = outstandingOffer > 0 ? outstandingBid / outstandingOffer : 0;
            stocksData.push({
                symbol,
                open, prevClose, close, high, low,
                change: changeStr,
                changeValue,
                turnover, deals,
                outstandingBid, outstandingOffer,
                volume, mcap,
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
            batch.set(trendsRef, {
                symbol: stock.symbol,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            // D. trends/{symbol}/history/{date}
            const historyRef = trendsRef.collection("history").doc(formattedDate);
            batch.set(historyRef, Object.assign({ date: formattedDate }, stock));
        }
        await batch.commit();
        console.log("Batch write complete.");
        // 8. UPDATE CONFIG/APP.AVAILABLEDATES
        const configRef = db.collection("config").doc("app");
        await configRef.set({
            availableDates: admin.firestore.FieldValue.arrayUnion(formattedDate),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`Successfully imported ${stocksData.length} stocks for ${formattedDate}`);
        return {
            success: true,
            message: `Imported ${stocksData.length} stocks`,
            date: formattedDate,
            stockCount: stocksData.length,
        };
    }
    catch (error) {
        console.error("Error in scrapeDSEAndWriteToFirestore:", error);
        return { success: false, message: `Error: ${error}` };
    }
}
// ------------------------------------------------------------------
// 1. Scheduled Function: Check Price Alerts
// Runs every 15 minutes Mon-Fri during market hours (09:30 - 16:15)
// ------------------------------------------------------------------
exports.checkPriceAlerts = (0, scheduler_1.onSchedule)({
    schedule: "every 15 minutes",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1", // Cloud Scheduler not available in africa-south1
}, async (event) => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const hour = now.getHours();
    const mins = now.getMinutes();
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
        const { data: apiResponse } = await axios_1.default.get(dseUrl);
        const marketData = apiResponse.data || [];
        if (!marketData || marketData.length === 0) {
            console.error("No market data received from DSE API.");
            return;
        }
        // B. Create Price Map: Symbol -> Current Price
        const priceMap = {};
        marketData.forEach((item) => {
            const rawPrice = item.price ? parseFloat(item.price.replace(/,/g, "")) : 0;
            const symbol = item.company.trim();
            if (symbol && rawPrice > 0) {
                priceMap[symbol] = rawPrice;
            }
        });
        console.log(`Fetched prices for ${Object.keys(priceMap).length} symbols.`);
        // C. Fetch Active Alerts
        const alertsSnap = await db
            .collection("alerts")
            .where("status", "==", "ACTIVE")
            .get();
        if (alertsSnap.empty) {
            console.log("No active alerts found.");
            return;
        }
        // D. Check Conditions
        const batch = db.batch();
        const notifications = [];
        let triggeredCount = 0;
        alertsSnap.forEach((doc) => {
            const alert = doc.data();
            const currentPrice = priceMap[alert.symbol];
            if (currentPrice === undefined)
                return;
            let triggered = false;
            if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice) {
                triggered = true;
            }
            else if (alert.condition === "BELOW" && currentPrice <= alert.targetPrice) {
                triggered = true;
            }
            if (triggered) {
                triggeredCount++;
                console.log(`Alert triggered: ${alert.symbol} is ${currentPrice} (${alert.condition} ${alert.targetPrice})`);
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
                            price: String(currentPrice)
                        }
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
                        alertId: doc.id
                    },
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        // E. Execute Batch Updates & Send Notifications
        if (triggeredCount > 0) {
            await batch.commit();
            console.log(`Updated ${triggeredCount} alerts in Firestore.`);
            if (notifications.length > 0) {
                const response = await admin.messaging().sendEach(notifications);
                console.log(`Sent ${response.successCount} push notifications. Failed: ${response.failureCount}`);
            }
        }
        else {
            console.log("No alerts triggered this run.");
        }
    }
    catch (error) {
        console.error("Error in checkPriceAlerts:", error);
    }
});
// ------------------------------------------------------------------
// 2. Callable Function: Create Alert
// Secure way for frontend to create alerts with validation
// ------------------------------------------------------------------
exports.createAlert = (0, https_1.onCall)({ region: "africa-south1" }, async (request) => {
    // A. Auth Check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to create specific alerts.");
    }
    const { symbol, targetPrice, condition, fcmToken } = request.data;
    const userId = request.auth.uid;
    // B. Validation
    if (!symbol || typeof symbol !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Valid symbol is required.");
    }
    if (!targetPrice || typeof targetPrice !== "number" || targetPrice <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Positive target price is required.");
    }
    if (!["ABOVE", "BELOW"].includes(condition)) {
        throw new https_1.HttpsError("invalid-argument", "Condition must be ABOVE or BELOW.");
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
            lastCheckedAt: null
        });
        console.log(`Alert created: ${docRef.id} for ${symbol} by ${userId}`);
        return { success: true, alertId: docRef.id };
    }
    catch (error) {
        console.error("Error creating alert:", error);
        throw new https_1.HttpsError("internal", "Failed to save alert.");
    }
});
// ------------------------------------------------------------------
// 3. Scheduled Function: Scrape Daily Closing Data
// Runs daily at 17:00 EAT (after market close at 16:00)
// ------------------------------------------------------------------
exports.scrapeDailyClosing = (0, scheduler_1.onSchedule)({
    schedule: "0 17 * * 1-5", // 17:00 Mon-Fri
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
}, async () => {
    const result = await scrapeDSEAndWriteToFirestore();
    console.log("scrapeDailyClosing result:", result);
});
// ------------------------------------------------------------------
// 4. HTTP Function: Manual Trigger for Testing (Emulator Only)
// Use: curl http://localhost:5001/PROJECT_ID/europe-west1/scrapeDailyClosingHttp
// ------------------------------------------------------------------
exports.scrapeDailyClosingHttp = (0, https_1.onRequest)({
    region: "europe-west1",
}, async (req, res) => {
    // Only allow in emulator
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
        res.status(403).json({ error: "This endpoint is only available in the emulator." });
        return;
    }
    const result = await scrapeDSEAndWriteToFirestore();
    res.json(result);
});
//# sourceMappingURL=index.js.map