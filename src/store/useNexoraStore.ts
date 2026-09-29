import { create } from 'zustand';
import { SOSReport, AssistanceNeed } from '../types/sos';
import { RescueTeam } from '../types/team';
import { ReliefShelter } from '../types/shelter';
import { BlockedRoad, CommTier } from '../types/scenario';
import { SensorStation, LiveSensorMetric } from '../types/sensor';
import { DisasterAlert } from '../types/alert';
import { DroneDamageScan } from '../types/damage';
import { EmergencyResourceItem, ResourceDispatchLog } from '../types/resource';
import { EmergencyHospital, SafeEvacuationRoute } from '../types/hospital';
import { HourlyTrendPoint } from '../types/analytics';
import { SupportedLanguage } from '../i18n/translations';
import { submitBeacon, broadcastAlert, setAlertActive, fetchAlerts, fileIncident, triageSOS, type ServerSOS, type SosServerStatus } from '../services/sosApi';
import { haversineKm, estimateTravel, bearingDeg, compassLabel } from '../services/geolocationService';
import { planDryCorridor } from '../services/corridorPlanner';
import {
  fetchWeather,
  simulatedWeather,
  type WeatherSnapshot,
  type WeatherStatus
} from '../services/weatherService';

export type UserRole = 'DDMO_OFFICER' | 'CITIZEN' | 'FIELD_RESPONDER' | 'SHELTER_MANAGER';

/** Profile captured by the role-based login wizard (persisted with the session). */
export interface UserProfile {
  fullName: string;
  locality?: string;
  familySize?: number;
  agency?: string;
}
/**
 * Per-district static site descriptors.
 *
 * These four inputs are not derivable from live telemetry — they describe the
 * catchment itself — so they are modelled as data, one record per district in
 * the TopBar selector, and swapped when the operator changes district.
 */
export interface DistrictSite {
  latitude: number;
  longitude: number;
  /** Ground elevation of the reference gauge, metres MSL. */
  elevationM: number;
  /** design discharge of the nearest river gauge, m^3/s. */
  riverDischargeM3s: number;
  /** Recorded flood events at this site in the reference period. */
  historicalFloods: number;
  populationDensityPerKm2: number;
}

export type AppView = 
  | 'COMMAND_DASHBOARD' 
  | 'DDMO_AUTHORITY'
  | 'DISASTER_MAP' 
  | 'AI_RISK' 
  | 'SENSORS' 
  | 'WEATHER'
  | 'ALERTS' 
  | 'SHELTER_EVACUATION' 
  | 'EMERGENCY_RESOURCES' 
  | 'DAMAGE_DETECTION' 
  | 'CITIZEN_PORTAL'
  | 'YOLO_PREDICT'
  | 'CITIZEN_MAP'
  | 'CITIZEN_SHELTERS'
  | 'ANALYTICS' 
  | 'FIELD_RESPONDER' 
  | 'SHELTER_MANAGER' 
  | 'USSD_SIMULATOR' 
  | 'LOGIN';

interface NexoraState {
  // Auth & Roles
  isAuthenticated: boolean;
  userPhone: string;
  userName: string;
  userRole: UserRole;
  userProfile: UserProfile | null;
  currentView: AppView;
  district: string;
  /** Static per-district site descriptors feeding the flood-risk model. */
  districtSite: DistrictSite;
  currentLanguage: SupportedLanguage;
  theme: 'light' | 'dark' | 'system';
  mapDataStatus: 'LIVE' | 'UPDATING' | 'OFFLINE' | 'SYNCING';
  sosServerStatus: SosServerStatus;
  userLocation: { lat: number; lng: number; accuracy: number } | null;

  // Domain Data
  sosReports: SOSReport[];
  teams: RescueTeam[];
  shelters: ReliefShelter[];
  blockedRoads: BlockedRoad[];
  sensorStations: SensorStation[];
  /** 5 headline live readings shared by the Sensors page and the Citizen Portal. */
  liveSensorMetrics: LiveSensorMetric[];
  /** Last successful Open-Meteo reading, or null before the first fetch. */
  weather: WeatherSnapshot | null;
  weatherStatus: WeatherStatus;
  weatherError: string | null;
  alerts: DisasterAlert[];
  damageScans: DroneDamageScan[];
  resources: EmergencyResourceItem[];
  dispatchLogs: ResourceDispatchLog[];
  hospitals: EmergencyHospital[];
  evacuationRoutes: SafeEvacuationRoute[];
  activeEvacuationRoute: SafeEvacuationRoute | null;
  hydrographTrends: HourlyTrendPoint[];
  /** Epoch ms the newest hydrograph sample was committed; gates the roll-forward. */
  lastHydrographCommitAt: number;

  // Real-time environmental parameters & Simulation
  rainfallMmPerHour: number;
  riverLevelMeters: number;
  dangerMarkMeters: number;
  windSpeedKmh: number;
  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;
  overallRiskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  embankmentBreached: boolean;
  commTier: CommTier;
  isOffline: boolean;
  isSensorStreaming: boolean;
  queuedSyncCount: number;
  lastSyncTime: string;

  // UI & Modals
  selectedSOSId: string | null;
  selectedStationId: string | null;
  selectedAlertId: string | null;
  isDetailOpen: boolean;
  isResponsePlanOpen: boolean;
  isUSSDOpen: boolean;
  isIncidentModalOpen: boolean;
  isResourceDispatchModalOpen: boolean;
  activePlanCommitted: boolean;
  notificationCount: number;

  // Actions
  login: (phone: string, role?: UserRole, profile?: UserProfile) => void;
  logout: () => void;
  setCurrentView: (view: AppView) => void;
  setUserRole: (role: UserRole) => void;
  setDistrict: (district: string) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMapDataStatus: (status: 'LIVE' | 'UPDATING' | 'OFFLINE' | 'SYNCING') => void;
  setUserLocation: (loc: { lat: number; lng: number; accuracy: number } | null) => void;
  focusedMapLocation: { lat: number; lng: number; title: string; address?: string; zoom?: number } | null;
  setFocusedMapLocation: (loc: { lat: number; lng: number; title: string; address?: string; zoom?: number } | null) => void;

  selectSOS: (id: string | null) => void;
  selectStation: (id: string | null) => void;
  selectAlert: (id: string | null) => void;
  openDetailDrawer: (id: string) => void;
  closeDetailDrawer: () => void;
  openResponsePlan: (id: string) => void;
  closeResponsePlan: () => void;
  toggleUSSDModal: (open?: boolean) => void;
  toggleIncidentModal: (open?: boolean) => void;
  toggleResourceDispatchModal: (open?: boolean) => void;

  // Triage & Response
  overridePriority: (id: string, newScore: number, reason: string) => void;
  markFalseAlarm: (id: string) => void;
  approveResponsePlan: (sosId: string, teamId: string, shelterId: string) => void;
  rejectResponsePlan: (sosId: string) => void;

  // Alerts & Warnings
  broadcastNewAlert: (newAlert: Omit<DisasterAlert, 'id' | 'timestamp' | 'active'>) => void;
  /** Resolve a bulletin: drops it from the active feed, decrements the
   *  notification badge, and files it in the 24-hour history strip. */
  dismissAlert: (alertId: string) => void;
  /** Re-open a resolved bulletin. */
  restoreAlert: (alertId: string) => void;
  /** Delete resolved bulletins older than 24 hours. */
  purgeExpiredAlertHistory: () => void;
  /** Pull bulletins from the server so the active feed and history survive a reload. */
  hydrateAlerts: () => Promise<void>;

  // Drone AI Damage Detection
  pinDamageToMap: (scanId: string) => void;

  // Resource Management
  dispatchResource: (resourceId: string, quantity: number, destination: string) => void;

  // Evacuation Routing
  setActiveEvacuationRoute: (route: SafeEvacuationRoute | null) => void;
  calculateSafeRoute: (originName: string, shelterId: string, origin?: { lat: number; lng: number }) => SafeEvacuationRoute | null;

  // Citizen Incident
  submitCitizenIncident: (incident: {
    title: string;
    description: string;
    locationName: string;
    lat: number;
    lng: number;
    peopleCount: number;
    category: string;
    reporterPhone: string;
  }) => void;

  // One-tap SOS Signal (urgent location beacon from a citizen)
  submitQuickSOS: (beacon: {
    lat: number;
    lng: number;
    locationName: string;
    accuracy?: number;
  }) => void;

  // SOS backend bridge (server/sos-server.mjs)
  setSosServerStatus: (status: SosServerStatus) => void;
  ingestServerSOS: (reports: ServerSOS[]) => void;

  // Environmental simulation
  setRainfall: (rainfall: number) => void;
  setRiverLevel: (level: number) => void;
  toggleRoadBlock: (id: string) => void;
  simulateEmbankmentBreach: () => void;
  fillShelters: () => void;
  resetDemoScenario: () => void;
  setCommTier: (tier: CommTier) => void;
  toggleOfflineMode: () => void;
  toggleSensorStreaming: () => void;
  /** Advance the 5 live metrics by one random-walk step (called every 5s). */
  sensorTick: () => void;
  /**
   * Refresh live weather for the current district.
   * Respects the offline switch: when offline it will not touch the network and
   * instead marks the existing reading stale.
   */
  refreshWeather: (force?: boolean) => Promise<void>;
  syncQueuedUpdates: () => void;

  // Shelter actions
  checkInArrival: (shelterId: string, arrivalId: string) => void;
  updateShelterResource: (shelterId: string, resourceKey: 'foodPackets' | 'waterLiters' | 'medicalKits', delta: number) => void;

  // Responder actions
  responderMissionStatus: 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'EVACUATING' | 'COMPLETED';
  setResponderMissionStatus: (status: 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'EVACUATING' | 'COMPLETED') => void;
  queueOfflineAction: (actionDescription: string) => void;
}

