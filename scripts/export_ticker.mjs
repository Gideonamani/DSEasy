/**
 * Export Ticker Data Script
 * 
 * This script connects to the repo's Firestore database and extracts all historical 
 * daily closing data (prices, volume, high/low, etc.) for a specific ticker symbol.
 * It queries the `dailyClosing` collection and outputs the results to a CSV file.
 * 
 * Usage example:
 * node scripts/export_ticker.mjs CRDB
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

// Get the ticker symbol from the command line arguments
const ticker = process.argv[2]?.toUpperCase();

if (!ticker) {
  console.error("Please provide a ticker symbol. Example: node export_ticker.mjs NMB");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function exportTickerData() {
  console.log(`Fetching ${ticker} daily closing prices from dailyClosing...`);
  const csvRows = ['Date,Price,Open,High,Low,Change,Volume,Deals,Turnover,MarketCap,OutstandingBid,OutstandingOffer,BidOfferRatio,HighLowSpread,VolPerDeal,TurnoverPerDeal,TurnoverPercent,ChangePerVol'];
  
  try {
    const dailyClosingRef = db.collection('dailyClosing');
    const docRefs = await dailyClosingRef.listDocuments();
    
    if (docRefs.length === 0) {
      console.log('No dates found in dailyClosing.');
      return;
    }

    const dates = docRefs.map(ref => ref.id);
    dates.sort();
    console.log(`Found ${dates.length} total closing dates. Extracting ${ticker}...`);
    
    // Process in batches of 50 to avoid overloading
    const batchSize = 50;
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      
      const promises = batch.map(async (date) => {
        const docRef = dailyClosingRef.doc(date).collection('stocks').doc(ticker);
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data();
          const row = [
            date,
            data.close ?? '',
            data.open ?? '',
            data.high ?? '',
            data.low ?? '',
            data.changeValue ?? '',
            data.volume ?? '',
            data.deals ?? '',
            data.turnover ?? '',
            data.mcap ?? '',
            data.outstandingBid ?? '',
            data.outstandingOffer ?? '',
            data.bidOfferRatio ?? '',
            data.highLowSpread ?? '',
            data.volPerDeal ?? '',
            data.turnoverPerDeal ?? '',
            data.turnoverPercent ?? '',
            data.changePerVol ?? ''
          ].join(',');
          return { date, row };
        }
        return null; // Ticker didn't trade or wasn't recorded on this day
      });
      
      const results = await Promise.all(promises);
      for (const res of results) {
        if (res != null) {
          csvRows.push(res.row);
        }
      }
    }
    
    // Re-sort the rows by date just in case
    const header = csvRows[0];
    const dataRows = csvRows.slice(1);
    dataRows.sort();
    
    if (dataRows.length === 0) {
      console.log(`No records found for ticker ${ticker}.`);
      return;
    }
    
    const finalCsv = [header, ...dataRows].join('\n');
    
    // Output into the root directory (so we go up one level from scripts/)
    const outputPath = `../${ticker.toLowerCase()}_daily_prices.csv`;
    fs.writeFileSync(outputPath, finalCsv);
    console.log(`Successfully exported to ${outputPath}.`);
    console.log(`Total ${ticker} records: ${dataRows.length}`);
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

exportTickerData().then(() => process.exit(0));
