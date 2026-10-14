import { describe, it, expect, vi } from "vitest";

// Mock firebase.ts to avoid actual init issues in Node test environment
vi.mock("../firebase", () => ({
  db: {},
}));

import { fetchTickerHistory } from "./market.service";

describe("market.service - fetchTickerHistory validation", () => {
  it("rejects invalid symbols with special characters or path sequences", async () => {
    await expect(fetchTickerHistory("../invalid")).rejects.toThrow("Invalid ticker symbol format.");
    await expect(fetchTickerHistory("CRDB-1")).rejects.toThrow("Invalid ticker symbol format.");
    await expect(fetchTickerHistory("CRDB/TBL")).rejects.toThrow("Invalid ticker symbol format.");
  });

  it("rejects symbols longer than 8 characters", async () => {
    await expect(fetchTickerHistory("VERYLONGSYMBOL")).rejects.toThrow("Invalid ticker symbol format.");
  });

  it("rejects empty or whitespace symbols", async () => {
    await expect(fetchTickerHistory("")).rejects.toThrow("Invalid ticker symbol format.");
    await expect(fetchTickerHistory(" ")).rejects.toThrow("Invalid ticker symbol format.");
  });
});
