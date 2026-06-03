import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";

// Belt-and-braces holiday detection. The intraday monitor flags a day as a
// non-trading day after ~45 min of frozen snapshots, but if the monitor was
// down or the threshold wasn't reached (e.g. a half-day with delayed start),
// this catches it at the start of the next session: if the most recent date
// in marketWatchDates has no corresponding dailyClosing entry, its first and
// last snapshots are deep-compared, and if identical we mark it as a holiday
// and remove it from marketWatchDates.
async function verifyMostRecentMarketWatchDay(todayStr: string): Promise<void> {
  const configSnap = await db.collection("config").doc("app").get();
  const cfg = configSnap.data() ?? {};
  const watchDates: string[] = cfg.marketWatchDates ?? [];
  const closingDates: string[] = cfg.availableDates ?? [];
  const closingSet = new Set(closingDates);

  // Find the most recent watch date that ISN'T today and has no closing entry.
  const suspect = [...watchDates]
    .sort()
    .reverse()
    .find((d) => d !== todayStr && !closingSet.has(d));
  if (!suspect) return;

  const dateRef = db.collection("marketWatch").doc(suspect);
  const meta = (await dateRef.get()).data() ?? {};
  if (meta.isHoliday) return; // Already handled.

  const snaps = await dateRef
    .collection("snapshots")
    .orderBy("capturedAt", "asc")
    .get();
  if (snaps.size < 2) return; // Not enough data to compare.

  const first = (snaps.docs[0].data().stocks ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const last = (snaps.docs[snaps.size - 1].data().stocks ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const firstKeys = Object.keys(first);
  if (firstKeys.length === 0 || firstKeys.length !== Object.keys(last).length) {
    return;
  }
  for (const sym of firstKeys) {
    const a = first[sym];
    const b = last[sym];
    if (!b) return;
    if (
      a.marketPrice !== b.marketPrice ||
      a.volume !== b.volume ||
      a.bestBidQuantity !== b.bestBidQuantity ||
      a.bestOfferQuantity !== b.bestOfferQuantity
    ) {
      return;
    }
  }

  // All snapshots identical across the whole day → non-trading day.
  await dateRef.set(
    {
      isHoliday: true,
      detectedAt: admin.firestore.FieldValue.serverTimestamp(),
      detectedBy: "preOpenSummary",
    },
    { merge: true },
  );
  await db.collection("config").doc("app").set(
    {
      marketWatchDates: admin.firestore.FieldValue.arrayRemove(suspect),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(
    JSON.stringify({
      event: "MARKETWATCH_HOLIDAY_RETRO",
      date: suspect,
      snapshotCount: snaps.size,
      message: `Retroactively flagged ${suspect} as non-trading day (all ${snaps.size} snapshots identical).`,
    }),
  );
}

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
      await verifyMostRecentMarketWatchDay(todayStr);
    } catch (verifyError) {
      console.error("Holiday verification failed:", verifyError);
    }

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
