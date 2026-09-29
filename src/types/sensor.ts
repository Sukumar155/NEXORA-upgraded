export type StationStatus = 'ONLINE' | 'WARNING' | 'OFFLINE';

/**
 * A single live headline reading shown in the 5-metric telemetry strip.
 * `min`/`max` bound the random walk, `dangerAt` drives the warning state.
 */
export interface LiveSensorMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  precision: number;
  min: number;
  max: number;
  dangerAt: number;
  /** Change vs the previous tick — drives the trend arrow. */
  delta: number;
  trend: 'up' | 'down' | 'flat';
  /** Seconds since this reading was last refreshed. */
  ageSec: number;
}


export interface SensorStation {
  id: string;
  stationCode: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  waterLevelCm: number;
  waterLevelNormalCm: number;
  waterLevelDangerCm: number;
  rainfallMm: number;
  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;
  windSpeedKmh: number;
  batteryPct: number;
  loraRssiDbm: number;
  loraSnrDb: number;
  status: StationStatus;
  lastPingTime: string;
  packetSuccessRatePct: number;
}
