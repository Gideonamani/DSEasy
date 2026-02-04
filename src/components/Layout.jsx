import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, TrendingUp, LineChart, Settings, Bell, Search, Menu, X, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
        backgroundColor: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
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

const UserProfileSection = () => {
    const { currentUser, loginWithGoogle, logout } = useAuth();
    const [loading, setLoading] = useState(false);
  
    const handleLogin = async () => {
      try {
        setLoading(true);
        await loginWithGoogle();
      } catch (error) {
        console.error("Login failed", error);
      } finally {
        setLoading(false);
      }
    };
  
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed", error);
        }
    };
  
    if (currentUser) {
      return (
        <div>
           <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
             {currentUser.photoURL ? (
                <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName} 
                    referrerPolicy="no-referrer"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', marginRight: '12px', border: '1px solid var(--glass-border)' }}
                />
             ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={18} color="#fff" />
                </div>
             )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser.displayName || "User"}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser.email}
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            style={{ 
                width: '100%',
                padding: '8px', 
                background: 'var(--bg-input)', 
                border: '1px solid var(--border-subtle)', 
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                transition: 'all 0.2s'
            }}
            className="hover-bg"
          >
            <LogOut size={14} style={{ marginRight: '8px' }} />
            Sign Out
          </button>
        </div>
      );
    }
  
    return (
      <button 
        onClick={handleLogin}
        disabled={loading}
        style={{ 
            width: '100%',
            padding: '10px', 
            background: 'var(--accent-primary)', 
            border: 'none', 
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 500,
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s'
        }}
      >
        <LogIn size={16} style={{ marginRight: '8px' }} />
        {loading ? 'Signing In...' : 'Sign In with Google'}
      </button>
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
          background: 'var(--bg-sidebar)' // Use themed sidebar background
        }}
      >
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/icons/icon-48x48.png" alt="DSEasy Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '12px', border: '1px solid var(--glass-border)' }} />
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>DSEasy</h1>
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

        <div style={{ 
          padding: '24px', 
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', // Ensure clearance for mobile toolbars
          borderTop: '1px solid var(--glass-border)' 
        }}>
          <UserProfileSection />
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
                            background: 'var(--bg-input)', 
                            border: '1px solid var(--border-subtle)', 
                            borderRadius: '20px', 
                            padding: '8px 16px 8px 36px', 
                            color: 'var(--text-primary)',
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
