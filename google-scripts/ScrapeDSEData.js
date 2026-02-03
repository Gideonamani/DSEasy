/*
  DSE WEBSITE SCRAPER
  Filename: ScrapeDSEData.gs
  
  Instructions:
  1. This script fetches https://dse.co.tz homepage.
  2. Parses the "Market Summary" date.
  3. Parses the "Equity" table data.
  4. Creates a new sheet with the parsed date (e.g., "30Jan2026").
  5. Appends the data.
*/

function scrapeDSEData(interactive = true) {
  const url = "https://dse.co.tz";
  let html;

  try {
    html = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
    }).getContentText();
  } catch (e) {
    if (interactive)
      SpreadsheetApp.getUi().alert("Error fetching DSE website: " + e.message);
    return { success: false, message: "Fetch error: " + e.message };
  }

  // 1. EXTRACT DATA DATE
  const dateRegex =
    /Market Summary\s*:\s*<\/h5>\s*<h5[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/h5>/i;
  const dateMatch = html.match(dateRegex);

  if (!dateMatch) {
    if (interactive)
      SpreadsheetApp.getUi().alert(
        "Could not find Market Summary date on DSE homepage.",
      );
    return { success: false, message: "Date not found in HTML" };
  }

  const rawDateStr = dateMatch[1].trim();
  Logger.log("Found Date: " + rawDateStr);

  let formattedDate = formatDateForSheet(rawDateStr);
  if (!formattedDate) {
    if (interactive)
      SpreadsheetApp.getUi().alert("Could not parse date: " + rawDateStr);
    return { success: false, message: "Date parse failed: " + rawDateStr };
  }

  // 2. CHECK SHEET & PREPARE DESTINATION
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // [PRODUCTION MODE] Removed test prefix for final version
  // formattedDate = "2ndTest" + formattedDate;

  let targetSheet = ss.getSheetByName(formattedDate);
  let sheetCreated = false;

  if (targetSheet) {
    // IF SHEET EXISTS
    if (interactive) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        "Sheet Exists",
        `A sheet named "${formattedDate}" already exists. Do you want to overwrite it?`,
        ui.ButtonSet.YES_NO,
      );
      if (response == ui.Button.NO) {
        return {
          success: true,
          dateStr: formattedDate,
          sheetName: formattedDate,
          exists: true,
          created: false,
          message: "User cancelled overwrite",
        };
      }
      // Interactive YES -> Overwrite
      targetSheet.getRange("A2:M").clearContent();
    } else {
      // Headless -> Assume we are just checking.
      // Optimization: If it exists, we assume we already scraped it today.
      // We return 'exists: true' so the caller knows data is present.
      return {
        success: true,
        dateStr: formattedDate,
        sheetName: formattedDate,
        exists: true,
        created: false,
        message: "Sheet already exists",
      };
    }
  } else {
    // CREATE NEW (TEMPLATE OR BLANK)
    const templateName = "_##2026";
    const templateSheet = ss.getSheetByName(templateName);

    if (templateSheet) {
      targetSheet = templateSheet.copyTo(ss).setName(formattedDate);
      targetSheet.getRange("A2:M").clearContent();
    } else {
      targetSheet = ss.insertSheet(formattedDate);
      const headers = [
        "Symbol",
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
      ];
      targetSheet.appendRow(headers);
      targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
    sheetCreated = true;
  }

  // 3. EXTRACT TABLE DATA
  const tableStartRegex = /id="equity-watch"[^>]*>[\s\S]*?<tbody[^>]*>/i;
  const tableStartMatch = html.match(tableStartRegex);

  if (!tableStartMatch) {
    if (interactive)
      SpreadsheetApp.getUi().alert("Could not find Equity table in HTML.");
    return { success: false, message: "Equity table not found" };
  }

  const tableContentStart = tableStartMatch.index + tableStartMatch[0].length;
  const htmlAfterTableStart = html.substring(tableContentStart);
  const tbodyEndIndex = htmlAfterTableStart.indexOf("</tbody>");

  if (tbodyEndIndex === -1) {
    if (interactive)
      SpreadsheetApp.getUi().alert("Could not find end of Equity table.");
    return { success: false, message: "Table end not found" };
  }

  const tbodyContent = htmlAfterTableStart.substring(0, tbodyEndIndex);

  // 4. PARSE ROWS
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  const parsedRows = [];

  while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
    const rowInnerHtml = rowMatch[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowInnerHtml)) !== null) {
      let content = cellMatch[1];
      content = content.replace(/<[^>]+>/g, ""); // Remove HTML tags
      content = content.replace(/\s+/g, " ").trim(); // Clean whitespace
      cells.push(content);
    }

    if (cells.length > 0) {
      parsedRows.push(cells);
    }
  }

  if (parsedRows.length === 0) {
    if (interactive)
      SpreadsheetApp.getUi().alert("No data rows found in the table.");
    return { success: false, message: "No data rows found" };
  }

  // 5. WRITE TO SHEET
  const finalData = parsedRows.map((row) => {
    if (row.length < 13) return row;
    return [
      row[0], // Symbol
      parseDseNumber(row[1]),
      parseDseNumber(row[2]),
      parseDseNumber(row[3]),
      parseDseNumber(row[4]),
      parseDseNumber(row[5]),
      parseDseChange(row[6]), // Change
      parseDseNumber(row[7]),
      parseDseNumber(row[8]),
      parseDseNumber(row[9]),
      parseDseNumber(row[10]),
      parseDseNumber(row[11]),
      parseDseNumber(row[12]),
    ];
  });

  if (finalData.length > 0) {
    targetSheet
      .getRange(2, 1, finalData.length, finalData[0].length)
      .setValues(finalData);
  }

  const successMsg = `Import complete! Imported ${finalData.length} symbols to "${formattedDate}".`;
  
  // 6. SYNC & UPDATE CONFIG
  try {
    const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID);
    // formatDateString is in ClosingToSymbols.gs
    // processSheetData is in ClosingToSymbols.gs
    // updateDateConfig is in AdminActions.gs
    
    // Convert "30Jan2026" -> "30 Jan 2026"
    const prettyDate = formatDateString(formattedDate); 
    
    // Sync to Trends Spreadsheet
    processSheetData(targetSheet, destSs, prettyDate);
    
    // Update local config index
    updateDateConfig();
    
    Logger.log("Auto-sync and config update successful.");
  } catch (err) {
    Logger.log("Error during auto-sync: " + err.message);
    if (interactive) {
      SpreadsheetApp.getUi().alert("Data Scraped, but Sync failed: " + err.message);
    }
  }

  if (interactive) SpreadsheetApp.getUi().alert(successMsg + "\n\nAlso synced to Trends & updated Date Config.");

  return {
    success: true,
    dateStr: formattedDate,
    sheetName: targetSheet.getName(),
    created: sheetCreated,
    exists: !sheetCreated,
    message: successMsg,
    rowCount: finalData.length,
  };
}

