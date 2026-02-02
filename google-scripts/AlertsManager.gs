/*
  ALERTS MANAGER
  Filename: AlertsManager.gs
  
  1. createAlert(email, symbol, targetPrice, condition, fcmToken)
  2. checkIntradayAlerts() -> Triggered every 15 mins
*/

const ALERTS_SHEET_NAME = "_alerts";

// 1. API Endpoint to Create Alert
function createAlert(email, symbol, targetPrice, condition, fcmToken) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ALERTS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(ALERTS_SHEET_NAME);
    sheet.appendRow([
      "Email",
      "Symbol",
      "Target Price",
      "Condition",
      "FCM Token",
      "Status",
      "Created At",
    ]);
  }

  sheet.appendRow([
    email,
    symbol,
    Number(targetPrice),
    condition, // "ABOVE" or "BELOW"
    fcmToken,
    "ACTIVE",
    new Date(),
  ]);

  return { success: true, message: "Alert set for " + symbol };
}

// 2. Monitoring Function (Run via Trigger)
function checkIntradayAlerts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTS_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) return;

  // 1. Fetch Live Prices (Reusing scrape logic slightly modified for speed or just latest close)
  // ideally we fetch from the DSE API directly here for "Live" feel
  const livePrices = fetchLivePricesMap();

  const data = sheet.getDataRange().getValues();
  // Row 0 is header

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const [email, symbol, targetPrice, condition, fcmToken, status] = row;

    if (status !== "ACTIVE") continue;

    const currentPrice = livePrices[symbol];
    if (!currentPrice) continue;

    let triggered = false;

    if (condition === "ABOVE" && currentPrice >= targetPrice) {
      triggered = true;
    } else if (condition === "BELOW" && currentPrice <= targetPrice) {
      triggered = true;
    }

    if (triggered) {
      Logger.log(`Triggering Alert for ${symbol}: ${currentPrice}`);

      const title = `Price Alert: ${symbol}`;
      const body = `${symbol} has reached ${currentPrice} TZS (Target: ${targetPrice})`;

      // Send Push
      if (fcmToken) {
        sendPushNotification(fcmToken, title, body);
      } else {
        // Fallback to Email if no token
        MailApp.sendEmail(email, title, body);
      }

      // Update Status to "TRIGGERED" so we don't spam
      sheet.getRange(i + 1, 6).setValue("TRIGGERED");
      sheet.getRange(i + 1, 7).setValue(new Date()); // Update timestamp to trigger time
    }
  }
}

// Helper: Quick fetch of live prices
function fetchLivePricesMap() {
  // Use the same API endpoint used in ScrapeDSEData
  const url = "https://dse.co.tz/api/get/live/market/prices"; // We trust this exists
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());

    const map = {};
    if (json.data && json.data.length > 0) {
      json.data.forEach((item) => {
        // "symbol": "CRDB", "close": "550" (or similar)
        // Usually live prices are in Different fields, verify structure if needed
        // Assuming 'Close' is the current trading price for simplicity or 'close' from API
        map[item.Symbol] = Number(item.Close) || 0;
      });
    }
    return map;
  } catch (e) {
    Logger.log("Error fetching live prices: " + e.toString());
    return {};
  }
}
