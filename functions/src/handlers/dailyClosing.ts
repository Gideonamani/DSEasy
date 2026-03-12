import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";
import { scrapeDSEAndWriteToFirestore, sendScraperAlert } from "../services/scraper";

export const scrapeDailyClosing = onSchedule(
  {
    schedule: "0 17-23 * * 1-5", // Every hour from 17:00 to 23:00 Mon-Fri
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    // 1. Check if data for TODAY already exists
    const now = moment().tz("Africa/Dar_es_Salaam");
    const todayFormatted = now.format("YYYY-MM-DD"); // e.g., "2026-03-09"

    // Check Firestore directly first to avoid unnecessary scraping
    const docRef = db.collection("dailyClosing").doc(todayFormatted);
    const doc = await docRef.get();

    if (doc.exists) {
      console.log(
        `Data for ${todayFormatted} already exists. Skipping scrape.`,
      );
      return;
    }

    console.log(`Data for ${todayFormatted} missing. Attempting scrape...`);

    // 2. Attempt Scrape
    const result = await scrapeDSEAndWriteToFirestore();
    console.log("scrapeDailyClosing result:", result);

    // 3. Check for Failure / Stale Data
    // Logic: If the scraped date is NOT today, it means DSE hasn't updated yet.
    if (result.success && result.date === todayFormatted) {
      console.log("Scrape successful and data matches today.");
      return;
    }

    // 4. Send Alert if Last Run (23:00)
    const currentHour = now.hour();
    console.log(
      `Scrape finished but data is old or failed. Current hour: ${currentHour}`,
    );

    if (currentHour >= 23) {
      console.log("Last attempt of the day failed. Sending alert...");
      const subject = `⚠️ DSE Data Missing for ${todayFormatted}`;
      const body =
        `The scraper ran at ${now.format("HH:mm")} and could not find data for today.\n\n` +
        `Scraper Result: ${result.message}\n` +
        `Last Scraped Date: ${result.date || "Unknown"}\n\n` +
        `Please check https://dse.co.tz manually.`;

      await sendScraperAlert(subject, body);
    }
  },
);

export const scrapeDailyClosingHttp = onRequest(
  {
    region: "europe-west1",
  },
  async (req, res) => {
    // Only allow in emulator
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      res
        .status(403)
        .json({ error: "This endpoint is only available in the emulator." });
      return;
    }

    const result = await scrapeDSEAndWriteToFirestore();
    res.json(result);
  },
);
