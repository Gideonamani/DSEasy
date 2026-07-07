import axios, { AxiosError } from "axios";
import * as https from "https";
import { BROWSER_HEADERS, SYMBOL_MAPPINGS } from "../constants";
import { DailyReportLink } from "../types";

// DSE website (dse.co.tz) has an expired SSL certificate.
// This agent bypasses certificate validation so scraping can continue.
// TODO: Remove this once DSE renews their SSL certificate.
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Fetch a URL with automatic retry on 429 (Too Many Requests) errors.
 * - Uses browser-like headers to reduce bot detection.
 * - Parses the `retry-after` response header (seconds) from the server.
 * - Falls back to exponential backoff if no retry-after header is present.
 * @param url - The URL to fetch
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeout - Request timeout in ms (default: 30000)
 */
export async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  timeout = 30000,
): Promise<{ data: any }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout,
        httpsAgent: insecureAgent,
      });
      return response;
    } catch (error) {
      const axiosErr = error as AxiosError;

      // Only retry on 429 (rate limit) errors
      if (axiosErr.response?.status === 429 && attempt < maxRetries) {
        // Parse retry-after header (in seconds), default to exponential backoff
        const retryAfterHeader = axiosErr.response.headers["retry-after"];
        const retryAfterSecs = retryAfterHeader
          ? parseInt(String(retryAfterHeader), 10)
          : Math.pow(2, attempt + 1); // 2s, 4s, 8s fallback

        const waitMs = (isNaN(retryAfterSecs) ? 5 : retryAfterSecs) * 1000;

        console.warn(
          `[fetchWithRetry] 429 on ${url} (attempt ${attempt + 1}/${maxRetries}). ` +
            `Waiting ${waitMs / 1000}s before retry...`,
        );

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Non-429 error or exhausted retries — rethrow
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs a return
  throw new Error(
    `[fetchWithRetry] All ${maxRetries} retries exhausted for ${url}`,
  );
}

/**
 * Random jitter delay (1-30 seconds) to avoid hitting rate limits
 * at the same time as other GCP users on shared IP pools.
 */
export async function randomJitter(): Promise<void> {
  const jitterMs = Math.floor(Math.random() * 29000) + 1000; // 1s to 30s
  console.log(
    `[Jitter] Waiting ${(jitterMs / 1000).toFixed(1)}s before making requests...`,
  );
  await new Promise((resolve) => setTimeout(resolve, jitterMs));
}

export function normalizeSymbol(rawSymbol: string): string {
  if (!rawSymbol) return "";
  const trimmed = rawSymbol.trim();
  return SYMBOL_MAPPINGS[trimmed] || trimmed;
}

export function parseNum(val: string | number | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = val.toString().replace(/,/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function parseChangeValue(str: string): number {
  if (!str) return 0;
  // Match number at the end: "-▼ -2.48" -> -2.48
  const matches = str.match(/[-+]?\d*\.?\d+/g);
  if (matches && matches.length > 0) {
    return parseFloat(matches[matches.length - 1]);
  }
  return 0;
}

// Convert "February 7, 2026" -> "7Feb2026"
export function formatDateForSheet(longDateStr: string): string | null {
  const parts = longDateStr.replace(/,/g, "").split(" "); // ["February", "7", "2026"]
  if (parts.length < 3) return null;

  const monthNumbers: { [key: string]: string } = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };

  const month = monthNumbers[parts[0]];
  const day = parts[1].padStart(2, "0");
  const year = parts[2];

  if (!month) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Parse the "Daily Market Reports" cards on the DSE homepage.
 * Each card pairs a date (e.g. "6<suZ>th</suZ> July 2026" - the <suZ> ordinal
 * tag appears to be a template quirk on DSE's end, not standard HTML) with a
 * report link whose token is base64 JSON of Laravel's encrypt() payload
 * ({iv, value, mac, tag}). Cards appear in the same order on the page, so
 * dates and hrefs are paired positionally.
 */
export function extractDailyReportLinks(html: string): DailyReportLink[] {
  const dateRegex =
    /<span>Date:\s*<\/span>\s*(\d{1,2})<suZ>[^<]*<\/suZ>\s*([A-Za-z]+)\s+(\d{4})/g;
  const hrefRegex = /href="(https:\/\/dse\.co\.tz\/get\/daily\/report\/([^"]+))"/g;

  const dateMatches = [...html.matchAll(dateRegex)];
  const hrefMatches = [...html.matchAll(hrefRegex)];

  const links: DailyReportLink[] = [];

  for (let i = 0; i < Math.min(dateMatches.length, hrefMatches.length); i++) {
    const [, day, month, year] = dateMatches[i];
    const formattedDate = formatDateForSheet(`${month} ${day}, ${year}`);
    const [, reportUrl, token] = hrefMatches[i];

    if (!formattedDate) continue;

    let iv = "";
    let value = "";
    let mac = "";
    try {
      const decoded = JSON.parse(
        Buffer.from(token, "base64").toString("utf-8"),
      );
      iv = decoded.iv || "";
      value = decoded.value || "";
      mac = decoded.mac || "";
    } catch {
      // Token wasn't the expected base64 JSON shape - store raw token only.
    }

    links.push({ date: formattedDate, reportUrl, token, iv, value, mac });
  }

  return links;
}

export function formatLargeNumber(num: number): string {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return new Intl.NumberFormat("en-US").format(num);
}
