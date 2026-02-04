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
  // Time Window Check: 9:30 AM - 4:15 PM
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const isWeekday = now.getDay() > 0 && now.getDay() < 6;
  
  // 9:30 AM = 570 mins, 4:15 PM = 975 mins
  if (!isWeekday || mins < 570 || mins > 975) {
    Logger.log("Outside of trading hours or weekend. Skipping.");
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTS_SHEET_NAME);

  // 1. Fetch Live Data (Raw List)
  const marketData = fetchLiveMarketData(); // Returns Array
  if (!marketData || marketData.length === 0) {
    Logger.log("No market data fetched.");
    return;
  }

  // 2. Log to History (_live_prices)
  logLivePricesToHistory(ss, marketData);

  // 3. Prepare Map for Alert Checking
  const livePrices = {};
  marketData.forEach(item => {
    const price = Number(item.price) || 0;   // Open Price
    const change = Number(item.change) || 0; // Change
    livePrices[item.company] = price + change; // Current Price
  });

  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  // Row 0 is header

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const [email, symbol, targetPrice, condition, fcmToken, status] = row;

    if (status !== "ACTIVE") continue;

    const currentPrice = livePrices[symbol];
    if (currentPrice === undefined) continue;

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

// ---------------------------------------------------
// SETUP & LOGGING
// ---------------------------------------------------

// Run this ONCE to set up the 15-minute trigger
function setupIntradayTrigger() {
  const functionName = "checkIntradayAlerts";
  
  // Check if exists
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === functionName) {
      Logger.log("Trigger already exists.");
      return;
    }
  }

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(15)
    .create();
    
  Logger.log("Intraday trigger set up successfully.");
}

function fetchLiveMarketData() {
  const url = "https://dse.co.tz/api/get/live/market/prices";
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());
    if (json.data && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {
    Logger.log("Error fetching live data: " + e.toString());
  }
  return [];
}

function logLivePricesToHistory(ss, dataList) {
  const sheetName = "_live_prices";
  let sheet = ss.getSheetByName(sheetName);
  
  // Sort data alphabetically by company symbol
  dataList.sort((a, b) => a.company.localeCompare(b.company));
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Create Header Row
    const headers = ["Timestamp"];
    dataList.forEach(item => {
      headers.push(`${item.company} Open`);
      headers.push(`${item.company} Change`);
    });
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = new Array(headers.length).fill("");
  
  row[0] = new Date(); // Timestamp
  
  dataList.forEach(item => {
    // Find columns
    const openIndex = headers.indexOf(`${item.company} Open`);
    const changeIndex = headers.indexOf(`${item.company} Change`);
    
    if (openIndex > -1) row[openIndex] = item.price;
    if (changeIndex > -1) row[changeIndex] = item.change;
  });
  
  sheet.appendRow(row);
}

// ---------------------------------------------------
// TEST FUNCTION FOR SERVICE WORKER
// ---------------------------------------------------
function testServiceWorkerNotification() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTS_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("No alerts found.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  let sentCount = 0;
  let errors = [];

  // Iterate rows (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Columns: 0=Email, 1=Symbol, 2=Target, 3=Condition, 4=Token, 5=Status, 6=Created
    const email = row[0];
    const fcmToken = row[4];
    const status = row[5];

    // ONLY send if Status explicitly says "TEST"
    if (status === "TEST") {
      if (!fcmToken) {
        errors.push(`Row ${i + 1}: No Token`);
        continue;
      }

      const title = "🔔 TEST MODE";
      const body = `Test notification for ${email}.`;

      try {
        const result = sendPushNotification(fcmToken, title, body);
        if (result) {
          sentCount++;
        } else {
          errors.push(`Row ${i + 1}: Check Logs (Key Error?)`);
        }
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.toString()}`);
      }
    }
  }

  const message =
    sentCount > 0
      ? `✅ Sent ${sentCount} test notifications.`
      : "⚠️ No rows found with Status = 'TEST'.\n\nChange the Status column to 'TEST' for the rows you want to check.";

  if (errors.length > 0) {
    SpreadsheetApp.getUi().alert(message + "\n\nErrors:\n" + errors.join("\n"));
  } else {
    SpreadsheetApp.getUi().alert(message);
  }
}

// 4. Get Alerts (API)
function getAlerts(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTS_SHEET_NAME);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const alerts = [];

  // Skip header, check Status=ACTIVE
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // [Email, Symbol, Target, Condition, Token, Status, Created]
    if (row[5] === "ACTIVE") {
      if (!email || row[0] === email) {
        alerts.push({
          email: row[0],
          symbol: row[1],
          targetPrice: row[2],
          condition: row[3],
          fcmToken: row[4],
          status: row[5],
          created: row[6],
        });
      }
    }
  }
  return alerts;
}

// 5. Delete Alert (API)
function deleteAlert(email, symbol, targetPrice, condition) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTS_SHEET_NAME);
  if (!sheet) return { success: false, error: "No sheet" };

  const data = sheet.getDataRange().getValues();
  // Iterate backwards loop
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    // Match logic
    if (
      row[0] == email &&
      row[1] == symbol &&
      row[2] == targetPrice &&
      row[3] == condition
    ) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Alert not found" };
}
