export type AssistanceNeed = 'Elderly' | 'Child' | 'Disabled' | 'Medical' | 'Food' | 'Water';

export type SOSStatus = 'PENDING' | 'TRIAGED' | 'DISPATCHED' | 'COMMITTED' | 'RESCUED' | 'FALSE_ALARM';

export type SOSPriority = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export interface SOSReport {
  id: string;
  reporterPhone: string;
  maskedPhone: string;
  locationName: string;
  lat: number;
  lng: number;
  peopleCount: number;
  needs: AssistanceNeed[];
  waterLevelMeters: number;
  priorityScore: number; // 0 to 100
  priorityLevel: SOSPriority;
  aiExplanation: string;
  status: SOSStatus;
  timestamp: string; // ISO string
  assignedTeamId?: string;
  assignedShelterId?: string;
  isPriorityOverridden?: boolean;
  overriddenBy?: string;
  originalScore?: number;
}
