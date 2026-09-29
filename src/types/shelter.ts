export interface ShelterArrivalGroup {
  id: string;
  teamName: string;
  headcount: number;
  eta: string;
  needsSummary: string;
  checkedIn: boolean;
}

export interface ShelterResources {
  foodPackets: number;
  waterLiters: number;
  medicalKits: number;
  foodLowThreshold: number;
  waterLowThreshold: number;
  medicalLowThreshold: number;
}

export interface ReliefShelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalCapacity: number;
  currentOccupancy: number;
  reservedSpaces: number;
  accessibilityScore: number; // 0 to 100
  hasMedicalFacility: boolean;
  resources: ShelterResources;
  expectedArrivals: ShelterArrivalGroup[];
}
