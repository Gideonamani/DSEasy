import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, Trash2, History, BellRing } from "lucide-react";

// API URL (Same as App.jsx)
const API_URL = "https://script.google.com/macros/s/AKfycbw5vvHP7mC6UCQ8Dm8Z_Xiwp_PM-diBGMPbPY8euN5utNZu-9ysrgV6kk_tupcx0rxAJg/exec";

export function NotificationsManager() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <Loader2 className="animate-spin" color="var(--accent-primary)" size={32} />
        </div>
    );
  }

  if (!currentUser) {
     return <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>Please log in to view alerts.</div>;
  }

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  const historyAlerts = alerts.filter(a => a.status !== 'ACTIVE');
  const displayedAlerts = activeTab === 'active' ? activeAlerts : historyAlerts;

  return (
    <div className="glass-panel" style={{ padding: "var(--space-6)", borderRadius: "var(--radius-xl)", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)" }}>Price Alerts</h2>
        <button 
            onClick={fetchAlerts}
            style={{ 
                background: "var(--bg-elevated)", 
                border: "none", 
                padding: "8px 16px", 
                borderRadius: "var(--radius-lg)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.target.style.color = "var(--text-primary)"}
            onMouseOut={(e) => e.target.style.color = "var(--text-secondary)"}
        >
            Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-5)', padding: '4px', background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: "var(--radius-md)",
            border: 'none',
            background: activeTab === 'active' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'active' ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <BellRing size={16} />
          <span>Active ({activeAlerts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: "var(--radius-md)",
            border: 'none',
            background: activeTab === 'history' ? 'var(--bg-elevated)' : 'transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <History size={16} />
          <span>History ({historyAlerts.length})</span>
        </button>
      </div>

      {displayedAlerts.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            color: "var(--text-secondary)", 
            padding: "48px 32px",
            background: 'var(--bg-surface)',
            borderRadius: "var(--radius-lg)",
            border: '1px dashed var(--glass-border)'
          }}>
            <p>{activeTab === 'active' ? 'No active price alerts.' : 'No alert history available.'}</p>
          </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
           {displayedAlerts.map((alert, idx) => (
             <div key={idx} style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: activeTab === 'active' ? "var(--bg-surface)" : "transparent",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--glass-border)",
                opacity: activeTab === 'history' ? 0.7 : 1
             }}>
               <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: "var(--font-bold)", fontSize: "var(--text-base)" }}>{alert.symbol}</span>
                    <span style={{ 
                        padding: "2px 8px", 
                        borderRadius: "4px", 
                        fontSize: "var(--text-xs)",
                        backgroundColor: alert.condition === 'ABOVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: alert.condition === 'ABOVE' ? 'var(--accent-success)' : 'var(--accent-danger)'
                    }}>
                      {alert.condition} {alert.targetPrice.toLocaleString()}
                    </span>
                    {activeTab === 'history' && (
                         <span style={{ 
                            padding: "2px 6px", 
                            borderRadius: "4px", 
                            fontSize: "10px",
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase'
                        }}>
                             {alert.status}
                        </span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {activeTab === 'active' ? 'Created: ' : 'Triggered: '} 
                    {new Date(alert.created).toLocaleDateString()} {new Date(alert.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    opacity: deleting === alert.created ? 0.5 : 1,
                    transition: "color 0.2s"
                 }}
                 title="Delete Alert"
                 onMouseOver={(e) => e.target.style.color = "var(--accent-danger)"}
                 onMouseOut={(e) => e.target.style.color = "var(--text-secondary)"}
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
