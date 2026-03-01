/**
 * migrate_dates.cjs
 *
 * One-time migration: converts all existing dailyClosingHistory document IDs
 * from DDMonYYYY (e.g., "26Jan2026") to ISO YYYY-MM-DD (e.g., "2026-01-26").
 *
 * For each doc:
 * 1. Reads the old doc
 * 2. Creates a new doc with the ISO date ID and updates the 'date' field
 * 3. Deletes the old doc
 *
 * Safe to re-run — if a doc is already ISO formatted, it's skipped.
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

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Convert "26Jan2026" -> "2026-01-26"
 * Returns null if already ISO or unrecognized.
 */
function toISO(docId) {
  // Already ISO? Skip.
  if (/^\d{4}-\d{2}-\d{2}$/.test(docId)) return null;

  const match = docId.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const month = MONTHS[match[2].toLowerCase()];
  const year = match[3];

  if (!month) return null;
  return `${year}-${month}-${day}`;
}

async function migrateDates() {
  console.log('🚀 Converting dailyClosingHistory doc IDs → ISO YYYY-MM-DD\n');

  const trendsSnap = await db.collection('trends').get();
  const symbols = trendsSnap.docs.map(d => d.id);
  console.log(`Found ${symbols.length} symbols\n`);

  let totalConverted = 0;
  let totalSkipped = 0;

  for (const symbol of symbols) {
    process.stdout.write(`Processing ${symbol}... `);

    const colRef = db.collection('trends').doc(symbol).collection('dailyClosingHistory');
    const snap = await colRef.get();

    if (snap.empty) {
      console.log('(empty)');
      continue;
    }

    let batch = db.batch();
    let opCount = 0;
    let converted = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      const isoDate = toISO(doc.id);

      if (!isoDate) {
        // Already ISO or unrecognized — skip
        skipped++;
        totalSkipped++;
        continue;
      }

      const data = doc.data();

      // Create new doc with ISO ID
      const newRef = colRef.doc(isoDate);
      batch.set(newRef, { ...data, date: isoDate });
      opCount++;

      // Delete old doc
      batch.delete(doc.ref);
      opCount++;

      converted++;
      totalConverted++;

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

    console.log(`  ✅ Converted: ${converted} | Skipped: ${skipped}`);
  }

  console.log('\n==============================');
  console.log('✅ Date format migration complete!');
  console.log(`   Docs converted : ${totalConverted}`);
  console.log(`   Docs skipped   : ${totalSkipped} (already ISO)`);
  console.log('==============================\n');
}

migrateDates().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
