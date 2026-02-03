/* 
   CLOSING TO SYMBOLS SYNC & BACKFILL
   Filename: ClosingToSymbols.gs
   
   Instructions:
   1. Paste this into your Google Apps Script project.
   2. Creates a "Trends" database by sending daily data to a second spreadsheet.
   3. A custom menu "📊 Trends Sync" will appear after refreshing the spreadsheet (managed in AdminActions.gs).
*/

// --- HELPER: Formats "26Jan2026" -> "26 Jan 2026" ---
function formatDateString(sheetName) {
  // Regex looks for: (1 or 2 digits) followed by (3 letters) followed by (4 digits)
  const regex = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/;
  const match = sheetName.match(regex);

  if (match) {
    // Rebuild it with spaces
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return sheetName; // If it doesn't match pattern, return original
}

// 1. DAILY SYNC FUNCTION (Run this daily via trigger)
function syncDailyToTrends() {
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID); // Uses shared constant

  const sheets = sourceSs.getSheets();
  let targetSheet = null;

  // Find latest valid sheet (iterate backwards)
  for (let i = sheets.length - 1; i >= 0; i--) {
    const name = sheets[i].getName();
    if (!name.startsWith("_") && !EXCLUDED_SHEET_NAMES.includes(name)) {
      // Uses shared constant
      targetSheet = sheets[i];
      break;
    }
  }

  if (!targetSheet) return;

  // FORMAT THE DATE HERE
  const rawName = targetSheet.getName();
  const dateStr = formatDateString(rawName);

  Logger.log("Processing: " + rawName + " as " + dateStr);

  const result = processSheetData(targetSheet, destSs, dateStr, true); // Strict Mode = ON
  
  if (result.skipped.length > 0) {
    Logger.log("WARNING: Skipped new symbols: " + result.skipped.join(", "));
    // We could send an email here if this was triggered manually, but usually triggering from ScrapeDSEData handles the email.
    // If triggered from menu "Sync Latest Day", we likely want a UI alert.
    // Let's rely on the caller or add a UI alert if possible.
  }

  // Auto-update config after sync
  updateDateConfig(); // Calls function from AdminActions.gs
  
  return result; // Return result for caller (e.g. ScrapeDSEData)
}

// 2. BACKFILL HISTORY FUNCTION (Run manually to fill database with old sheets)
function backfillAllHistory() {
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID); // Uses shared constant
  const sheets = sourceSs.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getName();

    if (name.startsWith("_") || EXCLUDED_SHEET_NAMES.includes(name)) continue; // Uses shared constant

    // FORMAT THE DATE HERE
    const dateStr = formatDateString(name);

    Logger.log("Backfilling: " + name + " -> " + dateStr);
    processSheetData(sheet, destSs, dateStr, false); // Strict Mode = OFF (Create missing sheets)

    Utilities.sleep(500); // Respect rate limits
  }

  updateDateConfig(); // Calls function from AdminActions.gs
}

// 3. SHARED PROCESSING LOGIC
// Returns object: { processed: count, skipped: [symbol list] }
function processSheetData(sheet, destSs, dateStr, strictMode = true) {
  const lastRow = sheet.getLastRow();
  const result = { processed: 0, skipped: [] };
  
  if (lastRow < 2) return result;

  const range = sheet.getRange(2, 1, lastRow - 1, DATA_COLUMN_COUNT); // Uses shared constant
  const values = range.getValues();

  values.forEach((row) => {
    const symbol = row[0];
    if (
      !symbol ||
      symbol === "SYMBOL" ||
      symbol === "Total" ||
      symbol === "Co."
    )
      return;

    if (row[6]) row[6] = "'" + row[6]; // Fix formula error for the Change column

    const rowData = [dateStr, ...row.slice(1)];
    
    let symbolSheet = destSs.getSheetByName(symbol);

    if (!symbolSheet) {
      if (strictMode) {
        // STRICT MODE: Do not create new sheet. Log as skipped.
        result.skipped.push(symbol);
        return; // Skip this row
      } else {
        // PERMISSIVE MODE: Create new sheet (Backfill or explicit override)
        symbolSheet = destSs.insertSheet(symbol);
        symbolSheet.appendRow([
          "Date",
          "Open",
          "Prev Close",
          "Close",
          "High",
          "Low",
          "Change",
          "Turn Over",
          "Deals",
          "Out Standing Bid",
          "Out Standing Offer",
          "Volume",
          "MCAP (TZS 'B)",
          "Change Value",
          "",
          "Bid/Offer",
          "High/Low Spread",
          "Turnover % of Daily Traded",
          "Turnover / MCAP",
          "Vol/Deal",
          "Turnover/Deal",
          "Change/Vol",
        ]);
        symbolSheet.getRange("G:G").setNumberFormat("@");
      }
    }

    // Duplicate Check
    const destData = symbolSheet.getDataRange().getValues();
    let dateExists = false;
    // Optimization: Check last row first? Or just iterate. 
    // Usually we append to end, so checking last row date (if sorted) is faster but let's stick to safe iterate.
    for (let d = 1; d < destData.length; d++) {
      if (destData[d][0].toString() === dateStr.toString()) {
        dateExists = true;
        break;
      }
    }

    if (!dateExists) {
      symbolSheet.appendRow(rowData);
      result.processed++;
    }
  });
  
  return result;
}
