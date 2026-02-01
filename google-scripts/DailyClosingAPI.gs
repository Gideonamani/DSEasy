/*
  BACKEND API FOR DSEASY (Lazy Loading)
  Filename: Code.gs
  
  Instructions:
  1. Paste this into your Google Apps Script project (e.g., named "Code.gs").
  2. Deploy -> New Deployment -> Web App.
  3. Set "Who has access" to "Anyone".
*/

function doGet(e) {
  const params = e.parameter;
  const action = params.action; // 'getDates' or 'getData'

  if (action === "getDates") {
    return getAvailableDates();
  }

  if (action === "getData") {
    const dateStr = params.date;
    return getDayData(dateStr);
  }

  // Default fallback
  return ContentService.createTextOutput(
    JSON.stringify({ error: "Invalid Action" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

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

  sheets.forEach((sheet) => {
    const name = sheet.getName();
    // Rule: Exclude if starts with "_" OR is in excluded list
    if (!name.startsWith("_") && !EXCLUDED_SHEET_NAMES.includes(name)) {
      // Mock the structure
      dateList.push({
        date: null, // We might not parse it here perfectly in fallback mode, or we can try
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
  // A=0, B=1, ... N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20, V=21
  const data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();

  // Helper to remove commas and parse number
  const parseNumber = (val) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "");
    return Number(clean) || 0;
  };

  const formattedData = data.map((row) => {
    return {
      // Core data (A-N)
      symbol: row[0],
      open: parseNumber(row[1]),
      prevClose: parseNumber(row[2]),
      close: parseNumber(row[3]),
      high: parseNumber(row[4]),
      low: parseNumber(row[5]),
      change: parseNumber(row[13]), // Col N: numeric Change Value
      turnover: parseNumber(row[7]),
      deals: parseNumber(row[8]),
      outstandingBid: parseNumber(row[9]), // Col J
      outstandingOffer: parseNumber(row[10]), // Col K
      volume: parseNumber(row[11]),
      mcap: parseNumber(row[12]) * 1000000000, // Scale: Billions -> Units

      // Derived metrics (P-V)
      bidOfferRatio: parseNumber(row[15]), // Col P: Bid/Offer
      highLowSpread: parseNumber(row[16]), // Col Q: High/Low Spread
      turnoverPctDaily: parseNumber(row[17]), // Col R: Turnover % of Daily Traded
      turnoverMcapRatio: parseNumber(row[18]), // Col S: Turnover / MCAP
      volPerDeal: parseNumber(row[19]), // Col T: Vol/Deal
      turnoverPerDeal: parseNumber(row[20]), // Col U: Turnover/Deal
      changePerVol: parseNumber(row[21]), // Col V: Change/Vol
    };
  });

  return jsonResponse(formattedData);
}

// Helper: Standard JSON Response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
