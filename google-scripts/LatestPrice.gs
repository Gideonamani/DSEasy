/**
 * DSEasy Google Sheets Integration
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Paste this code into the editor.
 * 4. Run the 'setupDSEasy' function once to set your API Key.
 * 5. Use =latestDSEasyPrice("TICKER") in any cell.
 */

const API_BASE_URL = "https://europe-west1-dse-easy.cloudfunctions.net/getTickerPrice";

/**
 * Custom function to get the latest price for a DSE ticker.
 * 
 * @param {string} ticker The stock symbol (e.g. "NMB", "CRDB").
 * @param {any} refreshTrigger Optional: Link this to a cell that changes to force a refresh.
 * @return The latest market price.
 * @customfunction
 */
function latestDSEasyPrice(ticker, refreshTrigger) {
  if (!ticker) return "Enter Ticker";
  
  const tickerUpper = ticker.toString().toUpperCase().trim();
  const cache = CacheService.getScriptCache();
  const cacheKey = "price_" + tickerUpper;
  
  // 1. Check Cache (5 minutes)
  const cachedPrice = cache.get(cacheKey);
  if (cachedPrice && !refreshTrigger) {
    return parseFloat(cachedPrice);
  }
  
  // 2. Get API Key from Script Properties
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('DSEASY_API_KEY');
  
  if (!apiKey) {
    return "Error: Run setupDSEasy() first";
  }
  
  try {
    const url = API_BASE_URL + "?ticker=" + tickerUpper + "&key=" + apiKey;
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const content = JSON.parse(response.getContentText());
    
    if (code === 200) {
      const price = content.price;
      // Store in cache for 5 minutes (300 seconds)
      cache.put(cacheKey, price.toString(), 300);
      return price;
    } else {
      return "Error: " + (content.error || "Unknown");
    }
  } catch (e) {
    return "Error: Connection Failed";
  }
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
 * Forces a refresh of all prices by updating a hidden 'refresh' cell.
 * Note: For this to work, you should call your functions like:
 * =latestDSEasyPrice("NMB", $Z$1) where Z1 is your refresh cell.
 */
function refreshPrices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  // We use a hidden property to track a counter
  const props = PropertiesService.getScriptProperties();
  let count = parseInt(props.getProperty('refresh_count') || "0");
  count++;
  props.setProperty('refresh_count', count.toString());
  
  // Optional: If you want to use a specific cell for triggering, 
  // you can uncomment the line below and set a cell like 'Settings!A1'
  // sheet.getRange('Z1').setValue(count);
  
  SpreadsheetApp.getUi().alert('Refresh triggered! If prices don\'t update immediately, ensure your formulas include a reference to a refresh cell, or simply re-open the sheet.');
}
