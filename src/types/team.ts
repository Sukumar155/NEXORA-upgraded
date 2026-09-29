export type TeamType = 'NDRF' | 'SDRF' | 'CIVIL_DEFENCE' | 'AAPDA_MITRA';

export type TeamStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'STANDBY';

export interface RescueTeam {
  id: string;
  name: string;
  type: TeamType;
  status: TeamStatus;
  personnelCount: number;
  capabilities: string[];
  currentLocation: string;
  lat: number;
  lng: number;
  activeAssignmentId?: string;
  etaMinutes?: number;
  distanceKm?: number;
}
