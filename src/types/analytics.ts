export interface HourlyTrendPoint {
  timeLabel: string;
  waterLevelM: number;
  dangerMarkM: number;
  rainfallMm: number;
  riskScore: number;
}

export interface IncidentResolutionMetric {
  category: string;
  totalReceived: number;
  triaged: number;
  rescued: number;
  avgResolutionTimeMins: number;
}
