import { onSchedule } from "firebase-functions/v2/scheduler";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";
import { generateSnapshotIntel, generateTrendIntel } from "../services/marketIntel";

export const generateDailyCloseSummary = onSchedule(
  {
    schedule: "10 16 * * 1-5", // 10 min after official 16:00 close to capture 16:05 snapshot
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    const now = moment().tz("Africa/Dar_es_Salaam");
    const dateStr = now.format("YYYY-MM-DD");
    
    try {
      // Get last snapshot of the day
      const lastSnapQuery = await db.collection("marketWatch").doc(dateStr).collection("snapshots")
        .orderBy("capturedAt", "desc")
        .limit(1)
        .get();
        
      if (lastSnapQuery.empty) {
        console.log(`No snapshots found for ${dateStr} closing summary.`);
        return;
      }
      
      const lastSnapshot = lastSnapQuery.docs[0].data();
      const snapshotSummary = generateSnapshotIntel(lastSnapshot);
      
      let trendSummary = await generateTrendIntel(db, dateStr, lastSnapshot);
      
      // Compare daily open vs close
      const firstSnapQuery = await db.collection("marketWatch").doc(dateStr).collection("snapshots")
        .orderBy("capturedAt", "asc")
        .limit(1)
        .get();
        
      if (!firstSnapQuery.empty && firstSnapQuery.docs[0].id !== lastSnapQuery.docs[0].id) {
         const firstSnapshot = firstSnapQuery.docs[0].data();
         
         let firstUp = 0; let firstDown = 0;
         Object.values(firstSnapshot.stocks).forEach((s: any) => { if (s.change > 0) firstUp++; else if (s.change < 0) firstDown++; });
         const firstSentiment = firstUp > firstDown ? 'BULLISH' : firstDown > firstUp ? 'BEARISH' : 'NEUTRAL';
         
         let lastUp = 0; let lastDown = 0;
         Object.values(lastSnapshot.stocks).forEach((s: any) => { if (s.change > 0) lastUp++; else if (s.change < 0) lastDown++; });
         const lastSentiment = lastUp > lastDown ? 'BULLISH' : lastDown > lastUp ? 'BEARISH' : 'NEUTRAL';
         
         let txt = `Overall for the day, the market opened **${firstSentiment}** and closed **${lastSentiment}**. `;
         
         let biggestMoverSymbol = "";
         let maxAbsMovePct = -1;
         let movePctVal = 0;
         let moveDir = "";
         
         for (const [symbol, currDataAny] of Object.entries(lastSnapshot.stocks)) {
            const currData = currDataAny as any;
            if (currData.marketPrice > 0 && currData.change !== 0) {
               const prevClose = currData.marketPrice - currData.change;
               if (prevClose > 0) {
                  const pctMove = (currData.change / prevClose) * 100;
                  const absMove = Math.abs(pctMove);
                  if (absMove > maxAbsMovePct) {
                     maxAbsMovePct = absMove;
                     biggestMoverSymbol = symbol;
                     moveDir = pctMove > 0 ? "gained" : "dropped";
                     movePctVal = absMove;
                  }
               }
            }
         }
         
         if (biggestMoverSymbol && maxAbsMovePct > 0) {
            txt += `**${biggestMoverSymbol}** was today's notable mover, having ${moveDir} **${movePctVal.toFixed(2)}%** for the day.`;
         }
         trendSummary = txt;
      }
      
      const timestamp = new Date().toISOString();
      const intelRef = db
        .collection("marketWatch")
        .doc(dateStr)
        .collection("intel")
        .doc(timestamp);
        
      await intelRef.set({
        capturedAt: timestamp,
        type: "closing",
        snapshotSummary,
        trendSummary
      });
      
      console.log(`Successfully generated daily closing summary for ${dateStr}`);
    } catch (e) {
      console.error("Error generating daily close summary:", e);
    }
  }
);