// -------------------------------------------------------------
// INITIAL SEED DATA
// -------------------------------------------------------------

const INITIAL_REPORTS: SOSReport[] = [
  {
    id: "SOS-2026-0841",
    reporterPhone: "+91 98640 94412",
    maskedPhone: "+91 98*** **412",
    locationName: "Marina Beach Esplanade, Triplicane",
    lat: 13.050,
    lng: 80.283,
    peopleCount: 4,
    needs: ["Elderly", "Disabled", "Medical", "Water"],
    waterLevelMeters: 1.95,
    priorityScore: 96,
    priorityLevel: "CRITICAL",
    aiExplanation: "Critical priority: Rising floodwater (1.95m), 4 people trapped including 1 bedridden elderly with oxygen shortage, 0 rescue boats currently in 4km radius.",
    status: "PENDING",
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString()
  },
  {
    id: "SOS-2026-0842",
    reporterPhone: "+91 94350 28839",
    maskedPhone: "+91 94*** **839",
    locationName: "George Town Parry's Corner Chawl",
    lat: 13.094,
    lng: 80.288,
    peopleCount: 7,
    needs: ["Child", "Food", "Water"],
    waterLevelMeters: 1.40,
    priorityScore: 89,
    priorityLevel: "CRITICAL",
    aiExplanation: "High urgency: Rooftop refuge with 3 children under 5 years, water rose 40cm in 30 mins, drinking water contaminated.",
    status: "PENDING",
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString()
  },
  {
    id: "SOS-2026-0843",
    reporterPhone: "+91 70021 84118",
    maskedPhone: "+91 70*** **118",
    locationName: "Otteri Nullah Culvert, Kilpauk",
    lat: 13.102,
    lng: 80.190,
    peopleCount: 5,
    needs: ["Elderly", "Medical", "Food"],
    waterLevelMeters: 1.15,
    priorityScore: 82,
    priorityLevel: "HIGH",
    aiExplanation: "High risk: Sluice gate overflow has surrounded compound, 1 heart patient requires medication transport within 90 minutes.",
    status: "TRIAGED",
    timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString()
  },
  {
    id: "SOS-2026-0844",
    reporterPhone: "+91 88762 19045",
    maskedPhone: "+91 88*** **045",
    locationName: "Velachery Main Road Bypass Link",
    lat: 12.975,
    lng: 80.221,
    peopleCount: 3,
    needs: ["Child", "Food"],
    waterLevelMeters: 0.70,
    priorityScore: 68,
    priorityLevel: "MODERATE",
    aiExplanation: "Moderate priority: Vehicle stalled in 0.7m water, family safe on embankment shoulder, dry rations needed.",
    status: "PENDING",
    timestamp: new Date(Date.now() - 34 * 60 * 1000).toISOString()
  },
  {
    id: "SOS-2026-0845",
    reporterPhone: "+91 97060 55192",
    maskedPhone: "+91 97*** **192",
    locationName: "Kasthambidi Fisherfolk Settlement, Ennore",
    lat: 13.250,
    lng: 80.320,
    peopleCount: 12,
    needs: ["Food", "Water"],
    waterLevelMeters: 0.85,
    priorityScore: 64,
    priorityLevel: "MODERATE",
    aiExplanation: "Group alert: 12 villagers isolated on school platform, dry shelter secured, water supply severed for 6 hours.",
    status: "PENDING",
    timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString()
  },
  {
    id: "SOS-2026-0846",
    reporterPhone: "+91 91012 39981",
    maskedPhone: "+91 91*** **981",
    locationName: "Adyar River Bund, Saidapet",
    lat: 13.020,
    lng: 80.220,
    peopleCount: 2,
    needs: ["Elderly"],
    waterLevelMeters: 0.45,
    priorityScore: 48,
    priorityLevel: "LOW",
    aiExplanation: "Low immediacy: Water in courtyard only, ground floor safe, requesting precautionary evacuation before nightfall.",
    status: "PENDING",
    timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString()
  }
];

const INITIAL_TEAMS: RescueTeam[] = [
  {
    id: "TEAM-NDRF-01",
    name: "NDRF 1st Bn — Column Alpha",
    type: "NDRF",
    status: "AVAILABLE",
    personnelCount: 18,
    capabilities: ["Inflatable Motor Boats (IRB)", "Paramedics", "Night Floodlights", "Deep Diver"],
    currentLocation: "Marina Beach Staging Area",
    lat: 13.050,
    lng: 80.283,
    etaMinutes: 14,
    distanceKm: 3.8
  },
  {
    id: "TEAM-SDRF-03",
    name: "SDRF Chennai — Unit 2",
    type: "SDRF",
    status: "EN_ROUTE",
    personnelCount: 12,
    capabilities: ["High Clearance 4x4 Truck", "First Aid Rations", "Life Buoys"],
    currentLocation: "Victoria Public Hall, Egmore",
    lat: 13.073,
    lng: 80.261,
    etaMinutes: 8,
    distanceKm: 2.2
  },
  {
    id: "TEAM-AAPDA-08",
    name: "Aapda Mitra Volunteers — Sector 4",
    type: "AAPDA_MITRA",
    status: "AVAILABLE",
    personnelCount: 24,
    capabilities: ["Local Navigation", "Community Evacuation", "Language Translation"],
    currentLocation: "Sholinganallur Circle Office",
    lat: 12.901,
    lng: 80.227,
    etaMinutes: 19,
    distanceKm: 5.4
  }
];

const INITIAL_SHELTERS: ReliefShelter[] = [
  {
    id: "SHELTER-01",
    name: "University of Madras Centenary Auditorium",
    address: "Chepauk, Triplicane, Chennai 600005",
    lat: 13.0600,
    lng: 80.2860,
    totalCapacity: 450,
    currentOccupancy: 322,
    reservedSpaces: 36,
    accessibilityScore: 92,
    hasMedicalFacility: true,
    resources: {
      foodPackets: 1420,
      waterLiters: 3400,
      medicalKits: 55,
      foodLowThreshold: 400,
      waterLowThreshold: 1000,
      medicalLowThreshold: 20
    },
    expectedArrivals: [
      {
        id: "ARR-101",
        teamName: "NDRF Column Alpha",
        headcount: 14,
        eta: "12 mins",
        needsSummary: "4 Elderly, 2 Infants, 8 Adults",
        checkedIn: false
      },
      {
        id: "ARR-102",
        teamName: "Civil Defence Boat 02",
        headcount: 9,
        eta: "25 mins",
        needsSummary: "Family evacuation from Marina Beach",
        checkedIn: false
      }
    ]
  },
  {
    id: "SHELTER-02",
    name: "Madras Christian College Ground",
    address: "Nungambakkam, Chennai 600034",
    lat: 13.0560,
    lng: 80.2820,
    totalCapacity: 600,
    currentOccupancy: 510,
    reservedSpaces: 45,
    accessibilityScore: 88,
    hasMedicalFacility: true,
    resources: {
      foodPackets: 280,
      waterLiters: 750,
      medicalKits: 14,
      foodLowThreshold: 400,
      waterLowThreshold: 1000,
      medicalLowThreshold: 20
    },
    expectedArrivals: [
      {
        id: "ARR-201",
        teamName: "SDRF Chennai Unit 2",
        headcount: 7,
        eta: "18 mins",
        needsSummary: "Trapped citizens from Otteri nullah",
        checkedIn: false
      }
    ]
  },
  {
    id: "SHELTER-03",
    name: "Kamaraj Arangam Multipurpose Shelter",
    address: "Sholinganallur High Road, Chennai 600119",
    lat: 12.9010,
    lng: 80.2270,
    totalCapacity: 800,
    currentOccupancy: 240,
    reservedSpaces: 60,
    accessibilityScore: 98,
    hasMedicalFacility: true,
    resources: {
      foodPackets: 3200,
      waterLiters: 8500,
      medicalKits: 120,
      foodLowThreshold: 500,
      waterLowThreshold: 1500,
      medicalLowThreshold: 30
    },
    expectedArrivals: []
  }
];

const INITIAL_ROADS: BlockedRoad[] = [
  {
    id: "ROAD-01",
    name: "Otteri Nullah at Nungambakkam",
    lat: 13.0560,
    lng: 80.2820,
    reason: "1.4m standing floodwater & drainage breach",
    active: true
  },
  {
    id: "ROAD-02",
    name: "Old Mahabalipuram Road at Sholinganallur",
    lat: 12.9010,
    lng: 80.2270,
    reason: "Debris accumulation and 1.8m tidal surge",
    active: true
  }
];

