import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules - Notifications", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "dseasy-test-rules",
      firestore: {
        rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows a user to read their own notification history", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const docRef = doc(aliceDb, "notifications/alice/history/notif_1");
    await assertSucceeds(getDoc(docRef));
  });

  it("denies a user from reading another user's notification history", async () => {
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const docRef = doc(bobDb, "notifications/alice/history/notif_1");
    await assertFails(getDoc(docRef));
  });

  it("allows a user to mark their own notifications as read", async () => {
    // Setup initial data using admin context
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const adminDocRef = doc(db, "notifications/alice/history/notif_1");
      await setDoc(adminDocRef, {
        read: false,
        title: "Test",
        createdAt: new Date(),
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const docRef = doc(aliceDb, "notifications/alice/history/notif_1");
    await assertSucceeds(updateDoc(docRef, { read: true }));
  });

  it("denies unauthenticated users from reading any notifications", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(guestDb, "notifications/alice/history/notif_1");
    await assertFails(getDoc(docRef));
  });
});
