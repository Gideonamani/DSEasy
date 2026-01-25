import { useState } from 'react'
import { marketData } from './data/marketData'
import './App.css'

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <h1>Financial Dashboard</h1>
      <p>Status: <strong>Ready</strong></p>
      <p>Data Source: <strong>Loaded {marketData.length} records</strong></p>
      
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {marketData.slice(0, 5).map(item => (
          <div key={item.symbol} style={{ border: '1px solid #333', padding: '10px', borderRadius: '8px' }}>
            <strong>{item.symbol}</strong>
            <div>{item.close}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
