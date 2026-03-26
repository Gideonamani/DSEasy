import { onSchedule } from "firebase-functions/v2/scheduler";
import * as moment from "moment-timezone";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { db } from "../config/firebase";
import { fetchWithRetry, randomJitter } from "../utils/helpers";
import { sendScraperAlert } from "../services/scraper";
import { DSEMarketData, MarketWatchEntry } from "../types";
import {
  generateSnapshotIntel,
  generateTrendIntel,
  generateGapDetection,
} from "../services/marketIntel";

// ------------------------------------------------------------------
// Core intraday monitoring logic, shared by multiple scheduled triggers.
// ------------------------------------------------------------------
async function runIntradayMonitor(): Promise<void> {
  const eatNow = moment().tz("Africa/Dar_es_Salaam");

  try {
    console.log("Starting alert check...");
    await randomJitter();

    const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
    const { data: apiResponse } = await fetchWithRetry(dseUrl);
    const marketData: DSEMarketData[] = apiResponse.data || [];

    if (!marketData || marketData.length === 0) {
      console.error("No market data received from DSE API.");
      return;
    }

    const priceMap: { [symbol: string]: number } = {};

    marketData.forEach((item) => {
      const basePrice = item.price
        ? parseFloat(String(item.price).replace(/,/g, ""))
        : 0;
      const changeValue = item.change
        ? parseFloat(String(item.change).replace(/,/g, ""))
        : 0;

      const currentPrice = basePrice + changeValue;
      const symbol = item.company.trim();

      if (symbol && currentPrice > 0) {
        priceMap[symbol] = currentPrice;
      }
    });

    console.log(`Fetched prices for ${Object.keys(priceMap).length} symbols.`);

    const batch = db.batch();
    const timestamp = new Date().toISOString();

    try {
      const marketWatchUrl = "https://api.dse.co.tz/api/market-data?isBond=false";
      const { data: marketWatchRaw } = await axios.get(marketWatchUrl, {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      const marketWatchData: MarketWatchEntry[] = Array.isArray(marketWatchRaw)
        ? marketWatchRaw
        : [];

      if (marketWatchData.length > 0) {
        const snapshot: { [symbol: string]: Record<string, unknown> } = {};

        marketWatchData.forEach((item) => {
          const symbol =
            item.company?.symbol ||
            item.security?.symbol ||
            "";
          if (!symbol) return;

          snapshot[symbol] = {
            marketPrice: item.marketPrice || 0,
            openingPrice: item.openingPrice || 0,
            change: item.change || 0,
            bestBidPrice: item.bestBidPrice || 0,
            bestBidQuantity: item.bestBidQuantity || 0,
            bestOfferPrice: item.bestOfferPrice || 0,
            bestOfferQuantity: item.bestOfferQuantity || 0,
            high: item.high || 0,
            low: item.low || 0,
            volume: item.volume || 0,
            marketCap: item.marketCap || 0,
            minLimit: item.minLimit || 0,
            maxLimit: item.maxLimit || 0,
            totalSharesIssued: item.security?.totalSharesIssued || 0,
            companyDescription:
              item.companyDescription ||
              item.security?.securityDesc ||
              symbol,
            marketSegment: item.security?.marketSegmentID || "",
          };

          if (item.marketPrice && item.marketPrice > 0) {
            priceMap[symbol] = item.marketPrice;
          }
        });

        const dateStr = eatNow.format("YYYY-MM-DD");
        const snapshotRef = db
          .collection("marketWatch")
          .doc(dateStr)
          .collection("snapshots")
          .doc(timestamp);

        batch.set(snapshotRef, {
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          capturedAt: timestamp,
          stockCount: Object.keys(snapshot).length,
          stocks: snapshot,
        });

        const configAppRef = db.collection("config").doc("app");
        batch.set(configAppRef, {
          marketWatchDates: admin.firestore.FieldValue.arrayUnion(dateStr),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(
          `Queued write to marketWatch/${dateStr}/snapshots/${timestamp} with ${Object.keys(snapshot).length} stocks.`,
        );

        try {
          const currentSnapPayload = {
             capturedAt: timestamp,
             stockCount: Object.keys(snapshot).length,
             stocks: snapshot,
          };
          let snapshotSummary = generateSnapshotIntel(currentSnapPayload);
          const trendSummary = await generateTrendIntel(db, dateStr, currentSnapPayload);
          
          if (!trendSummary) {
            const gapText = await generateGapDetection(db, currentSnapPayload);
            if (gapText) {
              snapshotSummary += ` ${gapText}`;
            }
          }

          const intelRef = db
            .collection("marketWatch")
            .doc(dateStr)
            .collection("intel")
            .doc(timestamp);

          batch.set(intelRef, {
            capturedAt: timestamp,
            type: "intraday",
            snapshotSummary,
            trendSummary,
          });
          console.log(`Queued market intel for ${dateStr}/${timestamp}`);
        } catch (intelError) {
          console.error("Failed to generate market intel:", intelError);
        }
      } else {
        console.warn("New market-data API returned no data.");
      }
    } catch (marketWatchError) {
      console.error(
        "Failed to fetch from api.dse.co.tz market-data:",
        marketWatchError,
      );
    }

    try {
      const indicesUrl = "https://dse.co.tz/get/last/traded/indices";
      const { data: indicesResponse } = await fetchWithRetry(indicesUrl);
      if (
        indicesResponse &&
        indicesResponse.success &&
        indicesResponse.data
      ) {
        const currentIndicesRef = db
          .collection("marketIndices")
          .doc("current");
        const historyIndicesRef = db
          .collection("marketIndices")
          .doc("history")
          .collection("records")
          .doc(timestamp);

        const indicesPayload = {
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          data: indicesResponse.data,
        };

        batch.set(currentIndicesRef, indicesPayload);
        batch.set(historyIndicesRef, indicesPayload);
        console.log(
          `Queued write to marketIndices/current and history for ${indicesResponse.data.length} indices.`,
        );
      }
    } catch (indicesError) {
      console.error("Failed to fetch market indices:", indicesError);
    }

    const alertsSnap = await db
      .collection("alerts")
      .where("status", "==", "ACTIVE")
      .get();

    if (alertsSnap.empty) {
      console.log("No active alerts found.");
      if (Object.keys(priceMap).length > 0) {
        await batch.commit();
        console.log("Committed market data (no alerts checked).");
      }
      return;
    }

    let triggeredCount = 0;
    const triggeredAlerts: {
      userId: string;
      symbol: string;
      currentPrice: number;
      targetPrice: number;
      alertId: string;
    }[] = [];

    alertsSnap.forEach((doc) => {
      const alert = doc.data();
      const currentPrice = priceMap[alert.symbol];

      if (currentPrice === undefined) return;

      let triggered = false;

      if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (
        alert.condition === "BELOW" &&
        currentPrice <= alert.targetPrice
      ) {
        triggered = true;
      }

      if (triggered) {
        triggeredCount++;
        console.log(
          `Alert triggered: ${alert.symbol} is ${currentPrice} (${alert.condition} ${alert.targetPrice})`,
        );

        batch.update(doc.ref, {
          status: "TRIGGERED",
          triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
          triggeredPrice: currentPrice,
        });

        triggeredAlerts.push({
          userId: alert.userId,
          symbol: alert.symbol,
          currentPrice,
          targetPrice: alert.targetPrice,
          alertId: doc.id,
        });

        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
          userId: alert.userId,
          type: "PRICE_ALERT",
          title: `Price Alert: ${alert.symbol}`,
          body: `${alert.symbol} reached ${currentPrice} TZS`,
          data: {
            symbol: alert.symbol,
            triggeredPrice: currentPrice,
            alertId: doc.id,
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();
    console.log(`Batch committed. Triggered ${triggeredCount} alerts.`);

    if (triggeredAlerts.length > 0) {
      const uniqueUserIds = [
        ...new Set(triggeredAlerts.map((a) => a.userId)),
      ];

      const userTokensMap: { [userId: string]: string[] } = {};
      for (const userId of uniqueUserIds) {
        const tokensSnap = await db
          .collection("users")
          .doc(userId)
          .collection("fcmTokens")
          .get();
        userTokensMap[userId] = tokensSnap.docs.map(
          (d) => d.data().token as string,
        );
      }

      const notifications: admin.messaging.Message[] = [];
      const tokenRefs: { userId: string; token: string }[] = [];

      for (const alert of triggeredAlerts) {
        const tokens = userTokensMap[alert.userId] || [];
        for (const token of tokens) {
          notifications.push({
            token,
            notification: {
              title: `Price Alert: ${alert.symbol}`,
              body: `${alert.symbol} is now ${alert.currentPrice} TZS (Target: ${alert.targetPrice})`,
            },
            data: {
              type: "PRICE_ALERT",
              symbol: alert.symbol,
              alertId: alert.alertId,
              price: String(alert.currentPrice),
            },
          });
          tokenRefs.push({ userId: alert.userId, token });
        }
      }

      if (notifications.length > 0) {
        const response = await admin.messaging().sendEach(notifications);
        console.log(
          `Sent ${response.successCount} push notifications to ${notifications.length} devices. Failed: ${response.failureCount}`,
        );

        const staleDeletes: Promise<FirebaseFirestore.WriteResult>[] = [];
        response.responses.forEach((resp, idx) => {
          if (
            resp.error &&
            (resp.error.code ===
              "messaging/registration-token-not-registered" ||
              resp.error.code === "messaging/invalid-registration-token")
          ) {
            const { userId, token } = tokenRefs[idx];
            console.log(`Removing stale FCM token for user ${userId}`);
            staleDeletes.push(
              db
                .collection("users")
                .doc(userId)
                .collection("fcmTokens")
                .doc(token)
                .delete(),
            );
          }
        });
        if (staleDeletes.length > 0) {
          await Promise.all(staleDeletes);
          console.log(`Cleaned up ${staleDeletes.length} stale FCM tokens.`);
        }
      }
    }
  } catch (error) {
    console.error("Error in runIntradayMonitor:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await sendScraperAlert(
      `🚨 DSE Intraday Monitor Error`,
      `The intraday market monitor failed.\n\nError: ${err.message}\n\nStack:\n${err.stack || "N/A"}`,
    );
  }
}

// ------------------------------------------------------------------
// Scheduled Function: Monitor every 15 minutes during market hours
// ------------------------------------------------------------------
export const monitorIntradayMarket = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async (event) => {
    const eatNow = moment().tz("Africa/Dar_es_Salaam");

    const day = eatNow.day(); // 0 = Sun, 6 = Sat
    const hour = eatNow.hour();
    const mins = eatNow.minute();
    const totalMins = hour * 60 + mins;

    if (day === 0 || day === 6) {
      console.log("Weekend - skipping alert check.");
      return;
    }

    // Validation: Run only between 09:30 (570) and 16:07 (967)
    // Aligned to official DSE timetable (effective 2 June 2025)
    // We allow until 16:07 to ensure the 16:05 closing capture completes.
    if (totalMins < 570 || totalMins > 967) {
      console.log(`Outside market hours (${eatNow.format("HH:mm")}) - skipping alert check.`);
      return;
    }

    await runIntradayMonitor();
  },
);

// ------------------------------------------------------------------
// Scheduled Function: Dedicated closing auction capture at 16:05 EAT
// Ensures we always capture the 16:05 closing auction data, even if
// the "every 15 minutes" schedule doesn't land exactly at 16:05.
// ------------------------------------------------------------------
export const monitorClosingAuction = onSchedule(
  {
    schedule: "5 16 * * 1-5",
    timeZone: "Africa/Dar_es_Salaam",
    region: "europe-west1",
  },
  async () => {
    await runIntradayMonitor();
  },
);

export const monitorIntradayMarketHttp = onRequest(
  {
    region: "europe-west1",
  },
  async (req, res) => {
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      res
        .status(403)
        .json({ error: "This endpoint is only available in the emulator." });
      return;
    }

    try {
      console.log("Manually triggering monitorIntradayMarket logic...");

      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await fetchWithRetry(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        res.json({ success: false, message: "No market data" });
        return;
      }

      const priceMap: { [symbol: string]: number } = {};
      marketData.forEach((item) => {
        const basePrice = item.price
          ? parseFloat(String(item.price).replace(/,/g, ""))
          : 0;
        const changeValue = item.change
          ? parseFloat(String(item.change).replace(/,/g, ""))
          : 0;

        const currentPrice = basePrice + changeValue;
        const symbol = item.company.trim();
        if (symbol && currentPrice > 0) {
          priceMap[symbol] = currentPrice;
        }
      });

      const batch = db.batch();
      const timestamp = new Date().toISOString();

      let marketWatchCount = 0;
      try {
        const marketWatchUrl =
          "https://api.dse.co.tz/api/market-data?isBond=false";
        const { data: marketWatchRaw } = await axios.get(marketWatchUrl, {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
        });

        const marketWatchData: MarketWatchEntry[] = Array.isArray(marketWatchRaw)
          ? marketWatchRaw
          : [];

        if (marketWatchData.length > 0) {
          const snapshot: { [symbol: string]: Record<string, unknown> } = {};

          marketWatchData.forEach((item) => {
            const symbol =
              item.company?.symbol ||
              item.security?.symbol ||
              "";
            if (!symbol) return;

            snapshot[symbol] = {
              marketPrice: item.marketPrice || 0,
              openingPrice: item.openingPrice || 0,
              change: item.change || 0,
              bestBidPrice: item.bestBidPrice || 0,
              bestBidQuantity: item.bestBidQuantity || 0,
              bestOfferPrice: item.bestOfferPrice || 0,
              bestOfferQuantity: item.bestOfferQuantity || 0,
              high: item.high || 0,
              low: item.low || 0,
              volume: item.volume || 0,
              marketCap: item.marketCap || 0,
              minLimit: item.minLimit || 0,
              maxLimit: item.maxLimit || 0,
              totalSharesIssued: item.security?.totalSharesIssued || 0,
              companyDescription:
                item.companyDescription ||
                item.security?.securityDesc ||
                symbol,
              marketSegment: item.security?.marketSegmentID || "",
            };

            if (item.marketPrice && item.marketPrice > 0) {
              priceMap[symbol] = item.marketPrice;
            }
          });

          const now = new Date();
          const eatTimeStr = now.toLocaleString("en-US", {
            timeZone: "Africa/Dar_es_Salaam",
          });
          const eatDate = new Date(eatTimeStr);
          const dateStr = eatDate
            .toISOString()
            .split("T")[0];
          const snapshotRef = db
            .collection("marketWatch")
            .doc(dateStr)
            .collection("snapshots")
            .doc(timestamp);

          batch.set(snapshotRef, {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            capturedAt: timestamp,
            stockCount: Object.keys(snapshot).length,
            stocks: snapshot,
          });

          marketWatchCount = Object.keys(snapshot).length;
          console.log(
            `Queued write to marketWatch/${dateStr}/snapshots/${timestamp} with ${marketWatchCount} stocks.`,
          );
        }
      } catch (marketWatchError) {
        console.error(
          "Failed to fetch from api.dse.co.tz market-data:",
          marketWatchError,
        );
      }

      try {
        const indicesUrl = "https://dse.co.tz/get/last/traded/indices";
        const { data: indicesResponse } = await fetchWithRetry(indicesUrl);
        if (
          indicesResponse &&
          indicesResponse.success &&
          indicesResponse.data
        ) {
          const currentIndicesRef = db
            .collection("marketIndices")
            .doc("current");
          const historyIndicesRef = db
            .collection("marketIndices")
            .doc("history")
            .collection("records")
            .doc(timestamp);

          const indicesPayload = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            data: indicesResponse.data,
          };

          batch.set(currentIndicesRef, indicesPayload);
          batch.set(historyIndicesRef, indicesPayload);
          console.log(
            `(HTTP Test) Queued write to marketIndices/current and history for ${indicesResponse.data.length} indices.`,
          );
        }
      } catch (indicesError) {
        console.error("Failed to fetch market indices:", indicesError);
      }

      const alertsSnap = await db
        .collection("alerts")
        .where("status", "==", "ACTIVE")
        .get();

      let triggeredCount = 0;
      if (!alertsSnap.empty) {
        alertsSnap.forEach((doc) => {
          const alert = doc.data();
          const currentPrice = priceMap[alert.symbol];
          if (currentPrice === undefined) return;

          let triggered = false;
          if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice)
            triggered = true;
          else if (
            alert.condition === "BELOW" &&
            currentPrice <= alert.targetPrice
          )
            triggered = true;

          if (triggered) {
            triggeredCount++;
            batch.update(doc.ref, {
              status: "TRIGGERED",
              triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
              triggeredPrice: currentPrice,
            });
            console.log(`(HTTP Test) Alert triggered: ${alert.symbol}`);
          }
        });
      }

      await batch.commit();
      res.json({
        success: true,
        message: "Executed monitorIntradayMarket logic",
        pricesSaved: Object.keys(priceMap).length,
        alertsTriggered: triggeredCount,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: String(error) });
    }
  },
);
