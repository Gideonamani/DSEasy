import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";
import { StockData } from "../types";
import {
  extractDailyReportLinks,
  fetchWithRetry,
  formatDateForSheet,
  parseChangeValue,
  parseNum,
  resolveSymbol,
} from "../utils/helpers";

/**
 * Alert on symbols that don't already have a `trends/{symbol}` doc, so a DSE
 * site change (renamed ticker, new listing, or a spacing/hyphen variant
 * `resolveSymbol` couldn't match) surfaces immediately instead of silently
 * starting a disconnected history under the wrong key (see issue #206/#208).
 * This never blocks the write — unlike the old Google Sheets automation,
 * unrecognized symbols are still written to Firestore; this is visibility
 * only, so a real new listing isn't lost while someone verifies whether
 * SYMBOL_MAPPINGS needs an entry.
 */
async function alertOnUnrecognizedSymbols(
  stocksData: StockData[],
  knownSymbols: Set<string>,
): Promise<void> {
  try {
    const newSymbols = [
      ...new Set(
        stocksData
          .map((s) => s.symbol)
          .filter((symbol) => !knownSymbols.has(symbol)),
      ),
    ];

    if (newSymbols.length === 0) return;

    console.warn(
      JSON.stringify({
        event: "SCRAPER_UNRECOGNIZED_SYMBOL",
        symbols: newSymbols,
        message: `Found symbol(s) with no existing trends doc: ${newSymbols.join(", ")}`,
      }),
    );

    await sendScraperAlert(
      "⚠️ DSE Scraper: New/Unrecognized Symbol(s) Detected",
      `The scraper found symbol(s) with no existing trends/{symbol} history:\n\n` +
        `${newSymbols.join("\n")}\n\n` +
        `These were still written to Firestore as new tickers (nothing is blocked). ` +
        `If this is a genuine new listing, no action is needed. If it's a renamed or ` +
        `truncated form of an existing ticker (e.g. a site formatting change), add a ` +
        `mapping to SYMBOL_MAPPINGS in functions/src/constants/index.ts and run the ` +
        `matching cleanup script to merge the fragmented history back together.`,
    );
  } catch (error) {
    console.error("Failed to check for unrecognized symbols:", error);
  }
}

/**
 * Record the DSE daily-report link for `formattedDate`, if present among the
 * homepage's report cards and not already recorded. Best-effort: the report
 * card can lag behind the summary table appearing, and we don't yet know the
 * token's lifetime/rotation rules, so failures here must never break the
 * primary dailyClosing scrape (see issue #203).
 */
