import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// lucide-react icons removed - not used directly in this component
import { useSettings } from '../contexts/SettingsContext';
import { formatLargeNumber } from "../utils/formatters";
import { StockData } from '../hooks/useMarketQuery';

export interface MarketTableProps {
  data: StockData[];
}

export const MarketTable: React.FC<MarketTableProps> = ({ data }) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: string }>({ key: 'change', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const sortedData = useMemo(() => {
        let sortableData = [...data];

        if (searchTerm) {
            sortableData = sortableData.filter(item =>
                item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        sortableData.sort((a, b) => {
            const aVal = (a as any)[sortConfig.key] || 0;
            const bVal = (b as any)[sortConfig.key] || 0;

            if (aVal < bVal) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortableData;
    }, [data, sortConfig, searchTerm]);

    const requestSort = (key: string): void => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string): React.ReactElement => {
        if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}>⇅</span>;
        return sortConfig.direction === 'asc' ? <span>↑</span> : <span>↓</span>;
    };

    if (data.length === 0) {
        return <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-secondary)' }}>No market data available</div>;
    }

    const thStyle: React.CSSProperties = {
        padding: 'var(--space-4)',
        textAlign: 'left' as const,
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-semibold)',
        backgroundColor: 'var(--bg-surface)',
        cursor: 'pointer',
        userSelect: 'none' as const,
        whiteSpace: 'nowrap' as const
    };

    const tdStyle: React.CSSProperties = {
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)'
    };

    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <input
                    type="text"
                    placeholder="Search symbol..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-2) var(--space-3)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '200px',
                        fontSize: 'var(--text-sm)'
                    }}
                />
            </div>
            
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{...thStyle, backgroundColor: 'var(--bg-elevated)', position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid var(--glass-border)', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)'}} onClick={() => requestSort('symbol')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Symbol {getSortIcon('symbol')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('close')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Close {getSortIcon('close')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('high')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>High {getSortIcon('high')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('low')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Low {getSortIcon('low')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('change')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Change {getSortIcon('change')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('pctChange')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>% Change {getSortIcon('pctChange')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('outstandingBid')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Bid {getSortIcon('outstandingBid')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('outstandingOffer')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Offer {getSortIcon('outstandingOffer')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('volume')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Volume {getSortIcon('volume')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('turnover')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Turnover {getSortIcon('turnover')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('mcap')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>MCap (B) {getSortIcon('mcap')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row) => (
                            <tr key={row.symbol} 
                                className="market-table-row"
                                style={{ transition: 'background-color 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <td style={{
                                    ...tdStyle, 
                                    fontWeight: 'var(--font-semibold)', 
                                    color: 'var(--text-primary)',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 5,
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderRight: '1px solid var(--glass-border)',
                                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)'
                                }}>
                                    <span 
                                        onClick={() => navigate(`/trends/${row.symbol}`)}
                                        style={{ 
                                            cursor: 'pointer', 
                                            color: 'var(--color-primary-500)',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = 'var(--color-primary-600)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.textDecoration = 'none';
                                            e.currentTarget.style.color = 'var(--color-primary-500)';
                                        }}
                                    >
                                        {row.symbol}
                                    </span>
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{row.close.toLocaleString()}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{row.high.toLocaleString()}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{row.low.toLocaleString()}</td>
                                <td style={{...tdStyle, textAlign: 'right', color: row.change > 0 ? 'var(--accent-success)' : row.change < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'}}>
                                    {row.change > 0 ? '+' : ''}{formatLargeNumber(row.change)}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: (row.pctChange ?? 0) > 0 ? 'rgba(16, 185, 129, 0.1)' : (row.pctChange ?? 0) < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: (row.pctChange ?? 0) > 0 ? 'var(--accent-success)' : (row.pctChange ?? 0) < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)',
                                        fontWeight: 'var(--font-semibold)',
                                        fontSize: 'var(--text-xs)'
                                    }}>
                                        {(row.pctChange ?? 0) > 0 ? '+' : ''}{(row.pctChange ?? 0).toFixed(2)}%
                                    </span>
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>
                                    {(row.outstandingBid ?? 0) > 0 ? formatLargeNumber(row.outstandingBid!) : '-'}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>
                                    {(row.outstandingOffer ?? 0) > 0 ? formatLargeNumber(row.outstandingOffer!) : '-'}
                                </td>
                                <td style={{...tdStyle, textAlign: 'right', color: 'var(--text-primary)'}}>
                                    {settings.numberFormat === 'full' ? (row.volume ?? 0).toLocaleString() : formatLargeNumber(row.volume ?? 0)}
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
