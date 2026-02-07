import { Bar, Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getCommonChartOptions, getChartTheme } from '../utils/chartTheme';

export const PriceChangeChart = ({ data }) => {
    const { settings } = useSettings();
    const options = getCommonChartOptions(settings.theme);

    // Top 10 by absolute change
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10);
    }, [data]);

    const config = useMemo(() => {
        return {
            labels: sortedData.map(d => d.symbol),
            datasets: [
                {
                    label: 'Price Change %',
                    data: sortedData.map(d => d.change),
                    backgroundColor: sortedData.map(d => d.change >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderColor: sortedData.map(d => d.change >= 0 ? '#10b981' : '#ef4444'),
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };
    }, [sortedData]);

    return (
        <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', height: '400px' }}>
            <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Top Price Changes (%)</h3>
            <div style={{ position: 'relative', height: '320px' }}>
                <Bar options={options} data={config} />
            </div>
        </div>
    );
};

export const TurnoverChart = ({ data }) => {
    // Top 5 by Turnover
    const chartData = useMemo(() => {
        return [...data].sort((a, b) => b.turnover - a.turnover).slice(0, 5);
    }, [data]);
    
    const config = {
        labels: chartData.map(d => d.symbol),
        datasets: [
            {
                label: 'Turnover',
                data: chartData.map(d => d.turnover),
                backgroundColor: [
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(244, 63, 94, 0.7)',
                    'rgba(234, 179, 8, 0.7)',
                    'rgba(168, 85, 247, 0.7)',
                ],
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            },
        ],
    };

    const { settings } = useSettings();
    const { textColorHex } = getChartTheme(settings.theme);

    const doughnutOptions = {
        ...getCommonChartOptions(settings.theme),
        scales: {}, // No scales for doughnut
        cutout: '70%',
        plugins: {
            legend: {
                position: 'right',
                labels: { color: textColorHex, padding: 20, font: { family: "'Inter', sans-serif", size: 12 } }
            },
            tooltip: getCommonChartOptions(settings.theme).plugins.tooltip
        }
    };

    return (
        <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', height: '400px' }}>
            <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Turnover Distribution (Top 5)</h3>
            <div style={{ position: 'relative', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut options={doughnutOptions} data={config} />
            </div>
        </div>
    );
};
