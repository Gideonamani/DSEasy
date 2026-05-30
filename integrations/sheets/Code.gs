/**
 * DSEasy Google Sheets Integration
 *
 * This file is the source-of-truth copy of the Apps Script that consumes the
 * `getTickerPrice` Cloud Function (functions/src/handlers/prices.ts). Apps
 * Script lives in Google's environment, so this file is documentation, not
 * the live code — paste it into Extensions -> Apps Script after editing.
 *
 * Setup:
 * 1. Open your Google Sheet.
 * 2. Extensions -> Apps Script.
 * 3. Paste this code into the editor and save.
 * 4. Run the 'setupDSEasy' function once to set your API Key.
 * 5. Use =latestDSEasyPrice("TICKER", $Z$1) in any cell, where Z1 matches
 *    REFRESH_CELL below (the "Refresh All Prices" menu writes into it).
 */

const API_BASE_URL = "https://europe-west1-dse-easy.cloudfunctions.net/getTickerPrice";
const REFRESH_CELL = "Z1"; // Cell that "Refresh All Prices" writes into.

/**
 * Custom function to get the latest price for a DSE ticker.
 *
 * @param {string} ticker The stock symbol (e.g. "NMB", "CRDB", "IEACLC-ETF").
 * @param {any} refreshTrigger Optional: reference this to a cell that changes
 *                             (e.g. $Z$1) to force a refresh.
 * @return The latest market price, or blank if the ticker isn't tracked.
 * @customfunction
 */
function latestDSEasyPrice(ticker, refreshTrigger) {
  if (!ticker) return "Enter Ticker";

  const tickerUpper = ticker.toString().toUpperCase().trim();
  const cache = CacheService.getScriptCache();
  const cacheKey = "price_" + tickerUpper;
  const notFoundKey = cacheKey + "_404";

  // 1. Positive cache (5 min) — known good price.
  const cachedPrice = cache.get(cacheKey);
  if (cachedPrice && !refreshTrigger) {
    return parseFloat(cachedPrice);
  }

  // 1b. Negative cache (1 min) — already learned this ticker isn't tracked.
  if (cache.get(notFoundKey) && !refreshTrigger) {
    return "";
  }

  // 2. API key
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('DSEASY_API_KEY');
  if (!apiKey) {
    throw new Error("Run setupDSEasy() first to set your API key.");
  }

  // 3. Call the function
  const url = API_BASE_URL + "?ticker=" + encodeURIComponent(tickerUpper) + "&key=" + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  const code = response.getResponseCode();
  let content = {};
  try { content = JSON.parse(response.getContentText()); } catch (_) {}

  if (code === 200) {
    const price = content.price;
    cache.put(cacheKey, price.toString(), 300); // 5 min
    return price;
  }

  if (code === 404) {
    // Unknown / unlisted ticker — leave the cell blank so it doesn't
    // pollute charts or aggregations.
    cache.put(notFoundKey, "1", 60); // 1 min
    return "";
  }

  // Real errors (401, 5xx, network glitches) — surface as a proper #ERROR!
  // with hover text, so they don't look like data.
  throw new Error(content.error || ("HTTP " + code));
}

/**
 * Adds a custom menu to the spreadsheet.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('DSEasy')
      .addItem('Refresh All Prices', 'refreshPrices')
      .addSeparator()
      .addItem('Setup API Key', 'setupDSEasy')
      .addToUi();
}

/**
 * Helper to set up the API Key in Script Properties.
 */
function setupDSEasy() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'DSEasy Setup',
    'Please enter your API Key:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key) {
      PropertiesService.getScriptProperties().setProperty('DSEASY_API_KEY', key);
      ui.alert('Success! API Key has been saved safely.');
    } else {
      ui.alert('Error: Key cannot be empty.');
    }
  }
}

/**
 * Forces a refresh of all prices by writing a new value into REFRESH_CELL.
 * Formulas that reference that cell as their second argument will re-run.
 *
 * Setup: in your sheet, use =latestDSEasyPrice("NMB", $Z$1) (Z1 must match
 * REFRESH_CELL above). The cell can be hidden if you don't want to see it.
 */
function refreshPrices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const props = PropertiesService.getScriptProperties();
  let count = parseInt(props.getProperty('refresh_count') || "0", 10);
  count++;
  props.setProperty('refresh_count', count.toString());

  sheet.getRange(REFRESH_CELL).setValue(count);

  SpreadsheetApp.getUi().alert(
    "Refresh triggered. Make sure your formulas reference " + REFRESH_CELL +
    " as the second argument, e.g. =latestDSEasyPrice(\"NMB\", $Z$1)."
  );
}
