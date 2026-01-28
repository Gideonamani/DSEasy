/*
  BACKEND API FOR SPREADSHEETY (Lazy Loading)
  Filename: Code.gs
  
  Instructions:
  1. Paste this into your Google Apps Script project (e.g., named "Code.gs").
  2. Deploy -> New Deployment -> Web App.
  3. Set "Who has access" to "Anyone".
*/

function doGet(e) {
  const params = e.parameter;
  const action = params.action; // 'getDates' or 'getData'
  
  if (action === 'getDates') {
    return getAvailableDates();
  } 
  
  if (action === 'getData') {
    const dateStr = params.date;
    return getDayData(dateStr);
  }
  
  // Default fallback
  return ContentService.createTextOutput(JSON.stringify({error: "Invalid Action"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// 1. Function to get list of sheets (Dates)
function getAvailableDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const dateList = [];
  
  // Excluded list
  const EXCLUDED = ['Market Summary', 'Equity', 'Bonds', 'template', '_config'];
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    // Rule: Exclude if starts with "_" OR is in excluded list
    if (!name.startsWith('_') && !EXCLUDED.includes(name)) {
      dateList.push(name);
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
  
  // Get Columns A to N (14 columns)
  // Index 0 = A ... Index 13 = N (Change Value)
  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  
  const formattedData = data.map(row => {
    return {
      symbol: row[0],
      open: Number(row[1]) || 0,
      prevClose: Number(row[2]) || 0,
      close: Number(row[3]) || 0,
      high: Number(row[4]) || 0,
      low: Number(row[5]) || 0,
      
      // We use Col N (Index 13) for the numeric Change Value to preserve negatives correctly
      change: Number(row[13]) || 0, 
      
      turnover: Number(row[7]) || 0,
      deals: Number(row[8]) || 0,
      volume: Number(row[11]) || 0,
      mcap: Number(row[12]) || 0
    };
  });
  
  return jsonResponse(formattedData);
}

// Helper: Standard JSON Response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
