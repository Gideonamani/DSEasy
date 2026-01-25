import { LayoutDashboard, BarChart3, Settings, Bell, Search } from 'lucide-react';
// Actually, let's use inline styles combined with our global classes for simplicity in this file for now to keep it self-contained or use a module if it gets complex. 
// For now, I'll use the global classes we defined.

const SidebarItem = ({ icon: Icon, label, active }) => (
  <div 
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      margin: '4px 8px',
      borderRadius: '8px',
      cursor: 'pointer',
      backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      transition: 'all 0.2s ease'
    }}
    className="hover-effect"
  >
    <Icon size={20} style={{ marginRight: '12px' }} />
    <span style={{ fontSize: '14px', fontWeight: 500 }}>{label}</span>
  </div>
);

export const Layout = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside 
        className="glass-panel"
        style={{
          width: '260px',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          borderRight: '1px solid var(--glass-border)',
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40
        }}
      >
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', borderRadius: '8px', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 color="#fff" size={20} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>FinDash</h1>
        </div>

        <div style={{ flex: 1, padding: '12px 0' }}>
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
          <SidebarItem icon={BarChart3} label="Market Analysis" />
          <SidebarItem icon={Bell} label="Notifications" />
          <SidebarItem icon={Settings} label="Settings" />
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#475569', marginRight: '12px' }}></div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Keon Geraldo</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pro Trader</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header className="glass-header" style={{ padding: '0 32px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                <span style={{ marginRight: '8px' }}>Overview</span>
                <span>/</span>
                <span style={{ marginLeft: '8px', color: 'var(--text-primary)' }}>Market Dashboard</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input 
                        type="text" 
                        placeholder="Search symbols..." 
                        style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '20px', 
                            padding: '8px 16px 8px 36px', 
                            color: 'white',
                            outline: 'none',
                            width: '240px',
                            fontSize: '14px'
                        }} 
                    />
                </div>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Bell size={20} />
                </button>
            </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: '32px', flex: 1 }}>
            {children}
        </main>
      </div>
    </div>
  );
};
