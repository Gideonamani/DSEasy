import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate, Link } from "react-router-dom";
import { useSettings } from '../contexts/SettingsContext';

export const MarketTable = ({ data }) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [sortConfig, setSortConfig] = useState({ key: 'change', direction: 'desc' });

    const sortedData = [...data].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name) => {
        if (sortConfig.key !== name) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    // Helper for large numbers (consistent with App.jsx)
    const formatLargeNumber = (num) => {
        if (!num) return "0";
        if (settings.numberFormat === 'full') {
            return num.toLocaleString();
        }
         // Abbreviated
        if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
        if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
        if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
        if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
        return num.toString();
    };

    const thStyle = {
        textAlign: 'left',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '1px solid var(--glass-border)',
        padding: settings.density === 'compact' ? '12px 16px' : '16px 24px' // Dynamic padding
    };

    const tdStyle = {
        borderBottom: '1px solid var(--glass-border)',
        fontSize: '14px',
        padding: settings.density === 'compact' ? '8px 16px' : '16px 24px' // Dynamic padding
    };

    return (
        <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th style={thStyle} onClick={() => requestSort('symbol')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Symbol {getSortIcon('symbol')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('close')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Close {getSortIcon('close')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('change')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Change % {getSortIcon('change')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('volume')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Volume {getSortIcon('volume')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('turnover')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Turnover {getSortIcon('turnover')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('mcap')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>MCap {getSortIcon('mcap')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row) => (
                            <tr 
                                key={row.symbol} 
                                onClick={() => navigate(`/trends/${row.symbol}`)}
                                style={{ 
                                    cursor: 'pointer',
                                    transition: 'background 0.2s', 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{...tdStyle, fontWeight: 600, color: 'var(--text-primary)'}}>
                                    <Link 
                                        to={`/trends/${row.symbol}`}
                                        onClick={(e) => e.stopPropagation()} // Prevent row click
                                        style={{ 
                                            color: 'var(--accent-primary)', // Make it look like a link
                                            textDecoration: 'none',
                                            display: 'inline-block' 
                                        }}
                                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                    >
                                        {row.symbol}
                                    </Link>
                                </td>
                                <td style={{...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '15px' }}>
                                    {row.close.toLocaleString()}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        background: row.change > 0 ? 'rgba(16, 185, 129, 0.15)' : row.change < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                                        color: row.change > 0 ? 'var(--accent-success)' : row.change < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)',
                                        fontWeight: 600,
                                        fontSize: '12px'
                                    }}>
                                        {row.change > 0 ? '+' : ''}{row.change}%
                                    </span>
                                </td>
                                <td style={{...tdStyle, textAlign: 'right', color: 'var(--text-primary)'}}>
                                    {settings.numberFormat === 'full' ? row.volume.toLocaleString() : formatLargeNumber(row.volume)}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right', color: 'var(--text-secondary)'}}>
                                    {settings.showCurrency ? 'TZS ' : ''}{formatLargeNumber(row.turnover)}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right', color: 'var(--text-secondary)'}}>
                                    {settings.showCurrency ? 'TZS ' : ''}{formatLargeNumber(row.mcap)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

