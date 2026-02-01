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

function scrapeDSEData() {
  const url = "https://dse.co.tz";
  const html = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
  }).getContentText();

  // 1. EXTRACT DATA DATE
  // Look for: <h5 class="ms-2 w500"  style="font-size: 14px">January 30, 2026</h5>
  // We'll use a regex that is flexible with attributes
  const dateRegex =
    /Market Summary\s*:\s*<\/h5>\s*<h5[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/h5>/i;
  const dateMatch = html.match(dateRegex);

  if (!dateMatch) {
    SpreadsheetApp.getUi().alert(
      "Could not find Market Summary date on DSE homepage.",
    );
    Logger.log("Error: Date not found in HTML.");
    return;
  }

  const rawDateStr = dateMatch[1].trim(); // e.g., "January 30, 2026"
  Logger.log("Found Date: " + rawDateStr);

  // Convert "January 30, 2026" -> "30Jan2026"
  let formattedDate = formatDateForSheet(rawDateStr);
  if (!formattedDate) {
    SpreadsheetApp.getUi().alert("Could not parse date: " + rawDateStr);
    return;
  }

  // 2. CHECK SHEET & PREPARE DESTINATION
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let targetSheet = ss.getSheetByName(formattedDate);

  if (targetSheet) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      "Sheet Exists",
      `A sheet named "${formattedDate}" already exists. Do you want to overwrite it?`,
      ui.ButtonSet.YES_NO,
    );

    if (response == ui.Button.NO) {
      Logger.log("User cancelled overwrite.");
      return;
    }
    // Clear existing data range only (A-M) to preserve extra columns if they exist
    // Actually, if we overwrite, we might want to start fresh or just clear A-M
    targetSheet.getRange("A2:M").clearContent();
  } else {
    // TEMPLATE STRATEGY
    const templateName = "_##2026";
    const templateSheet = ss.getSheetByName(templateName);

    if (templateSheet) {
      targetSheet = templateSheet.copyTo(ss).setName(formattedDate);
      // Clear any placeholder data in the template's data range (A-M)
      // Assuming headers are in row 1
      targetSheet.getRange("A2:M").clearContent();
    } else {
      // Fallback: Create new if template missing
      targetSheet = ss.insertSheet(formattedDate);
      // Add Headers since new sheet is empty
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
  }

  // 3. EXTRACT TABLE DATA
  // We look for the Equity table. It usually starts after "id=\"equity-watch\""
  const tableStartRegex = /id="equity-watch"[^>]*>[\s\S]*?<tbody[^>]*>/i;
  const tableStartMatch = html.match(tableStartRegex);

  if (!tableStartMatch) {
    SpreadsheetApp.getUi().alert("Could not find Equity table in HTML.");
    return;
  }

  // Slice HTML from the start of the tbody to reduce search space
  const tableContentStart = tableStartMatch.index + tableStartMatch[0].length;
  const htmlAfterTableStart = html.substring(tableContentStart);
  const tbodyEndIndex = htmlAfterTableStart.indexOf("</tbody>");

  if (tbodyEndIndex === -1) {
    SpreadsheetApp.getUi().alert("Could not find end of Equity table.");
    return;
  }

  const tbodyContent = htmlAfterTableStart.substring(0, tbodyEndIndex);

  // 4. PARSE ROWS
  // Each row is within <tr>...</tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  const parsedRows = [];

  while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
    const rowInnerHtml = rowMatch[1];

    // Extract cells <td>...</td>
    // DSE table has 13 columns based on inspection
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

  Logger.log("Parsed " + parsedRows.length + " rows.");

  if (parsedRows.length === 0) {
    SpreadsheetApp.getUi().alert("No data rows found in the table.");
    return;
  }

  // 5. WRITE TO SHEET
  const finalData = parsedRows.map((row) => {
    // Map extracted strings to correct format (Columns A-M)
    if (row.length < 13) return row;

    return [
      row[0], // Symbol
      parseDseNumber(row[1]),
      parseDseNumber(row[2]),
      parseDseNumber(row[3]),
      parseDseNumber(row[4]),
      parseDseNumber(row[5]),
      parseDseChange(row[6]), // Change (text or number)
      parseDseNumber(row[7]),
      parseDseNumber(row[8]),
      parseDseNumber(row[9]),
      parseDseNumber(row[10]),
      parseDseNumber(row[11]),
      parseDseNumber(row[12]),
    ];
  });

  if (finalData.length > 0) {
    // Overwrite A2:M... with new data
    targetSheet
      .getRange(2, 1, finalData.length, finalData[0].length)
      .setValues(finalData);
  }

  SpreadsheetApp.getUi().alert(
    `Import complete! Correctly imported ${finalData.length} symbols to sheet "${formattedDate}" (Template Used: ${targetSheet.getName() !== formattedDate ? "No" : "Yes"}).`,
  );
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
