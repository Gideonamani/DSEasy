require('dotenv').config();
const admin = require('firebase-admin');
const { google } = require('googleapis');
const fs = require('fs');

// CONFIG
const path = require('path');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ Error: serviceAccountKey.json not found in root directory.");
  process.exit(1);
}

if (!SPREADSHEET_ID) {
  console.error("❌ Error: SPREADSHEET_ID not found in .env");
  process.exit(1);
}

// INITIALIZE FIREBASE
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// INITIALIZE GOOGLE SHEETS
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function migrate() {
  console.log("🚀 Starting Migration...");
  
  try {
    // 1. Get all sheet names
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetNames = meta.data.sheets
      .map(s => s.properties.title)
      .filter(title => !title.startsWith('_') && !['template', 'Market Summary', 'Equity'].includes(title));
      
    console.log(`Found ${sheetNames.length} daily sheets to migrate.`);
    
    const validDates = [];
    const batchSize = 500;
    let batch = db.batch();
    let opCount = 0;
    
    // 2. Process each sheet
    for (const sheetName of sheetNames) {
      console.log(`\nProcessing ${sheetName}...`);
      
      // Parse date: "26Jan2026"
      // We'll keep the sheet name as ID for simplicity, or format to YYYY-MM-DD
      // Let's stick to sheet name as ID to match legacy, OR format properly
      // Plan said {date} document. Let's try to parse it.
      // Expected format: DMMMYYYY (e.g. 30Jan2026)
      
      const rows = await getSheetData(sheetName);
      if (rows.length < 2) continue; // Empty or just header
      
      validDates.push(sheetName);
      
      // Create MarketData Document
      const marketDocRef = db.collection('marketData').doc(sheetName);
      batch.set(marketDocRef, {
        date: sheetName,
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
        stockCount: rows.length - 1
      });
      opCount++;
      
      // Process Rows (skip header)
      // First pass: Calculate Day Totals for % metrics
      let dayTotalTurnover = 0;
      const validRows = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || row[0] === 'Total') continue;
        const to = parseNum(row[7]);
        dayTotalTurnover += to;
        validRows.push(row);
      }
      
      for (const row of validRows) {
        const symbol = row[0];
        
        const open = parseNum(row[1]);
        const prevClose = parseNum(row[2]);
        const close = parseNum(row[3]);
        const high = parseNum(row[4]);
        const low = parseNum(row[5]);
        const turnover = parseNum(row[7]);
        const deals = parseNum(row[8]);
        const osBid = parseNum(row[9]);   // Out Standing Bid
        const osOffer = parseNum(row[10]); // Out Standing Offer
        const volume = parseNum(row[11]);
        const mcap = parseNum(row[12]);

        // Derived Metrics
        const changeVal = parseChangeVal(row[6]); 
        const highLowSpread = high - low;
        const volPerDeal = deals > 0 ? volume / deals : 0;
        const turnoverPerDeal = deals > 0 ? turnover / deals : 0;
        const turnoverPerMcap = mcap > 0 ? turnover / (mcap * 1000000000) : 0; // MCAP is in Billions usually? "TZS 'B" -> Billion. Turnover is TZS? 
        // Let's assume raw ratio is enough or handle unit scale if known. keeping raw ratio for now.
        // Actually MCAP column says "MCAP (TZS 'B)". Turnover says "Turn Over". 
        // If Turnover is absolute and MCAP is Billions, we need to adjust.
        // But let's stick to raw numbers or simple division if user didn't specify units. 
        // Better: Turnover / MCAP (as ratio).
        
        const turnoverPercent = dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0;
        const changePerVol = volume > 0 ? changeVal / volume : 0;
        const bidOfferRatio = osOffer > 0 ? osBid / osOffer : 0;

        const stockData = {
          symbol: symbol,
          open, prevClose, close, high, low,
          change: row[6],
          changeValue: changeVal,
          turnover, deals,
          outstandingBid: osBid,
          outstandingOffer: osOffer,
          volume, mcap,
          // Extra Metrics
          highLowSpread,
          volPerDeal,
          turnoverPerDeal,
          turnoverPerMcap,
          turnoverPercent,
          changePerVol,
          bidOfferRatio
        };
        
        // 1. Write to marketData/{date}/stocks/{symbol}
        const stockRef = marketDocRef.collection('stocks').doc(symbol);
        batch.set(stockRef, stockData);
        opCount++;
        
        // 2. Write to trends/{symbol}/history/{date}
        const trendsRef = db.collection('trends').doc(symbol).collection('history').doc(sheetName);
        batch.set(trendsRef, {
          date: sheetName,
          ...stockData
        });
        opCount++;
        
        // 3. Update symbol config
        const symbolRef = db.collection('trends').doc(symbol);
        batch.set(symbolRef, { 
          symbol: symbol,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        opCount++;
        
        if (opCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
          process.stdout.write('.');
        }
      }
    }
    
    // Commit remaining
    if (opCount > 0) await batch.commit();
    
    // 3. Write Config
    console.log("\n\nWriting Config...");
    await db.collection('config').doc('app').set({
      availableDates: validDates,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log("✅ Migration Complete!");
    
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

function parseChangeVal(str) {
  if (!str) return 0;
  // Match number at the end: "-▼ -2.48" -> -2.48
  // Or just parsed number. 
  // Regex: Find signed float
  const matches = str.match(/[-+]?\d*\.?\d+/g);
  if (matches && matches.length > 0) {
    return parseFloat(matches[matches.length - 1]);
  }
  return 0;
}

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove commas, spaces
  const clean = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

async function getSheetData(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
  });
  return res.data.values || [];
}

migrate();
