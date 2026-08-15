import { describe, expect, it } from "vitest";
import type { CorporateAction, StockData } from "../types/market";
import {
  adjustStockDataForCorporateActions,
  getSplitAdjustmentFactors,
  getVisibleSuspensionDates,
  insertSuspensionGaps,
} from "./corporateActions";

const nmbSplit: CorporateAction = {
  id: "NMB-2026-08-24-10-for-1",
  ticker: "NMB",
  actionType: "share_split",
  ratioNew: 10,
  ratioOld: 1,
  announcementDate: "2026-07-27",
  lastCumDate: "2026-08-19",
  suspensionStart: "2026-08-20",
  suspensionEnd: "2026-08-21",
  effectiveDate: "2026-08-24",
  sourceUrl: "https://dse.co.tz/example.pdf",
  status: "approved",
};

const point: StockData = {
  symbol: "NMB",
  date: "2026-08-19",
  open: 16_700,
  close: 16_730,
  high: 16_800,
  low: 16_600,
  prevClose: 16_650,
  change: 30,
  pctChange: 0.18,
  spread: 200,
  volume: 100_000,
  outstandingBid: 5_000,
  outstandingOffer: 2_000,
  volDeal: 100,
  changeVol: 0.0000018,
  turnover: 1_673_000_000,
  mcap: 8_365_000_000_000,
  deals: 1_000,
};

describe("corporate action adjustments", () => {
  it("adjusts pre-split prices and quantities without changing value fields", () => {
    const adjusted = adjustStockDataForCorporateActions(
      point,
      [nmbSplit],
      "2026-08-24",
    );

    expect(adjusted.close).toBe(1_673);
    expect(adjusted.volume).toBe(1_000_000);
    expect(adjusted.turnover).toBe(point.turnover);
    expect(adjusted.mcap).toBe(point.mcap);
    expect((adjusted.close ?? 0) * (adjusted.volume ?? 0)).toBe(
      point.close * (point.volume ?? 0),
    );
    expect(point.close).toBe(16_730);
    expect(point.volume).toBe(100_000);
  });

  it("does not activate the adjustment before the effective date", () => {
    expect(
      adjustStockDataForCorporateActions(point, [nmbSplit], "2026-08-23"),
    ).toEqual(point);
  });

  it("does not adjust observations on the effective date", () => {
    const effectivePoint = { ...point, date: "2026-08-24", close: 1_680 };
    expect(
      adjustStockDataForCorporateActions(effectivePoint, [nmbSplit], "2026-08-24"),
    ).toEqual(effectivePoint);
  });

  it("keeps a return spanning the split economically continuous", () => {
    const preSplit = adjustStockDataForCorporateActions(
      point,
      [nmbSplit],
      "2026-08-24",
    );
    const postSplit = adjustStockDataForCorporateActions(
      { ...point, date: "2026-08-24", close: 1_680 },
      [nmbSplit],
      "2026-08-24",
    );
    const periodReturn = (postSplit.close / preSplit.close) - 1;
    expect(periodReturn).toBeCloseTo(0.004184, 5);
  });

  it("supports reverse splits and sequential actions", () => {
    const reverseSplit: CorporateAction = {
      ...nmbSplit,
      id: "NMB-2027-01-10-1-for-2",
      ratioNew: 1,
      ratioOld: 2,
      effectiveDate: "2027-01-10",
    };
    expect(
      getSplitAdjustmentFactors(
        [nmbSplit, reverseSplit],
        "NMB",
        "2026-01-01",
        "2027-01-10",
      ),
    ).toEqual({ price: 0.2, quantity: 5 });
  });

  it("exposes suspension dates only once they are reached", () => {
    expect(getVisibleSuspensionDates([nmbSplit], "NMB", "2026-08-19")).toEqual([]);
    expect(getVisibleSuspensionDates([nmbSplit], "NMB", "2026-08-20")).toEqual([
      "2026-08-20",
    ]);
    expect(getVisibleSuspensionDates([nmbSplit], "NMB", "2026-08-24")).toEqual([
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("inserts presentation-only gaps without changing source observations", () => {
    const data = [
      point,
      { ...point, date: "2026-08-24", close: 1_680 },
    ];
    const withGaps = insertSuspensionGaps(
      data,
      [nmbSplit],
      "NMB",
      "2026-08-24",
    );
    expect(withGaps.map((item) => item.date)).toEqual([
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-24",
    ]);
    expect(Number.isNaN(withGaps[1].close)).toBe(true);
    expect(data).toHaveLength(2);
  });
});