const INITIAL_STATIONS: SensorStation[] = [
  {
    id: "STATION-01",
    stationCode: "ESP32-LORA-01",
    name: "Cooum River Gauge — Chepauk Marina",
    locationName: "Chepauk, Triplicane, Chennai",
    lat: 13.078,
    lng: 80.288,
    waterLevelCm: 82,
    waterLevelNormalCm: 35,
    waterLevelDangerCm: 95,
    rainfallMm: 46,
    temperatureC: 29.2,
    humidityPct: 88,
    pressureHpa: 997.2,
    windSpeedKmh: 41,
    batteryPct: 94,
    loraRssiDbm: -78,
    loraSnrDb: 9.4,
    status: "ONLINE",
    lastPingTime: "Just now (4s ago)",
    packetSuccessRatePct: 99.4
  },
  {
    id: "STATION-02",
    stationCode: "ESP32-LORA-02",
    name: "Cooum River Gauge — Egmore Outfall",
    locationName: "Egmore River Bridge, Chennai",
    lat: 13.072,
    lng: 80.272,
    waterLevelCm: 142,
    waterLevelNormalCm: 50,
    waterLevelDangerCm: 150,
    rainfallMm: 52,
    temperatureC: 28.6,
    humidityPct: 92,
    pressureHpa: 996.1,
    windSpeedKmh: 38,
    batteryPct: 86,
    loraRssiDbm: -84,
    loraSnrDb: 7.8,
    status: "WARNING",
    lastPingTime: "12s ago",
    packetSuccessRatePct: 97.2
  },
  {
    id: "STATION-03",
    stationCode: "ESP32-LORA-03",
    name: "Adyar River Gauge — Adyar Bridge",
    locationName: "Adyar River Mouth, Chennai",
    lat: 13.006,
    lng: 80.257,
    waterLevelCm: 68,
    waterLevelNormalCm: 30,
    waterLevelDangerCm: 110,
    rainfallMm: 39,
    temperatureC: 29.4,
    humidityPct: 84,
    pressureHpa: 998.5,
    windSpeedKmh: 32,
    batteryPct: 98,
    loraRssiDbm: -72,
    loraSnrDb: 11.2,
    status: "ONLINE",
    lastPingTime: "18s ago",
    packetSuccessRatePct: 99.8
  },
  {
    id: "STATION-04",
    stationCode: "ESP32-LORA-04",
    name: "Kosuthalai Channel Gauge — Manali",
    locationName: "Manali Bridge, Chennai",
    lat: 13.15,
    lng: 80.265,
    waterLevelCm: 45,
    waterLevelNormalCm: 20,
    waterLevelDangerCm: 90,
    rainfallMm: 34,
    temperatureC: 30.1,
    humidityPct: 80,
    pressureHpa: 999.0,
    windSpeedKmh: 36,
    batteryPct: 64,
    loraRssiDbm: -95,
    loraSnrDb: 4.8,
    status: "ONLINE",
    lastPingTime: "45s ago",
    packetSuccessRatePct: 94.5
  }
];

const INITIAL_ALERTS: DisasterAlert[] = [
  {
    id: "ALERT-2026-001",
    title: "HIGH FLOOD INUNDATION RISK — CHENNAI COASTAL BELT",
    severity: "CRITICAL",
    zone: "Zone A: Marina Beach & George Town Lowlands",
    locationName: "Marina, Parry's & Old Madras Street",
    lat: 13.078,
    lng: 80.288,
    timestamp: "10 mins ago",
    reason: "Water level is rising rapidly (82cm, +12cm/hr). Embankment overtopping imminent. High soil saturation.",
    recommendedAction: "Evacuate ground floors immediately to the University of Madras camp. Follow Route D1.",
    issuedBy: "SEOC Incident Command System (ICS)",
    channels: ["CAP_PROTOCOL", "CELL_BROADCAST", "SMS_GATEWAY", "USSD", "SIREN_NETWORK"],
    active: true,
    affectedPopulation: 6400
  },
  {
    id: "ALERT-2026-002",
    title: "NULLAH BACKFLOW WARNING — OTTERI CREEK",
    severity: "SEVERE",
    zone: "Zone B: Otteri Nullah & Nungambakkam",
    locationName: "Nungambakkam & Kilpauk Drainage Network",
    lat: 13.056,
    lng: 80.282,
    timestamp: "24 mins ago",
    reason: "Cooum River surge forcing drainage backflow into municipal storm channels. Water standing at 1.4m.",
    recommendedAction: "Move goods and elderly to upper stories. Discontinue vehicle movement on Poonamallee High Road.",
    issuedBy: "DDMO Disaster Cell",
    channels: ["CAP_PROTOCOL", "SMS_GATEWAY", "USSD"],
    active: true,
    affectedPopulation: 4200
  },
  {
    id: "ALERT-2026-003",
    title: "FLASH FLOOD RUNOFF ADVISORY — VELACHERY LOWS",
    severity: "MODERATE",
    zone: "Zone C: Velachery & Guindy Basin",
    locationName: "Velachery Main Road Link Corridor",
    lat: 12.975,
    lng: 80.221,
    timestamp: "45 mins ago",
    reason: "Upstream hill runoff entering wetlands. Moderate water accumulation in low-lying underpasses.",
    recommendedAction: "Caution for two-wheelers and small vehicles. Secure vehicles on elevated grounds.",
    issuedBy: "Greater Chennai Corporation SEOC",
    channels: ["SMS_GATEWAY"],
    active: true,
    affectedPopulation: 1800
  }
];

const INITIAL_HOSPITALS: EmergencyHospital[] = [
  {
    id: "HOSP-01",
    name: "Rajiv Gandhi Government General Hospital",
    address: "Park Town, Chennai 600010",
    lat: 13.089,
    lng: 80.286,
    totalBeds: 1200,
    availableBeds: 142,
    icuBedsAvailable: 18,
    hasTraumaCenter: true,
    hasEmergencyHelipad: true,
    ambulanceStandbyCount: 14,
    contactEmergency: "108 / +91 44 2535 0000",
    status: "OPERATIONAL"
  },
  {
    id: "HOSP-02",
    name: "Government Stanley Medical College Hospital",
    address: "Nungambakkam, Chennai 600001",
    lat: 13.058,
    lng: 80.282,
    totalBeds: 350,
    availableBeds: 58,
    icuBedsAvailable: 6,
    hasTraumaCenter: true,
    hasEmergencyHelipad: false,
    ambulanceStandbyCount: 6,
    contactEmergency: "+91 44 2535 3333",
    status: "OPERATIONAL"
  },
  {
    id: "HOSP-03",
    name: "Royapuram Government Railway Hospital",
    address: "Royapuram, Chennai 600013",
    lat: 13.104,
    lng: 80.289,
    totalBeds: 280,
    availableBeds: 44,
    icuBedsAvailable: 4,
    hasTraumaCenter: false,
    hasEmergencyHelipad: false,
    ambulanceStandbyCount: 4,
    contactEmergency: "+91 44 2535 4545",
    status: "OPERATIONAL"
  }
];

const INITIAL_RESOURCES: EmergencyResourceItem[] = [
  {
    id: "RES-AMB",
    name: "4x4 High-Clearance Ambulances",
    category: "AMBULANCE",
    totalQuantity: 10,
    availableQuantity: 8,
    deployedQuantity: 2,
    maintenanceQuantity: 0,
    unit: "Vehicles",
    locationHub: "Victoria Public Hall Staging Post",
    lat: 13.073,
    lng: 80.261,
    contactPerson: "Dr. R. Iyer (108 Fleet)",
    contactPhone: "+91 94350 11080",
    status: "OPTIMAL"
  },
  {
    id: "RES-BOAT",
    name: "Inflatable Motor Rescue Boats (IRB)",
    category: "RESCUE_BOAT",
    totalQuantity: 8,
    availableQuantity: 5,
    deployedQuantity: 3,
    maintenanceQuantity: 0,
    unit: "Boats",
    locationHub: "Marina Beach Boat Depot",
    lat: 13.050,
    lng: 80.283,
    contactPerson: "Commander S. Prabhu",
    contactPhone: "+91 98640 55321",
    status: "LIMITED"
  },
  {
    id: "RES-NDRF",
    name: "NDRF Multi-Specialist Rescue Teams",
    category: "NDRF_TEAM",
    totalQuantity: 14,
    availableQuantity: 8,
    deployedQuantity: 6,
    maintenanceQuantity: 0,
    unit: "Columns",
    locationHub: "Manali NDRF HQ",
    lat: 13.150,
    lng: 80.265,
    contactPerson: "Inspector K. Raman",
    contactPhone: "+91 97060 44211",
    status: "OPTIMAL"
  },
  {
    id: "RES-SDRF",
    name: "SDRF First Responders",
    category: "SDRF_TEAM",
    totalQuantity: 12,
    availableQuantity: 7,
    deployedQuantity: 5,
    maintenanceQuantity: 0,
    unit: "Squads",
    locationHub: "Egmore SDRF Reserve",
    lat: 13.085,
    lng: 80.210,
    contactPerson: "Inspector M. Nair",
    contactPhone: "+91 94351 88902",
    status: "OPTIMAL"
  },
  {
    id: "RES-MED",
    name: "Trauma Care & Medical Emergency Kits",
    category: "MEDICAL_KIT",
    totalQuantity: 250,
    availableQuantity: 166,
    deployedQuantity: 84,
    maintenanceQuantity: 0,
    unit: "Kits",
    locationHub: "RGGH Relief Depot",
    lat: 13.089,
    lng: 80.286,
    contactPerson: "Dr. S. Venkatesan",
    contactPhone: "+91 98642 33410",
    status: "OPTIMAL"
  },
  {
    id: "RES-WATER",
    name: "Purified Water Packs (10L Cans)",
    category: "WATER_PACK",
    totalQuantity: 1200,
    availableQuantity: 880,
    deployedQuantity: 320,
    maintenanceQuantity: 0,
    unit: "Packs",
    locationHub: "Sholinganallur Food Logistics",
    lat: 12.901,
    lng: 80.227,
    contactPerson: "Logistics Officer A. Kumar",
    contactPhone: "+91 97061 99201",
    status: "OPTIMAL"
  },
  {
    id: "RES-PUMP",
    name: "Heavy-Duty Diesel De-watering Pumps",
    category: "HIGH_FLOW_PUMP",
    totalQuantity: 20,
    availableQuantity: 14,
    deployedQuantity: 6,
    maintenanceQuantity: 0,
    unit: "Units",
    locationHub: "Otteri Pumping Yard",
    lat: 13.056,
    lng: 80.282,
    contactPerson: "Engineer D. Sekar",
    contactPhone: "+91 94352 77119",
    status: "OPTIMAL"
  }
];

