import { marketData } from './data/marketData'
import { Layout } from './components/Layout'

function App() {
  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Market Overview</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Track live performance of top financial instruments.</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '24px' 
      }}>
        {marketData.slice(0, 8).map(item => (
          <div key={item.symbol} className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{item.symbol}</div>
              <div 
                style={{ 
                  color: item.change > 0 ? 'var(--accent-success)' : item.change < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                {item.change > 0 ? '+' : ''}{item.change}%
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                {item.close.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Vol: {item.volume.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}

export default App
