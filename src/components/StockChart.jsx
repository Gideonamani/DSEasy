import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const getChartOptions = (theme) => {
    const isLight = theme === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: textColor }
            },
            title: {
                display: false,
            },
        },
        scales: {
            x: {
                ticks: { color: textColor },
                grid: { color: gridColor }
            },
            y: {
                ticks: { color: textColor },
                grid: { color: gridColor }
            }
        }
    };
};

export const PriceChangeChart = ({ data }) => {
    const { settings } = useSettings();
    const options = getChartOptions(settings.theme);

    // Top 10 by absolute change
    const chartData = useMemo(() => {
        return [...data].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10);
    }, [data]);

    const config = {
        labels: chartData.map(d => d.symbol),
        datasets: [
            {
                label: 'Price Change %',
                data: chartData.map(d => d.change),
                backgroundColor: chartData.map(d => d.change >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor: chartData.map(d => d.change >= 0 ? '#10b981' : '#ef4444'),
                borderWidth: 1,
                borderRadius: 4,
            },
        ],
    };

    return (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-secondary)' }}>Top Price Changes (%)</h3>
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
    const isLight = settings.theme === 'light';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    const doughnutOptions = {
        ...getChartOptions(settings.theme),
        scales: {}, // No scales for doughnut
        cutout: '70%',
        plugins: {
            legend: {
                position: 'right',
                labels: { color: textColor, padding: 20 }
            }
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-secondary)' }}>Turnover Distribution (Top 5)</h3>
            <div style={{ position: 'relative', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut options={doughnutOptions} data={config} />
            </div>
        </div>
    );
};
