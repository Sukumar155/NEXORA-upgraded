export interface DetectedDamageObject {
  id: string;
  label: string;
  category: 'FLOODED_ROAD' | 'STRUCTURAL_DAMAGE' | 'BLOCKED_ROUTE' | 'SUBMERGED_VEHICLE' | 'TRAPPED_CITIZENS';
  confidencePct: number; // e.g. 94.2
  // Bounding box percentages [ymin, xmin, ymax, xmax] relative to image dimensions (0-100)
  bbox: [number, number, number, number];
  description: string;
}

export interface DroneDamageScan {
  id: string;
  title: string;
  imageUrl: string;
  timestamp: string;
  altitudeMeters: number;
  locationName: string;
  lat: number;
  lng: number;
  overallSeverity: 'SEVERE' | 'HIGH' | 'MODERATE';
  detectedObjects: DetectedDamageObject[];
  pinnedToMap: boolean;
  notes: string;
}
