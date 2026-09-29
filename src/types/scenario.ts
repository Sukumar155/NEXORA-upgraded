export type CommTier = 'T1' | 'T2' | 'T3' | 'T4';

export interface BlockedRoad {
  id: string;
  name: string;
  lat: number;
  lng: number;
  reason: string;
  active: boolean;
}

export interface ScenarioState {
  rainfallMmPerHour: number;
  riverLevelMeters: number;
  dangerMarkMeters: number;
  embankmentBreached: boolean;
  blockedRoads: BlockedRoad[];
  commTier: CommTier;
  isOffline: boolean;
  queuedSyncCount: number;
  lastSyncTime: string;
}
