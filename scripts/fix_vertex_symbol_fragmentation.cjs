/**
 * One-off cleanup for issue #206.
 *
 * DSE's homepage truncated the "VERTEX ETF" symbol to "VERTEX ET" on
 * 2026-07-08, and before SYMBOL_MAPPINGS had an entry for it, the scraper
 * wrote that day's row under a brand-new, disconnected symbol instead of
 * appending to the existing "VERTEX ETF" history:
 *   - trends/VERTEX ET/dailyClosingHistory/{date}
 *   - dailyClosing/{date}/stocks/VERTEX ET
 *
 * This script merges each fragment back into the correct canonical symbol
 * and deletes the phantom docs. Safe to re-run: if the destination already
 * has a doc for that date, it's left untouched and reported instead of
 * overwritten.
 *
 * Run with: node scripts/fix_vertex_symbol_fragmentation.cjs [--apply]
 * Without --apply, the script is a dry run that only reports what it would do.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

// Add more { from, to } pairs here if the same fragmentation recurs for
// another symbol before a mapping fix ships.
const FIXES = [{ from: 'VERTEX ET', to: 'VERTEX ETF' }];

(async () => {
  for (const { from, to } of FIXES) {
    console.log(`\n=== Merging "${from}" -> "${to}" ===`);

    const fromTrendRef = db.collection('trends').doc(from);
    const toTrendRef = db.collection('trends').doc(to);

    const fromHistorySnap = await fromTrendRef
      .collection('dailyClosingHistory')
      .get();

    if (fromHistorySnap.empty) {
      console.log(`  No dailyClosingHistory docs under trends/${from}. Nothing to merge.`);
      continue;
    }

    for (const historyDoc of fromHistorySnap.docs) {
      const date = historyDoc.id;
      const data = historyDoc.data();

      const destHistoryRef = toTrendRef.collection('dailyClosingHistory').doc(date);
      const destHistorySnap = await destHistoryRef.get();

      if (destHistorySnap.exists) {
        console.log(`  [SKIP] trends/${to}/dailyClosingHistory/${date} already exists — leaving both, please compare manually.`);
      } else {
        console.log(`  [MERGE] trends/${from}/dailyClosingHistory/${date} -> trends/${to}/dailyClosingHistory/${date} (close=${data.close})`);
        if (APPLY) {
          await destHistoryRef.set({ ...data, symbol: to });
        }
      }

      const fromStockRef = db.collection('dailyClosing').doc(date).collection('stocks').doc(from);
      const toStockRef = db.collection('dailyClosing').doc(date).collection('stocks').doc(to);
      const fromStockSnap = await fromStockRef.get();

      if (fromStockSnap.exists) {
        const toStockSnap = await toStockRef.get();
        if (toStockSnap.exists) {
          console.log(`  [SKIP] dailyClosing/${date}/stocks/${to} already exists — leaving both, please compare manually.`);
        } else {
          console.log(`  [MERGE] dailyClosing/${date}/stocks/${from} -> dailyClosing/${date}/stocks/${to}`);
          if (APPLY) {
            await toStockRef.set({ ...fromStockSnap.data(), symbol: to });
            await fromStockRef.delete();
          }
        }
      }

      if (APPLY) {
        await historyDoc.ref.delete();
      }
    }

    console.log(`  [DELETE] trends/${from} (phantom symbol doc)`);
    if (APPLY) {
      await fromTrendRef.delete();
    }
  }

  if (!APPLY) {
    console.log('\nDry run — pass --apply to perform the writes/deletes listed above.');
  } else {
    console.log('\nDone.');
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
