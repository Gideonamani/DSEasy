/* 
   CLOSING TO SYMBOLS SYNC & BACKFILL
   Filename: ClosingToSymbols.gs
   
   Instructions:
   1. Paste this into your Google Apps Script project.
   2. Creates a "Trends" database by sending daily data to a second spreadsheet.
*/

const DESTINATION_SPREADSHEET_ID = '1cvCaJod4PPsilu3wcAMosMSapfawlJqL2ddtx2xt9rQ'; // <--- REPLACE THIS ID
const EXCLUDED_SPECIFIC_NAMES = ['Market Summary', 'Equity', 'Bonds', 'template', '_config']; 

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
  const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID);
  
  const sheets = sourceSs.getSheets();
  let targetSheet = null;
  
  // Find latest valid sheet (iterate backwards)
  for (let i = sheets.length - 1; i >= 0; i--) {
     const name = sheets[i].getName();
     if (!name.startsWith('_') && !EXCLUDED_SPECIFIC_NAMES.includes(name)) {
       targetSheet = sheets[i];
       break;
     }
  }
  
  if (!targetSheet) return;

  // FORMAT THE DATE HERE
  const rawName = targetSheet.getName();
  const dateStr = formatDateString(rawName); 
  
  Logger.log("Processing: " + rawName + " as " + dateStr);

  processSheetData(targetSheet, destSs, dateStr);
}


// 2. BACKFILL HISTORY FUNCTION (Run manually to fill database with old sheets)
function backfillAllHistory() {
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID);
  const sheets = sourceSs.getSheets();
  
  for (let i = 0; i < sheets.length; i++) {
     const sheet = sheets[i];
     const name = sheet.getName();
     
     if (name.startsWith('_') || EXCLUDED_SPECIFIC_NAMES.includes(name)) continue;
     
     // FORMAT THE DATE HERE
     const dateStr = formatDateString(name);
     
     Logger.log("Backfilling: " + name + " -> " + dateStr);
     processSheetData(sheet, destSs, dateStr);
     
     Utilities.sleep(500); // Respect rate limits
  }
}


// 3. SHARED PROCESSING LOGIC
function processSheetData(sheet, destSs, dateStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, 14); 
  const values = range.getValues();
  
  values.forEach(row => {
    const symbol = row[0]; 
    if (!symbol || symbol === "SYMBOL" || symbol === "Total" || symbol === "Co.") return;

    if (row[6]) row[6] = "'" + row[6]; // Fix formula error for the Change column

    const rowData = [dateStr, ...row.slice(1)];
    
    let symbolSheet = destSs.getSheetByName(symbol);
    
    if (!symbolSheet) {
      symbolSheet = destSs.insertSheet(symbol);
      symbolSheet.appendRow(["Date", "Open", "Prev Close", "Close", "High", "Low", "Change", "Turnover", "Deals", "Bid", "Offer", "Volume", "MCap", "Change Value"]);
      symbolSheet.getRange("G:G").setNumberFormat("@");
    }
    
    // Duplicate Check
    const destData = symbolSheet.getDataRange().getValues();
    let dateExists = false;
    for (let d = 1; d < destData.length; d++) {
      if (destData[d][0].toString() === dateStr.toString()) {
        dateExists = true;
        break;
      }
    }
    
    if (!dateExists) {
      symbolSheet.appendRow(rowData);
    }
  });
}
