import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";

export const generatePreOpenSummary = onSchedule(
  {
    schedule: "25 9 * * 1-5",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    const now = moment().tz("Africa/Dar_es_Salaam");
    const todayStr = now.format("YYYY-MM-DD");

    try {
      const closingQuery = await db.collection("dailyClosing")
        .orderBy("date", "desc")
        .limit(1)
        .get();

      if (closingQuery.empty) {
        console.log("No previous dailyClosing data found for pre-open intel.");
        return;
      }

      const lastClosingDoc = closingQuery.docs[0].data();
      const lastClosingDate = lastClosingDoc.date;

      const stocksSnap = await db.collection("dailyClosing").doc(lastClosingDate)
        .collection("stocks")
        .get();

      if (stocksSnap.empty) {
        console.log(`No stocks data for ${lastClosingDate}.`);
        return;
      }

      const stocks = stocksSnap.docs.map(doc => doc.data());

      let upCount = 0;
      let downCount = 0;
      const movers: { symbol: string; changePct: number; changeVal: number }[] = [];

      stocks.forEach(s => {
        const changeVal = s.changeValue || 0;
        if (changeVal > 0) upCount++;
        else if (changeVal < 0) downCount++;

        if (s.close && s.close > 0 && s.prevClose && s.prevClose > 0 && changeVal !== 0) {
          const changePct = ((s.close - s.prevClose) / s.prevClose) * 100;
          movers.push({ symbol: s.symbol, changePct, changeVal });
        }
      });

      const prevSentiment = upCount > downCount ? "BULLISH" : downCount > upCount ? "BEARISH" : "NEUTRAL";
      
      movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
      
      const topGainers = movers.filter(m => m.changePct > 0).slice(0, 3);
      const topLosers = movers.filter(m => m.changePct < 0).slice(0, 3);

      let txt = `Yesterday's session (${lastClosingDate}) closed **${prevSentiment}** with ${upCount} stocks up and ${downCount} down. `;

      if (topGainers.length > 0) {
        const gainersList = topGainers.map(g => `**${g.symbol}** (+${g.changePct.toFixed(2)}%)`).join(", ");
        txt += `Top gainers: ${gainersList}. `;
      }
      
      if (topLosers.length > 0) {
        const losersList = topLosers.map(l => `**${l.symbol}** (${l.changePct.toFixed(2)}%)`).join(", ");
        txt += `Biggest decliners: ${losersList}. `;
      }
      
      txt += `The opening auction begins in 5 minutes.`;

      const timestamp = new Date().toISOString();
      const intelRef = db
        .collection("marketWatch")
        .doc(todayStr)
        .collection("intel")
        .doc(timestamp);

      await intelRef.set({
        capturedAt: timestamp,
        type: "pre-open",
        snapshotSummary: txt.trim(),
      });

      const configAppRef = db.collection("config").doc("app");
      await configAppRef.set({
        marketWatchDates: admin.firestore.FieldValue.arrayUnion(todayStr),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`Successfully generated pre-open intel for ${todayStr}`);
    } catch (e) {
      console.error("Error generating pre-open summary:", e);
    }
  }
);
