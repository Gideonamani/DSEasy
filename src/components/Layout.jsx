import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, TrendingUp, LineChart, Settings, Bell, Search, Menu, X } from 'lucide-react';

const SidebarItem = ({ icon, label, active, onClick }) => {
  const Icon = icon;
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        margin: '4px 8px',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      className="hover-effect"
    >
      {active && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '10%',
          bottom: '10%',
          width: '3px',
          backgroundColor: 'var(--accent-primary)',
          borderRadius: '0 4px 4px 0'
        }} />
      )}
      <Icon size={20} style={{ marginRight: '12px', zIndex: 1 }} />
      <span style={{ fontSize: '14px', fontWeight: 500, zIndex: 1 }}>{label}</span>
    </div>
  );
};

export const Layout = ({ children, activeTab, onTabChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 35,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Sidebar */}
      <aside 
        className="glass-panel"
        style={{
          width: '260px',
          height: '100vh',
          position: 'fixed',
          left: isSidebarOpen ? 0 : '-280px',
          top: 0,
          borderRight: '1px solid var(--glass-border)',
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 60,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--bg-card)' // Ensure opacity for overlay
        }}
      >
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', borderRadius: '8px', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 color="#fff" size={20} />
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>FinDash</h1>
          </div>
          {isMobile && (
            <button onClick={toggleSidebar} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, padding: '12px 0' }}>
          {['Dashboard', 'Derived Analytics', 'Ticker Trends', 'Notifications', 'Settings'].map(tab => (
            <SidebarItem 
              key={tab}
              icon={
                tab === 'Dashboard' ? LayoutDashboard : 
                tab === 'Derived Analytics' ? TrendingUp :
                tab === 'Ticker Trends' ? LineChart : 
                tab === 'Notifications' ? Bell : Settings
              } 
              label={tab} 
              active={activeTab === tab}
              onClick={() => {
                onTabChange(tab);
                if (isMobile) setIsSidebarOpen(false);
              }}
            />
          ))}
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
      <div style={{ 
        marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%'
      }}>
        {/* Header */}
        <header className="glass-header" style={{ padding: '0 24px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button 
                onClick={toggleSidebar}
                style={{ 
                  marginRight: '16px', 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: isSidebarOpen && !isMobile ? 'none' : 'flex'
                }}
              >
                <Menu size={24} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  <span style={{ marginRight: '8px', display: isMobile ? 'none' : 'block' }}>Overview</span>
                  <span style={{ display: isMobile ? 'none' : 'block' }}>/</span>
                  <span style={{ marginLeft: isMobile ? '0' : '8px', color: 'var(--text-primary)' }}>{activeTab}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative', display: isMobile ? 'none' : 'block' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '20px', 
                            padding: '8px 16px 8px 36px', 
                            color: 'white',
                            outline: 'none',
                            width: '200px',
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
        <main style={{ padding: isMobile ? '16px' : '32px', flex: 1 }}>
            {children}
        </main>
      </div>
    </div>
  );
};
