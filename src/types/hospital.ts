export interface EmergencyHospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalBeds: number;
  availableBeds: number;
  icuBedsAvailable: number;
  hasTraumaCenter: boolean;
  hasEmergencyHelipad: boolean;
  ambulanceStandbyCount: number;
  contactEmergency: string;
  status: 'OPERATIONAL' | 'BUSY' | 'CRITICAL';
}

export interface SafeEvacuationRoute {
  id: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationShelterId: string;
  destinationName: string;
  distanceKm: number;
  etaMinutes: number;
  riskRating: 'DRY_CORRIDOR_SAFE' | 'CAUTION_SHALLOW_SURGE' | 'BLOCKED';
  waypoints: [number, number][];
  directions: string[];
}
