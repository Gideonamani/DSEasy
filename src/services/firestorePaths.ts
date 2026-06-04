// Centralised Firestore collection/document path definitions.
// Components, hooks, and services must reference these helpers instead of
// hard-coding string literals so collection layout changes touch one file.

export const FirestorePaths = {
  appConfig: () => ["config", "app"] as const,
  dailyClosingStocks: (date: string) => ["dailyClosing", date, "stocks"] as const,
  trends: () => ["trends"] as const,
  tickerHistory: (symbol: string) => ["trends", symbol, "dailyClosingHistory"] as const,
  dividendHistory: (symbol: string) => ["trends", symbol, "dividendHistory"] as const,
  marketIndicesCurrent: () => ["marketIndices", "current"] as const,
  marketWatchSnapshots: (date: string) => ["marketWatch", date, "snapshots"] as const,
  marketWatchIntel: (date: string) => ["marketWatch", date, "intel"] as const,
  alerts: () => ["alerts"] as const,
  alert: (alertId: string) => ["alerts", alertId] as const,
  userSettings: (uid: string) => ["users", uid, "profile", "settings"] as const,
  userFcmToken: (uid: string, token: string) => ["users", uid, "fcmTokens", token] as const,
  userNotifications: (uid: string) => ["notifications", uid, "history"] as const,
  userNotification: (uid: string, notificationId: string) => ["notifications", uid, "history", notificationId] as const,
};