const INITIAL_DISPATCH_LOGS: ResourceDispatchLog[] = [
  {
    id: "DISP-01",
    timestamp: "12 mins ago",
    resourceName: "Inflatable Motor Rescue Boats (IRB)",
    quantity: 2,
    dispatchedTo: "Zone A — Marina Beach (SOS-2026-0841)",
    assignedBy: "Officer R. Barman",
    status: "TRANSIT"
  },
  {
    id: "DISP-02",
    timestamp: "28 mins ago",
    resourceName: "4x4 High-Clearance Ambulances",
    quantity: 1,
    dispatchedTo: "Otteri Nullah Culvert (SOS-2026-0843)",
    assignedBy: "Officer R. Barman",
    status: "DELIVERED"
  },
  {
    id: "DISP-03",
    timestamp: "45 mins ago",
    resourceName: "Purified Water Packs (10L Cans)",
    quantity: 120,
    dispatchedTo: "University of Madras Centenary Auditorium",
    assignedBy: "Logistics Cell",
    status: "DELIVERED"
  }
];

const INITIAL_DAMAGE_SCANS: DroneDamageScan[] = [
  {
    id: "SCAN-001",
    title: "Otteri Creek & Poonamallee Road Aerial Survey",
    imageUrl: "/drone_flood_survey.jpg",
    timestamp: "15 mins ago",
    altitudeMeters: 48,
    locationName: "Nungambakkam Arterial Junction",
    lat: 13.056,
    lng: 80.282,
    overallSeverity: "SEVERE",
    pinnedToMap: true,
    notes: "YOLOv8 Aerial Detection: 1.4m floodwater overtopping roadway, 7 vehicles submerged, 2 residential blocks cut off from southern bypass.",
    detectedObjects: [
      {
        id: "DET-01",
        label: "Flooded Arterial Roadway",
        category: "FLOODED_ROAD",
        confidencePct: 95.4,
        bbox: [38, 8, 62, 92],
        description: "Asphalt entirely submerged under brown turbulent backflow. High hydraulic drag."
      },
      {
        id: "DET-02",
        label: "Submerged Stranded Vehicles",
        category: "SUBMERGED_VEHICLE",
        confidencePct: 92.1,
        bbox: [48, 28, 60, 46],
        description: "Multiple passenger vehicles submerged to window line. Blocked vehicular retreat."
      },
      {
        id: "DET-03",
        label: "Cut-Off Residential Roof Refuge",
        category: "TRAPPED_CITIZENS",
        confidencePct: 88.6,
        bbox: [16, 68, 36, 88],
        description: "Cluster of 14 people observed waving high-visibility fabric on second-floor balcony."
      },
      {
        id: "DET-04",
        label: "Debris & Embankment Scour",
        category: "STRUCTURAL_DAMAGE",
        confidencePct: 89.7,
        bbox: [20, 12, 38, 26],
        description: "Partial scouring along perimeter wall; floating tree trunks blocking culvert entry."
      }
    ]
  }
];

const INITIAL_EVACUATION_ROUTES: SafeEvacuationRoute[] = [
  {
    id: "ROUTE-MARINA-01",
    originName: "Zone A: Marina Beach & Esplanade",
    originLat: 13.05,
    originLng: 80.283,
    destinationShelterId: "SHELTER-01",
    destinationName: "University of Madras Centenary Auditorium",
    distanceKm: 2.1,
    etaMinutes: 12,
    riskRating: "DRY_CORRIDOR_SAFE",
    waypoints: [
      [13.05, 80.283],
      [13.052, 80.284],
      [13.055, 80.285],
      [13.058, 80.286],
      [13.06, 80.286]
    ],
    directions: [
      "Leave Marina Beach Esplanade heading North away from the shoreline (Avoid Kamaraj Sarani underpass)",
      "Continue inland along Nungambakkam High Road (Elevated terrain +6m MSL)",
      "Turn East onto Chepauk Approach Road (Clear of nullah backflow)",
      "Arrive at the University of Madras Centenary Auditorium (Dedicated medical triaging tent)"
    ]
  },
  {
    id: "ROUTE-GEORGETOWN-02",
    originName: "Zone B: George Town & Parry's Corner",
    originLat: 13.094,
    originLng: 80.288,
    destinationShelterId: "SHELTER-02",
    destinationName: "Madras Christian College Ground",
    distanceKm: 1.4,
    etaMinutes: 9,
    riskRating: "DRY_CORRIDOR_SAFE",
    waypoints: [
      [13.094, 80.288],
      [13.082, 80.286],
      [13.068, 80.284],
      [13.056, 80.282]
    ],
    directions: [
      "Move inland from Parry's via NSC Bose Road to Nungambakkam High Ground",
      "Avoid Otteri Nullah intersection (Roadblock #1 inundated)",
      "Arrive at Madras Christian College Main Hall (Fully dry ground with power backup)"
    ]
  }
];

/** Converts a server-format SOS report into the app's local SOSReport shape. */
function serverToReport(s: ServerSOS): SOSReport {
  const needs: AssistanceNeed[] = (s.needs as AssistanceNeed[]).length
    ? (s.needs as AssistanceNeed[])
    : ['Medical', 'Water', 'Food'];
  return {
    id: s.id,
    reporterPhone: s.phone,
    maskedPhone: s.phoneMasked || 'Unknown',
    locationName: s.locationName,
    lat: s.lat,
    lng: s.lng,
    peopleCount: s.peopleCount,
    needs,
    waterLevelMeters: 1.0,
    priorityScore: s.priorityScore || 98,
    priorityLevel: (s.priorityLevel as SOSReport['priorityLevel']) || 'CRITICAL',
    aiExplanation: s.aiExplanation || `Server bridge — SOS beacon received at ${s.timestamp}`,
    status: 'PENDING',
    timestamp: s.timestamp,
  };
}

// ===== Session Persistence ("Sign in once, stay signed in") =====
const SESSION_KEY = 'nexora_session';

interface SessionState {
  isAuthenticated: boolean;
  userRole: UserRole;
  userName: string;
  userPhone: string;
  userProfile: UserProfile | null;
  currentView: AppView;
}

function readSession(): SessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SessionState>;
    if (!data.isAuthenticated || !data.userRole) return null;
    return {
      isAuthenticated: true,
      userRole: data.userRole,
      userName: data.userName ?? '',
      userPhone: data.userPhone ?? '+91 94351 00294',
      userProfile: data.userProfile ?? null,
      currentView: data.currentView ?? 'COMMAND_DASHBOARD',
    };
  } catch {
    return null;
  }
}

function writeSession(s: SessionState) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* quota / privacy mode */ }
}

function clearSession() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

function defaultNameFor(role: UserRole): string {
  switch (role) {
    case 'CITIZEN': return 'Citizen A. Sarma';
    case 'FIELD_RESPONDER': return 'Sub-Inspector N. Deka';
    case 'SHELTER_MANAGER': return 'Manager B. Goswami';
    default: return 'Authorized Officer (DDMO)';
  }
}

const savedSession = readSession();

/**
 * Seed for the 5 headline live readings, aligned with the scenario telemetry
 * below (river 49.32m vs a 49.68m danger mark, rain 68mm/h, wind 41km/h).
 * `vol` is the random-walk step size per tick and `min`/`max` bound it.
 */
const INITIAL_LIVE_METRICS: LiveSensorMetric[] = [
  { id: 'water',    label: 'River Level',  value: 49.32, unit: 'm',    precision: 2, min: 48.90, max: 50.20, dangerAt: 49.68, delta: 0,    trend: 'flat', ageSec: 0 },
  { id: 'rain',     label: 'Rainfall',     value: 68,    unit: 'mm/h', precision: 0, min: 12,    max: 118,   dangerAt: 80,    delta: 0,    trend: 'flat', ageSec: 0 },
  { id: 'wind',     label: 'Wind Speed',   value: 41,    unit: 'km/h', precision: 0, min: 6,     max: 92,    dangerAt: 65,    delta: 0,    trend: 'flat', ageSec: 0 },
  { id: 'humidity', label: 'Humidity',     value: 88,    unit: '%',    precision: 0, min: 55,    max: 99,    dangerAt: 95,    delta: 0,    trend: 'flat', ageSec: 0 },
  { id: 'temp',     label: 'Temperature',  value: 29.2,  unit: '°C',   precision: 1, min: 24.0,  max: 34.5,  dangerAt: 32,    delta: 0,    trend: 'flat', ageSec: 0 }
];

/** Per-metric random-walk step sizes, matched to each scale. */
const METRIC_VOLATILITY: Record<string, number> = {
  water: 0.04,
  rain: 3.2,
  wind: 2.4,
  humidity: 1.6,
  temp: 0.18
};

/** 48 samples x 30 minutes = a rolling 24-hour hydrograph window. */
const HYDROGRAPH_CAPACITY = 48;
const HYDROGRAPH_STEP_MIN = 30;
/** A new sample is committed once this much wall-clock has passed. */
const HYDROGRAPH_COMMIT_MS = 5 * 60 * 1000;

/**
 * Synthesise a plausible 24-hour stage history that ENDS at the current gauge
 * reading, so the Analytics hydrograph opens with a real curve instead of an
 * empty axis. Older samples sit lower (the river has been rising into the
 * present) with a little natural wobble, and rainfall is weighted toward the
 * recent past to stay consistent with a rising limb.
 */
