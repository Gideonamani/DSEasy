import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, ChartOptions } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export interface ChartTheme {
    isLight: boolean;
    textColor: string;
    textColorHex: string;
    gridColor: string;
    tooltipBg: string;
    tooltipBorder: string;
    tooltipTitle: string;
    tooltipBody: string;
    fontFamily: string;
}

export const getChartTheme = (theme: 'light' | 'dark' | string): ChartTheme => {
    const isLight = theme === 'light';
    
    return {
        isLight,
        textColor: 'var(--text-secondary)', // Use CSS variable if possible, but ChartJS needs hex/rgba usually. We can specific check computed style or just use hardcoded matching values.
        // Actually, better to use the specific colors that match our CSS variables
        textColorHex: isLight ? '#64748b' : '#94a3b8',
        gridColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)',
        tooltipBg: 'rgba(15, 23, 42, 0.95)',
        tooltipBorder: 'rgba(255, 255, 255, 0.1)',
        tooltipTitle: '#ffffff',
        tooltipBody: '#94a3b8',
        fontFamily: "'Inter', sans-serif"
    };
};

export const getCommonChartOptions = (theme: 'light' | 'dark' | string): ChartOptions<any> => {
    const { textColorHex, gridColor, tooltipBg, tooltipBorder, tooltipTitle, tooltipBody, fontFamily } = getChartTheme(theme);

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { 
                    color: textColorHex,
                    font: { family: fontFamily, size: 12 }
                }
            },
            title: {
                display: false,
            },
            tooltip: {
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderWidth: 1,
                titleColor: tooltipTitle,
                bodyColor: tooltipBody,
                padding: 12,
                cornerRadius: 8,
                titleFont: { family: fontFamily, weight: '600' },
                bodyFont: { family: fontFamily }
            }
        },
        scales: {
            x: {
                ticks: { 
                    color: textColorHex,
                    font: { family: fontFamily, size: 11 }
                },
                grid: { color: gridColor, drawBorder: false }
            },
            y: {
                ticks: { 
                    color: textColorHex,
                    font: { family: fontFamily, size: 11 }
                },
                grid: { color: gridColor, drawBorder: false }
            }
        }
    };
};