// HELPER: Convert "January 30, 2026" -> "30Jan2026"
function formatDateForSheet(longDateStr) {
  const parts = longDateStr.replace(/,/g, "").split(" "); // ["January", "30", "2026"]
  if (parts.length < 3) return null;

  const monthNames = {
    January: "Jan",
    February: "Feb",
    March: "Mar",
    April: "Apr",
    May: "May",
    June: "Jun",
    July: "Jul",
    August: "Aug",
    September: "Sep",
    October: "Oct",
    November: "Nov",
    December: "Dec",
  };

  const month = monthNames[parts[0]];
  const day = parts[1];
  const year = parts[2];

  if (!month) return null;

  return `${day}${month}${year}`;
}

// HELPER: "1,200.50" -> 1200.50
function parseDseNumber(str) {
  if (!str) return 0;
  // maintain negative signs if present, remove commas
  const clean = str.replace(/,/g, "").trim();
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

// HELPER: "-▼ -2.48" -> -2.48
function parseDseChange(str) {
  // if (!str) return 0;
  // // Look for the last number in the string which is usually the percentage
  // // The string might contain arrows and signs.
  // // Example: "-▼ -2.48" -> -2.48
  // // Example: "+▲ 0.66" -> 0.66

  // // Regex to find a number (integer or float) potentially preceded by a minus sign
  // // We extract the last number found which seems to be the % change based on observation
  // const match = str.match(/[-+]?\d*\.?\d+/g);
  // if (match && match.length > 0) {
  //   // If there are multiple numbers, the last one is likely the value we want (e.g. if it says - 2.48)
  //   // Actually in "-▼ -2.48" the matches are ["-2.48"] or ["-", "2.48"] depending on spaces
  //   // Let's grab the last match which should be the value
  //   return parseFloat(match[match.length - 1]);
  // }
  // return 0;
  return str;
}
