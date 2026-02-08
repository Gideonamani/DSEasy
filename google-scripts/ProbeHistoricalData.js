/**
 * DSE Historical Data Tools
 * 
 * 1. probeHistoricalData() - Summary table (INCLUDES FULL NAME).
 * 2. fillHistoricalData() - Fetches API data and dumps to sheets (INCLUDES SHARES & MCAP).
 * 3. enrichExistingSheets() - Reads EXISTING sheets and adds derived columns.
 */

// Official Symbol List
const SYMBOLS = [
  "AFRIPRISE", "CRDB", "DCB", "DSE", "EABL", "JATU", "JHL", "KA", "KCB", 
  "MBP", "MCB", "MKCB", "MUCOBA", "NICO", "NMB", "NMG", "PAL", "SWALA", 
  "SWIS", "TBL", "TCC", "TCCL", "TOL", "TPCC", "TTP", "USL", "VODA", 
  "YETU", "VERTEX ETF"
];

const RANGES_TO_TRY = [5000, 2500, 365];

function probeHistoricalData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "HistoricalProbe";
  let sheet = ss.getSheetByName(sheetName);
  
  // Headers Updated to include Full Name
  const headers = ["Symbol", "Full Name", "First Date", "Last Date", "Total Records", "Status", "Last Checked"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    // Clear data only
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    // Update header row in case it changed
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const results = [];

  SYMBOLS.forEach(rawSymbol => {
    Logger.log(`[PROBE] Processing ${rawSymbol}...`);
    const { success, data, message } = fetchAdaptiveData(rawSymbol);

    if (success && data.length > 0) {
      data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
      const first = data[0].trade_date.split('T')[0];
      const last = data[data.length - 1].trade_date.split('T')[0];
      
      // Get Full Name from first record, fallback to rawSymbol
      const fullName = data[0].fullName || data[0].company || rawSymbol;

      results.push([
        rawSymbol, fullName, first, last, data.length, "SUCCESS", new Date()
      ]);
    } else {
      results.push([
        rawSymbol, "-", "-", "-", 0, message || "NO_DATA", new Date()
      ]);
    }
    Utilities.sleep(200);
  });

  if (results.length > 0) {
    sheet.getRange(2, 1, results.length, headers.length).setValues(results);
  }
}

function fillHistoricalData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
  
    SYMBOLS.forEach(rawSymbol => {
        Logger.log(`[FILL] Processing ${rawSymbol}...`);
        const { success, data } = fetchAdaptiveData(rawSymbol);
        
        if (!success || data.length === 0) {
            Logger.log(`  > No data for ${rawSymbol}. Skipping.`);
            return;
        }

        const sheetName = `History_${rawSymbol.replace(/\s+/g, "_")}`;
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.insertSheet(sheetName);
        else sheet.clear();

        data.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
        
        // Define Headers explicitly to include SHARES and MCAP
        let headers = [
            "trade_date", "company",  // Removed fullName
            "closing_price", "opening_price", "high", "low", 
            "volume", "turnover", 
            "shares_in_issue", "market_cap"
        ];
        
        const outputRows = [headers];
        
        data.forEach(row => {
            const rowData = headers.map(h => {
                if (h === "trade_date") {
                    return row[h] ? row[h].split('T')[0] : "";
                }
                return row[h] !== undefined ? row[h] : "";
            });
            outputRows.push(rowData);
        });

        if (outputRows.length > 0) {
            sheet.getRange(1, 1, outputRows.length, headers.length).setValues(outputRows);
            // Bold Headers
            sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
            // Format Numbers
            const count = outputRows.length - 1;
            // Columns 3-6 (Prices), 7-8 (Vol), 9-10 (Shares/MCAP) -> Indices match 1-based column numbers
            // Price: Col 3, 4, 5, 6
            sheet.getRange(2, 3, count, 8).setNumberFormat("#,##0");
        }
        Utilities.sleep(1000);
    });
    Logger.log("[FILL] All data dumps complete.");
}

