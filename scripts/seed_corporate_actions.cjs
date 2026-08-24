/**
 * Idempotently seeds approved corporate actions into config/app.
 *
 * Run a dry-run with: npm run seed:corporate-actions
 * Apply with: npm run seed:corporate-actions -- --apply
 */
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const APPLY = process.argv.includes("--apply");
const actions = [
  {
    id: "NMB-2026-08-24-10-for-1",
    ticker: "NMB",
    actionType: "share_split",
    ratioNew: 10,
    ratioOld: 1,
    announcementDate: "2026-07-27",
    lastCumDate: "2026-08-19",
    suspensionStart: "2026-08-20",
    suspensionEnd: "2026-08-21",
    effectiveDate: "2026-08-24",
    sourceUrl: "https://dse.co.tz/storage//securities/NMB/news/9NLTNi54w8XssuAZJEANFESZ6fCoCpBWtQXAPmsW.pdf",
    status: "approved",
  },
];

(async () => {
  const configRef = admin.firestore().collection("config").doc("app");
  const config = (await configRef.get()).data() || {};
  const existing = Array.isArray(config.corporateActions)
    ? config.corporateActions
    : [];
  const seededIds = new Set(actions.map((action) => action.id));
  const next = [
    ...existing.filter((action) => !seededIds.has(action.id)),
    ...actions,
  ].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  console.log(JSON.stringify({ apply: APPLY, corporateActions: next }, null, 2));
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to update config/app.");
    return;
  }

  await configRef.set({ corporateActions: next }, { merge: true });
  console.log(`Stored ${actions.length} corporate action(s) in config/app.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
