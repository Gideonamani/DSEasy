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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: { color: '#94a3b8' } // text-secondary
        },
        title: {
            display: false,
        },
    },
    scales: {
        x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
    }
};

export const PriceChart = ({ data }) => {
    // Sort by Close Price descending and take top 10 for readability
    const chartData = [...data].sort((a, b) => b.close - a.close).slice(0, 10);

    const config = {
        labels: chartData.map(d => d.symbol),
        datasets: [
            {
                label: 'Closing Price',
                data: chartData.map(d => d.close),
                backgroundColor: 'rgba(99, 102, 241, 0.6)', // Indigo
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
            },
        ],
    };

    return (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-secondary)' }}>Top Prices</h3>
            <div style={{ position: 'relative', height: '320px' }}>
                <Bar options={defaultOptions} data={config} />
            </div>
        </div>
    );
};

export const VolumeChart = ({ data }) => {
    // Top 5 by Volume
    const chartData = [...data].sort((a, b) => b.volume - a.volume).slice(0, 5);
    
    const config = {
        labels: chartData.map(d => d.symbol),
        datasets: [
            {
                label: 'Volume',
                data: chartData.map(d => d.volume),
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

    const doughnutOptions = {
        ...defaultOptions,
        scales: {}, // No scales for doughnut
        cutout: '70%',
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#94a3b8', padding: 20 }
            }
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-secondary)' }}>Volume Distribution (Top 5)</h3>
            <div style={{ position: 'relative', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut options={doughnutOptions} data={config} />
            </div>
        </div>
    );
};
