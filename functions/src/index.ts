// ------------------------------------------------------------------
// DSEasy Cloud Functions — Barrel Entry Point
//
// All function logic lives in src/handlers/ and src/services/.
// This file only re-exports handlers so the Firebase runtime can
// discover and deploy them.
//
// firebase-admin is initialized once in src/config/firebase.ts,
// which is imported by the handlers before any Firestore calls.
// ------------------------------------------------------------------

export {
  monitorIntradayMarket,
  monitorClosingAuction,
  monitorIntradayMarketHttp,
} from "./handlers/monitorIntraday";

export {
  scrapeDailyClosing,
  scrapeDailyClosingHttp,
} from "./handlers/dailyClosing";

export { generatePreOpenSummary } from "./handlers/preOpenSummary";
export { generateDailyCloseSummary } from "./handlers/dailyCloseSummary";
export { createAlert } from "./handlers/alerts";
