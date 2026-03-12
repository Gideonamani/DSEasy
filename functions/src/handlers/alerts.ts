import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../config/firebase";

export const createAlert = onCall(
  { region: "europe-west1", cors: true },
  async (request) => {
    // A. Auth Check
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to create specific alerts.",
      );
    }

    const { symbol, targetPrice, condition } = request.data;
    const userId = request.auth.uid;

    // B. Validation
    if (!symbol || typeof symbol !== "string") {
      throw new HttpsError("invalid-argument", "Valid symbol is required.");
    }
    if (!targetPrice || typeof targetPrice !== "number" || targetPrice <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Positive target price is required.",
      );
    }
    if (!["ABOVE", "BELOW"].includes(condition)) {
      throw new HttpsError(
        "invalid-argument",
        "Condition must be ABOVE or BELOW.",
      );
    }

    // C. Write to Firestore
    try {
      const docRef = await db.collection("alerts").add({
        userId,
        userEmail: request.auth.token.email || "unknown",
        symbol: symbol.toUpperCase(),
        targetPrice,
        condition,
        status: "ACTIVE",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // Initial check metadata
        lastCheckedAt: null,
      });

      console.log(`Alert created: ${docRef.id} for ${symbol} by ${userId}`);
      return { success: true, alertId: docRef.id };
    } catch (error) {
      console.error("Error creating alert:", error);
      throw new HttpsError("internal", "Failed to save alert.");
    }
  },
);
