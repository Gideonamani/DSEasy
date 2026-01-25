import { useMemo } from 'react'
import { marketData } from './data/marketData'
import { Layout } from './components/Layout'
import { StatCard } from './components/StatCard'
import { MarketTable } from './components/MarketTable'
import { PriceChart, VolumeChart } from './components/StockChart'

function App() {
  // Calculate Market Stats
  const topGainer = useMemo(() => {
    return marketData.reduce((prev, current) => (prev.change > current.change) ? prev : current, marketData[0]);
  }, []);

  const topLoser = useMemo(() => {
    return marketData.reduce((prev, current) => (prev.change < current.change) ? prev : current, marketData[0]);
  }, []);

  const totalVolume = useMemo(() => {
    return marketData.reduce((acc, curr) => acc + curr.volume, 0);
  }, []);

  const totalTurnover = useMemo(() => {
    return marketData.reduce((acc, curr) => acc + curr.turnover, 0);
  }, []);

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Market Overview</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Live market performance and insights.</p>
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '24px',
        marginBottom: '32px'
      }}>
        <StatCard 
          title="Top Gainer" 
          value={topGainer.symbol} 
          change={topGainer.change} 
          subtext={`Price: ${topGainer.close.toLocaleString()}`}
          type="success"
        />
        <StatCard 
          title="Top Loser" 
          value={topLoser.symbol} 
          change={topLoser.change} 
          subtext={`Price: ${topLoser.close.toLocaleString()}`}
          type="danger"
        />
        <StatCard 
          title="Total Volume" 
          value={(totalVolume / 1000000).toFixed(2) + 'M'} 
          change={12.5} 
          subtext="Total Shares Traded"
          type="primary"
        />
        <StatCard 
            title="Total Turnover" 
            value={totalTurnover > 1000000000 ? (totalTurnover / 1000000000).toFixed(2) + 'B' : (totalTurnover / 1000000).toFixed(2) + 'M'}
            change={5.2}
            subtext="TZS Turnover"
            type="neutral"
        />
      </div>

      {/* Charts Section */}
      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
          gap: '24px',
          marginBottom: '32px' 
      }}>
          <PriceChart data={marketData} />
          <VolumeChart data={marketData} />
      </div>

      <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Detailed Market Data</h3>
          <MarketTable data={marketData} />
      </div>

    </Layout>
  )
}

export default App