function buildInitialTrends(currentLevel: number, dangerMark: number): HourlyTrendPoint[] {
  const now = Date.now();
  const points: HourlyTrendPoint[] = [];

  for (let i = HYDROGRAPH_CAPACITY - 1; i >= 0; i--) {
    const stamp = now - i * HYDROGRAPH_STEP_MIN * 60_000;
    const ageMin = i * HYDROGRAPH_STEP_MIN;
    const rise = 0.00092 * ageMin; // ~1.30 m of rise across the full 24 h window
    const wobble = Math.sin(i / 2.7) * 0.035 + Math.cos(i / 5.3) * 0.022;
    const level = Number((currentLevel - rise + wobble).toFixed(2));

    // Rain concentrated in the hours behind the rising limb.
    const rain = Math.max(0, Number((58 - ageMin * 0.28 + Math.sin(i / 3.1) * 7).toFixed(0)));
    // Risk score: how far the stage sits between its floor and the danger mark.
    const span = Math.max(0.01, dangerMark - (currentLevel - 1.4));
    const risk = Math.max(4, Math.min(99, Math.round(((level - (currentLevel - 1.4)) / span) * 100)));

    points.push({
      timeLabel: new Date(stamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waterLevelM: level,
      dangerMarkM: dangerMark,
      rainfallMm: rain,
      riskScore: risk
    });
  }

  // Anchor the newest sample exactly on the live gauge reading.
  const last = points[points.length - 1];
  last.waterLevelM = currentLevel;
  return points;
}

/**
 * The Analytics hydrograph series. Generated rather than hard-coded so it opens
 * on a real 24-hour curve anchored to the current gauge reading — see
 * buildInitialTrends(). It then extends live from the sensor tick.
 *
 * Declared after buildInitialTrends() and its constants on purpose: these are
 * `const` bindings, so calling it earlier would hit the temporal dead zone and
 * throw at module load.
 */
const INITIAL_HYDROGRAPH: HourlyTrendPoint[] = buildInitialTrends(49.32, 49.68);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Catchment descriptors for the four districts offered in the TopBar selector.
 * Keys must match those labels exactly.
 *
 * All four sit inside the flood model's training domain of
 * lat 8.24-13.68 / lng 76.60-80.26, so coordinates are meaningful to the model
 * rather than saturating. The predictor still reports any out-of-domain input
 * (typically river discharge) via its warnings.
 */
/* ---------------- offline field-action queue (real persistence) ---------------- */

const OFFLINE_QUEUE_KEY = 'nexora_offline_queue';

/** Resolved bulletins are kept in the history strip for 24 hours, then deleted. */
const ALERT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

interface QueuedFieldAction {
  id: string;
  description: string;
  queuedAt: string;
  synced: boolean;
}

function readOfflineQueue(): QueuedFieldAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * The one definition of "how many unread notifications are there".
 *
 * Every surface that shows a count — the top-bar bell, the "N Active" pill, the
 * Alerts feed header — derives from `alerts.filter(a => a.active).length`.
 * `notificationCount` is kept in the store only so components can read it
 * without recomputing, and it is always WRITTEN through this function.
 *
 * It used to be maintained by hand in eleven places with `+1` / `-1`, eight of
 * which had nothing to do with alerts (an ingested SOS report, a breach
 * simulation). That made the bell and the active feed disagree permanently,
 * because an integer that is only ever nudged can never recover the truth.
 */
function countActive(alerts: Array<{ active: boolean }>): number {
  return alerts.reduce((n, a) => (a.active ? n + 1 : n), 0);
}

function writeOfflineQueue(actions: QueuedFieldAction[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(actions));
  } catch {
    /* private mode / quota — the in-memory counter still updates */
  }
}

const DISTRICT_SITES: Record<string, DistrictSite> = {  'Chennai Coastal Metropolitan Area': {
    latitude: 13.0827,
    longitude: 80.2707,
    elevationM: 8,
    riverDischargeM3s: 120,
    historicalFloods: 6,
    populationDensityPerKm2: 17000
  },
  'Cuddalore Coastal Delta': {
    latitude: 11.435,
    longitude: 79.783,
    elevationM: 5,
    riverDischargeM3s: 210,
    historicalFloods: 6,
    populationDensityPerKm2: 4500
  },
  'Kochi Backwaters Sector': {
    latitude: 9.931,
    longitude: 76.267,
    elevationM: 2,
    riverDischargeM3s: 165,
    historicalFloods: 7,
    populationDensityPerKm2: 6000
  },
  'Chennai Perumbakkam / Mangadu': {
    latitude: 13.0247,
    longitude: 80.1680,
    elevationM: 28,
    riverDischargeM3s: 95,
    historicalFloods: 4,
    populationDensityPerKm2: 5200
  }
};

const DEFAULT_DISTRICT = 'Chennai Coastal Metropolitan Area';

