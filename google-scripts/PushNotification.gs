/*
  PUSH NOTIFICATION SERVICE (FCM V1 API)
  Filename: PushNotification.gs

  1. Signs a JWT using the Private Key (RSA-SHA256).
  2. Exchanges JWT for a temporary Google OAuth2 Access Token.
  3. Sends the Push Notification via HTTP v1 API.
*/

// --- CONFIGURATION ---
// Credentials stored in Project Settings > Script Properties
const scriptProps = PropertiesService.getScriptProperties();
const FIREBASE_PROJECT_ID = scriptProps.getProperty("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = scriptProps.getProperty("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY = scriptProps
  .getProperty("FIREBASE_PRIVATE_KEY")
  .replace(/\\n/g, "\n")
  .replace(/^"|"$/g, ""); // Remove wrapping quotes if present

if (!FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PROJECT_ID) {
  Logger.log("ERROR: Missing Firebase Credentials in Script Properties");
}

/**
 * Sends a Push Notification to a specific device token
 */
function sendPushNotification(deviceToken, title, body) {
  const token = getAccessToken();
  if (!token) {
    Logger.log("Failed to get Access Token");
    return;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

  const payload = {
    message: {
      token: deviceToken,
      data: {
        title: title,
        body: body,
      },
      // Note: We use 'data' payload so our Service Worker handles it in background
    },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
    },
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log("Notification Sent: " + response.getContentText());
    return true;
  } catch (e) {
    Logger.log("Error sending notification: " + e.toString());
    return false;
  }
}

/**
 * GENERATE OAUTH2 TOKEN (The Hard Part Manual Implementation)
 * Since we can't use libraries easily, we implement a basic JWT signer here.
 */
function getAccessToken() {
  const now = Math.floor(new Date().getTime() / 1000);
  const oneHour = 60 * 60;

  // 1. Create JWT Header & Claim Set
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + oneHour,
    iat: now,
  };

  const encodedHeader = base64Encode(JSON.stringify(header));
  const encodedClaimSet = base64Encode(JSON.stringify(claimSet));
  const toSign = encodedHeader + "." + encodedClaimSet;

  // 2. Sign with Private Key
  const signatureBytes = Utilities.computeRsaSha256Signature(
    toSign,
    FIREBASE_PRIVATE_KEY,
  );
  const encodedSignature = Utilities.base64EncodeWebSafe(
    signatureBytes,
  ).replace(/=/g, ""); // JWT spec says no padding

  const jwt = toSign + "." + encodedSignature;

  // 3. Exchange JWT for Access Token
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const payload = {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  };

  const options = {
    method: "post",
    payload: payload,
  };

  try {
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const json = JSON.parse(response.getContentText());
    return json.access_token;
  } catch (e) {
    Logger.log("Error getting access token: " + e.toString());
    return null;
  }
}

// Helper: Base64 URL Safe Encode (no padding)
function base64Encode(str) {
  const bytes = Utilities.newBlob(str).getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=/g, "");
}
