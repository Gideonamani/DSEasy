import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DseEquityQuote,
  ResolvedQuote,
  dedupeResolvedQuotes,
  extractEquityQuotes,
  extractTradingDate,
  findOpeningPrice,
  formatChange,
  quoteToStockData,
} from "./dseMarketPage";
// Only dependency-free modules here: root CI runs `npm ci` without
// functions/node_modules, so importing ./helpers (axios) would not resolve.
import { SYMBOL_MAPPINGS } from "../constants";

// Real https://dse.co.tz/en/all-equities data for 2026-10-30, trimmed to the
// flight chunks that matter. The quotes array is split across two chunks
// mid-object, as it can be on the live page.
const fixture = readFileSync(
  fileURLToPath(
    new URL("./__fixtures__/all-equities-2026-10-30.html", import.meta.url),
  ),
  "utf8",
);

// Wrap a payload the way Next.js does: a JSON-escaped string in a push call.
const flight = (payload: string) =>
  `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;

const quoteJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    symbol: "CRDB",
    name: "CRDB BANK PUBLIC LIMITED COMPANY",
    bidVol: 122506,
    askVol: 112310,
    last: 2840,
    prevClose: 2840,
    pct: 0,
    value: 1569751080,
    volume: 552720,
    trades: 909,
    high: 2870,
    low: 2820,
    mcap: 7417622000000,
    market: "main",
    ...overrides,
  });

describe("extractEquityQuotes", () => {
  const quotes = extractEquityQuotes(fixture);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  it("finds every equity and ETF on the page", () => {
    expect(quotes).toHaveLength(32);
    expect(quotes.filter((q) => q.market === "etf")).toHaveLength(4);
  });

  it("reads all fields for a regular equity", () => {
    expect(bySymbol.get("CRDB")).toEqual({
      symbol: "CRDB",
      name: "CRDB BANK PUBLIC LIMITED COMPANY",
      bidVol: 122506,
      askVol: 112310,
      last: 2840,
      prevClose: 2840,
      pct: 0,
      value: 1569751080,
      volume: 552720,
      trades: 909,
      high: 2870,
      low: 2820,
      mcap: 7417622000000,
      market: "main",
    });
  });

  it("keeps rows whose deal and order-book fields are null (ETFs)", () => {
    expect(bySymbol.get("IEACLC-ETF")).toMatchObject({
      bidVol: null,
      askVol: null,
      trades: null,
      volume: 493441,
      market: "etf",
    });
  });

  it("reads rows that straddle a flight chunk boundary", () => {
    expect(bySymbol.get("DCB")).toMatchObject({ last: 400, prevClose: 395, pct: 1.27 });
  });

  it("agrees with the page's own headline turnover (equities only)", () => {
    const equityTurnover = quotes
      .filter((q) => q.market !== "etf")
      .reduce((sum, q) => sum + q.value, 0);
    expect(equityTurnover).toBe(3765157100);
  });

  it("ignores the i18n label object that also has a prevClose key", () => {
    const page = flight(
      `{"stats":{"marketCap":"Market Cap.","prevClose":"Prev Close"}},${quoteJson()}`,
    );
    expect(extractEquityQuotes(page).map((q) => q.symbol)).toEqual(["CRDB"]);
  });

  it("de-duplicates a symbol that appears more than once", () => {
    const page = flight(`${quoteJson()},${quoteJson({ last: 9999 })}`);
    const result = extractEquityQuotes(page);
    expect(result).toHaveLength(1);
    expect(result[0].last).toBe(2840);
  });

  it("skips quotes that are missing a required numeric field", () => {
    const withoutVolume = JSON.parse(quoteJson());
    delete withoutVolume.volume;
    const page = flight(
      `${JSON.stringify(withoutVolume)},${quoteJson({ symbol: "NMB" })}`,
    );
    expect(extractEquityQuotes(page).map((q) => q.symbol)).toEqual(["NMB"]);
  });

  it("finds nothing on markup without flight data (e.g. the old homepage)", () => {
    const oldHomepage =
      '<table id="equity-watch"><tbody><tr><td>CRDB</td></tr></tbody></table>';
    expect(extractEquityQuotes(oldHomepage)).toEqual([]);
  });
});

describe("extractTradingDate", () => {
  const series = (...timestamps: number[]) =>
    JSON.stringify(timestamps.map((t) => [t, 9000.5]));

  it("returns the latest index date from the real page", () => {
    expect(extractTradingDate(fixture)).toBe("2026-10-30");
  });

  it("uses the newest point across all indices", () => {
    const page = flight(
      `"series":${series(1793232000, 1793318400)},"series":${series(1793145600, 1793232000)}`,
    );
    expect(extractTradingDate(page)).toBe("2026-10-30");
  });

  it("ignores series that are only a string reference to another tab", () => {
    const page = flight(
      `"series":${series(1793318400)},"series":"$1a:props:tabs:0:indices:0:series"`,
    );
    expect(extractTradingDate(page)).toBe("2026-10-30");
  });

  it("resolves the date in EAT, not UTC", () => {
    // 21:00 UTC on the 29th is midnight EAT on the 30th.
    expect(extractTradingDate(flight(`"series":${series(1793307600)}`))).toBe(
      "2026-10-30",
    );
    // 00:00 UTC is 03:00 EAT, the same day.
    expect(extractTradingDate(flight(`"series":${series(1793318400)}`))).toBe(
      "2026-10-30",
    );
  });

  it("returns null when the page has no index series", () => {
    expect(extractTradingDate(flight(quoteJson()))).toBeNull();
    expect(extractTradingDate("<html>no flight data</html>")).toBeNull();
  });

  it("returns null for an empty series", () => {
    expect(extractTradingDate(flight('"series":[[]]'))).toBeNull();
  });
});

describe("formatChange", () => {
  it("formats gains, losses and flat moves as DSE-style change text", () => {
    expect(formatChange(1.63)).toBe("▲ 1.63");
    expect(formatChange(-1.62)).toBe("▼ -1.62");
    expect(formatChange(0)).toBe("0.00");
  });
});

describe("quoteToStockData", () => {
  const quotes = extractEquityQuotes(fixture);
  const dayTotalTurnover = quotes.reduce((sum, q) => sum + q.value, 0);
  const find = (symbol: string): DseEquityQuote => {
    const quote = quotes.find((q) => q.symbol === symbol);
    if (!quote) throw new Error(`fixture is missing ${symbol}`);
    return quote;
  };

  it("maps page fields onto the stored StockData shape with derived metrics", () => {
    const stock = quoteToStockData(find("CRDB"), "CRDB", 2830, dayTotalTurnover);

    expect(stock).toMatchObject({
      symbol: "CRDB",
      source: "scraper",
      open: 2830,
      prevClose: 2840,
      close: 2840,
      high: 2870,
      low: 2820,
      change: "0.00",
      changeValue: 0,
      turnover: 1569751080,
      deals: 909,
      outstandingBid: 122506,
      outstandingOffer: 112310,
      volume: 552720,
      mcap: 7417622000000,
      highLowSpread: 50,
      changePerVol: 0,
    });
    expect(stock.volPerDeal).toBeCloseTo(552720 / 909);
    expect(stock.turnoverPerDeal).toBeCloseTo(1569751080 / 909);
    expect(stock.turnoverPerMcap).toBeCloseTo(1569751080 / 7417622000000);
    expect(stock.turnoverPercent).toBeCloseTo(
      (1569751080 / dayTotalTurnover) * 100,
    );
    expect(stock.bidOfferRatio).toBeCloseTo(122506 / 112310);
  });

  it("stores the page's percent change as changeValue and a DSE-style change string", () => {
    const loser = quoteToStockData(find("NMB"), "NMB", 1850, dayTotalTurnover);
    expect(loser.changeValue).toBe(-1.62);
    expect(loser.change).toBe("▼ -1.62");
    expect(loser.changePerVol).toBeCloseTo(-1.62 / 764065);

    const gainer = quoteToStockData(find("VODA"), "VODA", 1230, dayTotalTurnover);
    expect(gainer.changeValue).toBe(1.63);
    expect(gainer.change).toBe("▲ 1.63");
  });

  it("zeroes deal and order-book metrics when the page reports null (ETFs)", () => {
    const etf = quoteToStockData(
      find("IEACLC-ETF"),
      "IEACLC ETF",
      1400,
      dayTotalTurnover,
    );

    expect(etf.symbol).toBe("IEACLC ETF");
    expect(etf).toMatchObject({
      deals: 0,
      outstandingBid: 0,
      outstandingOffer: 0,
      volPerDeal: 0,
      turnoverPerDeal: 0,
      bidOfferRatio: 0,
    });
  });

  it("rounds float noise out of market cap", () => {
    const stock = quoteToStockData(find("TPCC"), "TPCC", 5750, dayTotalTurnover);
    expect(stock.mcap).toBe(1039956000000);
  });

  it("derives the percent change from prices when the page has none", () => {
    const quote: DseEquityQuote = { ...find("NMB"), pct: null };
    const stock = quoteToStockData(quote, "NMB", 1850, dayTotalTurnover);
    expect(stock.changeValue).toBe(-1.62);
  });

  it("avoids division by zero for a stock with no trades or turnover", () => {
    const stock = quoteToStockData(find("EABL"), "EABL", 5400, dayTotalTurnover);
    expect(stock).toMatchObject({
      volume: 0,
      turnover: 0,
      turnoverPercent: 0,
      changePerVol: 0,
      volPerDeal: 0,
    });
    expect(Number.isFinite(stock.turnoverPerMcap)).toBe(true);
  });
});

describe("dedupeResolvedQuotes", () => {
  const quotes = extractEquityQuotes(fixture);
  // The exact-alias step of the scraper's resolveSymbol (which needs axios).
  const resolveName = (symbol: string) => SYMBOL_MAPPINGS[symbol] ?? symbol;
  const resolveAll = (list: DseEquityQuote[]): ResolvedQuote[] =>
    list.map((quote) => ({ symbol: resolveName(quote.symbol), quote }));
  const row = (symbol: string, value: number, volume: number): ResolvedQuote => ({
    symbol,
    quote: { ...quotes[0], symbol, value, volume },
  });

  it("maps ZAN TIMIZA ETF onto the stored ZAN-ETF symbol", () => {
    expect(SYMBOL_MAPPINGS["ZAN TIMIZA ETF"]).toBe("ZAN-ETF");
    expect(resolveName("ZAN TIMIZA ETF")).toBe("ZAN-ETF");
    expect(resolveName("ZAN-ETF")).toBe("ZAN-ETF");
  });

  it("keeps the real fund, not the dormant ZAN-ETF row, from the real page", () => {
    const { kept, dropped } = dedupeResolvedQuotes(resolveAll(quotes));
    const zan = kept.filter((item) => item.symbol === "ZAN-ETF");

    expect(kept).toHaveLength(31);
    expect(zan).toHaveLength(1);
    expect(zan[0].quote).toMatchObject({
      symbol: "ZAN TIMIZA ETF",
      value: 290105290,
      mcap: 11382000000,
      last: 120,
    });
    expect(dropped.map((d) => d.quote.symbol)).toEqual(["ZAN-ETF"]);
  });

  it("picks the same row whichever order the page lists them in", () => {
    const reversed = resolveAll([...quotes].reverse());
    const { kept } = dedupeResolvedQuotes(reversed);

    expect(kept.find((item) => item.symbol === "ZAN-ETF")?.quote.symbol).toBe(
      "ZAN TIMIZA ETF",
    );
  });

  it("breaks a turnover tie on volume, then keeps the first listed", () => {
    const byVolume = dedupeResolvedQuotes([row("X", 0, 10), row("X", 0, 500)]);
    expect(byVolume.kept[0].quote.volume).toBe(500);

    const first = row("X", 5, 7);
    const second = row("X", 5, 7);
    const tie = dedupeResolvedQuotes([first, second]);
    expect(tie.kept).toEqual([first]);
    expect(tie.kept[0]).toBe(first);
    expect(tie.dropped[0]).toBe(second);
  });

  it("leaves distinct symbols alone and keeps first-appearance order", () => {
    const { kept, dropped } = dedupeResolvedQuotes([
      row("A", 1, 1),
      row("B", 2, 2),
      row("A", 9, 9),
    ]);

    expect(kept.map((item) => item.symbol)).toEqual(["A", "B"]);
    expect(kept[0].quote.value).toBe(9);
    expect(dropped).toHaveLength(1);
  });
});

describe("findOpeningPrice", () => {
  const resolve = (s: string) => SYMBOL_MAPPINGS[s] ?? s;

  it("prefers the exact page name so rows sharing a symbol keep their own price", () => {
    const prices = new Map([
      ["ZAN-ETF", 110],
      ["ZAN TIMIZA ETF", 120],
    ]);
    expect(findOpeningPrice(prices, "ZAN TIMIZA ETF", "ZAN-ETF", resolve)).toBe(120);
    expect(findOpeningPrice(prices, "ZAN-ETF", "ZAN-ETF", resolve)).toBe(110);
  });

  it("falls back to a snapshot name that resolves to the same stored symbol", () => {
    const prices = new Map([["VERTEX ETF", 310]]);
    expect(findOpeningPrice(prices, "VERTEX-ETF", "VERTEX ETF", resolve)).toBe(310);
  });

  it("returns undefined when the snapshot has nothing for the symbol", () => {
    const prices = new Map([["CRDB", 2830]]);
    expect(findOpeningPrice(prices, "NMB", "NMB", resolve)).toBeUndefined();
    expect(findOpeningPrice(new Map(), "NMB", "NMB", resolve)).toBeUndefined();
  });
});
