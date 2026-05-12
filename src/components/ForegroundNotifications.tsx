import { Bell, X } from "lucide-react";
import { useForegroundNotifications } from "../hooks/useForegroundNotifications";

export function ForegroundNotifications() {
  const { toasts, dismiss } = useForegroundNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 120,
        maxWidth: 340,
        width: "calc(100vw - 48px)",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderLeft: "3px solid var(--accent-primary)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            animation: "toast-in 0.2s ease",
          }}
        >
          <Bell
            size={16}
            style={{ color: "var(--accent-primary)", marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}
            >
              {toast.title}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                wordBreak: "break-word",
              }}
            >
              {toast.body}
            </div>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 2,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