/**
 * 3. ENRICH FUNCTION (Post-Processing)
 * Reads existing "History_X" sheets and adds derived columns.
 * NOW INCLUDES MARKET CAP CALCULATION if missing.
 */
function enrichExistingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  SYMBOLS.forEach(rawSymbol => {
    const sheetName = `History_${rawSymbol.replace(/\s+/g, "_")}`;
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return;

    Logger.log(`[ENRICH] Processing ${sheetName}...`);
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length < 2) return;
    
    const headers = values[0];
    const dataRows = values.slice(1);
    
    // Map Column Indices
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);
    
    // Check required columns
    if (colMap['closing_price'] === undefined) return;

    // Derived Headers
    const newHeaders = [
      "Prev Close", 
      "ChangeAbs", 
      "ChangeVal", 
      "High/Low Spread", 
      "Change/Vol", 
      "Turnover/MCAP",
      "Calculated MCAP (Billions)"
    ];
    
    const enrichedRows = dataRows.map((row, i) => {
        const close = Number(row[colMap['closing_price']]) || 0;
        const open = Number(row[colMap['opening_price']]) || 0;
        const high = Number(row[colMap['high']]) || 0;
        const low = Number(row[colMap['low']]) || 0;
        const vol = Number(row[colMap['volume']]) || 0;
        const turnover = Number(row[colMap['turnover']]) || 0;
        
        // Handle explicit market_cap or shares
        const existingMcap = row[colMap['market_cap']] ? Number(row[colMap['market_cap']]) : 0;
        const shares = row[colMap['shares_in_issue']] ? Number(row[colMap['shares_in_issue']]) : 0;

        // Prev Close
        let prevClose = open;
        if (i > 0) {
            const prevRow = dataRows[i-1];
            prevClose = Number(prevRow[colMap['closing_price']]) || 0;
        }

        // Change
        const change = close - prevClose;
        const changePercent = prevClose > 0 ? change / prevClose : 0;
        const spread = high - low;
        const changeVol = vol > 0 ? change / vol : 0;
        
        // MCAP Logic: Use existing or calculate from shares
        let finalMcap = existingMcap;
        if (finalMcap === 0 && shares > 0) {
            finalMcap = close * shares;
        }
        
        const turnMcap = finalMcap > 0 ? turnover / finalMcap : 0;
        const mcapBillions = finalMcap / 1000000000;

        return [
            prevClose,
            change,
            changePercent,
            spread,
            changeVol,
            turnMcap,
            mcapBillions
        ];
    });

    // Write New Columns
    const startCol = headers.length + 1;
    sheet.getRange(1, startCol, 1, newHeaders.length).setValues([newHeaders]).setFontWeight("bold");
    sheet.getRange(2, startCol, enrichedRows.length, newHeaders.length).setValues(enrichedRows);

    // Formatting
    // Change % (Index 2) -> startCol + 2
    sheet.getRange(2, startCol + 2, enrichedRows.length, 1).setNumberFormat("0.00%");
    // MCAP Billions (Index 6) -> startCol + 6
    sheet.getRange(2, startCol + 6, enrichedRows.length, 1).setNumberFormat("#,##0.00");
    
    Logger.log(`  > Enriched ${enrichedRows.length} rows.`);
  });
  
  Logger.log("[ENRICH] Complete.");
}

function fetchAdaptiveData(rawSymbol) {
    const symbolEncoded = encodeURIComponent(rawSymbol);
    for (const days of RANGES_TO_TRY) {
      try {
        const url = `https://dse.co.tz/api/get/market/prices/for/range/duration?security_code=${symbolEncoded}&days=${days}&class=EQUITY`;
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (response.getResponseCode() === 200) {
            let content = response.getContentText().trim();
            const json = JSON.parse(content);
            let d = Array.isArray(json) ? json : (json.data || []);
            if (d.length > 0) return { success: true, data: d };
        }
      } catch (e) {}
      Utilities.sleep(200);
    }
    return { success: false, data: [] };
}