async function recordDailyReportLink(
  html: string,
  formattedDate: string,
): Promise<void> {
  try {
    const reportLinkRef = db.collection("dailyReportLinks").doc(formattedDate);
    const existing = await reportLinkRef.get();
    if (existing.exists) return;

    const link = extractDailyReportLinks(html).find(
      (l) => l.date === formattedDate,
    );
    if (!link) return;

    await reportLinkRef.set({
      ...link,
      firstSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Recorded daily report link for ${formattedDate}.`);
  } catch (error) {
    console.error(
      `Failed to record daily report link for ${formattedDate}:`,
      error,
    );
  }
}

export async function scrapeDSEAndWriteToFirestore(
  context: "Scheduled" | "Manual" = "Manual",
): Promise<{
  success: boolean;
  message: string;
  date?: string;
  stockCount?: number;
}> {
  const url = "https://dse.co.tz";

  try {
    console.log(`[${context}] Fetching DSE homepage...`);
    const { data: html } = await fetchWithRetry(url);

    // 1. EXTRACT DATE
    const dateRegex =
      /Market Summary\s*:\s*<\/h5>\s*<h5[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/h5>/i;
    const dateMatch = html.match(dateRegex);

    if (!dateMatch) {
      console.error("Could not find Market Summary date on DSE homepage.");
      return { success: false, message: "Date not found in HTML" };
    }

    const rawDateStr = dateMatch[1].trim();
    const formattedDate = formatDateForSheet(rawDateStr);

    if (!formattedDate) {
      console.error(`Could not parse date: ${rawDateStr}`);
      return { success: false, message: `Date parse failed: ${rawDateStr}` };
    }

    console.log(`Found date: ${rawDateStr} -> ${formattedDate}`);

    // 2. CHECK IF ALREADY EXISTS
    const dailyDocRef = db.collection("dailyClosing").doc(formattedDate);
    const existingDoc = await dailyDocRef.get();

    if (existingDoc.exists) {
      console.log(
        JSON.stringify({
          event: "DAILY_CLOSING_SKIP",
          reason: "ALREADY_EXISTS",
          date: formattedDate,
          message: `Data for ${formattedDate} already exists. Skipping.`,
        }),
      );

      // The report link can be posted after the table, so keep checking
      // for it even once the table itself is already in Firestore.
      await recordDailyReportLink(html, formattedDate);

      return { success: true, message: "Already exists", date: formattedDate };
    }

    // 3. EXTRACT TABLE DATA
    const tableStartRegex = /id="equity-watch"[^>]*>[\s\S]*?<tbody[^>]*>/i;
    const tableStartMatch = html.match(tableStartRegex);

    if (!tableStartMatch) {
      console.error("Could not find Equity table in HTML.");
      return { success: false, message: "Equity table not found" };
    }

    const tableContentStart = tableStartMatch.index! + tableStartMatch[0].length;
    const htmlAfterTableStart = html.substring(tableContentStart);
    const tbodyEndIndex = htmlAfterTableStart.indexOf("</tbody>");

    if (tbodyEndIndex === -1) {
      console.error("Could not find end of Equity table.");
      return { success: false, message: "Table end not found" };
    }

    const tbodyContent = htmlAfterTableStart.substring(0, tbodyEndIndex);

    // 4. PARSE ROWS
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    const parsedRows: string[][] = [];

    while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
      const rowInnerHtml = rowMatch[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowInnerHtml)) !== null) {
        let content = cellMatch[1];
        content = content.replace(/<[^>]+>/g, ""); // Remove HTML tags
        content = content.replace(/\s+/g, " ").trim(); // Clean whitespace
        cells.push(content);
      }

      if (cells.length > 0) {
        parsedRows.push(cells);
      }
    }

    if (parsedRows.length === 0) {
      console.error("No data rows found in the table.");
      return { success: false, message: "No data rows found" };
    }

    console.log(`Parsed ${parsedRows.length} stock rows.`);

    // 5. CALCULATE DAY TOTAL TURNOVER (for turnoverPercent)
    let dayTotalTurnover = 0;
    for (const row of parsedRows) {
      if (row.length >= 13 && row[0] !== "Total") {
        dayTotalTurnover += parseNum(row[7]);
      }
    }

    // 6. BUILD STOCK DATA WITH DERIVED METRICS
    const knownSymbols = new Set(
      (await db.collection("trends").select().get()).docs.map((d) => d.id),
    );
    const stocksData: StockData[] = [];

    for (const row of parsedRows) {
      if (row.length < 13) continue;
      const symbol = resolveSymbol(row[0], knownSymbols);
      if (!symbol || symbol === "Total" || symbol === "Co.") continue;

      const open = parseNum(row[1]);
      const prevClose = parseNum(row[2]);
      const close = parseNum(row[3]);
      const high = parseNum(row[4]);
      const low = parseNum(row[5]);
      const changeStr = row[6];
      const turnover = parseNum(row[7]);
      const deals = parseNum(row[8]);
      const outstandingBid = parseNum(row[9]);
      const outstandingOffer = parseNum(row[10]);
      const volume = parseNum(row[11]);
      let mcap = parseNum(row[12]);

      // Block zero, negative, NaN, and Infinity close prices before writing to Firestore
      if (!(close > 0)) {
        console.warn(
          JSON.stringify({
            event: "SCRAPER_ROW_VALIDITY_FAIL",
            symbol,
            rawClose: row[3],
            message: `Skipping stock row for ${symbol} due to invalid or zero closing price.`,
          })
        );
        continue;
      }

      // DSE website reports MCAP in Billions (e.g. 1.23 = 1.23B TZS).
      // Expand to full number for uniform storage across all sources.
      if (mcap > 0 && Math.abs(mcap) < 1000000) {
        mcap = mcap * 1000000000;
      }

      // 8 Derived Metrics
      const changeValue = parseChangeValue(changeStr);
      const highLowSpread = high - low;
      const volPerDeal = deals > 0 ? volume / deals : 0;
      const turnoverPerDeal = deals > 0 ? turnover / deals : 0;
      const turnoverPerMcap = mcap > 0 ? turnover / mcap : 0;
      const turnoverPercent =
        dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0;
      const changePerVol = volume > 0 ? changeValue / volume : 0;
      const bidOfferRatio =
        outstandingOffer > 0 ? outstandingBid / outstandingOffer : 0;

      stocksData.push({
        symbol,
        source: "scraper" as const,
        open,
        prevClose,
        close,
        high,
        low,
        change: changeStr,
        changeValue,
        turnover,
        deals,
        outstandingBid,
        outstandingOffer,
        volume,
        mcap,
        highLowSpread,
        volPerDeal,
        turnoverPerDeal,
        turnoverPerMcap,
        turnoverPercent,
        changePerVol,
        bidOfferRatio,
      });
    }

    console.log(`Writing ${stocksData.length} stocks to Firestore...`);

    // 6b. FLAG SYMBOLS NOT ALREADY TRACKED (best-effort, never blocks the write)
    await alertOnUnrecognizedSymbols(stocksData, knownSymbols);

    // 7. BATCH WRITE TO FIRESTORE
    const batch = db.batch();

    // A. dailyClosing/{date} document
    batch.set(dailyDocRef, {
      date: formattedDate,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      stockCount: stocksData.length,
    });

    for (const stock of stocksData) {
      // B. dailyClosing/{date}/stocks/{symbol}
      const stockRef = dailyDocRef.collection("stocks").doc(stock.symbol);
      batch.set(stockRef, stock);

      // C. trends/{symbol} - update lastUpdated
      const trendsRef = db.collection("trends").doc(stock.symbol);
      batch.set(
        trendsRef,
        {
          symbol: stock.symbol,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // D. trends/{symbol}/dailyClosingHistory/{date}
      const historyRef = trendsRef
        .collection("dailyClosingHistory")
        .doc(formattedDate);
      batch.set(historyRef, {
        date: formattedDate,
        ...stock,
      });
    }

    // E. dailyReportLinks/{date} - if today's report card is already up
    const todaysReportLink = extractDailyReportLinks(html).find(
      (l) => l.date === formattedDate,
    );
    if (todaysReportLink) {
      const reportLinkRef = db.collection("dailyReportLinks").doc(formattedDate);
      batch.set(reportLinkRef, {
        ...todaysReportLink,
        firstSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log("Batch write complete.");

    // 8. UPDATE CONFIG/APP.AVAILABLEDATES
    const configRef = db.collection("config").doc("app");
    await configRef.set(
      {
        availableDates: admin.firestore.FieldValue.arrayUnion(formattedDate),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(
      JSON.stringify({
        event: "DAILY_CLOSING_SUCCESS",
        date: formattedDate,
        stockCount: stocksData.length,
        message: `Successfully imported ${stocksData.length} stocks for ${formattedDate}`,
      }),
    );

    return {
      success: true,
      message: `Imported ${stocksData.length} stocks`,
      date: formattedDate,
      stockCount: stocksData.length,
    };
  } catch (error) {
    console.error("Error in scrapeDSEAndWriteToFirestore:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    const isScheduled = context === "Scheduled";

    const subject = isScheduled
      ? `[Scheduled Refresh] 🚨 DSE Scraper Error`
      : `🚨 DSE Daily Closing Scraper Error (${context})`;

    const body =
      (isScheduled
        ? "NOTE: This is an automated hourly attempt (17:00 - 23:00 EAT).\n" +
          "If this is not the 23:00 run, it will automatically retry in an hour.\n" +
          "No manual action is likely required unless this persists.\n\n"
        : "") +
      `The scraper failed during ${context} execution.\n\n` +
      `Error: ${err.message}\n\n` +
      `Stack:\n${err.stack || "N/A"}`;

    await sendScraperAlert(subject, body);
    return { success: false, message: `Error: ${error}` };
  }
}

export async function sendScraperAlert(subject: string, body: string) {
  const email = process.env.SMTP_EMAIL;
  const password = process.env.SMTP_PASSWORD;
  const recipient = process.env.ALERT_RECIPIENT;

  if (!email || !password || !recipient) {
    console.warn("Skipping email alert: SMTP credentials missing in env.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: email,
      pass: password,
    },
  });

  // Identifies which deployed Cloud Function sent this and when, so it's
  // unmistakable at a glance whether an alert came from this pipeline (as
  // opposed to e.g. a stale trigger left over from a decommissioned
  // integration — see issue #208).
  const functionName =
    process.env.FUNCTION_TARGET || process.env.K_SERVICE || "unknown-function";
  const ranAt = moment().tz("Africa/Dar_es_Salaam").format("YYYY-MM-DD HH:mm:ss z");
  const footer = `\n\n---\nSent by Firebase Cloud Function "${functionName}" at ${ranAt} (EAT).`;

  try {
    await transporter.sendMail({
      from: `"DSE Scraper" <${email}>`,
      to: recipient,
      subject: subject,
      text: body + footer,
    });
    console.log("Alert email sent successfully.");
  } catch (error) {
    console.error("Failed to send alert email:", error);
  }
}
