/*
  BACKEND API FOR DSEASY (Updated with Alerts)
  Filename: DailyClosingAPI.gs
*/

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  // New Alert Action
  if (action === "createAlert") {
    const email = params.email;
    const symbol = params.symbol;
    const targetPrice = params.targetPrice;
    const condition = params.condition; // ABOVE or BELOW
    const fcmToken = params.fcmToken;

    if (!email || !symbol || !targetPrice) {
      return jsonResponse({ error: "Missing Parameters" });
    }

    // IMPORTANT: This calls the function in AlertsManager.gs
    const result = createAlert(email, symbol, targetPrice, condition, fcmToken);
    return jsonResponse(result);
  }

  // Existing Actions
  if (action === "getDates") {
    return getAvailableDates();
  }

  if (action === "getData") {
    const dateStr = params.date;
    return getDayData(dateStr);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ error: "Invalid Action" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// ... (Rest of existing functions getAvailableDates, getDayData, jsonResponse are unchanged)
// We only need to paste the FULL file if we want to be safe, or just the top part.
// For the user, I'll provide the full file to avoid copy-paste errors.

// 1. Function to get list of sheets (Dates)
function getAvailableDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("_config_dates");

  // FAST PATH: Read from config sheet if it exists
  if (configSheet) {
    const lastRow = configSheet.getLastRow();
    if (lastRow > 1) {
      // Get Date (Col A) and SheetName (Col B)
      const data = configSheet.getRange(2, 1, lastRow - 1, 2).getValues();

      const configDates = data.map((row) => {
        const dateObj = new Date(row[0]);
        // Format as YYYY-MM-DD for consistency or ISO string
        return {
          date: dateObj.toISOString(),
          sheetName: row[1],
        };
      });
      return jsonResponse(configDates);
    }
  }

  // SLOW PATH: Fallback to scanning sheets (if config doesn't exist yet)
  const sheets = ss.getSheets();
  const dateList = [];
  const EXCLUDED_SHEET_NAMES = ["_alert_log", "_config_dates", "_alerts"]; // Updated exclusion list

  sheets.forEach((sheet) => {
    const name = sheet.getName();
    // Rule: Exclude if starts with "_" OR is in excluded list
    if (!name.startsWith("_") && !EXCLUDED_SHEET_NAMES.includes(name)) {
      dateList.push({
        date: null,
        sheetName: name,
      });
    }
  });

  return jsonResponse(dateList);
}

// 2. Function to get data for ONE specific date
function getDayData(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(dateStr);

  if (!sheet) {
    return jsonResponse([]); // Return empty if not found
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse([]);

  // Get Columns A to V (22 columns)
  const data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();

  const parseNumber = (val) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "");
    return Number(clean) || 0;
  };

  const formattedData = data.map((row) => {
    return {
      symbol: row[0],
      open: parseNumber(row[1]),
      prevClose: parseNumber(row[2]),
      close: parseNumber(row[3]),
      high: parseNumber(row[4]),
      low: parseNumber(row[5]),
      change: parseNumber(row[13]),
      turnover: parseNumber(row[7]),
      deals: parseNumber(row[8]),
      outstandingBid: parseNumber(row[9]),
      outstandingOffer: parseNumber(row[10]),
      volume: parseNumber(row[11]),
      mcap: parseNumber(row[12]) * 1000000000,

      bidOfferRatio: parseNumber(row[15]),
      highLowSpread: parseNumber(row[16]),
      turnoverPctDaily: parseNumber(row[17]),
      turnoverMcapRatio: parseNumber(row[18]),
      volPerDeal: parseNumber(row[19]),
      turnoverPerDeal: parseNumber(row[20]),
      changePerVol: parseNumber(row[21]),
    };
  });

  return jsonResponse(formattedData);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
