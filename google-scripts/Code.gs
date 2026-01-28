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
  
// Helper to remove commas and parse number
  const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '');
    return Number(clean) || 0;
  };

  const formattedData = data.map(row => {
    return {
      symbol: row[0],
      open: parseNumber(row[1]),
      prevClose: parseNumber(row[2]),
      close: parseNumber(row[3]),
      high: parseNumber(row[4]),
      low: parseNumber(row[5]),
      
      // We use Col N (Index 13) for the numeric Change Value to preserve negatives correctly
      change: parseNumber(row[13]), 
      
      turnover: parseNumber(row[7]),
      deals: parseNumber(row[8]),
      volume: parseNumber(row[11]),
      mcap: parseNumber(row[12]) * 1000000000 // Scale: Billions -> Units
    };
  });
  
  return jsonResponse(formattedData);
}

// Helper: Standard JSON Response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
