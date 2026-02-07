const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  console.log('Checking recent alerts...');
  try {
    const snapshot = await db.collection('alerts')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    if (snapshot.empty) {
      console.log('No alerts found.');
      return;
    }

    console.log(`Found ${snapshot.size} alerts:`);
    snapshot.forEach(doc => {
      console.log(`ID: ${doc.id}, Symbol: ${doc.data().symbol}, Price: ${doc.data().targetPrice}, Status: ${doc.data().status}`);
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
  }
}

check();