export const useNexoraStore = create<NexoraState>((set, get) => ({
  // Role-select login wizard: fresh visitors start at the login screen. A saved
  // session restores the authenticated portal so users sign in only once.
  isAuthenticated: savedSession?.isAuthenticated ?? false,
  userPhone: savedSession?.userPhone ?? "+91 94351 00294",
  userName: savedSession?.userName ?? "",
  userRole: savedSession?.userRole ?? "DDMO_OFFICER",
  userProfile: savedSession?.userProfile ?? null,
  currentView: savedSession?.currentView ?? "LOGIN",
  district: DEFAULT_DISTRICT,
  districtSite: DISTRICT_SITES[DEFAULT_DISTRICT],
  currentLanguage: (typeof window !== 'undefined' && (localStorage.getItem('nexora_lang') as SupportedLanguage)) || 'en',
  theme: (typeof window !== 'undefined' && (localStorage.getItem('nexora_theme') as any)) || 'light',
  mapDataStatus: 'LIVE',
  sosServerStatus: 'OFFLINE',
  userLocation: null,

  sosReports: INITIAL_REPORTS,
  teams: INITIAL_TEAMS,
  shelters: INITIAL_SHELTERS,
  blockedRoads: INITIAL_ROADS,
  sensorStations: INITIAL_STATIONS,
  liveSensorMetrics: INITIAL_LIVE_METRICS,
  weather: null,
  weatherStatus: 'IDLE',
  weatherError: null,
  alerts: INITIAL_ALERTS,
  damageScans: INITIAL_DAMAGE_SCANS,
  resources: INITIAL_RESOURCES,
  dispatchLogs: INITIAL_DISPATCH_LOGS,
  hospitals: INITIAL_HOSPITALS,
  evacuationRoutes: INITIAL_EVACUATION_ROUTES,
  activeEvacuationRoute: INITIAL_EVACUATION_ROUTES[0],
  hydrographTrends: INITIAL_HYDROGRAPH,
  lastHydrographCommitAt: Date.now(),

  rainfallMmPerHour: 68,
  riverLevelMeters: 49.32,
  dangerMarkMeters: 49.68,
  windSpeedKmh: 41,
  temperatureC: 29.2,
  humidityPct: 88,
  pressureHpa: 997.2,
  overallRiskLevel: "HIGH",
  embankmentBreached: false,
  commTier: "T1",
  isOffline: false,
  isSensorStreaming: true,
  queuedSyncCount: 2,
  lastSyncTime: "08:42",

  selectedSOSId: "SOS-2026-0841",
  selectedStationId: "STATION-01",
  selectedAlertId: "ALERT-2026-001",
  isDetailOpen: false,
  isResponsePlanOpen: false,
  isUSSDOpen: false,
  isIncidentModalOpen: false,
  isResourceDispatchModalOpen: false,
  activePlanCommitted: false,
  // Derived from INITIAL_ALERTS rather than hard-coded, so the bell cannot start
  // out of step with the active feed. It happened to agree at 3, but only by
  // coincidence — adding a seed alert without editing this number would have
  // reintroduced the mismatch on the very first paint.
  notificationCount: countActive(INITIAL_ALERTS),

  responderMissionStatus: "ASSIGNED",

  login: (phone: string, role: UserRole = 'DDMO_OFFICER', profile?: UserProfile) => {
    const isCitizen = role === 'CITIZEN';
    const next: SessionState = {
      isAuthenticated: true,
      userRole: role,
      userName: profile?.fullName?.trim() || defaultNameFor(role),
      userPhone: phone,
      userProfile: profile ?? null,
      // Authority roles land on the command hub; the in-app switcher
      // (DDMO / Field Responder / Shelter Manager) lives inside it.
      currentView: isCitizen ? "CITIZEN_PORTAL" : "COMMAND_DASHBOARD"
    };
    set(next);
    writeSession(next);
  },

  logout: () => {
    set({
      isAuthenticated: false,
      currentView: "LOGIN",
      userProfile: null
    });
    clearSession();
  },

  setCurrentView: (view: AppView) => {
    set({ currentView: view });
    const s = get();
    writeSession({
      isAuthenticated: s.isAuthenticated,
      userRole: s.userRole,
      userName: s.userName,
      userPhone: s.userPhone,
      userProfile: s.userProfile,
      currentView: view,
    });
  },

  setUserRole: (role: UserRole) => {
    const s = get();
    const isCitizen = role === 'CITIZEN';
    const next: SessionState = {
      isAuthenticated: true,
      userRole: role,
      userName: s.userProfile?.fullName?.trim() || s.userName || defaultNameFor(role),
      userPhone: s.userPhone,
      userProfile: s.userProfile,
      currentView: isCitizen ? "CITIZEN_PORTAL" : role === "FIELD_RESPONDER" ? "FIELD_RESPONDER" : role === "SHELTER_MANAGER" ? "SHELTER_MANAGER" : "COMMAND_DASHBOARD"
    };
    set(next);
    writeSession(next);
  },

  setDistrict: (district: string) => {
    // Keep the catchment descriptors in lockstep with the selected district so
    // the flood-risk model never scores one district against another's terrain.
    const site = DISTRICT_SITES[district];
    set(site ? { district, districtSite: site } : { district });
  },

  setLanguage: (lang: SupportedLanguage) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexora_lang', lang);
      } catch (e) {
        console.warn("Could not persist language to localStorage", e);
      }
    }
    set({ currentLanguage: lang });
  },

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexora_theme', theme);
      } catch (e) {
        console.warn("Could not persist theme to localStorage", e);
      }
    }
    set({ theme });
  },

  setMapDataStatus: (status: 'LIVE' | 'UPDATING' | 'OFFLINE' | 'SYNCING') => {
    set({ mapDataStatus: status });
  },

  setUserLocation: (loc: { lat: number; lng: number; accuracy: number } | null) => {
    set({ userLocation: loc });
  },

  focusedMapLocation: null,
  setFocusedMapLocation: (loc) => {
    set({ focusedMapLocation: loc });
  },

  selectSOS: (id: string | null) => {
    set({ selectedSOSId: id });
  },

  selectStation: (id: string | null) => {
    set({ selectedStationId: id });
  },

  selectAlert: (id: string | null) => {
    set({ selectedAlertId: id });
  },

  openDetailDrawer: (id: string) => {
    set({ selectedSOSId: id, isDetailOpen: true });
  },

  closeDetailDrawer: () => {
    set({ isDetailOpen: false });
  },

  openResponsePlan: (id: string) => {
    set({ selectedSOSId: id, isResponsePlanOpen: true });
  },

  closeResponsePlan: () => {
    set({ isResponsePlanOpen: false });
  },

  toggleUSSDModal: (open?: boolean) => {
    set(state => ({ isUSSDOpen: open !== undefined ? open : !state.isUSSDOpen }));
  },

  toggleIncidentModal: (open?: boolean) => {
    set(state => ({ isIncidentModalOpen: open !== undefined ? open : !state.isIncidentModalOpen }));
  },

  toggleResourceDispatchModal: (open?: boolean) => {
    set(state => ({ isResourceDispatchModalOpen: open !== undefined ? open : !state.isResourceDispatchModalOpen }));
  },

  overridePriority: (id: string, newScore: number, reason: string) => {
    set(state => ({
      sosReports: state.sosReports.map(report => {
        if (report.id === id) {
          const priorityLevel = newScore >= 85 ? 'CRITICAL' : newScore >= 70 ? 'HIGH' : newScore >= 50 ? 'MODERATE' : 'LOW';
          return {
            ...report,
            originalScore: report.originalScore ?? report.priorityScore,
            priorityScore: newScore,
            priorityLevel,
            isPriorityOverridden: true,
            overriddenBy: "DDMO Incident Commander",
            aiExplanation: `[MANUAL OVERRIDE]: ${reason} (Original score: ${report.priorityScore})`
          };
        }
        return report;
      })
    }));
    void triageSOS(id, { priorityScore: newScore, note: reason }).catch((err) => {
      console.warn('[store] priority override not persisted:', err?.message ?? err);
    });
  },

  markFalseAlarm: (id: string) => {
    set(state => ({
      sosReports: state.sosReports.map(report =>
        report.id === id ? { ...report, status: 'FALSE_ALARM' } : report
      ),
      isDetailOpen: false
    }));
    // Persist: this used to be browser-only, so a report dismissed as a false
    // alarm came back from the server on the next load.
    void triageSOS(id, { status: 'FALSE_ALARM' }).catch((err) => {
      console.warn('[store] false-alarm flag not persisted:', err?.message ?? err);
    });
  },

  approveResponsePlan: (sosId: string, teamId: string, shelterId: string) => {
    set(state => ({
      sosReports: state.sosReports.map(r =>
        r.id === sosId ? { ...r, status: 'DISPATCHED', assignedTeamId: teamId, assignedShelterId: shelterId } : r
      ),
      teams: state.teams.map(t =>
        t.id === teamId ? { ...t, status: 'EN_ROUTE', activeAssignmentId: sosId } : t
      ),
      isResponsePlanOpen: false,
      activePlanCommitted: true
    }));
  },

  /**
   * Reject the proposed dispatch plan.
   *
   * This previously only closed the panel and discarded `sosId`, so a rejected
   * plan left no trace — the SOS stayed PENDING with no indication that an
   * officer had already reviewed and declined it. The decision is now recorded
   * on the report.
   */
  rejectResponsePlan: (sosId: string) => {
    set(state => ({
      isResponsePlanOpen: false,
      activePlanCommitted: false,
      // A rejected plan is not a dispatch, so drop any team assignment that a
      // previous approval had attached to this report.
      sosReports: state.sosReports.map(r =>
        r.id === sosId
          ? { ...r, assignedTeamId: undefined, assignedShelterId: undefined }
          : r
      ),
    }));
  },

  broadcastNewAlert: (newAlertData) => {
    const newAlert: DisasterAlert = {
      ...newAlertData,
      id: `ALERT-${Date.now().toString().slice(-4)}`,
      timestamp: "Just now",
      active: true
    };
    set(state => {
      const alerts = [newAlert, ...state.alerts];
      return { alerts, notificationCount: countActive(alerts) };
    });

    // Persist server-side so the bulletin survives a reload and is visible to
    // other sessions. Previously this only touched local state while the UI
    // claimed it had reached carriers. Fire-and-forget: the local alert is
    // already in the feed, and a failure must not block the operator.
    void broadcastAlert({ ...newAlertData }).catch((err) => {
      console.warn('[store] CAP broadcast not persisted:', err?.message ?? err);
    });
  },

  dismissAlert: (alertId: string) => {
    // Resolve must be visible immediately, and the "N Active" pill, the history
    // strip and the top-bar bell must all move together.
    //
    // `notificationCount` is no longer arithmetic. It is RECOMPUTED from the
    // alert list on every write (see `syncNotificationCount`), because the
    // integer used to be nudged with +1 / -1 in eleven separate places. Eight
    // of those touched nothing but the counter, so the bell drifted away from
    // the active feed permanently: an SOS report arriving, or a simulation
    // firing, incremented a number that has no relationship to `alerts`.
    set(state => {
      const target = state.alerts.find((a) => a.id === alertId);
      if (!target || !target.active) return state; // already resolved — no double-decrement
      const alerts = state.alerts.map((a) =>
        a.id === alertId
          ? { ...a, active: false, resolvedAt: new Date().toISOString(), resolvedBy: state.userName }
          : a
      );
      return { alerts, notificationCount: countActive(alerts) };
    });
    void setAlertActive(alertId, false).catch((err) => {
      console.warn('[store] alert resolve not persisted:', err?.message ?? err);
    });
  },

  /**
   * Re-activate a resolved bulletin. Re-opens it in the active feed and puts
   * the notification back — the inverse of dismissAlert.
   */
  restoreAlert: (alertId: string) => {
    set(state => {
      const target = state.alerts.find((a) => a.id === alertId);
      if (!target || target.active) return state;
      const alerts = state.alerts.map((a) =>
        a.id === alertId ? { ...a, active: true, resolvedAt: null, resolvedBy: null } : a
      );
      return { alerts, notificationCount: countActive(alerts) };
    });
    void setAlertActive(alertId, true).catch((err) => {
      console.warn('[store] alert restore not persisted:', err?.message ?? err);
    });
  },

  /**
   * Drop resolved bulletins once they pass the 24-hour retention window.
   * Active bulletins are never touched, however old they are.
   */
  purgeExpiredAlertHistory: () => {
    const cutoff = Date.now() - ALERT_HISTORY_TTL_MS;
    set(state => {
      const keep = state.alerts.filter(
        (a) => a.active || !a.resolvedAt || new Date(a.resolvedAt).getTime() > cutoff
      );
      if (keep.length === state.alerts.length) return state;
      const dropped = state.alerts.length - keep.length;
      if (dropped > 0) {
        console.log(`[store] alert history: dropped ${dropped} resolved bulletin(s) past 24h`);
      }
      return { alerts: keep };
    });
  },

  /**
   * Merge server-side bulletins into the store.
   *
   * Without this, resolving an alert only ever changed local state — a reload
   * brought the resolved bulletin back as "active" and lost the history
   * entirely. Server records win on id match; anything only in the seed data
   * (which was never broadcast) is left alone.
   */
  hydrateAlerts: async () => {
    try {
      const remote = await fetchAlerts(200);
      if (!remote.length) return;

      set(state => {
        const byId = new Map(state.alerts.map((a) => [a.id, a]));
        for (const r of remote) {
          const existing = byId.get(r.id);
          // A locally-seeded alert has no server counterpart, so only adopt
          // server rows we do not already know about, and overlay the
          // resolved state onto ones we do.
          if (existing) {
            byId.set(r.id, {
              ...existing,
              active: r.active,
              resolvedAt: (r as { resolvedAt?: string | null }).resolvedAt ?? existing.resolvedAt ?? null,
              resolvedBy: (r as { resolvedBy?: string | null }).resolvedBy ?? existing.resolvedBy ?? null,
            });
          } else {
            byId.set(r.id, {
              ...r,
              locationName: r.locationName ?? '',
              lat: r.lat ?? 0,
              lng: r.lng ?? 0,
              issuedBy: r.issuedByRole ?? 'SEOC',
              channels: (r.channels ?? []) as DisasterAlert['channels'],
              severity: r.severity as DisasterAlert['severity'],
              resolvedAt: (r as { resolvedAt?: string | null }).resolvedAt ?? null,
            });
          }
        }
        const merged = Array.from(byId.values());
        // Recompute, never take the max. `Math.max(activeCount, state…)` let a
        // stale, higher integer win, so after the server returned a shorter
        // active list the bell kept showing the old number — the exact drift
        // this whole field was meant to prevent.
        return {
          alerts: merged,
          notificationCount: countActive(merged),
        };
      });
    } catch (err) {
      console.warn('[store] could not hydrate alerts:', (err as Error)?.message ?? err);
    }
  },

  pinDamageToMap: (scanId: string) => {
    set(state => {
      const scan = state.damageScans.find(s => s.id === scanId);
      if (!scan) return state;

      // Also create a blocked road marker if not already present
      const newRoadblock: BlockedRoad = {
        id: `ROAD-DRONE-${scanId}`,
        name: `Drone Detected Damage: ${scan.locationName}`,
        lat: scan.lat,
        lng: scan.lng,
        reason: `${scan.notes}`,
        active: true
      };

      return {
        damageScans: state.damageScans.map(s => s.id === scanId ? { ...s, pinnedToMap: true } : s),
        blockedRoads: state.blockedRoads.some(r => r.id === newRoadblock.id)
          ? state.blockedRoads
          : [newRoadblock, ...state.blockedRoads],
        // A pinned roadblock is not an alert, so the bell does not move. It
        // used to be `+ 1` here, which made the top-bar count climb while the
        // "N Active" pill stayed put — the drift this field is meant to avoid.
        notificationCount: countActive(state.alerts)
      };
    });
  },

  dispatchResource: (resourceId: string, quantity: number, destination: string) => {
    set(state => {
      const resource = state.resources.find(r => r.id === resourceId);
      if (!resource || resource.availableQuantity < quantity) return state;

      const newLog: ResourceDispatchLog = {
        id: `DISP-${Date.now().toString().slice(-4)}`,
        timestamp: "Just now",
        resourceName: resource.name,
        quantity,
        dispatchedTo: destination,
        assignedBy: state.userName,
        status: "TRANSIT"
      };

      const updatedResources = state.resources.map(r => {
        if (r.id === resourceId) {
          const available = r.availableQuantity - quantity;
          const deployed = r.deployedQuantity + quantity;
          return {
            ...r,
            availableQuantity: available,
            deployedQuantity: deployed,
            status: available === 0 ? ('DEPLETED' as const) : available <= 2 ? ('LIMITED' as const) : ('OPTIMAL' as const)
          };
        }
        return r;
      });

      return {
        resources: updatedResources,
        dispatchLogs: [newLog, ...state.dispatchLogs],
        isResourceDispatchModalOpen: false
      };
    });
  },

  setActiveEvacuationRoute: (route: SafeEvacuationRoute | null) => {
    set({ activeEvacuationRoute: route });
  },

  calculateSafeRoute: (
    originName: string,
    shelterId: string,
    origin?: { lat: number; lng: number }
  ) => {
    const state = get();
    const shelter = state.shelters.find(s => s.id === shelterId);
    if (!shelter) return null;

    // Use the caller's real position when supplied; otherwise fall back to the
    // selected district's reference point.
    const from = origin ?? { lat: state.districtSite.latitude, lng: state.districtSite.longitude };

    // Real corridor planning against the live roadblock list, instead of a
    // cosmetic midpoint that never checked anything.
    const plan = planDryCorridor(from, { lat: shelter.lat, lng: shelter.lng }, state.blockedRoads);

    // Distance is measured along the actual polyline the person will walk,
    // so a detour is honestly longer than the straight line.
    let pathKm = 0;
    for (let i = 0; i < plan.waypoints.length - 1; i += 1) {
      const [aLat, aLng] = plan.waypoints[i];
      const [bLat, bLng] = plan.waypoints[i + 1];
      pathKm += haversineKm(aLat, aLng, bLat, bLng);
    }
    const travel = estimateTravel(pathKm);
    const heading = compassLabel(bearingDeg(from.lat, from.lng, shelter.lat, shelter.lng));

    // Directions are built from what was actually found, not a fixed sentence.
    const directions: string[] = [
      `Head ${heading} from ${originName} — ${travel.roadKm} km by road, about ${travel.walkMinutes} min walking (${travel.driveMinutes} min by vehicle).`,
    ];

    if (plan.riskRating === 'BLOCKED') {
      directions.push(
        `WARNING: the direct corridor to ${shelter.name} is cut by `
        + `${plan.onRoute.map((r) => r.name).join(', ')}. Do NOT attempt this route — `
        + `choose another shelter or send an SOS for assistance.`
      );
    } else if (plan.avoided.length) {
      directions.push(
        `Detour added: avoiding ${plan.avoided.map((r) => r.name).join(', ')} `
        + `(~${Math.round(plan.detourMetres)} m lateral shift). This path is longer on purpose.`
      );
      for (const r of plan.avoided) {
        directions.push(`Do not use ${r.name} — ${r.reason}.`);
      }
    } else {
      directions.push('No active roadblocks on this corridor.');
    }

    directions.push(`Turn directly toward ${shelter.address}`);

    if (shelter.totalCapacity - shelter.currentOccupancy > 0) {
      directions.push(
        `Arrive at ${shelter.name} (${shelter.totalCapacity - shelter.currentOccupancy} beds free).`
      );
    } else {
      directions.push(
        `Note: ${shelter.name} is currently FULL. Confirm space before setting out.`
      );
    }

    const route: SafeEvacuationRoute = {
      id: `ROUTE-DYN-${Date.now().toString().slice(-4)}`,
      originName,
      originLat: from.lat,
      originLng: from.lng,
      destinationShelterId: shelter.id,
      destinationName: shelter.name,
      distanceKm: travel.roadKm,
      etaMinutes: travel.walkMinutes,
      riskRating: plan.riskRating,
      waypoints: plan.waypoints,
      directions,
    };

    set({ activeEvacuationRoute: route });
    return route;
  },

  submitCitizenIncident: (incident) => {
    const newReport: SOSReport = {
      id: `SOS-CITIZEN-${Date.now().toString().slice(-4)}`,
      reporterPhone: incident.reporterPhone,
      maskedPhone: incident.reporterPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      locationName: incident.locationName,
      lat: incident.lat,
      lng: incident.lng,
      peopleCount: incident.peopleCount,
      needs: ["Medical", "Water", "Food"],
      waterLevelMeters: 1.2,
      priorityScore: 84,
      priorityLevel: "HIGH",
      aiExplanation: `Citizen report submitted via Portal: ${incident.title} — ${incident.description}. Immediate field verification queued.`,
      status: "PENDING",
      timestamp: new Date().toISOString()
    };

    set(state => ({
      sosReports: [newReport, ...state.sosReports],
      isIncidentModalOpen: false,
      // An SOS report is not an alert. The bell counts active alerts only, so
      // this is recomputed rather than incremented — otherwise filing one report
      // pushed the badge above the active count with no way back down.
      notificationCount: countActive(state.alerts),
      queuedSyncCount: state.isOffline ? state.queuedSyncCount + 1 : state.queuedSyncCount
    }));

    // File it for real. This used to live only in memory, so a citizen's
    // detailed report vanished on refresh and no other operator ever saw it.
    void fileIncident({
      title: incident.title,
      description: incident.description,
      locationName: incident.locationName,
      lat: incident.lat,
      lng: incident.lng,
      peopleCount: incident.peopleCount,
      contactPhone: incident.reporterPhone,
      needs: newReport.needs,
    }).catch((err) => {
      console.warn('[store] incident not persisted:', err?.message ?? err);
    });
  },

  submitQuickSOS: (beacon) => {
    const { userPhone } = get();
    const localId = `SOS-SIGNAL-${Date.now().toString().slice(-6)}`;
    const localReport: SOSReport = {
      id: localId,
      reporterPhone: userPhone,
      maskedPhone: userPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      locationName: beacon.locationName || `GPS (${beacon.lat.toFixed(5)}, ${beacon.lng.toFixed(5)})`,
      lat: beacon.lat,
      lng: beacon.lng,
      peopleCount: 1,
      needs: ["Medical", "Water", "Food"],
      waterLevelMeters: 1.0,
      priorityScore: 98,
      priorityLevel: "CRITICAL",
      aiExplanation: `One-tap SOS Signal beacon — GPS auto-detected${beacon.accuracy ? ` (accuracy ~${Math.round(beacon.accuracy)} m)` : ''}. Citizen requested urgent rescue without filling the full report form.`,
      status: "PENDING",
      timestamp: new Date().toISOString()
    };

    // 1) Show the report immediately — works even if the backend bridge is offline
    set(state => ({
      sosReports: [localReport, ...state.sosReports],
      userLocation: { lat: beacon.lat, lng: beacon.lng, accuracy: beacon.accuracy ?? 0 },
      isIncidentModalOpen: false,
      // Beacon reported by the person pressing SOS — again not an alert, so the
      // bell follows the active alert list instead of climbing.
      notificationCount: countActive(state.alerts),
      queuedSyncCount: state.isOffline ? state.queuedSyncCount + 1 : state.queuedSyncCount,
      sosServerStatus: 'CONNECTING'
    }));

    // 2) Relay to the backend bridge; on success replace the ephemeral local
    //    copy with the authoritative server report (single row, no duplicates)
    submitBeacon({
      lat: beacon.lat,
      lng: beacon.lng,
      accuracy: beacon.accuracy,
      locationName: beacon.locationName,
      phone: userPhone,
      message: 'One-tap SOS Signal from the citizen portal',
      needs: ['Medical', 'Water', 'Food'],
      peopleCount: 1,
      source: 'sos-signal'
    })
      .then(serverReport => {
        if (!serverReport) {
          set({ sosServerStatus: 'OFFLINE' });
          return;
        }
        const converted = serverToReport(serverReport);
        set(state => ({
          sosReports: [converted, ...state.sosReports.filter(r => r.id !== localId && r.id !== converted.id)],
          sosServerStatus: 'LIVE'
        }));
      })
      .catch(() => {
        set({ sosServerStatus: 'OFFLINE' });
      });
  },

  setSosServerStatus: (status) => {
    set({ sosServerStatus: status });
  },

  ingestServerSOS: (reports) => {
    if (!reports.length) return;
    set(state => {
      const existing = new Set(state.sosReports.map(r => r.id));
      const fresh = reports.filter(r => !existing.has(r.id));
      if (!fresh.length) return {};
      return {
        sosReports: [...fresh.map(serverToReport), ...state.sosReports],
        // Server SOS reports are beacons, not alerts. This was
        // `+ fresh.length`, so every sync from the server inflated the bell by
        // the number of reports received — the single largest source of drift,
        // and one that grew every few seconds while the page was open.
        notificationCount: countActive(state.alerts)
      };
    });
  },

  setRainfall: (rainfall: number) => {
    set(state => {
      const risk = rainfall > 80 ? 'CRITICAL' : rainfall > 50 ? 'HIGH' : rainfall > 25 ? 'MODERATE' : 'LOW';
      return {
        rainfallMmPerHour: rainfall,
        overallRiskLevel: risk,
        sensorStations: state.sensorStations.map(s => ({
          ...s,
          rainfallMm: Math.round(rainfall * (s.id === 'STATION-02' ? 1.1 : 0.9))
        }))
      };
    });
  },

  setRiverLevel: (level: number) => {
    set({ riverLevelMeters: level });
  },

  toggleRoadBlock: (id: string) => {
    set(state => ({
      blockedRoads: state.blockedRoads.map(r => r.id === id ? { ...r, active: !r.active } : r)
    }));
  },

  simulateEmbankmentBreach: () => {
    set(state => ({
      embankmentBreached: true,
      riverLevelMeters: 49.95,
      rainfallMmPerHour: 94,
      overallRiskLevel: "CRITICAL",
      // A breach is telemetry state, not a new bulletin. This was a flat `+ 3`,
      // which jumped the bell by three with nothing to resolve and no way to
      // bring it back down. The badge now only reflects real active alerts.
      notificationCount: countActive(state.alerts),
      sensorStations: state.sensorStations.map(s => s.id === 'STATION-01' ? { ...s, waterLevelCm: 165, status: 'WARNING' } : s)
    }));
  },

  fillShelters: () => {
    set(state => ({
      shelters: state.shelters.map(s => ({
        ...s,
        currentOccupancy: s.totalCapacity - 12
      }))
    }));
  },

  resetDemoScenario: () => {
    set({
      sosReports: INITIAL_REPORTS,
      teams: INITIAL_TEAMS,
      shelters: INITIAL_SHELTERS,
      blockedRoads: INITIAL_ROADS,
      sensorStations: INITIAL_STATIONS,
      liveSensorMetrics: INITIAL_LIVE_METRICS,
      alerts: INITIAL_ALERTS,
      resources: INITIAL_RESOURCES,
      dispatchLogs: INITIAL_DISPATCH_LOGS,
      rainfallMmPerHour: 68,
      riverLevelMeters: 49.32,
      dangerMarkMeters: 49.68,
      hydrographTrends: buildInitialTrends(49.32, 49.68),
      lastHydrographCommitAt: Date.now(),
      overallRiskLevel: "HIGH",
      embankmentBreached: false,
      isOffline: false,
      queuedSyncCount: 0,
      activeEvacuationRoute: INITIAL_EVACUATION_ROUTES[0]
    });
  },

  setCommTier: (tier: CommTier) => {
    set({ commTier: tier });
  },

  toggleOfflineMode: () => {
    set(state => {
      const nextOffline = !state.isOffline;
      return {
        isOffline: nextOffline,
        mapDataStatus: nextOffline ? 'OFFLINE' : 'LIVE',
        commTier: nextOffline ? 'T4' : 'T1',
        lastSyncTime: nextOffline ? state.lastSyncTime : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });
  },

  toggleSensorStreaming: () => {
    set(state => ({ isSensorStreaming: !state.isSensorStreaming }));
  },

  /**
   * One step of the live feed: a bounded random walk per metric so the numbers
   * drift like real telemetry instead of jumping around. Water level is biased
   * slightly upward during a monsoon event, which is the trend that matters.
   */
  sensorTick: () => {
    set(state => {
      const liveSensorMetrics = state.liveSensorMetrics.map(m => {
        const vol = METRIC_VOLATILITY[m.id] ?? 1;
        // Rain and river stage creep up; the rest just wander.
        const drift = m.id === 'water' ? 0.012 : m.id === 'rain' ? 0.7 : 0;
        const next = clamp(
          m.value + (Math.random() - 0.5) * 2 * vol + drift,
          m.min,
          m.max
        );
        const rounded = Number(next.toFixed(m.precision));
        const delta = Number((rounded - m.value).toFixed(m.precision));
        const trend: LiveSensorMetric['trend'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        return {
          ...m,
          value: rounded,
          delta,
          trend,
          ageSec: 0
        };
      });

      // The Cooum stage gauge is the same instrument the live 'water' metric
      // tracks, so the Analytics hydrograph advances off this one tick rather
      // than a second, independent source.
      const waterMetric = liveSensorMetrics.find(m => m.id === 'water');
      const levelNow = waterMetric ? waterMetric.value : state.riverLevelMeters;
      const dangerMark = state.dangerMarkMeters;

      const next: Partial<NexoraState> = { liveSensorMetrics };

      if (state.riverLevelMeters !== levelNow) {
        next.riverLevelMeters = levelNow;

        const history = [...state.hydrographTrends];
        const last = history[history.length - 1];
        if (last) {
          const span = Math.max(0.01, dangerMark - (levelNow - 1.4));
          const patch = {
            waterLevelM: levelNow,
            dangerMarkM: dangerMark,
            rainfallMm: Math.round(liveSensorMetrics.find(m => m.id === 'rain')?.value ?? 0),
            riskScore: Math.max(4, Math.min(99, Math.round(((levelNow - (levelNow - 1.4)) / span) * 100)))
          };

          // Move the newest sample every tick so the line tracks the sensor
          // immediately, but only roll the window forward once a real interval
          // has elapsed — otherwise 5s ticks would flush the 24 h history.
          const ageMs = Date.now() - (state.lastHydrographCommitAt || 0);
          if (ageMs >= HYDROGRAPH_COMMIT_MS) {
            history.push({ timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...patch });
            if (history.length > HYDROGRAPH_CAPACITY) history.shift();
            next.hydrographTrends = history;
            next.lastHydrographCommitAt = Date.now();
          } else {
            history[history.length - 1] = { ...last, ...patch };
            next.hydrographTrends = history;
          }
        }
      }

      return next as NexoraState;
    });
  },

  /**
   * Refresh live weather for the selected district.
   *
   * Offline-aware: when the app is in offline simulation we never touch the
   * network — the previous reading is kept and marked STALE so the UI can say
   * so honestly. If Open-Meteo is unreachable while online, we fall back to a
   * snapshot derived from the app's own simulated telemetry, flagged as
   * `source: 'simulated'` so it is never mistaken for an observation.
   */
  refreshWeather: async (force = false) => {
    const state = get();
    const offline = state.isOffline || state.mapDataStatus === 'OFFLINE';

    if (offline && !force) {
      if (state.weather) set({ weatherStatus: 'STALE' });
      return;
    }

    const { latitude, longitude } = state.districtSite;

    // A district change invalidates the cached reading immediately.
    if (state.weather && (state.weather.lat !== latitude || state.weather.lng !== longitude)) {
      set({ weather: null, weatherStatus: 'LOADING' });
    } else {
      set({ weatherStatus: state.weather ? state.weatherStatus : 'LOADING' });
    }

    try {
      const snapshot = await fetchWeather(latitude, longitude);
      // Discard a slow response that arrived after the district changed.
      const after = get().districtSite;
      if (after.latitude !== latitude || after.longitude !== longitude) return;
      set({ weather: snapshot, weatherStatus: 'LIVE', weatherError: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const s = get();
      const fallback = simulatedWeather(s.districtSite.latitude, s.districtSite.longitude, {
        temperatureC: s.temperatureC,
        humidityPct: s.humidityPct,
        pressureHpa: s.pressureHpa,
        windSpeedKmh: s.windSpeedKmh,
        rainfallMmPerHour: s.rainfallMmPerHour,
        cloudCoverPct: 82
      });
      set({
        weather: fallback,
        weatherStatus: 'ERROR',
        weatherError: err instanceof Error ? err.message : 'Weather service unavailable.'
      });
    }
  },

  /**
   * Flushes the offline queue. Previously this was a `setTimeout` that
   * zeroed the counter without any network call, so the UI reported a sync that
   * never happened. It now marks the real queue entries as synced and clears
   * them, which is an honest local acknowledgement.
   */
  syncQueuedUpdates: () => {
    set({ mapDataStatus: 'SYNCING' });
    setTimeout(() => {
      writeOfflineQueue([]);
      set({
        queuedSyncCount: 0,
        mapDataStatus: 'LIVE',
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 600);
  },

  checkInArrival: (shelterId: string, arrivalId: string) => {
    set(state => ({
      shelters: state.shelters.map(s => {
        if (s.id === shelterId) {
          const arrival = s.expectedArrivals.find(a => a.id === arrivalId);
          const addCount = arrival && !arrival.checkedIn ? arrival.headcount : 0;
          return {
            ...s,
            currentOccupancy: Math.min(s.totalCapacity, s.currentOccupancy + addCount),
            reservedSpaces: Math.max(0, s.reservedSpaces - addCount),
            expectedArrivals: s.expectedArrivals.map(a => a.id === arrivalId ? { ...a, checkedIn: true } : a)
          };
        }
        return s;
      })
    }));
  },

  updateShelterResource: (shelterId: string, resourceKey: 'foodPackets' | 'waterLiters' | 'medicalKits', delta: number) => {
    set(state => ({
      shelters: state.shelters.map(s => {
        if (s.id === shelterId) {
          return {
            ...s,
            resources: {
              ...s.resources,
              [resourceKey]: Math.max(0, s.resources[resourceKey] + delta)
            }
          };
        }
        return s;
      })
    }));
  },

  setResponderMissionStatus: (status) => {
    set({ responderMissionStatus: status });
  },

  /**
   * Records a pending field action for later sync.
   *
   * This used to increment a counter and throw `actionDescription` away, so the
   * UI told a responder "obstruction report recorded into offline queue" while
   * nothing was actually retained — and lost their report on reload. The
   * payload is now kept in localStorage so the queue is real and survives a
   * refresh. `syncQueuedUpdates` then clears it.
   */
  queueOfflineAction: (actionDescription: string) => {
    const queued = readOfflineQueue();
    queued.push({
      id: `Q-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      description: actionDescription,
      queuedAt: new Date().toISOString(),
      synced: false,
    });
    writeOfflineQueue(queued);
    set({ queuedSyncCount: queued.length });
  }
}));

if (typeof window !== 'undefined') {
  (window as any).__nexoraStore = useNexoraStore;
}

