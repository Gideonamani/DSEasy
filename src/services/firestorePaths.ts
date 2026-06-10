// Centralised Firestore collection/document path definitions.
// Components, hooks, and services must reference these helpers instead of
// hard-coding string literals so collection layout changes touch one file.

const sanitize = (segment: string): string => {
  if (!segment || typeof segment !== "string") return "invalid-segment";
  const clean = segment.replace(/\.\./g, "").replace(/[\/\\]/g, "").replace(/\x00/g, "").trim();
  return clean || "invalid-segment";
};

export const FirestorePaths = {
  appConfig: () => ["config", "app"] as const,
  dailyClosingStocks: (date: string) => ["dailyClosing", sanitize(date), "stocks"] as const,
  trends: () => ["trends"] as const,
  tickerHistory: (symbol: string) => ["trends", sanitize(symbol), "dailyClosingHistory"] as const,
  marketIndicesCurrent: () => ["marketIndices", "current"] as const,
  marketWatchSnapshots: (date: string) => ["marketWatch", sanitize(date), "snapshots"] as const,
  marketWatchIntel: (date: string) => ["marketWatch", sanitize(date), "intel"] as const,
  alerts: () => ["alerts"] as const,
  alert: (alertId: string) => ["alerts", sanitize(alertId)] as const,
  userSettings: (uid: string) => ["users", sanitize(uid), "profile", "settings"] as const,
  userFcmToken: (uid: string, token: string) => ["users", sanitize(uid), "fcmTokens", sanitize(token)] as const,
  userNotifications: (uid: string) => ["notifications", sanitize(uid), "history"] as const,
  userNotification: (uid: string, notificationId: string) => ["notifications", sanitize(uid), "history", sanitize(notificationId)] as const,
};
