import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
// import * as moment from "moment"; // check if needed

admin.initializeApp();
const db = admin.firestore();

// Types
interface DSEMarketData {
  company: string;
  price: string;
  change: string;
  // add other fields if necessary
}

// ------------------------------------------------------------------
// 1. Scheduled Function: Check Price Alerts
// Runs every 15 minutes Mon-Fri during market hours (09:30 - 16:15)
// ------------------------------------------------------------------
export const checkPriceAlerts = functions.pubsub
  .schedule("every 15 minutes")
  .timeZone("Africa/Dar_es_Salaam")
  .onRun(async (context) => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const hour = now.getHours();
    const mins = now.getMinutes();
    const totalMins = hour * 60 + mins;

    // Validation: Run only Mon-Fri (1-5)
    if (day === 0 || day === 6) {
      console.log("Weekend - skipping alert check.");
      return null;
    }

    // Validation: Run only between 09:30 (570) and 16:15 (975)
    // Adding a buffer: 9:00 (540) to 17:00 (1020) to be safe with timezone edges
    if (totalMins < 540 || totalMins > 1020) {
      console.log("Outside market hours - skipping alert check.");
      return null;
    }

    try {
      console.log("Starting alert check...");

      // A. Fetch Live Prices from DSE API
      // Note: This URL was identified in strategy. Validate if it works or needs scraping.
      const dseUrl = "https://dse.co.tz/api/get/live/market/prices";
      const { data: apiResponse } = await axios.get(dseUrl);
      const marketData: DSEMarketData[] = apiResponse.data || [];

      if (!marketData || marketData.length === 0) {
        console.error("No market data received from DSE API.");
        return null;
      }

      // B. Create Price Map: Symbol -> Current Price
      const priceMap: { [symbol: string]: number } = {};
      
      marketData.forEach((item) => {
        // CLEANUP LOGIC MATCHING FRONTEND:
        // Raw Price: "16,500" -> 16500
        // Raw Change: "10" or "-5"
        // Current Price = Price + Change? Or just Price?
        // DSE "Close" is usually previous close. "Price" column in live board often means Last Traded Price.
        // Let's assume 'price' from API is the current trading price.
        // We will sanitize inputs.
        
        const rawPrice = item.price ? parseFloat(item.price.replace(/,/g, "")) : 0;
        // Symbol normalization might be needed here (e.g. trimming)
        const symbol = item.company.trim();
        
        if (symbol && rawPrice > 0) {
            priceMap[symbol] = rawPrice;
        }
      });

      console.log(`Fetched prices for ${Object.keys(priceMap).length} symbols.`);

      // C. Fetch Active Alerts
      const alertsSnap = await db
        .collection("alerts")
        .where("status", "==", "ACTIVE")
        .get();

      if (alertsSnap.empty) {
        console.log("No active alerts found.");
        return null;
      }

      // D. Check Conditions
      const batch = db.batch();
      const notifications: admin.messaging.Message[] = [];
      let triggeredCount = 0;

      alertsSnap.forEach((doc) => {
        const alert = doc.data();
        const currentPrice = priceMap[alert.symbol];

        // Skip if we don't have price data for this symbol
        if (currentPrice === undefined) return;

        let triggered = false;

        if (alert.condition === "ABOVE" && currentPrice >= alert.targetPrice) {
          triggered = true;
        } else if (alert.condition === "BELOW" && currentPrice <= alert.targetPrice) {
          triggered = true;
        }

        if (triggered) {
          triggeredCount++;
          console.log(`Alert triggered: ${alert.symbol} is ${currentPrice} (${alert.condition} ${alert.targetPrice})`);

          // 1. Mark as TRIGGERED in Firestore
          batch.update(doc.ref, {
            status: "TRIGGERED",
            triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
            triggeredPrice: currentPrice,
          });

          // 2. Prepare Push Notification
          if (alert.fcmToken) {
            notifications.push({
              token: alert.fcmToken,
              notification: {
                title: `Price Alert: ${alert.symbol}`,
                body: `${alert.symbol} is now ${currentPrice} TZS (Target: ${alert.targetPrice})`,
              },
              data: {
                type: "PRICE_ALERT",
                symbol: alert.symbol,
                alertId: doc.id,
                price: String(currentPrice)
              }
            });
          }
          
          // 3. Log to History (Optional - separate collection?)
          // For now, reliance on 'triggered' status might be enough, or create a notifications collection
          const notifRef = db.collection("notifications").doc();
          batch.set(notifRef, {
              userId: alert.userId,
              type: "PRICE_ALERT",
              title: `Price Alert: ${alert.symbol}`,
              body: `${alert.symbol} reached ${currentPrice} TZS`,
              data: {
                  symbol: alert.symbol,
                  triggeredPrice: currentPrice,
                  alertId: doc.id
              },
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      // E. Execute Batch Updates & Send Notifications
      if (triggeredCount > 0) {
        await batch.commit();
        console.log(`Updated ${triggeredCount} alerts in Firestore.`);

        if (notifications.length > 0) {
            // Send in batches if many
            const response = await admin.messaging().sendEach(notifications);
            console.log(`Sent ${response.successCount} push notifications. Failed: ${response.failureCount}`);
        }
      } else {
        console.log("No alerts triggered this run.");
      }

    } catch (error) {
      console.error("Error in checkPriceAlerts:", error);
    }

    return null;
  });


// ------------------------------------------------------------------
// 2. Callable Function: Create Alert
// Secure way for frontend to create alerts with validation
// ------------------------------------------------------------------
export const createAlert = functions.https.onCall(async (data, context) => {
    // A. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to create specific alerts."
        );
    }

    const { symbol, targetPrice, condition, fcmToken } = data;
    const userId = context.auth.uid;

    // B. Validation
    if (!symbol || typeof symbol !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Valid symbol is required.");
    }
    if (!targetPrice || typeof targetPrice !== "number" || targetPrice <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Positive target price is required.");
    }
    if (!["ABOVE", "BELOW"].includes(condition)) {
        throw new functions.https.HttpsError("invalid-argument", "Condition must be ABOVE or BELOW.");
    }

    // C. Write to Firestore
    try {
        const docRef = await db.collection("alerts").add({
            userId,
            userEmail: context.auth.token.email || "unknown",
            symbol: symbol.toUpperCase(),
            targetPrice,
            condition,
            fcmToken, // Store token to target device later
            status: "ACTIVE",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // Initial check metadata
            lastCheckedAt: null
        });

        console.log(`Alert created: ${docRef.id} for ${symbol} by ${userId}`);
        return { success: true, alertId: docRef.id };

    } catch (error) {
        console.error("Error creating alert:", error);
        throw new functions.https.HttpsError("internal", "Failed to save alert.");
    }
});
