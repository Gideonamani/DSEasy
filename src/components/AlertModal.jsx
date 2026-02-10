import { useState } from "react";
import { X, Bell, Loader2, CheckCircle } from "lucide-react";
import { messaging } from "../firebase";
import { getToken } from "firebase/messaging";

// Token retrieval uses the default configuration from firebase.js

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export const AlertModal = ({ isOpen, onClose, symbol, currentPrice }) => {
  const [targetPrice, setTargetPrice] = useState(currentPrice || 0);
  const [condition, setCondition] = useState("ABOVE"); // or BELOW
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, success, error

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    try {
      // 1. Request Permission & Get Token
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission denied");
      }

      // 2. Get FCM Token
      // Try to get token without VAPID key first (uses default if configured)
      const fcmToken = await getToken(messaging).catch(err => {
         console.error("FCM Token Error", err);
         throw new Error("Failed to get push token. Ensure you have notification permissions and a valid VAPID key if required.");
      });

      if (!fcmToken) throw new Error("No FCM Token received");

      // 3. Call Cloud Function
      const createAlert = httpsCallable(functions, 'createAlert');
      const result = await createAlert({
        symbol,
        targetPrice: parseFloat(targetPrice),
        condition,
        fcmToken,
      });

      if (!result.data.success) throw new Error(result.data.error || "Unknown error");
      
      setStatus("success");
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 2000);

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: "var(--z-modal)"
    }}>
      <div className="glass-panel" style={{ width: "400px", padding: "var(--space-6)", borderRadius: "var(--radius-xl)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <X size={20} />
        </button>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--space-6)" }}>
          <div style={{ padding: "10px", borderRadius: "12px", background: "var(--accent-primary)", display: "flex" }}>
            <Bell size={24} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)" }}>Set Price Alert</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>for {symbol}</p>
          </div>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <CheckCircle size={48} color="var(--accent-success)" style={{ marginBottom: "16px" }} />
            <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-medium)" }}>Alert Set Successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", marginBottom: "8px" }}>Target Price (TZS)</label>
              <input 
                type="number" 
                value={targetPrice} 
                onChange={e => setTargetPrice(e.target.value)}
                style={{ 
                  width: "100%", padding: "12px", borderRadius: "var(--radius-lg)", 
                  border: "1px solid var(--glass-border)", background: "var(--bg-input)",
                  color: "var(--text-primary)", fontSize: "var(--text-base)", outline: "none"
                }}
              />
            </div>

            <div style={{ marginBottom: "var(--space-6)" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", marginBottom: "8px" }}>Condition</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  type="button"
                  onClick={() => setCondition("ABOVE")}
                  style={{ 
                    flex: 1, padding: "10px", borderRadius: "var(--radius-lg)", cursor: "pointer",
                    background: condition === "ABOVE" ? "rgba(34, 197, 94, 0.2)" : "var(--bg-input)",
                    color: condition === "ABOVE" ? "var(--accent-success)" : "var(--text-secondary)",
                    border: condition === "ABOVE" ? "1px solid var(--accent-success)" : "1px solid transparent",
                    fontWeight: "var(--font-medium)"
                  }}
                >
                  Goes Above
                </button>
                <button 
                  type="button"
                  onClick={() => setCondition("BELOW")}
                  style={{ 
                    flex: 1, padding: "10px", borderRadius: "var(--radius-lg)", cursor: "pointer",
                    background: condition === "BELOW" ? "rgba(239, 68, 68, 0.2)" : "var(--bg-input)",
                    color: condition === "BELOW" ? "var(--accent-danger)" : "var(--text-secondary)",
                    border: condition === "BELOW" ? "1px solid var(--accent-danger)" : "1px solid transparent",
                     fontWeight: "var(--font-medium)"
                  }}
                >
                  Goes Below
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: "100%", padding: "14px", borderRadius: "var(--radius-lg)", border: "none", 
                background: "var(--accent-primary)", color: "white", fontWeight: "var(--font-bold)",
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "opacity 0.2s"
              }}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Activating..." : "Create Alert"}
            </button>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textAlign: "center", marginTop: "12px" }}>
              Needs Notification Permission
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
