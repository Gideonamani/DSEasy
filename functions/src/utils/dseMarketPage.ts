import { StockData } from "../types";

/**
 * Parsers for the DSE "Market Watch" page (https://dse.co.tz/en/all-equities).
 *
 * dse.co.tz was rebuilt as a Next.js app (see issue #225). The page no longer
 * contains an HTML table of stocks; instead the full quote list is embedded as
 * JSON in the server-rendered React Server Components payload, delivered as a
 * series of `self.__next_f.push([1,"<json string>"])` script calls. We decode
 * those chunks, concatenate them, and pull the objects we need out of the
 * resulting text. Matching is done on field names rather than on array
 * position or a parent key, so reshuffling the page props doesn't break it —
 * only renaming the fields themselves would.
 */

export interface DseEquityQuote {
  symbol: string;
  name: string;
  last: number;
  prevClose: number;
  /** Percent change vs `prevClose`, as displayed by DSE (2 dp). */
  pct: number | null;
  /** Turnover in TZS. */
  value: number;
  volume: number;
  /** Number of deals. `null` for ETFs and growth-market stocks. */
  trades: number | null;
  /** Outstanding bid / offer volume. `null` for ETFs and growth-market stocks. */
  bidVol: number | null;
  askVol: number | null;
  high: number;
  low: number;
  /** Market cap in full TZS (not billions). */
  mcap: number;
  market: string;
}

// `self.__next_f.push([1,"..."])` — the string literal is JSON-escaped, so
// match it with an unrolled `non-quote (escaped-char non-quote)*` loop.
const FLIGHT_CHUNK = /self\.__next_f\.push\(\[1,("[^"\\]*(?:\\.[^"\\]*)*")\]\)/g;

// A flat (no nested braces) object that carries a `prevClose` key. The page's
// i18n label dictionary also has a flat `"prevClose":"Prev Close"` object;
// that one is filtered out below because its values aren't numbers.
const QUOTE_OBJECT = /\{[^{}]*"prevClose"\s*:[^{}]*\}/g;

// `"series":[[1793318400,9836.17],...]` — the TSI/DSEI daily index history.
// Later tabs reference the first tab's series by string ("$1a:props:..."),
// which intentionally doesn't match.
const INDEX_SERIES = /"series"\s*:\s*(\[\[[\d.,\s[\]eE+-]*\]\])/g;

const EAT_OFFSET_SECONDS = 3 * 60 * 60; // Africa/Dar_es_Salaam is UTC+3, no DST.

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);

/** Decode and concatenate the page's React flight chunks into one string. */
function decodeFlightPayload(html: string): string {
  let payload = "";
  for (const match of html.matchAll(FLIGHT_CHUNK)) {
    try {
      payload += JSON.parse(match[1]) as string;
    } catch {
      // Not a plain JSON string literal, so it can't hold the data we need.
    }
  }
  return payload;
}

/**
 * Extract every equity/ETF quote on the page, de-duplicated by symbol.
 * Objects missing a required numeric field are skipped rather than guessed at.
 */
export function extractEquityQuotes(html: string): DseEquityQuote[] {
  const payload = decodeFlightPayload(html);
  const bySymbol = new Map<string, DseEquityQuote>();

  for (const [candidate] of payload.matchAll(QUOTE_OBJECT)) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(candidate);
    } catch {
      continue;
    }

    const symbol = typeof raw.symbol === "string" ? raw.symbol.trim() : "";
    if (!symbol || bySymbol.has(symbol)) continue;

    const { last, prevClose, high, low, volume, value, mcap } = raw;
    if (
      !isNum(last) ||
      !isNum(prevClose) ||
      !isNum(high) ||
      !isNum(low) ||
      !isNum(volume) ||
      !isNum(value) ||
      !isNum(mcap)
    ) {
      continue;
    }

    bySymbol.set(symbol, {
      symbol,
      name: typeof raw.name === "string" ? raw.name.trim() : symbol,
      last,
      prevClose,
      pct: numOrNull(raw.pct),
      value,
      volume,
      trades: numOrNull(raw.trades),
      bidVol: numOrNull(raw.bidVol),
      askVol: numOrNull(raw.askVol),
      high,
      low,
      mcap,
      market: typeof raw.market === "string" ? raw.market : "",
    });
  }

  return [...bySymbol.values()];
}

/**
 * The trading day the page's data belongs to, as `YYYY-MM-DD` in EAT.
 *
 * The page has no "as of" label, but its index charts end on the latest
 * trading day (a Unix timestamp at that day's midnight). Taking the newest
 * point across the indices errs on the safe side if the page is stale: the
 * scraper then sees a date it already has and simply retries next hour,
 * rather than filing the data under the wrong day.
 */
export function extractTradingDate(html: string): string | null {
  const payload = decodeFlightPayload(html);
  let latest = 0;

  for (const [, json] of payload.matchAll(INDEX_SERIES)) {
    let points: unknown;
    try {
      points = JSON.parse(json);
    } catch {
      continue;
    }
    if (!Array.isArray(points) || points.length === 0) continue;

    const lastPoint: unknown = points[points.length - 1];
    const timestamp = Array.isArray(lastPoint) ? lastPoint[0] : undefined;
    if (isNum(timestamp) && timestamp > latest) latest = timestamp;
  }

  if (!latest) return null;
  return new Date((latest + EAT_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10);
}

/** DSE-style change text, e.g. "▲ 1.63" / "▼ -1.62" / "0.00". */
export function formatChange(pct: number): string {
  if (pct > 0) return `▲ ${pct.toFixed(2)}`;
  if (pct < 0) return `▼ ${pct.toFixed(2)}`;
  return "0.00";
}

/**
 * Map a page quote to the `StockData` shape we store in Firestore, including
 * the derived metrics. `symbol` is the canonical (already resolved) symbol,
 * `open` the opening price (the page doesn't publish one), and
 * `dayTotalTurnover` the market-wide turnover used for `turnoverPercent`.
 */
export function quoteToStockData(
  quote: DseEquityQuote,
  symbol: string,
  open: number,
  dayTotalTurnover: number,
): StockData {
  const { last: close, prevClose, high, low, value: turnover, volume } = quote;
  const deals = quote.trades ?? 0;
  const outstandingBid = quote.bidVol ?? 0;
  const outstandingOffer = quote.askVol ?? 0;
  // Float noise like 1039955999999.9999 isn't meaningful; mcap is whole TZS.
  const mcap = Math.round(quote.mcap);

  const changeValue =
    quote.pct ??
    (prevClose > 0
      ? Math.round(((close - prevClose) / prevClose) * 10000) / 100
      : 0);

  return {
    symbol,
    source: "scraper" as const,
    open,
    prevClose,
    close,
    high,
    low,
    change: formatChange(changeValue),
    changeValue,
    turnover,
    deals,
    outstandingBid,
    outstandingOffer,
    volume,
    mcap,
    highLowSpread: high - low,
    volPerDeal: deals > 0 ? volume / deals : 0,
    turnoverPerDeal: deals > 0 ? turnover / deals : 0,
    turnoverPerMcap: mcap > 0 ? turnover / mcap : 0,
    turnoverPercent:
      dayTotalTurnover > 0 ? (turnover / dayTotalTurnover) * 100 : 0,
    changePerVol: volume > 0 ? changeValue / volume : 0,
    bidOfferRatio: outstandingOffer > 0 ? outstandingBid / outstandingOffer : 0,
  };
}
