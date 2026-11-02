import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as moment from "moment-timezone";
import { db } from "../config/firebase";
import { StockData } from "../types";
import {
  dedupeResolvedQuotes,
  extractEquityQuotes,
  extractTradingDate,
  findOpeningPrice,
  quoteToStockData,
} from "../utils/dseMarketPage";
import {
  extractDailyReportLinks,
  fetchWithRetry,
  resolveSymbol,
} from "../utils/helpers";

// DSE's Next.js site (issue #225) no longer has a homepage stock table; the
// full quote list lives in the data embedded in this page.
const DSE_EQUITIES_URL = "https://dse.co.tz/en/all-equities";

/**
 * Opening prices for `date`, taken from the latest intraday `marketWatch`
 * snapshot (written by monitorIntraday from api.dse.co.tz). The equities page
 * has no opening price, and `open` drives the frontend's `change = close -
 * open`, so writing 0 would corrupt gainers/losers. Keyed by the snapshot's
 * own symbol names (see `findOpeningPrice`). Best-effort: returns an empty
 * map if there is no snapshot or the read fails.
 */
async function loadMarketWatchOpeningPrices(
  date: string,
): Promise<Map<string, number>> {
  const openingPrices = new Map<string, number>();

  try {
    const snapshot = await db
      .collection("marketWatch")
      .doc(date)
      .collection("snapshots")
      .orderBy("capturedAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`No marketWatch snapshot for ${date}; opening prices unavailable.`);
      return openingPrices;
    }

    const stocks = (snapshot.docs[0].data().stocks ?? {}) as {
      [symbol: string]: { openingPrice?: number };
    };
    for (const [rawSymbol, entry] of Object.entries(stocks)) {
      const price = entry?.openingPrice;
      if (typeof price === "number" && price > 0) {
        openingPrices.set(rawSymbol.trim(), price);
      }
    }
  } catch (error) {
    console.error(`Failed to load marketWatch opening prices for ${date}:`, error);
  }

  return openingPrices;
}

/**
 * Visibility-only alert (never blocks the write) for symbols that traded but
 * had no opening price, so their stored `open` fell back to `prevClose`.
 */
async function alertOnOpenPriceFallback(
  date: string,
  symbols: string[],
): Promise<void> {
  if (symbols.length === 0) return;

  try {
    console.warn(
      JSON.stringify({
        event: "SCRAPER_OPEN_PRICE_FALLBACK",
        date,
        symbols,
        message: `No marketWatch opening price for ${symbols.length} traded symbol(s); used prevClose.`,
      }),
    );

    await sendScraperAlert(
      `⚠️ DSE Scraper: opening price missing for ${date}`,
      `The dse.co.tz equities page doesn't publish opening prices, so the scraper takes ` +
        `them from the intraday marketWatch snapshot. None was available for these ` +
        `${symbols.length} traded symbol(s), so "open" was stored as the previous close:\n\n` +
        `${symbols.join("\n")}\n\n` +
        `The rest of the day's data was imported normally. Check that monitorIntraday ` +
        `(api.dse.co.tz/api/market-data) is still producing snapshots.`,
    );
  } catch (error) {
    console.error("Failed to send open-price fallback alert:", error);
  }
}

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
      `⚠️ DSE Scraper: Unrecognized symbol ${newSymbols.map((s) => `"${s}"`).join(", ")}`,
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
  try {
    console.log(`[${context}] Fetching DSE equities page...`);
    const { data: html } = await fetchWithRetry(DSE_EQUITIES_URL);

    // 1. EXTRACT DATE
    const formattedDate = extractTradingDate(html);

    if (!formattedDate) {
      console.error("Could not find the trading date in the DSE equities page.");
      return { success: false, message: "Trading date not found in page" };
    }

    console.log(`Found trading date: ${formattedDate}`);

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

    // 3. EXTRACT QUOTES
    const quotes = extractEquityQuotes(html);

    if (quotes.length === 0) {
      console.error("Could not find any equity quotes in the DSE equities page.");
      return { success: false, message: "Equity quotes not found in page" };
    }

    console.log(`Parsed ${quotes.length} stock quotes.`);

    // 4. RESOLVE SYMBOLS (one row per stored symbol)
    const knownSymbols = new Set(
      (await db.collection("trends").select().get()).docs.map((d) => d.id),
    );
    const { kept: resolvedQuotes, dropped } = dedupeResolvedQuotes(
      quotes
        .map((quote) => ({
          symbol: resolveSymbol(quote.symbol, knownSymbols),
          quote,
        }))
        .filter((item) => item.symbol),
    );

    if (dropped.length > 0) {
      console.warn(
        JSON.stringify({
          event: "SCRAPER_DUPLICATE_SYMBOL",
          dropped: dropped.map((d) => `${d.quote.symbol} -> ${d.symbol}`),
          message: `Dropped ${dropped.length} row(s) that resolve to a symbol already listed with more activity.`,
        }),
      );
    }

    // 5. CALCULATE DAY TOTAL TURNOVER (for turnoverPercent)
    const dayTotalTurnover = resolvedQuotes.reduce(
      (sum, { quote }) => sum + quote.value,
      0,
    );

    // 6. BUILD STOCK DATA WITH DERIVED METRICS
    const openingPrices = await loadMarketWatchOpeningPrices(formattedDate);
    const resolveSnapshotSymbol = (s: string) => resolveSymbol(s, knownSymbols);
    const openFallbackSymbols: string[] = [];
    const stocksData: StockData[] = [];

    for (const { symbol, quote } of resolvedQuotes) {
      // Block zero, negative, NaN, and Infinity close prices before writing to Firestore
      if (!(quote.last > 0)) {
        console.warn(
          JSON.stringify({
            event: "SCRAPER_ROW_VALIDITY_FAIL",
            symbol,
            rawClose: quote.last,
            message: `Skipping stock row for ${symbol} due to invalid or zero closing price.`,
          })
        );
        continue;
      }

      // No marketWatch open: fall back to prevClose so `change = close - open`
      // stays a sane daily change instead of `close - 0`.
      let open = findOpeningPrice(
        openingPrices,
        quote.symbol,
        symbol,
        resolveSnapshotSymbol,
      );
      if (open === undefined) {
        open = quote.prevClose;
        if (quote.volume > 0) openFallbackSymbols.push(symbol);
      }

      stocksData.push(
        quoteToStockData(quote, symbol, open, dayTotalTurnover),
      );
    }

    console.log(`Writing ${stocksData.length} stocks to Firestore...`);

    // 6b. FLAG SYMBOLS NOT ALREADY TRACKED (best-effort, never blocks the write)
    await alertOnUnrecognizedSymbols(stocksData, knownSymbols);

    // 6c. FLAG TRADED SYMBOLS WHOSE OPEN FELL BACK TO PREVCLOSE (best-effort)
    await alertOnOpenPriceFallback(formattedDate, openFallbackSymbols);

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
