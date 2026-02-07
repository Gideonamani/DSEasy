import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate, Link } from "react-router-dom";
import { useSettings } from '../contexts/SettingsContext';
import { formatNumber, formatLargeNumber } from "../utils/formatters";

export const MarketTable = ({ data }) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [sortConfig, setSortConfig] = useState({ key: 'change', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const sortedData = useMemo(() => {
        let sortableData = [...data];

        if (searchTerm) {
            sortableData = sortableData.filter(item =>
                item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        sortableData.sort((a, b) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;

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

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}>⇅</span>;
        return sortConfig.direction === 'asc' ? <span>↑</span> : <span>↓</span>;
    };

    if (data.length === 0) {
        return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No market data available</div>;
    }

    const thStyle = {
        padding: '16px',
        textAlign: 'left',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        fontWeight: 600,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap'
    };

    const tdStyle = {
        padding: '16px',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: 500
    };

    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <input
                    type="text"
                    placeholder="Search symbol..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '200px',
                        fontSize: '13px'
                    }}
                />
            </div>
            
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle} onClick={() => requestSort('symbol')}>
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Change % {getSortIcon('change')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('volume')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Volume {getSortIcon('volume')}</div>
                            </th>
                            <th style={{...thStyle, textAlign: 'right'}} onClick={() => requestSort('turnover')}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>Turnover {getSortIcon('turnover')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row) => (
                            <tr key={row.symbol} style={{ transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                <td style={{...tdStyle, fontWeight: 600, color: 'var(--primary)'}}>{row.symbol}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{formatLargeNumber(row.close)}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{formatLargeNumber(row.high)}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{formatLargeNumber(row.low)}</td>
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

