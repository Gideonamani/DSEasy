import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, Trash2, History, BellRing } from "lucide-react";

// API URL (Same as App.jsx)
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";

export function NotificationsManager() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'

  useEffect(() => {
    if (!currentUser?.uid) {
       setAlerts([]);
       setLoading(false);
       return;
    }

    setLoading(true);
    const q = query(
      collection(db, "alerts"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamp to number for existing UI compatibility if needed, 
        // or just use valid date objects. 
        // The UI uses new Date(alert.created), so we need to map createdAt to created or update UI.
        // Let's map createdAt (Firestore Timestamp) to 'created' (ISO string or number)
        created: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
      }));
      setAlerts(newAlerts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching alerts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleDelete = async (alert) => {
    if (!confirm(`Delete alert for ${alert.symbol}?`)) return;

    // Use alert.id (Firestore Doc ID) or fallback to created if using old data (but we are moving to new data)
    // The new logic uses alert.id from snapshot.
    const alertId = alert.id;
    if (!alertId) return;

    setDeleting(alertId);
    
    try {
      await deleteDoc(doc(db, "alerts", alertId));
      // No need to fetchAlerts(), onSnapshot handles it
    } catch (error) {
      console.error("Error deleting alert:", error);
      alert("Delete failed: " + error.message);
    } finally {
      setDeleting(null);
    }
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
        {/* Manual refresh button removed since we use real-time updates */}
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
                 disabled={deleting === alert.id}
                 style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px",
                    color: "var(--text-secondary)",
                    opacity: deleting === alert.id ? 0.5 : 1,
                    transition: "color 0.2s"
                 }}
                 title="Delete Alert"
                 onMouseOver={(e) => e.target.style.color = "var(--accent-danger)"}
                 onMouseOut={(e) => e.target.style.color = "var(--text-secondary)"}
               >
                 {deleting === alert.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
               </button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
