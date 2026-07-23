// New scraped whitespace/hyphen variants (e.g. "VERTEX- ETF") don't need an
// entry here — `resolveSymbol` in utils/helpers.ts matches those against
// known trends/{symbol} docs automatically (see issue #208). "VERTEX-ETF"
// and "IEACLC-ETF" stay listed explicitly because `normalizeSymbol` (used by
// the public getTickerPrice API in handlers/prices.ts, which intentionally
// does static-only matching) relies on them for the dashed form documented
// in integrations/sheets/README.md.
export const SYMBOL_MAPPINGS: { [key: string]: string } = {
  "VERTEX-ETF": "VERTEX ETF",
  "IEACLC-ETF": "IEACLC ETF",
  "ITRUST ETF": "IEACLC ETF",
  // DSE's homepage equity-watch table has truncated both tracked ETFs'
  // symbols to this form before (see issue #206). Both are 10 characters,
  // so map the truncated form defensively for each.
  "VERTEX ET": "VERTEX ETF",
  "IEACLC ET": "IEACLC ETF",
};

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  Connection: "keep-alive",
};

export const GAP_THRESHOLD_PCT = 2;
