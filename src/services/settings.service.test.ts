import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveUserSettings } from "./settings.service";
import { setDoc } from "firebase/firestore";

// Mock firebase/firestore
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(),
    serverTimestamp: vi.fn(() => new Date()),
    setDoc: vi.fn(),
  };
});

// Mock firebase.ts to avoid actual init issues
vi.mock("../firebase", () => {
  return {
    db: {},
  };
});

describe("saveUserSettings with AbortSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should write successfully if signal is not aborted", async () => {
    vi.mocked(setDoc).mockResolvedValueOnce();

    const uid = "user-123";
    const settings = {
      theme: "dark" as const,
      density: "comfortable" as const,
      numberFormat: "abbreviated" as const,
      showCurrency: true,
      defaultChartRange: "1M" as const,
      landingPage: "/" as const,
      notificationsEnabled: true,
    };

    const controller = new AbortController();
    await expect(saveUserSettings(uid, settings, controller.signal)).resolves.not.toThrow();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it("should throw AbortError if signal is already aborted", async () => {
    const uid = "user-123";
    const settings = {
      theme: "dark" as const,
      density: "comfortable" as const,
      numberFormat: "abbreviated" as const,
      showCurrency: true,
      defaultChartRange: "1M" as const,
      landingPage: "/" as const,
      notificationsEnabled: true,
    };

    const controller = new AbortController();
    controller.abort();

    await expect(saveUserSettings(uid, settings, controller.signal)).rejects.toThrowError(
      /aborted/
    );
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("should throw AbortError if signal is aborted mid-flight", async () => {
    let resolveSetDoc: () => void = () => {};
    const setDocPromise = new Promise<void>((resolve) => {
      resolveSetDoc = resolve;
    });
    vi.mocked(setDoc).mockReturnValueOnce(setDocPromise);

    const uid = "user-123";
    const settings = {
      theme: "dark" as const,
      density: "comfortable" as const,
      numberFormat: "abbreviated" as const,
      showCurrency: true,
      defaultChartRange: "1M" as const,
      landingPage: "/" as const,
      notificationsEnabled: true,
    };

    const controller = new AbortController();
    const savePromise = saveUserSettings(uid, settings, controller.signal);

    // Abort while setDoc is in-flight
    controller.abort();
    resolveSetDoc();

    await expect(savePromise).rejects.toThrowError(/aborted/);
  });
});
