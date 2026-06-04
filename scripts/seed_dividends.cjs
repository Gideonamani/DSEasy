const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const dividendData = {
  CRDB: [
    { exDate: "2025-05-23", paymentDate: "2025-06-15", amount: 45.0, type: "Final" },
    { exDate: "2024-05-17", paymentDate: "2024-06-07", amount: 50.0, type: "Final" },
    { exDate: "2023-05-19", paymentDate: "2023-06-09", amount: 45.0, type: "Final" },
    { exDate: "2022-05-20", paymentDate: "2022-06-10", amount: 36.0, type: "Final" },
    { exDate: "2021-05-21", paymentDate: "2021-06-11", amount: 22.0, type: "Final" },
    { exDate: "2020-05-22", paymentDate: "2020-06-12", amount: 17.0, type: "Final" },
    { exDate: "2019-05-24", paymentDate: "2019-06-14", amount: 8.0, type: "Final" },
    { exDate: "2018-05-25", paymentDate: "2018-06-15", amount: 5.0, type: "Final" }
  ],
  NMB: [
    { exDate: "2025-05-30", paymentDate: "2025-06-20", amount: 360.0, type: "Final" },
    { exDate: "2024-05-24", paymentDate: "2024-06-14", amount: 286.0, type: "Final" },
    { exDate: "2023-05-26", paymentDate: "2023-06-16", amount: 268.0, type: "Final" },
    { exDate: "2022-05-27", paymentDate: "2022-06-17", amount: 193.0, type: "Final" },
    { exDate: "2021-05-28", paymentDate: "2021-06-18", amount: 137.0, type: "Final" },
    { exDate: "2020-05-29", paymentDate: "2020-06-19", amount: 96.0, type: "Final" },
    { exDate: "2019-05-31", paymentDate: "2019-06-21", amount: 66.0, type: "Final" },
    { exDate: "2018-06-01", paymentDate: "2018-06-22", amount: 64.0, type: "Final" }
  ],
  TBL: [
    { exDate: "2024-11-15", paymentDate: "2024-12-06", amount: 290.0, type: "Final" },
    { exDate: "2023-11-17", paymentDate: "2023-12-08", amount: 180.0, type: "Final" },
    { exDate: "2022-11-18", paymentDate: "2022-12-09", amount: 220.0, type: "Final" },
    { exDate: "2021-11-19", paymentDate: "2021-12-10", amount: 290.0, type: "Final" },
    { exDate: "2020-11-20", paymentDate: "2020-12-11", amount: 350.0, type: "Final" },
    { exDate: "2019-11-22", paymentDate: "2019-12-13", amount: 450.0, type: "Final" },
    { exDate: "2018-11-23", paymentDate: "2018-12-14", amount: 600.0, type: "Final" }
  ],
  TPCC: [
    { exDate: "2025-06-06", paymentDate: "2025-06-27", amount: 390.0, type: "Final" },
    { exDate: "2024-06-07", paymentDate: "2024-06-28", amount: 320.0, type: "Final" },
    { exDate: "2023-06-09", paymentDate: "2023-06-30", amount: 390.0, type: "Final" },
    { exDate: "2022-06-10", paymentDate: "2022-07-01", amount: 390.0, type: "Final" },
    { exDate: "2021-06-11", paymentDate: "2021-07-02", amount: 340.0, type: "Final" },
    { exDate: "2020-06-12", paymentDate: "2020-07-03", amount: 290.0, type: "Final" },
    { exDate: "2019-06-14", paymentDate: "2019-07-05", amount: 260.0, type: "Final" },
    { exDate: "2018-06-15", paymentDate: "2018-07-06", amount: 240.0, type: "Final" }
  ]
};

async function seed() {
  console.log("Seeding dividend history...");
  for (const [symbol, dividends] of Object.entries(dividendData)) {
    const collRef = db.collection('trends').doc(symbol).collection('dividendHistory');
    
    // Clear existing to ensure idempotency
    const snapshot = await collRef.get();
    if (!snapshot.empty) {
      console.log(`Clearing ${snapshot.size} existing dividend entries for ${symbol}...`);
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    console.log(`Writing ${dividends.length} entries for ${symbol}...`);
    const writeBatch = db.batch();
    dividends.forEach(div => {
      const docRef = collRef.doc(div.exDate);
      writeBatch.set(docRef, div);
    });
    await writeBatch.commit();
  }
  console.log("Seeding complete!");
}

seed().catch(err => {
  console.error("Error seeding dividends:", err);
  process.exit(1);
});
