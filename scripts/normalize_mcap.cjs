/**
 * normalize_mcap.cjs
 *
 * One-time migration that:
 *   Phase 1: Normalizes MCAP + backfills source in dailyClosingHistory (2026+)
 *   Phase 2: Normalizes MCAP + backfills source in dailyClosing/stocks (2026+)
 *   Phase 3: Moves old-format date docs (e.g. "20Jan2026") from dailyClosing
 *            to legacyDailyClosing, then deletes the originals.
 *
 * Usage:
 *   node scripts/normalize_mcap.cjs [--dry-run]
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');
const DRY_RUN = process.argv.includes('--dry-run');
const CUTOFF_DATE = '2026-01-01';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ serviceAccountKey.json not found.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const db = admin.firestore();
const BATCH_SIZE = 400;

/**
 * Determine if an MCAP value needs normalization (is in Billions).
 */
function needsNormalization(mcap) {
  if (typeof mcap !== 'number' || mcap <= 0) return false;
  return Math.abs(mcap) < 1_000_000;
}

/**
 * Check if a document ID is in the old format (e.g. "20Jan2026", "9Jan2026")
 * vs the ISO format "YYYY-MM-DD".
 */
function isOldDateFormat(docId) {
  // Old format: 1-2 digits + 3-letter month + 4-digit year (e.g. "9Jan2026", "20Feb2026")
  return /^\d{1,2}[A-Za-z]{3}\d{4}$/.test(docId);
}

// ── PHASE 1: Normalize dailyClosingHistory ──────────────────────────────────

