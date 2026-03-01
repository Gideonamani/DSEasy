/**
 * migrate_historical_api.cjs
 *
 * Reads from Google Sheets History_{SYMBOL} tabs (populated by fillHistoricalData()
 * in ProbeHistoricalData.js) and writes records to:
 *
 *   trendsHistorical/{symbol}/history/{YYYY-MM-DD}
 *
 * Also seeds trends/{symbol}.sharesInIssue from the latest available API record.
 *
 * This is a STAGING import — data goes to 'trendsHistorical', NOT 'trends'.
 * A later merge step will reconcile this with our scraper data in 'trends'.
 *
 * Safe to re-run: uses batch.set() — idempotent.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');
// The historical sheet is separate from the daily sheet in .env
const SPREADSHEET_ID = '1ugijIyiTSEWVOJDTWvmbJghQWk27kzJPH4ztC9Pa3sI';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ serviceAccountKey.json not found.');
  process.exit(1);
}
if (!SPREADSHEET_ID) {
  console.error('❌ SPREADSHEET_ID not found in .env');
  process.exit(1);
}

// All symbols matching the History_{SYMBOL} sheet naming convention
const SYMBOLS = [
  'AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'JATU', 'JHL', 'KA', 'KCB',
  'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'NMG', 'PAL', 'SWALA',
  'SWIS', 'TBL', 'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VODA',
  'YETU', 'VERTEX_ETF',  // Sheet uses underscore for space
];

const BATCH_SIZE = 400;

// ── INITIALIZE ───────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});
const db = admin.firestore();

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ── HELPERS ──────────────────────────────────────────────────────────────────
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Normalise a trade_date string into a YYYY-MM-DD document ID.
 * Handles:  "2024-01-26T00:00:00" → "2024-01-26"
 *           "2024-01-26"          → "2024-01-26"
 */
function normaliseDate(raw) {
  if (!raw) return null;
  return String(raw).split('T')[0];
}

async function getSheetData(sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });
    return res.data.values || [];
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      return null; // Sheet doesn't exist
    }
    throw err;
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function importHistoricalAPI() {
  console.log('🚀 Starting historical API import → trendsHistorical\n');

  let totalSymbols = 0;
  let totalDocs    = 0;
  let totalSkipped = 0;

  for (const symbolKey of SYMBOLS) {
    // Sheet name uses underscore for spaces (VERTEX_ETF), firestore symbol uses space
    const sheetName = `History_${symbolKey}`;
    const symbol    = symbolKey.replace(/_/g, ' '); // "VERTEX ETF"

    process.stdout.write(`Processing ${symbol} (sheet: ${sheetName})... `);

    const rows = await getSheetData(sheetName);

    if (rows === null) {
      console.log(`⚠️  Sheet not found — skipping`);
      totalSkipped++;
      continue;
    }

    if (rows.length < 2) {
      console.log(`⚠️  No data rows — skipping`);
      totalSkipped++;
      continue;
    }

    // Parse header row → column index map
    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const col = {};
    headers.forEach((h, i) => col[h] = i);

    // Validate required columns
    if (col['trade_date'] === undefined || col['closing_price'] === undefined) {
      console.log(`⚠️  Missing required columns (trade_date / closing_price) — skipping`);
      totalSkipped++;
      continue;
    }

    const dataRows = rows.slice(1);
    console.log(`${dataRows.length} rows`);

    let batch   = db.batch();
    let opCount = 0;
    let latestSharesInIssue = 0;
    let latestDateSeen      = '';

    for (const row of dataRows) {
      const rawDate = row[col['trade_date']];
      const dateId  = normaliseDate(rawDate);
      if (!dateId) continue;

      const close       = parseNum(row[col['closing_price']]);
      const open        = parseNum(row[col['opening_price']] ?? row[col['opening_price']]);
      const high        = parseNum(row[col['high']]);
      const low         = parseNum(row[col['low']]);
      const volume      = parseNum(row[col['volume']]);
      const turnover    = parseNum(row[col['turnover']]);
      const sharesInIssue  = parseNum(row[col['shares_in_issue']]);
      const marketCap   = parseNum(row[col['market_cap']]);

      // Track latest sharesInIssue for seeding parent doc
      if (sharesInIssue > 0 && dateId > latestDateSeen) {
        latestSharesInIssue = sharesInIssue;
        latestDateSeen      = dateId;
      }

      const record = {
        date:         dateId,
        symbol:       symbol,
        source:       'api',
        open:         open,
        close:        close,
        high:         high,
        low:          low,
        volume:       volume,
        turnover:     turnover,
        sharesInIssue: sharesInIssue || null,
        mcap:         marketCap || null,
        // Fields only in scraper data — null for API records
        prevClose:         null,
        change:            null,
        changeValue:       null,
        deals:             null,
        outstandingBid:    null,
        outstandingOffer:  null,
      };

      const docRef = db
        .collection('trendsHistorical')
        .doc(symbol)
        .collection('history')
        .doc(dateId);

      batch.set(docRef, record);
      opCount++;
      totalDocs++;

      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch   = db.batch();
        opCount = 0;
        process.stdout.write('.');
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    // Seed parent trends/{symbol} with sharesInIssue from the latest API record
    if (latestSharesInIssue > 0) {
      await db.collection('trends').doc(symbol).set(
        {
          sharesInIssue:    latestSharesInIssue,
          sharesUpdatedAt:  latestDateSeen,
          sharesSource:     'api',
        },
        { merge: true }
      );
      console.log(`  ✅ Imported ${dataRows.length} records | sharesInIssue: ${latestSharesInIssue.toLocaleString()}`);
    } else {
      console.log(`  ✅ Imported ${dataRows.length} records | sharesInIssue: not available`);
    }

    // Also create/update the trendsHistorical parent doc
    await db.collection('trendsHistorical').doc(symbol).set(
      { symbol, lastImported: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    totalSymbols++;
  }

  console.log('\n==============================');
  console.log('✅ Historical API import complete!');
  console.log(`   Symbols imported : ${totalSymbols}`);
  console.log(`   Symbols skipped  : ${totalSkipped}`);
  console.log(`   Total docs       : ${totalDocs}`);
  console.log('==============================\n');
  console.log('Next step: run migrate_merge.cjs to reconcile trendsHistorical with trends.');
}

importHistoricalAPI().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
