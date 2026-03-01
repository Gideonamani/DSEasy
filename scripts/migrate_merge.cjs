/**
 * migrate_merge.cjs
 *
 * Reads 54k+ normalized historical API records from trendsHistorical/{symbol}/history/{date}
 * and merges them into the active trends/{symbol}/dailyClosingHistory/{date} collection.
 * 
 * Uses { merge: true } so we never overwrite fields unique to the daily scraper 
 * (like 'deals', 'outstandingBid', etc) if the scraper happens to run on the same day.
 * 
 * We write exactly to YYYY-MM-DD document IDs because that's what the daily scraper uses.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ serviceAccountKey.json not found.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
});

const db = admin.firestore();
const BATCH_SIZE = 400;

async function mergeHistoricalData() {
  console.log('🚀 Starting merge: trendsHistorical → dailyClosingHistory\n');

  // We loop over all symbols in trendsHistorical
  const histSnap = await db.collection('trendsHistorical').get();
  const symbols = histSnap.docs.map(d => d.id);
  
  if (symbols.length === 0) {
    console.log("No data found in trendsHistorical.");
    return;
  }

  let totalMerged = 0;

  for (const symbol of symbols) {
    process.stdout.write(`Merging ${symbol}... `);
    
    const recordsSnap = await db
      .collection('trendsHistorical')
      .doc(symbol)
      .collection('history')
      .get();

    if (recordsSnap.empty) {
      console.log("(no records)");
      continue;
    }

    let batch = db.batch();
    let opCount = 0;

    for (const doc of recordsSnap.docs) {
      const data = doc.data();
      const dateId = doc.id; // YYYY-MM-DD — our new standard format

      const targetRef = db
        .collection('trends')
        .doc(symbol)
        .collection('dailyClosingHistory')
        .doc(dateId);

      // We explicitly merge. If the daily scraper already has a doc here,
      // this adds the 'api' fields (like sharesInIssue, mcap) without nuking 
      // the scraper's unique fields (deals, spread, etc).
      batch.set(targetRef, data, { merge: true });
      opCount++;
      totalMerged++;

      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
        process.stdout.write('.');
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    console.log(`  ✅ Merged ${recordsSnap.size} records`);
  }

  console.log('\n==============================');
  console.log(`✅ Merge complete!`);
  console.log(`   Symbols processed : ${symbols.length}`);
  console.log(`   Total docs merged : ${totalMerged}`);
  console.log('==============================\n');
}

mergeHistoricalData().catch(err => {
  console.error('❌ Merge failed:', err);
  process.exit(1);
});
