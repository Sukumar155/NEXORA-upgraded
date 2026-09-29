export type ResourceCategory =
  | 'AMBULANCE'
  | 'RESCUE_BOAT'
  | 'NDRF_TEAM'
  | 'SDRF_TEAM'
  | 'MEDICAL_KIT'
  | 'WATER_PACK'
  | 'HIGH_FLOW_PUMP';

export interface EmergencyResourceItem {
  id: string;
  name: string;
  category: ResourceCategory;
  totalQuantity: number;
  availableQuantity: number;
  deployedQuantity: number;
  maintenanceQuantity: number;
  unit: string;
  locationHub: string;
  lat: number;
  lng: number;
  contactPerson: string;
  contactPhone: string;
  status: 'OPTIMAL' | 'LIMITED' | 'DEPLETED';
}

export interface ResourceDispatchLog {
  id: string;
  timestamp: string;
  resourceName: string;
  quantity: number;
  dispatchedTo: string; // e.g. "Zone A - Pandu Ghat SOS-0841"
  assignedBy: string;
  status: 'TRANSIT' | 'DELIVERED';
}
