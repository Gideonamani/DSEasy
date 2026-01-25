import { useState, useMemo } from 'react'
import { marketData } from './data/marketData'
import { Layout } from './components/Layout'
import { StatCard } from './components/StatCard'
import { MarketTable } from './components/MarketTable'
import { PriceChangeChart, TurnoverChart } from './components/StockChart'
import { Calendar } from 'lucide-react'

function App() {
  const availableDates = Object.keys(marketData).sort().reverse(); // Newest first
  const [selectedDate, setSelectedDate] = useState(availableDates[0]);
  
  const currentData = useMemo(() => {
    return marketData[selectedDate] || [];
  }, [selectedDate]);

  // Calculate Market Stats
  const topGainer = useMemo(() => {
    if (!currentData.length) return { symbol: '-', change: 0, close: 0 };
    return currentData.reduce((prev, current) => (prev.change > current.change) ? prev : current, currentData[0]);
  }, [currentData]);

  const topLoser = useMemo(() => {
    if (!currentData.length) return { symbol: '-', change: 0, close: 0 };
    return currentData.reduce((prev, current) => (prev.change < current.change) ? prev : current, currentData[0]);
  }, [currentData]);

  const totalVolume = useMemo(() => {
    return currentData.reduce((acc, curr) => acc + curr.volume, 0);
  }, [currentData]);

  const totalTurnover = useMemo(() => {
    return currentData.reduce((acc, curr) => acc + curr.turnover, 0);
  }, [currentData]);

  return (
    <Layout>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Market Overview</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Data for <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>

        <div className="glass-panel" style={{ 
          padding: '8px 16px', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center',
          gap: '12px'
        }}>
          <Calendar size={18} color="var(--text-secondary)" />
          <select 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)', 
              fontSize: '14px', 
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {availableDates.map(date => (
              <option key={date} value={date} style={{ background: '#1e293b' }}>
                {date}
              </option>
            ))}
          </select>
        </div>
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
          change={0} 
          subtext="Total Shares Traded"
          type="primary"
        />
        <StatCard 
            title="Total Turnover" 
            value={totalTurnover > 1000000000 ? (totalTurnover / 1000000000).toFixed(2) + 'B' : (totalTurnover / 1000000).toFixed(2) + 'M'}
            change={0}
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
          <PriceChangeChart data={currentData} />
          <TurnoverChart data={currentData} />
      </div>

      <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Detailed Market Data</h3>
          <MarketTable data={currentData} />
      </div>

    </Layout>
  )
}

export default App
