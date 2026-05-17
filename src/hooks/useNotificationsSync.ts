import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { registerFcmToken, unregisterFcmToken } from "../services/fcm.service";

/**
 * Keeps the device's FCM registration in sync with the user's
 * `notificationsEnabled` preference and current auth state.
 *
 * - Authenticated + enabled → register token (prompts for permission once).
 * - Authenticated + disabled → delete token from Firestore + messaging.
 * - Signed out → no-op (auth flow handles cleanup of UI; tokens linger
 *   under the previously authenticated user, which is acceptable.)
 */
export function useNotificationsSync(): void {
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const key = `${currentUser.uid}:${settings.notificationsEnabled}`;
    if (lastAppliedRef.current === key) return;
    lastAppliedRef.current = key;

    if (settings.notificationsEnabled) {
      registerFcmToken(currentUser);
    } else {
      unregisterFcmToken(currentUser);
    }
  }, [currentUser, settings.notificationsEnabled]);
}
