import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, Trash2 } from "lucide-react";

// API URL (Same as App.jsx)
const API_URL = "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec";

export function NotificationsManager() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    if (!currentUser?.email) {
       setAlerts([]);
       setLoading(false);
       return;
    }

    const url = `${API_URL}?action=getAlerts&email=${encodeURIComponent(currentUser.email)}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
         setAlerts(Array.isArray(data) ? data : []);
         setLoading(false);
      })
      .catch(err => {
         console.error(err);
         setLoading(false);
      });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
        fetchAlerts();
    } else {
        setLoading(false);
    }
  }, [currentUser, fetchAlerts]);

  const handleDelete = (alert) => {
    if (!confirm(`Using Delete API for ${alert.symbol}... Are you sure?`)) return;

    setDeleting(alert.created);
    
    const params = new URLSearchParams({
       action: "deleteAlert",
       email: alert.email,
       symbol: alert.symbol,
       targetPrice: alert.targetPrice,
       condition: alert.condition
    });

    fetch(`${API_URL}?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
         if (data.success) {
            fetchAlerts();
         } else {
            alert("Delete failed: " + (data.error || "Unknown error"));
         }
         setDeleting(null);
      })
      .catch(err => {
         console.error(err);
         setDeleting(null);
      });
  };

  if (loading) {
    return (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
            <Loader2 className="animate-spin" color="#6366f1" size={32} />
        </div>
    );
  }

  if (!currentUser) {
     return <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>Please log in to view alerts.</div>;
  }

  return (
    <div className="glass-panel" style={{ padding: "32px", borderRadius: "16px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>Active Price Alerts</h2>
        <button 
            onClick={fetchAlerts}
            style={{ 
                background: "rgba(255,255,255,0.05)", 
                border: "none", 
                padding: "8px 16px", 
                borderRadius: "8px",
                color: "var(--text-secondary)",
                cursor: "pointer"
            }}
        >
            Refresh
        </button>
      </div>

      {alerts.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px" }}>No active alerts set.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
           {alerts.map((alert, idx) => (
             <div key={idx} style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: "rgba(255,255,255,0.02)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.05)"
             }}>
               <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "16px" }}>{alert.symbol}</span>
                    <span style={{ 
                        padding: "2px 8px", 
                        borderRadius: "4px", 
                        fontSize: "12px",
                        backgroundColor: alert.condition === 'ABOVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: alert.condition === 'ABOVE' ? '#4ade80' : '#f87171'
                    }}>
                      {alert.condition} {alert.targetPrice.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Created: {new Date(alert.created).toLocaleDateString()}
                  </div>
               </div>
               
               <button 
                 onClick={() => handleDelete(alert)}
                 disabled={deleting === alert.created}
                 style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px",
                    color: "var(--text-secondary)",
                    opacity: deleting === alert.created ? 0.5 : 1
                 }}
                 title="Delete Alert"
               >
                 {deleting === alert.created ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
               </button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
