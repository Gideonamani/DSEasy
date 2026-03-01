/**
 * migrate_paths.cjs
 * 
 * One-time migration script that moves all Firestore documents from:
 *   trends/{symbol}/history/{date}
 * to:
 *   trends/{symbol}/dailyClosingHistory/{date}
 * 
 * Safe to run while the app is live — it copies first, then deletes.
 * Safe to re-run — uses batch.set() so documents are idempotent.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Error: serviceAccountKey.json not found.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const db = admin.firestore();
const BATCH_SIZE = 400;

async function migratePaths() {
  console.log('🚀 Starting path migration: history -> dailyClosingHistory\n');

  // 1. Get all symbol documents from trends/
  const trendsSnap = await db.collection('trends').get();
  if (trendsSnap.empty) {
    console.log('No documents found in trends/. Nothing to migrate.');
    return;
  }

  const symbols = trendsSnap.docs.map(d => d.id);
  console.log(`Found ${symbols.length} symbols: ${symbols.join(', ')}\n`);

  let totalCopied = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;

  for (const symbol of symbols) {
    process.stdout.write(`Processing ${symbol}... `);

    // 2. Read all docs from old path
    const oldColRef = db.collection('trends').doc(symbol).collection('history');
    const oldSnap = await oldColRef.get();

    if (oldSnap.empty) {
      console.log(`(no old 'history' docs, skipping)`);
      totalSkipped++;
      continue;
    }

    console.log(`${oldSnap.size} docs to migrate`);

    // 3. Copy in batches to new path
    let batch = db.batch();
    let opCount = 0;

    for (const oldDoc of oldSnap.docs) {
      const newDocRef = db
        .collection('trends')
        .doc(symbol)
        .collection('dailyClosingHistory')
        .doc(oldDoc.id);

      batch.set(newDocRef, oldDoc.data());
      opCount++;
      totalCopied++;

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

    console.log(`  ✅ Copied ${oldSnap.size} docs for ${symbol}`);

    // 4. Delete old docs in batches
    let deleteBatch = db.batch();
    let deleteCount = 0;

    for (const oldDoc of oldSnap.docs) {
      deleteBatch.delete(oldDoc.ref);
      deleteCount++;
      totalDeleted++;

      if (deleteCount >= BATCH_SIZE) {
        await deleteBatch.commit();
        deleteBatch = db.batch();
        deleteCount = 0;
      }
    }

    if (deleteCount > 0) {
      await deleteBatch.commit();
    }

    console.log(`  🗑️  Deleted ${oldSnap.size} old docs for ${symbol}`);
  }

  console.log('\n==============================');
  console.log(`✅ Migration complete!`);
  console.log(`   Symbols processed : ${symbols.length}`);
  console.log(`   Symbols skipped   : ${totalSkipped} (already clean)`);
  console.log(`   Docs copied       : ${totalCopied}`);
  console.log(`   Docs deleted      : ${totalDeleted}`);
  console.log('==============================\n');
}

migratePaths().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
