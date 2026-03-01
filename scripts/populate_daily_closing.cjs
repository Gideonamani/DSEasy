/**
 * populate_daily_closing.cjs
 *
 * Reads all records from trends/{symbol}/dailyClosingHistory/{date}
 * and pivots them into dailyClosing/{date}/stocks/{symbol}.
 *
 * Also updates config/app.availableDates with all unique dates found.
 *
 * Uses { merge: true } so existing scraper records (with richer fields
 * like deals, outstandingBid) are NOT overwritten by sparser API records.
 *
 * Safe to re-run — idempotent.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ serviceAccountKey.json not found.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const db = admin.firestore();
const BATCH_SIZE = 400;

async function populateDailyClosing() {
  console.log('🚀 Populating dailyClosing from dailyClosingHistory\n');

  // 1. Read all symbols
  const trendsSnap = await db.collection('trends').get();
  const symbols = trendsSnap.docs.map(d => d.id);
  console.log(`Found ${symbols.length} symbols\n`);

  // Group all records by date: { "2024-01-26": [ {symbol, ...data}, ... ] }
  const byDate = {};
  let totalRead = 0;

  for (const symbol of symbols) {
    process.stdout.write(`Reading ${symbol}... `);

    const histSnap = await db
      .collection('trends')
      .doc(symbol)
      .collection('dailyClosingHistory')
      .get();

    if (histSnap.empty) {
      console.log('(empty)');
      continue;
    }

    console.log(`${histSnap.size} records`);

    for (const doc of histSnap.docs) {
      const dateId = doc.id;
      const data = doc.data();

      if (!byDate[dateId]) byDate[dateId] = [];

      // Build a clean stock record — omit null/undefined fields
      const stock = { symbol };
      const fields = ['open', 'close', 'high', 'low', 'volume', 'turnover', 'mcap',
        'change', 'changeValue', 'prevClose', 'deals', 'outstandingBid',
        'outstandingOffer', 'highLowSpread', 'volPerDeal', 'turnoverPerDeal',
        'turnoverPerMcap', 'turnoverPercent', 'changePerVol', 'bidOfferRatio',
        'source'];

      for (const f of fields) {
        if (data[f] !== null && data[f] !== undefined) {
          stock[f] = data[f];
        }
      }

      byDate[dateId].push(stock);
      totalRead++;
    }
  }

  const allDates = Object.keys(byDate).sort();
  console.log(`\nGrouped into ${allDates.length} unique dates (${totalRead} total records)`);
  console.log(`Date range: ${allDates[0]} → ${allDates[allDates.length - 1]}\n`);

  // 2. Write to dailyClosing/{date}/stocks/{symbol}
  let totalWritten = 0;
  let batch = db.batch();
  let opCount = 0;
  let dateCount = 0;

  for (const dateId of allDates) {
    const stocks = byDate[dateId];

    // Parent doc: dailyClosing/{date}
    const dailyRef = db.collection('dailyClosing').doc(dateId);
    batch.set(dailyRef, {
      date: dateId,
      stockCount: stocks.length,
    }, { merge: true });
    opCount++;

    // Stock subdocs
    for (const stock of stocks) {
      const stockRef = dailyRef.collection('stocks').doc(stock.symbol);
      batch.set(stockRef, stock, { merge: true });
      opCount++;
      totalWritten++;

      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
        process.stdout.write('.');
      }
    }

    dateCount++;
    if (dateCount % 100 === 0) {
      process.stdout.write(`[${dateCount}/${allDates.length}]`);
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`\n\n✅ Wrote ${totalWritten} stock docs across ${allDates.length} dates`);

  // 3. Update config/app.availableDates
  console.log('\nUpdating config/app.availableDates...');
  await db.collection('config').doc('app').set(
    { availableDates: allDates },
    { merge: true }
  );

  console.log('\n==============================');
  console.log('✅ dailyClosing population complete!');
  console.log(`   Unique dates     : ${allDates.length}`);
  console.log(`   Stock docs       : ${totalWritten}`);
  console.log(`   Date range       : ${allDates[0]} → ${allDates[allDates.length - 1]}`);
  console.log(`   availableDates   : updated (${allDates.length} entries)`);
  console.log('==============================\n');
}

populateDailyClosing().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
