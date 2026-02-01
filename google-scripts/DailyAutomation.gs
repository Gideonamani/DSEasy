/*
  DAILY AUTOMATION TRIGGERS
  Filename: DailyAutomation.gs
  
  Instructions:
  1. Set a Time-Driven Trigger for 'triggerDailyClose' to run Every Hour (e.g. 18:00 - 23:00).
  2. This script checks if DSE has updated their site to "Today's Date".
  3. If updated -> It scrapes, creates the sheet, and syncs to Trends.
  4. If old data -> It waits for the next hour.
  5. If old data AND it's late (e.g. > 11 PM) -> Sends email alert.
*/

const ALERT_EMAIL = Session.getActiveUser().getEmail(); // Or hardcode "your@email.com"

function triggerDailyClose(e) {
  const now = new Date();
  const currentHour = now.getHours(); // 0-23

  // 0. TIME WINDOW CHECK (7 PM - 12 AM approx)
  // We strictly check between 19:00 and 23:59.
  // Note: We check 'e' (event object) to ensure we only skip during AUTOMATED runs.
  // Manual runs (testing) will have 'e' as undefined and will proceed.
  if (e && currentHour < 19) {
    Logger.log(
      `[DailyWorkflow] Outside active hours (19:00 - 23:59). Current hour: ${currentHour}. Skipping.`,
    );
    return;
  }

  Logger.log(`[DailyWorkflow] Running at ${now.toString()}`);

  // 1. ATTEMPT SCRAPE (Headless)
  const result = scrapeDSEData(false);

  if (!result || !result.success) {
    Logger.log(
      "[DailyWorkflow] Scrape failed: " +
        (result ? result.message : "Unknown error"),
    );
    return;
  }

  Logger.log(
    `[DailyWorkflow] Scraped Date: ${result.dateStr}. Status: ${result.message}`,
  );

  // 2. CHECK IF DATE MATCHES TODAY
  // result.dateStr is "30Jan2026"
  const todayFormatted = getTodayFormatted();

  if (result.dateStr !== todayFormatted) {
    Logger.log(
      `[DailyWorkflow] DSE Date (${result.dateStr}) does not match Today (${todayFormatted}). Data not yet updated.`,
    );

    // 3. CHECK FOR LATE ALERT (e.g., after 11 PM)
    // If it's 23:00 or later and we still don't have today's data (assuming today is a weekday)
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    if (!isWeekend && currentHour >= 23) {
      MailApp.sendEmail({
        to: ALERT_EMAIL,
        subject: `⚠️ DSE Data Missing for ${todayFormatted}`,
        body: `The automated scraper checked at ${now.toLocaleTimeString()} and the DSE website is still showing data for ${result.dateStr}.\n\nPlease check dse.co.tz manually.`,
      });
      Logger.log("[DailyWorkflow] Sent missing data alert email.");
    }

    return;
  }

  // 4. IF DATA IS FRESH & NEWLY CREATED -> SYNC
  if (result.created) {
    Logger.log("[DailyWorkflow] New data detected! Proceeding to Sync...");

    // Call the sync function (from ClosingToSymbols.gs)
    try {
      syncDailyToTrends();
      Logger.log("[DailyWorkflow] Sync successful.");

      // Optional: Email success summary
      // MailApp.sendEmail(ALERT_EMAIL, "DSE Data Synced", `Synced data for ${result.dateStr}`);
    } catch (e) {
      Logger.log("[DailyWorkflow] Sync failed: " + e.message);
      MailApp.sendEmail(
        ALERT_EMAIL,
        "❌ DSE Sync Failed",
        `Scraped data for ${result.dateStr} but Sync failed.\nError: ${e.message}`,
      );
    }
  } else {
    Logger.log(
      "[DailyWorkflow] Data for today already exists. No action needed.",
    );
  }
}

// HELPER: Get today in "30Jan2026" format
function getTodayFormatted() {
  const now = new Date();
  const day = now.getDate().toString(); // "30"
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  return `${day}${month}${year}`;
}