async function normalizeHistory() {
  console.log('\n📊 Phase 1: Normalizing trends/{symbol}/dailyClosingHistory (>= ' + CUTOFF_DATE + ')\n');

  const trendsSnap = await db.collection('trends').get();
  const symbols = trendsSnap.docs.map(d => d.id);
  console.log(`Found ${symbols.length} symbols\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalSourceBackfilled = 0;
  let totalMcapNormalized = 0;

  for (const symbol of symbols) {
    process.stdout.write(`  ${symbol}... `);

    const histSnap = await db
      .collection('trends')
      .doc(symbol)
      .collection('dailyClosingHistory')
      .where(admin.firestore.FieldPath.documentId(), '>=', CUTOFF_DATE)
      .get();

    if (histSnap.empty) {
      console.log('(no 2026+ records)');
      continue;
    }

    let batch = db.batch();
    let opCount = 0;
    let symbolUpdated = 0;

    for (const doc of histSnap.docs) {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      if (data.source === 'api') {
        totalSkipped++;
        continue;
      }

      if (!data.source) {
        updates.source = 'scraper';
        totalSourceBackfilled++;
        needsUpdate = true;
      }

      if (needsNormalization(data.mcap)) {
        updates.mcap = data.mcap * 1_000_000_000;
        totalMcapNormalized++;
        needsUpdate = true;
      }

      if (!needsUpdate) {
        totalSkipped++;
        continue;
      }

      if (!DRY_RUN) {
        batch.update(doc.ref, updates);
        opCount++;

        if (opCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
          process.stdout.write('.');
        }
      }

      symbolUpdated++;
      totalUpdated++;
    }

    if (!DRY_RUN && opCount > 0) {
      await batch.commit();
    }

    console.log(`${symbolUpdated} updated, ${histSnap.size - symbolUpdated} skipped (${histSnap.size} total 2026+ docs)`);
  }

  console.log(`\n  ✅ Phase 1 complete:`);
  console.log(`     Docs updated        : ${totalUpdated}`);
  console.log(`     Docs skipped        : ${totalSkipped}`);
  console.log(`     Source backfilled   : ${totalSourceBackfilled}`);
  console.log(`     MCAP normalized     : ${totalMcapNormalized}`);
  return totalUpdated;
}

// ── PHASE 2: Normalize dailyClosing ─────────────────────────────────────────

async function normalizeDailyClosing() {
  console.log('\n📊 Phase 2: Normalizing dailyClosing/{date}/stocks (>= ' + CUTOFF_DATE + ', ISO format only)\n');

  // Only fetch ISO-format dates from 2026 onward
  const datesSnap = await db.collection('dailyClosing')
    .where(admin.firestore.FieldPath.documentId(), '>=', CUTOFF_DATE)
    .get();

  // Filter to only ISO-format docs (skip old format — Phase 3 handles those)
  const isoDocs = datesSnap.docs.filter(d => !isOldDateFormat(d.id));
  console.log(`Found ${isoDocs.length} ISO-format dates from 2026+ (skipping ${datesSnap.size - isoDocs.length} old-format)\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMcapNormalized = 0;

  for (const dateDoc of isoDocs) {
    const dateId = dateDoc.id;
    process.stdout.write(`  ${dateId}... `);

    const stocksSnap = await db
      .collection('dailyClosing')
      .doc(dateId)
      .collection('stocks')
      .get();

    if (stocksSnap.empty) {
      console.log('(empty)');
      continue;
    }

    let batch = db.batch();
    let opCount = 0;
    let dateUpdated = 0;

    for (const doc of stocksSnap.docs) {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      if (data.source === 'api') {
        totalSkipped++;
        continue;
      }

      if (!data.source) {
        updates.source = 'scraper';
        needsUpdate = true;
      }

      if (needsNormalization(data.mcap)) {
        updates.mcap = data.mcap * 1_000_000_000;
        totalMcapNormalized++;
        needsUpdate = true;
      }

      if (!needsUpdate) {
        totalSkipped++;
        continue;
      }

      if (!DRY_RUN) {
        batch.update(doc.ref, updates);
        opCount++;

        if (opCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }

      dateUpdated++;
      totalUpdated++;
    }

    if (!DRY_RUN && opCount > 0) {
      await batch.commit();
    }

    console.log(`${dateUpdated} updated, ${stocksSnap.size - dateUpdated} skipped`);
  }

  console.log(`\n  ✅ Phase 2 complete:`);
  console.log(`     Docs updated        : ${totalUpdated}`);
  console.log(`     Docs skipped        : ${totalSkipped}`);
  console.log(`     MCAP normalized     : ${totalMcapNormalized}`);
  return totalUpdated;
}

// ── PHASE 3: Move old-format dates to legacyDailyClosing ────────────────────

async function moveLegacyDates() {
  console.log('\n📊 Phase 3: Moving old-format dates → legacyDailyClosing\n');

  // Get ALL dailyClosing docs and filter for old-format IDs
  const allDatesSnap = await db.collection('dailyClosing').get();
  const oldFormatDocs = allDatesSnap.docs.filter(d => isOldDateFormat(d.id));

  if (oldFormatDocs.length === 0) {
    console.log('  No old-format dates found — nothing to move.');
    return 0;
  }

  console.log(`Found ${oldFormatDocs.length} old-format dates to move:\n`);
  oldFormatDocs.forEach(d => console.log(`    ${d.id}`));
  console.log('');

  let totalDocsMoved = 0;
  let totalStocksMoved = 0;
  const movedDateIds = [];

  for (const dateDoc of oldFormatDocs) {
    const dateId = dateDoc.id;
    process.stdout.write(`  Moving ${dateId}... `);

    // 1. Read the parent doc data
    const parentData = dateDoc.data();

    // 2. Read all stocks in the subcollection
    const stocksSnap = await db
      .collection('dailyClosing')
      .doc(dateId)
      .collection('stocks')
      .get();

    if (!DRY_RUN) {
      let batch = db.batch();
      let opCount = 0;

      // 3. Write parent doc to legacyDailyClosing/{dateId}
      const legacyParentRef = db.collection('legacyDailyClosing').doc(dateId);
      batch.set(legacyParentRef, {
        ...parentData,
        movedAt: admin.firestore.FieldValue.serverTimestamp(),
        movedFrom: `dailyClosing/${dateId}`,
      });
      opCount++;

      // 4. Copy each stock subdoc to legacyDailyClosing/{dateId}/stocks/{symbol}
      for (const stockDoc of stocksSnap.docs) {
        const legacyStockRef = legacyParentRef.collection('stocks').doc(stockDoc.id);
        batch.set(legacyStockRef, stockDoc.data());
        opCount++;

        if (opCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }

      // 5. Commit the copy batch
      if (opCount > 0) {
        await batch.commit();
      }

      // 6. Now delete the originals (separate batch for safety — copy first, delete second)
      let deleteBatch = db.batch();
      let deleteOpCount = 0;

      // Delete stock subdocs first
      for (const stockDoc of stocksSnap.docs) {
        deleteBatch.delete(stockDoc.ref);
        deleteOpCount++;

        if (deleteOpCount >= BATCH_SIZE) {
          await deleteBatch.commit();
          deleteBatch = db.batch();
          deleteOpCount = 0;
        }
      }

      // Delete the parent doc
      deleteBatch.delete(dateDoc.ref);
      deleteOpCount++;

      await deleteBatch.commit();
    }

    movedDateIds.push(dateId);
    totalStocksMoved += stocksSnap.size;
    totalDocsMoved++;

    console.log(`✅ (${stocksSnap.size} stocks)`);
  }

  // 7. Clean up config/app.availableDates — remove old-format entries
  if (movedDateIds.length > 0 && !DRY_RUN) {
    console.log('\n  Cleaning config/app.availableDates...');
    const configRef = db.collection('config').doc('app');
    const configSnap = await configRef.get();

    if (configSnap.exists) {
      const data = configSnap.data();
      const currentDates = data.availableDates || [];
      const cleanedDates = currentDates.filter(d => !isOldDateFormat(d));

      if (cleanedDates.length < currentDates.length) {
        await configRef.update({ availableDates: cleanedDates });
        console.log(`  Removed ${currentDates.length - cleanedDates.length} old-format entries from availableDates`);
      }
    }
  }

  console.log(`\n  ✅ Phase 3 complete:`);
  console.log(`     Dates moved         : ${totalDocsMoved}`);
  console.log(`     Stock docs moved    : ${totalStocksMoved}`);
  console.log(`     Destination         : legacyDailyClosing/`);
  return totalDocsMoved;
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE — no writes will be made\n');
  }

  console.log('🚀 Starting MCAP normalization, source backfill & legacy cleanup\n');
  console.log(`Scope: records from ${CUTOFF_DATE} onward (scraper era)`);
  console.log('Rule: if mcap > 0 && mcap < 1,000,000 → multiply by 1,000,000,000');
  console.log('Rule: if source is missing → set to "scraper"');
  console.log('Rule: old-format dates (e.g. "20Jan2026") → move to legacyDailyClosing\n');

  const historyUpdated = await normalizeHistory();
  const dailyUpdated = await normalizeDailyClosing();
  const legacyMoved = await moveLegacyDates();

  console.log('\n==============================');
  console.log(`✅ All phases complete!${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`   Phase 1 — dailyClosingHistory : ${historyUpdated} docs updated`);
  console.log(`   Phase 2 — dailyClosing/stocks : ${dailyUpdated} docs updated`);
  console.log(`   Phase 3 — legacy dates moved  : ${legacyMoved} dates → legacyDailyClosing`);
  console.log('==============================\n');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
