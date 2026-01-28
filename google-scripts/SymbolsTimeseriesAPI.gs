/*
  SYMBOLS TIMESERIES API FOR DSEASY
  Filename: SymbolsTimeseriesAPI.gs
  
  IMPORTANT: Deploy this to the SYMBOLS spreadsheet (separate from Daily Closing)
  This ensures GET/POST requests don't collide between the two APIs.
  
  Instructions:
  1. Open the Symbols spreadsheet (ID: 1cvCaJod4PPsilu3wcAMosMSapfawlJqL2ddtx2xt9rQ)
  2. Go to Extensions -> Apps Script
  3. Paste this code and save
  4. Deploy -> New Deployment -> Web App
  5. Set "Who has access" to "Anyone"
  6. Copy the deployment URL for your frontend
  
  Endpoints:
  - ?action=getSymbols           -> Returns list of all symbol sheet names
  - ?action=getTimeseries&symbol=CRDB  -> Returns full timeseries for a symbol
  - ?action=getSymbolRange&symbol=CRDB&from=01 Jan 2026&to=28 Jan 2026 -> Date-filtered data
*/

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  if (action === "getSymbols") {
    return getAvailableSymbols();
  }

  if (action === "getTimeseries") {
    const symbol = params.symbol;
    if (!symbol) {
      return jsonResponse({ error: "Missing 'symbol' parameter" });
    }
    return getSymbolTimeseries(symbol);
  }

  if (action === "getSymbolRange") {
    const symbol = params.symbol;
    const fromDate = params.from;
    const toDate = params.to;
    if (!symbol) {
      return jsonResponse({ error: "Missing 'symbol' parameter" });
    }
    return getSymbolTimeseriesRange(symbol, fromDate, toDate);
  }

  // Default fallback
  return ContentService.createTextOutput(
    JSON.stringify({
      error: "Invalid Action",
      validActions: ["getSymbols", "getTimeseries", "getSymbolRange"],
      usage: {
        getSymbols: "?action=getSymbols",
        getTimeseries: "?action=getTimeseries&symbol=CRDB",
        getSymbolRange:
          "?action=getSymbolRange&symbol=CRDB&from=01 Jan 2026&to=28 Jan 2026",
      },
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// 1. Get list of all symbol sheets
function getAvailableSymbols() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const symbols = [];

  // Excluded list (system/config sheets)
  const EXCLUDED = ["_config", "template", "README"];

  sheets.forEach((sheet) => {
    const name = sheet.getName();
    // Exclude if starts with "_" OR is in excluded list
    if (!name.startsWith("_") && !EXCLUDED.includes(name)) {
      symbols.push(name);
    }
  });

  return jsonResponse(symbols.sort()); // Return sorted alphabetically
}

// 2. Get full timeseries data for a specific symbol
function getSymbolTimeseries(symbol) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(symbol);

  if (!sheet) {
    return jsonResponse({ error: `Symbol '${symbol}' not found` });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse([]);

  // Get all data (Date + columns B to N = 14 columns total)
  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  return jsonResponse(formatTimeseriesData(data));
}

// 3. Get timeseries data for a symbol within a date range
function getSymbolTimeseriesRange(symbol, fromDate, toDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(symbol);

  if (!sheet) {
    return jsonResponse({ error: `Symbol '${symbol}' not found` });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse([]);

  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  // Filter by date range if provided
  let filteredData = data;

  if (fromDate || toDate) {
    filteredData = data.filter((row) => {
      const rowDate = parseDate(row[0]);
      if (!rowDate) return false;

      if (fromDate && toDate) {
        const from = parseDate(fromDate);
        const to = parseDate(toDate);
        return rowDate >= from && rowDate <= to;
      } else if (fromDate) {
        return rowDate >= parseDate(fromDate);
      } else if (toDate) {
        return rowDate <= parseDate(toDate);
      }
      return true;
    });
  }

  return jsonResponse(formatTimeseriesData(filteredData));
}

// --- HELPER FUNCTIONS ---

// Parse date string "26 Jan 2026" -> Date object
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle Date objects directly
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();
  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  // Pattern: "26 Jan 2026" or "26Jan2026"
  const match = str.match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = months[match[2].toLowerCase()];
    const year = parseInt(match[3]);
    return new Date(year, month, day);
  }

  return null;
}

// Format raw sheet data into clean JSON objects
function formatTimeseriesData(data) {
  const parseNumber = (val) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "").replace(/^'/, ""); // Remove comma and leading apostrophe
    return Number(clean) || 0;
  };

  return data.map((row) => {
    // Format date as string
    let dateStr = row[0];
    if (row[0] instanceof Date) {
      const d = row[0];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    return {
      date: dateStr,
      open: parseNumber(row[1]),
      prevClose: parseNumber(row[2]),
      close: parseNumber(row[3]),
      high: parseNumber(row[4]),
      low: parseNumber(row[5]),
      change: String(row[6]).replace(/^'/, ""), // Keep as string (e.g., "-5.00%")
      turnover: parseNumber(row[7]),
      deals: parseNumber(row[8]),
      bid: parseNumber(row[9]),
      offer: parseNumber(row[10]),
      volume: parseNumber(row[11]),
      mcap: parseNumber(row[12]),
      changeValue: parseNumber(row[13]),
    };
  });
}

// Standard JSON Response helper
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
