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

// 1. Try Script Properties (Environment Variables)
// 2. Fallback to Effective User (The account running the trigger)
// const ALERT_EMAIL =
//   PropertiesService.getScriptProperties().getProperty("ALERT_EMAIL") ||
//   Session.getEffectiveUser().getEmail();

function getAlertEmail() {
  try {
    // 1. Try Script Properties
    const props = PropertiesService.getScriptProperties();
    const emailProp = props.getProperty("ALERT_EMAIL");
    if (emailProp) {
      // Logger.log("[DailyWorkflow] Found ALERT_EMAIL in Script Properties.");
      return emailProp;
    }

    // 2. Fallback to Effective User (only works if user triggers it, or specific permissions)
    Logger.log(
      "[DailyWorkflow] ALERT_EMAIL not found in props. Trying Session.getEffectiveUser()...",
    );
    const userEmail = Session.getEffectiveUser().getEmail();
    return userEmail;
  } catch (e) {
    // This catches the "You do not have permission to call Session.getActiveUser" error
    Logger.log(
      "[DailyWorkflow] Warning: Could not resolve email address. Error: " +
        e.message,
    );
    return null;
  }
}

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
      const emailAddr = getAlertEmail();
      if (emailAddr) {
        MailApp.sendEmail({
          to: emailAddr,
          subject: `⚠️ DSE Data Missing for ${todayFormatted}`,
          body: `The automated scraper checked at ${now.toLocaleTimeString()} and the DSE website is still showing data for ${result.dateStr}.\n\nPlease check dse.co.tz manually.`,
        });
        Logger.log("[DailyWorkflow] Sent missing data alert email.");
      } else {
        Logger.log(
          "[DailyWorkflow] Skipped missing data email (no email address resolved).",
        );
      }
    }

    return;
  }

  // 4. IF DATA IS FRESH & NEWLY CREATED -> SYNC
  if (result.created) {
    Logger.log("[DailyWorkflow] New data detected! Proceeding to Sync...");

    // Call the sync function (Implicitly handled by scrapeDSEData now? NO. scrapeDSEData calls sync if created.)
    // Wait, scrapeDSEData logic we just added DOES call sync IF successful. 
    // BUT triggerDailyClose calls scrapeDSEData(false).
    // So sync HAPPENS INSIDE scrapeDSEData now.
    
    // CHECK FOR SKIPPED SYMBOLS
    if (result.skippedSymbols && result.skippedSymbols.length > 0) {
       Logger.log("[DailyWorkflow] Found skipped symbols: " + result.skippedSymbols.join(", "));
       const emailAddr = getAlertEmail();
       if (emailAddr) {
         MailApp.sendEmail({
           to: emailAddr,
           subject: "⚠️ DSE Scraper: Unknown Symbols Detected",
           body: `The scraper found symbols that do not match existing sheets and were blocked from syncing:\n\n${result.skippedSymbols.join("\n")}\n\nPlease check if these are renames and update Constants.js, or manually create new sheets for them.`
         });
       }
    }

    // Retaining legacy explicit sync call logic only if scrapeDSEData DIDN'T do it?
    // In our new architecture, scrapeDSEData performs the sync automatically.
    // However, DailyAutomation.js logic below is:
    // "IF DATA IS FRESH & NEWLY CREATED -> SYNC"
    // But scrapeDSEData returns { created: true ... }
    
    // Issue: If scrapeDSEData already synced, calling syncDailyToTrends here is redundant or harmful.
    // Let's REMOVE the explicit sync call here since ScrapeDSEData now handles it.
    Logger.log("[DailyWorkflow] Scrape & Sync cycle complete.");
    
    /* 
    Legacy Sync Block Removed - now handled inside scrapeDSEData 
    try {
      syncDailyToTrends();
      ...
    }
    */
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
