/*
   ADMINISTRATION & CONFIGURATION ACTIONS
   Filename: AdminActions.gs
   
   Handles the custom menu and configuration tasks.
*/

// --- CUSTOM MENU (Runs automatically when spreadsheet opens) ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📊 Trends Sync")
    .addItem("Sync Latest Day", "syncDailyToTrends")
    .addSeparator()
    .addItem("Backfill All History", "backfillAllHistory")
    .addSeparator()
    .addItem("⚙️ Update Date Config", "updateDateConfig")
    .addSeparator()
    .addItem("🌍 Scrape DSE Data", "scrapeDSEData")
    .addSeparator()
    .addItem("⚠️ Undo Last Sync", "undoLastSync")
    .addToUi();
}

// 0. UNDO LAST SYNC (Deletes last row from each symbol sheet)
function undoLastSync() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "⚠️ Undo Last Sync",
    "This will DELETE the last row from EVERY symbol sheet in the Trends spreadsheet.\n\nAre you sure?",
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    ui.alert("Cancelled", "No changes were made.", ui.ButtonSet.OK);
    return;
  }

  const destSs = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID); // Uses constant
  const sheets = destSs.getSheets();
  let deletedCount = 0;

  sheets.forEach((sheet) => {
    const name = sheet.getName();
    if (name.startsWith("_")) return; // Skip system/config sheets

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Keep header row (row 1)
      sheet.deleteRow(lastRow);
      deletedCount++;
    }
  });

  ui.alert(
    "✅ Undo Complete",
    `Deleted the last row from ${deletedCount} symbol sheets.`,
    ui.ButtonSet.OK,
  );
  Logger.log(`Undo: Deleted last row from ${deletedCount} sheets`);
}

// --- HELPER: Parse "26Jan2026" -> Date Object ---
function parseSheetDate(sheetName) {
  const regex = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/;
  const match = sheetName.match(regex);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    const year = parseInt(match[3], 10);

    const months = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    return new Date(year, months[monthStr], day);
  }
  return null;
}

// 4. UPDATE DATE CONFIG (Scans sheets and updates _config_dates)
function updateDateConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const configSheetName = "_config_dates";
  let configSheet = ss.getSheetByName(configSheetName);

  if (!configSheet) {
    configSheet = ss.insertSheet(configSheetName);
    configSheet.hideSheet(); // Hide it so it doesn't clutter
  }

  // Clear old data
  configSheet.clear();
  configSheet.appendRow(["DateValue", "SheetName"]);

  const validDates = [];

  sheets.forEach((sheet) => {
    const name = sheet.getName();
    if (!name.startsWith("_") && !EXCLUDED_SHEET_NAMES.includes(name)) {
      // Uses constant
      const dateObj = parseSheetDate(name);
      if (dateObj) {
        validDates.push({ date: dateObj, name: name });
      }
    }
  });

  // Sort descending (Newest first)
  validDates.sort((a, b) => b.date - a.date);

  // Write to sheet
  if (validDates.length > 0) {
    const output = validDates.map((d) => [d.date, d.name]);

    // Format column A as Date (yyyy-mm-dd)
    configSheet.getRange(2, 1, output.length, 1).setNumberFormat("yyyy-mm-dd");
    // Format column B as Plain Text (@) to prevent auto-conversion of "29Jan2026" to date
    configSheet.getRange(2, 2, output.length, 1).setNumberFormat("@");

    configSheet.getRange(2, 1, output.length, 2).setValues(output);
  }

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "✅ Config Updated",
    `Found and indexed ${validDates.length} date sheets.`,
    ui.ButtonSet.OK,
  );
}
