import { useCallback, useEffect, useState } from "react";
import { onMessage } from "firebase/messaging";
import { messaging } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";

export interface ForegroundToast {
  id: string;
  title: string;
  body: string;
}

const DISMISS_MS = 5000;

export function useForegroundNotifications() {
  const [toasts, setToasts] = useState<ForegroundToast[]>([]);
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!currentUser || !settings.notificationsEnabled) return;

    return onMessage(messaging, (payload) => {
      const id = crypto.randomUUID();
      const title =
        payload.data?.title ?? payload.notification?.title ?? "DSEasy Alert";
      const body = payload.data?.body ?? payload.notification?.body ?? "";

      setToasts((prev) => [...prev, { id, title, body }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    });
  }, [currentUser, settings.notificationsEnabled, dismiss]);

  return { toasts, dismiss };
}
