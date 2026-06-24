import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns3 } from 'lucide-react';
import { useSettings, Settings } from '../contexts/SettingsContext';
import { formatLargeNumber } from "../utils/formatters";
import { StockData } from '../hooks/useMarketQuery';
import { SkeletonTableRows } from './Skeleton';
import { TickerLogoLabel } from './TickerLogo';

export interface MarketTableProps {
  data: StockData[];
  loading?: boolean;
}

interface ColumnDef {
    key: string;
    sortKey: keyof StockData;
    label: string;
    align: 'left' | 'right';
    render: (row: StockData, settings: Settings) => React.ReactNode;
}

const COLUMNS: ColumnDef[] = [
    {
        key: 'close', sortKey: 'close', label: 'Close', align: 'right',
        render: (row) => row.close.toLocaleString(),
    },
    {
        key: 'high', sortKey: 'high', label: 'High', align: 'right',
        render: (row) => (row.high ?? 0).toLocaleString(),
    },
    {
        key: 'low', sortKey: 'low', label: 'Low', align: 'right',
        render: (row) => (row.low ?? 0).toLocaleString(),
    },
    {
        key: 'change', sortKey: 'change', label: 'Change', align: 'right',
        render: (row) => (
            <span style={{ color: row.change > 0 ? 'var(--accent-success)' : row.change < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                {row.change > 0 ? '+' : ''}{formatLargeNumber(row.change)}
            </span>
        ),
    },
    {
        key: 'pctChange', sortKey: 'pctChange', label: '% Change', align: 'right',
        render: (row) => {
            const pct = row.pctChange ?? 0;
            return (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: pct > 0 ? 'rgba(16, 185, 129, 0.1)' : pct < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                    color: pct > 0 ? 'var(--accent-success)' : pct < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)',
                    fontWeight: 'var(--font-semibold)',
                    fontSize: 'var(--text-xs)',
                }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
            );
        },
    },
    {
        key: 'bid', sortKey: 'outstandingBid', label: 'Bid', align: 'right',
        render: (row) => (row.outstandingBid ?? 0) > 0 ? formatLargeNumber(row.outstandingBid!) : '-',
    },
    {
        key: 'offer', sortKey: 'outstandingOffer', label: 'Offer', align: 'right',
        render: (row) => (row.outstandingOffer ?? 0) > 0 ? formatLargeNumber(row.outstandingOffer!) : '-',
    },
    {
        key: 'volume', sortKey: 'volume', label: 'Volume', align: 'right',
        render: (row, settings) => settings.numberFormat === 'full'
            ? (row.volume ?? 0).toLocaleString()
            : formatLargeNumber(row.volume ?? 0),
    },
    {
        key: 'turnover', sortKey: 'turnover', label: 'Turnover', align: 'right',
        render: (row, settings) => `${settings.showCurrency ? 'TZS ' : ''}${formatLargeNumber(row.turnover)}`,
    },
    {
        key: 'mcap', sortKey: 'mcap', label: 'MCap', align: 'right',
        render: (row, settings) => `${settings.showCurrency ? 'TZS ' : ''}${formatLargeNumber(row.mcap)}`,
    },
];

const HIDDEN_COLUMNS_KEY = 'dseasy_market_table_hidden_columns';

export const MarketTable: React.FC<MarketTableProps> = ({ data, loading = false }) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [sortConfig, setSortConfig] = useState<{ key: keyof StockData; direction: "asc" | "desc" }>({ key: 'pctChange', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY);
            if (saved) return new Set(JSON.parse(saved));
        } catch (e) {
            console.warn('Failed to parse saved market table column visibility');
        }
        return new Set();
    });

    useEffect(() => {
        localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(Array.from(hiddenColumns)));
    }, [hiddenColumns]);

    const visibleColumns = useMemo(
        () => COLUMNS.filter(c => !hiddenColumns.has(c.key)),
        [hiddenColumns]
    );

    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        const onClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [pickerOpen]);

    const toggleColumn = (key: string) => {
        setHiddenColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const sortedData = useMemo(() => {
        let sortableData = [...data];

        if (searchTerm) {
            sortableData = sortableData.filter(item =>
                item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        sortableData.sort((a, b) => {
            const aRaw = a[sortConfig.key];
            const bRaw = b[sortConfig.key];
            const aVal = typeof aRaw === "number" ? aRaw : typeof aRaw === "string" ? aRaw : 0;
            const bVal = typeof bRaw === "number" ? bRaw : typeof bRaw === "string" ? bRaw : 0;

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

    const requestSort = (key: keyof StockData): void => {
        const direction: "asc" | "desc" =
            sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc";
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof StockData): React.ReactElement => {
        if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}>⇅</span>;
        return sortConfig.direction === 'asc' ? <span>↑</span> : <span>↓</span>;
    };

    if (!loading && data.length === 0) {
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
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', alignItems: 'center' }}>
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
                <div ref={pickerRef} style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setPickerOpen(o => !o)}
                        aria-label="Choose visible columns"
                        aria-expanded={pickerOpen}
                        title="Choose visible columns"
                        style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-2)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: 'var(--text-sm)',
                        }}
                    >
                        <Columns3 size={16} />
                    </button>
                    {pickerOpen && (
                        <div
                            role="menu"
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-2)',
                                minWidth: '180px',
                                zIndex: 20,
                                boxShadow: '0 8px 16px rgba(0,0,0,0.25)',
                            }}
                        >
                            <div style={{ padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Columns
                            </div>
                            {COLUMNS.map(col => {
                                const visible = !hiddenColumns.has(col.key);
                                return (
                                    <label
                                        key={col.key}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-2)',
                                            padding: 'var(--space-2)',
                                            cursor: 'pointer',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--text-sm)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={visible}
                                            onChange={() => toggleColumn(col.key)}
                                        />
                                        {col.label}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th
                                style={{ ...thStyle, backgroundColor: 'var(--bg-elevated)', position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid var(--glass-border)', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' }}
                                onClick={() => requestSort('symbol')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Symbol {getSortIcon('symbol')}</div>
                            </th>
                            {visibleColumns.map(col => (
                                <th
                                    key={col.key}
                                    style={{ ...thStyle, textAlign: col.align }}
                                    onClick={() => requestSort(col.sortKey)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                                        {col.label} {getSortIcon(col.sortKey)}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                          <SkeletonTableRows rows={8} />
                        ) : sortedData.map((row) => (
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
                                    <TickerLogoLabel symbol={row.symbol} size={28}>
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
                                    </TickerLogoLabel>
                                </td>
                                {visibleColumns.map(col => {
                                    const baseColor = col.key === 'turnover' || col.key === 'mcap' ? 'var(--text-secondary)' : 'var(--text-primary)';
                                    return (
                                        <td key={col.key} style={{ ...tdStyle, textAlign: col.align, color: baseColor }}>
                                            {col.render(row, settings)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
