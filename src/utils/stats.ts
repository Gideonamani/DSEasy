export interface TickerStatsInput {
  close: number;
  volume?: number;
}

export interface TickerStats {
  latest: number;
  high: number;
  low: number;
  periodChange: number;
  avgVolume: number;
  dataPoints: number;
}

export function calculateTickerStats(filteredData: TickerStatsInput[]): TickerStats | null {
  if (!filteredData || !filteredData.length) return null;

  const closes = filteredData.map((d) => d.close).filter((c): c is number => typeof c === "number" && c > 0);
  const latest = filteredData[filteredData.length - 1];
  const first = filteredData[0];
  const periodChange = first?.close ? ((latest?.close - first?.close) / first?.close) * 100 : 0;

  return {
    latest: latest?.close || 0,
    high: closes.length ? Math.max(...closes) : 0,
    low: closes.length ? Math.min(...closes) : 0,
    periodChange,
    avgVolume: filteredData.reduce((sum, d) => sum + (d.volume ?? 0), 0) / filteredData.length,
    dataPoints: filteredData.length,
  };
}
