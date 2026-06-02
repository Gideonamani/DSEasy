/**
 * One-off retroactive holiday cleanup.
 *
 * Scans every date in config/app.marketWatchDates that has no corresponding
 * entry in config/app.availableDates, and for each one compares the first and
 * last snapshot. If they are identical on (marketPrice, volume, bestBidQuantity,
 * bestOfferQuantity) for every stock, the day is flagged as a non-trading day:
 *   - marketWatch/{date}.isHoliday = true
 *   - config/app.marketWatchDates -= [date]
 *
 * Run with: node scripts/cleanup_holidays.cjs [--apply]
 * Without --apply, the script is a dry run that only reports what it would do.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

function snapshotsAreFrozen(prior, current) {
  const a = Object.keys(prior);
  const b = Object.keys(current);
  if (a.length === 0 || a.length !== b.length) return false;
  for (const sym of a) {
    const p = prior[sym];
    const c = current[sym];
    if (!c) return false;
    if (p.marketPrice !== c.marketPrice) return false;
    if (p.volume !== c.volume) return false;
    if (p.bestBidQuantity !== c.bestBidQuantity) return false;
    if (p.bestOfferQuantity !== c.bestOfferQuantity) return false;
  }
  return true;
}

(async () => {
  const cfgRef = db.collection('config').doc('app');
  const cfgSnap = await cfgRef.get();
  const cfg = cfgSnap.data() || {};
  const watchDates = (cfg.marketWatchDates || []).slice().sort();
  const closingSet = new Set(cfg.availableDates || []);

  const suspects = watchDates.filter((d) => !closingSet.has(d));
  console.log(`Found ${suspects.length} marketWatch dates without closing data:`, suspects);

  const toFlag = [];
  for (const date of suspects) {
    const dateRef = db.collection('marketWatch').doc(date);
    const meta = (await dateRef.get()).data() || {};
    if (meta.isHoliday) {
      console.log(`  ${date}: already flagged, skipping`);
      continue;
    }
    const snaps = await dateRef.collection('snapshots').orderBy('capturedAt', 'asc').get();
    if (snaps.size < 2) {
      console.log(`  ${date}: only ${snaps.size} snapshots, skipping`);
      continue;
    }
    const first = snaps.docs[0].data().stocks || {};
    const last = snaps.docs[snaps.size - 1].data().stocks || {};
    if (snapshotsAreFrozen(first, last)) {
      console.log(`  ${date}: FROZEN (${snaps.size} snapshots, all identical) → flag as holiday`);
      toFlag.push({ date, snapshotCount: snaps.size });
    } else {
      console.log(`  ${date}: snapshots differ — leaving alone`);
    }
  }

  if (toFlag.length === 0) {
    console.log('\nNothing to flag.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log(`\nDry run — pass --apply to flag ${toFlag.length} date(s).`);
    process.exit(0);
  }

  for (const { date, snapshotCount } of toFlag) {
    await db.collection('marketWatch').doc(date).set(
      {
        isHoliday: true,
        detectedAt: admin.firestore.FieldValue.serverTimestamp(),
        detectedBy: 'cleanup_holidays.cjs',
        snapshotCount,
      },
      { merge: true },
    );
    await cfgRef.set(
      {
        marketWatchDates: admin.firestore.FieldValue.arrayRemove(date),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  ✓ Flagged ${date} and removed from marketWatchDates.`);
  }

  console.log(`\nDone. Flagged ${toFlag.length} non-trading day(s).`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
