require('dotenv').config();
const admin = require('firebase-admin');
const { google } = require('googleapis');
const fs = require('fs');

// CONFIG
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
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
      const headers = rows[0]; // Assuming standard headers
      // Map columns based on index (A=0, B=1...)
      // Symbols=0, Open=1, Close=3, High=4, Low=5, Volume=11, MCAP=12
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const symbol = row[0];
        if (!symbol || symbol === 'Total') continue;
        
        const stockData = {
          symbol: symbol,
          open: parseNum(row[1]),
          prevClose: parseNum(row[2]),
          close: parseNum(row[3]),
          high: parseNum(row[4]),
          low: parseNum(row[5]),
          change: row[6], // Text usually
          turnover: parseNum(row[7]),
          deals: parseNum(row[8]),
          volume: parseNum(row[11]),
          mcap: parseNum(row[12]),
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
        
        // 3. Update symbol config (Trends parent doc)
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

async function getSheetData(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
  });
  return res.data.values || [];
}

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove commas, spaces
  const clean = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

migrate();
