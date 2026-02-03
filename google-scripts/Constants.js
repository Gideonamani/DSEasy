/* 
   SHARED CONSTANTS
   Filename: Constants.gs
   
   These values are available to all other script files in this project.
*/

const DESTINATION_SPREADSHEET_ID =
  "1cvCaJod4PPsilu3wcAMosMSapfawlJqL2ddtx2xt9rQ";

// Sheet names to ignore during sync and API scanning
const EXCLUDED_SHEET_NAMES = [
  "Market Summary",
  "Equity",
  "Bonds",
  "template",
  "_config",
  "_config_dates",
];

const DATA_COLUMN_COUNT = 22; // Columns A-V

// Canonical Registry for Symbol Normalization
// Maps "Bad/New Name" -> "Canonical/Old Name"
const SYMBOL_MAPPINGS = {
  "VERTEX-ETF": "VERTEX ETF",
  "IEACLC-ETF": "IEACLC ETF",
  "ITRUST ETF": "IEACLC ETF",
  // Add future renames here as needed
};
