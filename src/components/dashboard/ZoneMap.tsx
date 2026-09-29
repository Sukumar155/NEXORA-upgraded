import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, AlertTriangle, Compass, Crosshair, Map as MapIcon, ChevronDown } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { SOSReport } from '../../types/sos';
import { getTranslation } from '../../i18n/translations';
import { liveMapService, DataStatus } from '../../services/liveMapService';

// Custom Map Helper to Recenter
const MapRecenter: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

/**
 * Realistic basemap providers Ã¢â‚¬â€ ALL free, no API key required.
 * "Streets" and "Satellite" use Esri's public tile service (Google-Maps-like
 * quality with full place names); "Satellite" stacks a labels overlay so
 * places remain readable over imagery. "OSM" is the classic OpenStreetMap
 * and doubles as the automatic fallback if a provider can't be reached.
 */
type MapStyle = 'streets' | 'satellite' | 'dark' | 'osm';

interface TileProvider {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  /** Optional label overlay so place names stay visible (e.g. over satellite imagery). */
  labelsUrl?: string;
  labelsAttribution?: string;
}

const TILE_PROVIDERS: Record<MapStyle, TileProvider> = {
  streets: {
    name: 'Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    labelsAttribution: '&copy; Esri',
  },
  dark: {
    name: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, Garmin, FAO, NOAA, OpenStreetMap contributors',
    maxZoom: 16,
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    labelsAttribution: '&copy; Esri',
  },
  osm: {
    name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

/**
 * `audience` controls what the map is allowed to disclose.
 *
 * 'authority' shows everything, including SOS beacons.
 * 'public' is the citizen-facing view: inundation zones, blocked roads,
 * shelters, hospitals, sensors, drone damage and rescue teams â€” all of which
 * are public-safety information â€” but never SOS beacons.
 *
 * SOS markers are deliberately withheld from the public view because each one
 * carries the precise GPS coordinates of people who are trapped or stranded,
 * how many they are, and a link into the triage drawer. Publishing that to
 * anyone with a browser would expose vulnerable people to stalkers and
 * looters, so it stays an authority-only layer.
 */
export const ZoneMap: React.FC<{
  fullScreen?: boolean;
  audience?: 'authority' | 'public';
  /** Overrides the default height. Use when something sits below the map. */
  heightClass?: string;
}> = ({
  fullScreen = false,
  audience = 'authority',
  heightClass
}) => {
  const showSosLayer = audience === 'authority';
  const {
    sosReports,
    shelters,
    teams,
    blockedRoads,
    sensorStations,
    hospitals,
    damageScans,
    activeEvacuationRoute,
    selectedSOSId,
    openDetailDrawer,
    isResponsePlanOpen,
    setCurrentView,
    currentLanguage,
    theme,
    userLocation,
    setUserLocation,
    focusedMapLocation,
    setMapDataStatus
  } = useNexoraStore();

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [geoData, setGeoData] = useState<any>(null);
  const [activeLayers, setActiveLayers] = useState({
    zones: true,
    sos: true,
    sensors: true,
    shelters: true,
    hospitals: true,
    teams: true,
    roads: true,
    damage: true,
    evacRoute: true,
    user: true
  });
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => (isDark ? 'dark' : 'streets'));
  // Auto-fallback: if the active tile provider fails to load, we swap to OSM.
  const [provider, setProvider] = useState<MapStyle | null>(null);
  const tileErrorsRef = useRef(0);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [dataStatus, setDataStatus] = useState<DataStatus>(liveMapService.getStatus());
  const [lastUpdated, setLastUpdated] = useState<Date>(liveMapService.getLastUpdated());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isLocating, setIsLocating] = useState(false);

  const defaultCenter: [number, number] = [13.0827, 80.2707];
  const defaultZoom = 13;
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState<number>(defaultZoom);

  const t = (k: Parameters<typeof getTranslation>[1], f?: string) => getTranslation(currentLanguage, k, f);

  // Subscribe to real-time telemetry updates
  useEffect(() => {
    const unsub = liveMapService.subscribe((status, updated) => {
      setDataStatus(status);
      setLastUpdated(updated);
      setMapDataStatus(status);
    });
    return () => unsub();
  }, [setMapDataStatus]);

  // Real-time second counter
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Focus map on target location from Chatbot / Voice Assistant
  useEffect(() => {
    if (focusedMapLocation) {
      setMapCenter([focusedMapLocation.lat, focusedMapLocation.lng]);
      setMapZoom(focusedMapLocation.zoom || 15);
    }
  }, [focusedMapLocation]);

  // User GPS locator
  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const coords = await liveMapService.getUserLocation();
      setUserLocation({ lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy });
      setMapCenter([coords.lat, coords.lng]);
      setMapZoom(15);
    } catch (err) {
      console.warn('GPS locate error:', err);
    } finally {
      setIsLocating(false);
    }
  };

  // Custom Icon Generators
  const createSOSIcon = (report: SOSReport, isSelected: boolean) => {
    const isCritical = report.priorityLevel === 'CRITICAL';
    const color = isCritical ? '#B42318' : report.priorityLevel === 'HIGH' ? '#A15C07' : '#1A3A6B';
    
    return L.divIcon({
      className: 'custom-sos-marker',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="absolute w-8 h-8 rounded-full ${isCritical ? 'pulse-beacon' : ''}" style="background-color: ${color}33;"></span>
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold font-data text-xs shadow-md border-2 ${isSelected ? 'border-white scale-125 ring-3 ring-[#1A3A6B]' : 'border-white'}" style="background-color: ${color};">
            ${report.peopleCount}
          </div>
          <div class="absolute -bottom-4 bg-[#1A3A6B] text-white font-data text-[9px] px-1.5 py-0.2 rounded shadow-sm whitespace-nowrap">
            ${report.priorityScore}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const createSensorIcon = (stationCode: string, waterLevelCm: number, status: string) => {
    const isWarning = status === 'WARNING';
    const color = isWarning ? '#B54708' : '#1A3A6B';
    return L.divIcon({
      className: 'custom-sensor-marker',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer group">
          <div class="w-7 h-7 rounded-lg bg-[#1A3A6B] border-2 border-white text-white flex items-center justify-center shadow-lg" style="border-color: ${color};">
            <svg class="w-3.5 h-3.5 text-[#EEF2F8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="bg-[#1A3A6B] text-white font-data text-[9px] font-bold px-1.5 py-0.5 rounded shadow -mt-1 border border-[#35363F] whitespace-nowrap">
            ${waterLevelCm}cm
          </div>
        </div>
      `,
      iconSize: [28, 36],
      iconAnchor: [14, 18]
    });
  };

  const createShelterIcon = (name: string, available: number) => {
    return L.divIcon({
      className: 'custom-shelter-marker',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-[#1A3A6B] border-2 border-white text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
          </div>
          <div class="bg-[#126B34] text-white font-data text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md -mt-1 border border-white whitespace-nowrap">
            ${available} beds
          </div>
        </div>
      `,
      iconSize: [36, 42],
      iconAnchor: [18, 24]
    });
  };

  const createHospitalIcon = (name: string, bedsFree: number) => {
    return L.divIcon({
      className: 'custom-hospital-marker',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer">
          <div class="w-7 h-7 rounded-lg bg-[#B42318] border-2 border-white text-white flex items-center justify-center shadow-md">
            <span class="font-bold text-xs">+</span>
          </div>
          <div className="bg-[#14151A] text-white font-data text-[9px] px-1 py-0.2 rounded -mt-1 border border-[#35363F] whitespace-nowrap">
            ${bedsFree} beds
          </div>
        </div>
      `,
      iconSize: [28, 34],
      iconAnchor: [14, 17]
    });
  };

  const createDamageIcon = () => {
    return L.divIcon({
      className: 'custom-damage-marker',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer animate-pulse">
          <div class="w-7 h-7 rounded-full bg-[#5A5C66] border-2 border-white text-white flex items-center justify-center shadow-lg">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <div class="absolute -bottom-3 bg-[#14151A] text-white font-data text-[8px] font-bold px-1 rounded whitespace-nowrap">
            YOLO AI
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const createTeamIcon = (_name: string, _type: string) => {
    return L.divIcon({
      className: 'custom-team-marker',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="absolute w-7 h-7 rounded-full bg-[#126B34]/30"></span>
          <div class="w-6 h-6 rounded-full bg-[#14151A] border-2 border-white text-white flex items-center justify-center shadow-md">
            <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const createRoadblockIcon = () => {
    return L.divIcon({
      className: 'custom-roadblock-marker',
      html: `
        <div class="w-6 h-6 rounded-md bg-[#8A4D06] border-2 border-white text-white flex items-center justify-center shadow-md">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const createUserIcon = () => {
    return L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span className="absolute w-9 h-9 rounded-full bg-[#6E93C4]/30 animate-ping"></span>
          <span class="absolute w-7 h-7 rounded-full bg-[#1A3A6B]/40"></span>
          <div className="relative w-5 h-5 rounded-full bg-[#2C5C93] border-2 border-white shadow-lg flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-white shadow-xs"></div>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  // GeoJSON style handler
  const zoneStyle = (feature: any) => {
    const color = feature?.properties?.color || '#12294D';
    return {
      fillColor: color,
      weight: 2,
      opacity: 0.9,
      color: color,
      fillOpacity: 0.25,
      dashArray: '3'
    };
  };

  // Sample Dispatch Route Coordinates â€” Marina Beach to Government General Hospital
  const dispatchRoute: [number, number][] = [
    [13.0497, 80.2830],
    [13.0580, 80.2836],
    [13.0712, 80.2850],
    [13.0890, 80.2857]
  ];

  // Effective provider. A light basemap inside the dark UI is the single most
  // jarring thing on the page, so when the operator has NOT explicitly chosen a
  // style the basemap follows the theme. An explicit choice is always honoured;
  // a tile-failure fallback to OSM is likewise left alone (OSM has no dark
  // variant, so leaving it is better than flipping back mid-error).
  const effectiveStyle: MapStyle =
    provider ?? (isDark ? 'dark' : mapStyle);
  const providerCfg = TILE_PROVIDERS[effectiveStyle];

  const handleTileError = () => {
    tileErrorsRef.current += 1;
    if (tileErrorsRef.current >= 3 && effectiveStyle !== 'osm') {
      // Provider unreachable (blocked / throttled) -> switch to OpenStreetMap
      setProvider('osm');
      tileErrorsRef.current = 0;
    }
  };

  const switchMapStyle = (style: MapStyle) => {
    setMapStyle(style);
    setProvider(null);
    tileErrorsRef.current = 0;
    setStyleMenuOpen(false);
  };

  return (
    <div className={`nexora-card overflow-hidden flex flex-col ${
      // heightClass lets a page that stacks content *below* the map cap it, so
      // the map does not claim the whole viewport and push the rest off-screen.
      heightClass ?? (fullScreen ? 'h-[calc(100vh-140px)]' : 'h-[560px] lg:h-[640px]')
    } relative shadow-xs border border-[#DEDEDA] bg-white rounded-xl dark:bg-[#2F2F2F] dark:border-[#3D3D3D] `}>
      
      {/* MAP HEADER / LAYER FILTER CONTROLS */}
      <div className="px-4 py-3 bg-white border-b border-[#DEDEDA] flex flex-wrap items-center justify-between gap-3 z-20 dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
        <div className="flex items-center gap-3">
          <span className="font-heading font-bold text-sm text-[#14151A] flex items-center gap-1.5 dark:text-[#FFFFFF]">
            <Layers className="w-4 h-4 text-[#1A3A6B] dark:text-[#E0E0E0]" />
            {t('map_title', 'Live Disaster & Rescue GIS Grid')}
          </span>

          {/* Real-Time Telemetry Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F1F1EF] border border-[#DEDEDA] dark:bg-[#262626] dark:border-[#3D3D3D]">
            <span
              className={`w-2 h-2 rounded-full ${
                dataStatus === 'LIVE'
                  ? 'bg-[#126B34] animate-ping'
                  : dataStatus === 'UPDATING' || dataStatus === 'SYNCING'
                  ? 'bg-[#1A3A6B] animate-spin'
                  : 'bg-[#B54708]'
              }`}
            />
            <span
              className={`${
                dataStatus === 'LIVE'
                  ? 'text-[#126B34]'
                  : dataStatus === 'UPDATING' || dataStatus === 'SYNCING'
                  ? 'text-[#1A3A6B]'
                  : 'text-[#B54708]'
} dark:text-[#D0D0D0] dark:text-[#E0E0E0] `}
            >
              {dataStatus === 'LIVE'
                ? t('data_live', 'LIVE')
                : dataStatus === 'UPDATING'
                ? t('data_connecting', 'CONNECTING...')
                : dataStatus === 'SYNCING'
                ? t('data_syncing', 'SYNCING...')
                : t('data_offline', 'OFFLINE')}
            </span>
            <span className="text-[10px] font-normal text-[#5A5C66] dark:text-[#D0D0D0]">
              Ã¢â‚¬Â¢ {t('data_last_updated', 'LAST UPDATED')}: {secondsAgo}{t('data_seconds_ago', 's ago')}
            </span>
          </div>
        </div>

        {/* Multi-Layer Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
          
          {/* Zones */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, zones: !p.zones }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.zones ? 'bg-[#1A3A6B] text-white shadow-xs' : 'bg-[#F1F1EF] text-[#5A5C66] hover:bg-[#EEF2F8]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Zones
          </button>

          {/* SOS â€” authority only. Withheld from the public view: these markers
              expose the exact coordinates of trapped people. */}
          {showSosLayer && (
            <button
              onClick={() => setActiveLayers(p => ({ ...p, sos: !p.sos }))}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeLayers.sos ? 'bg-[#B42318] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
              } dark:text-[#D0D0D0] dark:bg-[#262626] `}
            >
              SOS ({sosReports.filter(r => r.status === 'PENDING').length})
            </button>
          )}

          {/* Sensors */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, sensors: !p.sensors }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.sensors ? 'bg-[#12294D] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Sensors ({sensorStations.length})
          </button>

          {/* Shelters */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, shelters: !p.shelters }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.shelters ? 'bg-[#126B34] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Shelters ({shelters.length})
          </button>

          {/* Hospitals */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, hospitals: !p.hospitals }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.hospitals ? 'bg-[#B42318] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Hospitals ({hospitals.length})
          </button>

          {/* Teams */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, teams: !p.teams }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.teams ? 'bg-[#14151A] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Rescue Teams
          </button>

          {/* Drone Damage */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, damage: !p.damage }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.damage ? 'bg-[#5A5C66] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Drone AI ({damageScans.length})
          </button>

          {/* Evac Route */}
          <button
            onClick={() => setActiveLayers(p => ({ ...p, evacRoute: !p.evacRoute }))}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeLayers.evacRoute ? 'bg-[#12294D] text-white shadow-2xs' : 'bg-[#F8F8F7] text-[#5A5C66] hover:bg-[#EFEFEC]'
            } dark:text-[#D0D0D0] dark:bg-[#262626] `}
          >
            Safe Route
          </button>

        </div>

        {/* Action Controls: Locate Me & Map Style */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EFEFEC] text-[#12294D] hover:bg-[#DCDCD8] border border-[#DCDCD8] shadow-2xs transition-all cursor-pointer dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]"
            title={t('map_locate_me', 'My GPS Location')}
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-[#2C5C93]' : 'text-[#12294D]'} dark:text-[#E0E0E0] dark:text-[#FFFFFF] `}/>
            <span>{isLocating ? t('map_locating', 'Locating...') : t('map_locate_me', 'My GPS Location')}</span>
          </button>

          <div className="relative">
            {styleMenuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setStyleMenuOpen(false)}
              />
            )}
            <button
              onClick={() => setStyleMenuOpen(o => !o)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-[#F8F8F7] hover:bg-[#EFEFEC] text-[#14151A] transition-all cursor-pointer border border-[#E4E4E0] inline-flex items-center gap-1.5 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
              title={t('map_style', 'Basemap style')}
            >
              <MapIcon className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#E0E0E0]" />
              {providerCfg.name}
              <ChevronDown className="w-3 h-3 text-[#6B6D77] dark:text-[#D0D0D0]" />
            </button>

            {styleMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] shadow-lg p-1.5">
                {(Object.keys(TILE_PROVIDERS) as MapStyle[]).map(style => (
                  <button
                    key={style}
                    onClick={() => switchMapStyle(style)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                      effectiveStyle === style
                        ? 'bg-[#EEF2F8] text-[#1A3A6B]'
                        : 'text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#EFEFEC] dark:hover:bg-[#1C1D22]'
                    }`}
                  >
                    {TILE_PROVIDERS[style].name}
                    {effectiveStyle === style && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A3A6B]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LEAFLET MAP VIEWPORT */}
      <div className="flex-1 w-full h-full relative z-10">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          maxZoom={19}
          className="w-full h-full"
        >
          <MapRecenter center={mapCenter} zoom={mapZoom} />

          {/* Tile Layer Ã¢â‚¬â€ realistic basemap with place names (no API key) */}
          <TileLayer
            key={providerCfg.name}
            url={providerCfg.url}
            attribution={providerCfg.attribution}
            maxZoom={providerCfg.maxZoom}
            eventHandlers={{ tileerror: handleTileError }}
          />
          {providerCfg.labelsUrl && (
            <TileLayer
              key={`${providerCfg.name}-labels`}
              url={providerCfg.labelsUrl}
              attribution={providerCfg.labelsAttribution}
              maxZoom={providerCfg.maxZoom}
              eventHandlers={{ tileerror: handleTileError }}
            />
          )}

          {/* GeoJSON Flood Zones */}
          {activeLayers.zones && geoData && (
            <GeoJSON
              data={geoData}
              style={zoneStyle}
              onEachFeature={(feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(`
                  <div style="font-family: var(--font-body); padding: 4px; max-width: 220px;">
                    <div style="font-weight: 700; color: #14151A; font-size: 13px;">${p.name}</div>
                    <div style="margin-top: 4px; font-size: 11px; color: #5A5C66;">${p.warning}</div>
                    <div style="margin-top: 6px; display: flex; gap: 8px; font-family: var(--font-mono); font-size: 11px;">
                      <span>Depth: <strong>${p.waterDepth}m</strong></span>
                      <span>Risk: <strong style="color: ${p.color};">${p.riskLevel}</strong></span>
                    </div>
                  </div>
                `);
              }}
            />
          )}

          {/* SOS Beacon Markers â€” authority-only layer. */}
          {showSosLayer && activeLayers.sos &&
            sosReports
              .filter(r => r.status !== 'FALSE_ALARM')
              .map((report) => (
                <Marker
                  key={report.id}
                  position={[report.lat, report.lng]}
                  icon={createSOSIcon(report, selectedSOSId === report.id)}
                  eventHandlers={{
                    click: () => {
                      openDetailDrawer(report.id);
                    }
                  }}
                >
                  <Popup>
                    <div className="p-1 max-w-xs font-sans">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs text-[#B42318] font-data dark:text-[#FFFFFF]">{report.id}</span>
                        <span className="font-data text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">
                          Priority {report.priorityScore}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF]">{report.locationName}</div>
                      <div className="text-[11px] text-[#5A5C66] mt-1 dark:text-[#D0D0D0]">{report.aiExplanation}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-data text-xs font-bold text-[#B42318] dark:text-[#FFFFFF]">
                          {report.peopleCount} trapped
                        </span>
                        <button
                          onClick={() => openDetailDrawer(report.id)}
                          className="px-2.5 py-1 bg-[#12294D] hover:bg-[#0F2140] text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-2xs"
                        >
                          Triage SOS
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {/* Sensor Stations (ESP32/LoRa) */}
          {activeLayers.sensors &&
            sensorStations.map((station) => (
              <Marker
                key={station.id}
                position={[station.lat, station.lng]}
                icon={createSensorIcon(station.stationCode, station.waterLevelCm, station.status)}
              >
                <Popup>
                  <div className="p-1.5 max-w-xs font-sans">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#12294D] font-data dark:text-[#FFFFFF]">{station.stationCode}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        station.status === 'ONLINE' ? 'bg-[#F0F7F4] text-[#2A6B4A]' : 'bg-[#FBF7EC] text-[#8A4D06]'
                      } dark:text-[#D0D0D0] dark:text-[#E0E0E0] dark:bg-[#3A2A0A] `}>
                        {station.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#14151A] mt-0.5 dark:text-[#FFFFFF]">{station.name}</div>
                    
                    {/* Live Telemetry Grid */}
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-data bg-[#F8F8F7] p-2 rounded-lg border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D]">
                      <div>Water Level: <strong>{station.waterLevelCm} cm</strong></div>
                      <div>Rainfall: <strong>{station.rainfallMm} mm/h</strong></div>
                      <div>Battery: <strong>{station.batteryPct}%</strong></div>
                      <div>LoRa RSSI: <strong>{station.loraRssiDbm} dBm</strong></div>
                    </div>

                    <div className="mt-2 flex justify-between items-center text-[10px] text-[#5A5C66] dark:text-[#D0D0D0]">
                      <span>Last ping: {station.lastPingTime}</span>
                      <button
                        onClick={() => setCurrentView('SENSORS')}
                        className="text-[#12294D] font-bold hover:underline cursor-pointer dark:text-[#FFFFFF]"
                      >
                        Sensor Telemetry Ã¢â€ â€™
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Shelters */}
          {activeLayers.shelters &&
            shelters.map((shelter) => {
              const available = shelter.totalCapacity - shelter.currentOccupancy;
              return (
                <Marker
                  key={shelter.id}
                  position={[shelter.lat, shelter.lng]}
                  icon={createShelterIcon(shelter.name, available)}
                >
                  <Popup>
                    <div className="p-1 max-w-xs font-sans">
                      <div className="font-bold text-xs text-[#14151A] dark:text-[#FFFFFF]">{shelter.name}</div>
                      <div className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">{shelter.address}</div>
                      <div className="mt-2 text-xs font-data flex items-center justify-between">
                        <span>Occupancy: {shelter.currentOccupancy}/{shelter.totalCapacity}</span>
                        <span className="text-[#2A6B4A] font-bold dark:text-[#D0D0D0]">{available} Free</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#E4E4E0] flex items-center justify-between dark:border-[#3D3D3D]">
                        <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0]">Water: {shelter.resources.waterLiters}L</span>
                        <button
                          onClick={() => setCurrentView('SHELTER_EVACUATION')}
                          className="text-[10px] font-bold text-[#12294D] hover:underline cursor-pointer dark:text-[#FFFFFF]"
                        >
                          Find Safe Route Ã¢â€ â€™
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Hospitals */}
          {activeLayers.hospitals &&
            hospitals.map((hospital) => (
              <Marker
                key={hospital.id}
                position={[hospital.lat, hospital.lng]}
                icon={createHospitalIcon(hospital.name, hospital.availableBeds)}
              >
                <Popup>
                  <div className="p-1 max-w-xs font-sans">
                    <div className="font-bold text-xs text-[#B42318] flex items-center gap-1 dark:text-[#FFFFFF]">
                      <span>Ã°Å¸ÂÂ¥</span>
                      <span>{hospital.name}</span>
                    </div>
                    <div className="text-[11px] text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">{hospital.address}</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] font-data bg-[#FCF1F0] p-1.5 rounded border border-[#F3CFC9] dark:bg-[#3F1414] dark:border-[#7F1D1D]">
                      <div>Total Beds: <strong>{hospital.totalBeds}</strong></div>
                      <div>Free Beds: <strong className="text-[#2A6B4A] dark:text-[#D0D0D0]">{hospital.availableBeds}</strong></div>
                      <div>ICU Beds: <strong>{hospital.icuBedsAvailable}</strong></div>
                      <div>Ambulances: <strong>{hospital.ambulanceStandbyCount}</strong></div>
                    </div>
                    <div className="mt-2 text-[10px] text-[#5A5C66] dark:text-[#D0D0D0]">
                      Emergency Contact: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{hospital.contactEmergency}</strong>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Rescue Teams Markers */}
          {activeLayers.teams &&
            teams.map((team) => (
              <Marker
                key={team.id}
                position={[team.lat, team.lng]}
                icon={createTeamIcon(team.name, team.type)}
              >
                <Popup>
                  <div className="p-1 font-sans">
                    <div className="font-bold text-xs text-[#14151A] dark:text-[#FFFFFF]">{team.name}</div>
                    <div className="text-[11px] text-[#14151A] mt-1 dark:text-[#FFFFFF]">
                      Status: <strong className="font-data">{team.status}</strong>
                    </div>
                    <div className="text-[11px] text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">
                      {team.capabilities.join(', ')}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Road Block Markers */}
          {activeLayers.roads &&
            blockedRoads
              .filter(r => r.active)
              .map((road) => (
                <Marker
                  key={road.id}
                  position={[road.lat, road.lng]}
                  icon={createRoadblockIcon()}
                >
                  <Popup>
                    <div className="p-1 font-sans">
                      <div className="font-bold text-xs text-[#8A4D06] flex items-center gap-1 dark:text-[#E0E0E0]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Road Inundated / Blocked</span>
                      </div>
                      <div className="text-xs font-semibold text-[#14151A] mt-1 dark:text-[#FFFFFF]">{road.name}</div>
                      <div className="text-[11px] text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">{road.reason}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {/* Drone AI Damage Detections */}
          {activeLayers.damage &&
            damageScans
              .filter(s => s.pinnedToMap)
              .map((scan) => (
                <Marker
                  key={scan.id}
                  position={[scan.lat, scan.lng]}
                  icon={createDamageIcon()}
                >
                  <Popup>
                    <div className="p-1 max-w-xs font-sans">
                      <div className="flex items-center justify-between text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">
                        <span>YOLOv8 Aerial Scan</span>
                        <span className="text-[10px] bg-[#EFEFEC] text-[#12294D] border border-[#DCDCD8] px-1.5 py-0.5 rounded dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]">
                          {scan.overallSeverity}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#14151A] mt-1 dark:text-[#FFFFFF]">{scan.title}</div>
                      <img
                        src={scan.imageUrl}
                        alt="Drone Survey"
                        className="w-full h-24 object-cover rounded-lg mt-1.5 border border-[#E4E4E0] dark:border-[#3D3D3D]"
                      />
                      <div className="text-[11px] text-[#5A5C66] mt-1 dark:text-[#D0D0D0]">{scan.notes}</div>
                      <button
                        onClick={() => setCurrentView('DAMAGE_DETECTION')}
                        className="mt-2 w-full py-1 text-center bg-[#12294D] hover:bg-[#0F2140] text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Inspect Full YOLO Bounding Boxes
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {/* Safe Evacuation Route Polyline */}
          {activeLayers.evacRoute && activeEvacuationRoute && (
            <Polyline
              positions={activeEvacuationRoute.waypoints}
              color="#12294D"
              weight={5}
              opacity={0.9}
              dashArray="10, 8"
            />
          )}

          {/* Active Response Plan Route Preview Polyline */}
          {isResponsePlanOpen && (
            <Polyline
              positions={dispatchRoute}
              color="#14151A"
              weight={4}
              opacity={0.85}
              dashArray="8, 6"
            />
          )}

          {/* Focused Location Spotlight Marker from Voice/Chatbot */}
          {focusedMapLocation && (
            <>
              <Marker
                position={[focusedMapLocation.lat, focusedMapLocation.lng]}
                icon={L.divIcon({
                  className: 'custom-focused-target-marker',
                  html: `
                    <div class="relative flex items-center justify-center">
                      <span class="absolute w-12 h-12 rounded-full bg-[#1A3A6B]/40 animate-ping"></span>
                      <div class="w-8 h-8 rounded-full bg-[#1A3A6B] border-2 border-[#1A3A6B] text-[#1A3A6B] flex items-center justify-center shadow-xl text-base font-bold">
                        Ã°Å¸â€œÂ
                      </div>
                    </div>
                  `,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                })}
              >
                <Popup>
                  <div className="p-2 space-y-1 font-sans">
                    <div className="flex items-center gap-1 text-[9px] font-data text-[#1A3A6B] font-bold uppercase tracking-wider dark:text-[#E0E0E0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A3A6B] animate-pulse"></span>
                      <span>Focused Location</span>
                    </div>
                    <div className="font-bold text-xs text-[#14151A] dark:text-[#FFFFFF]">{focusedMapLocation.title}</div>
                    {focusedMapLocation.address && (
                      <div className="text-[11px] text-[#5A5C66] leading-tight dark:text-[#D0D0D0]">{focusedMapLocation.address}</div>
                    )}
                    <div className="text-[10px] text-[#6B6D77] font-mono pt-1 border-t border-[#DEDEDA] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
                      {focusedMapLocation.lat.toFixed(4)}Ã‚Â° N, {focusedMapLocation.lng.toFixed(4)}Ã‚Â° E
                    </div>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[focusedMapLocation.lat, focusedMapLocation.lng]}
                radius={160}
                pathOptions={{
                  color: '#1A3A6B',
                  fillColor: '#1A3A6B',
                  fillOpacity: 0.25,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            </>
          )}

          {/* User Live GPS Marker & Accuracy Circle */}
          {userLocation && (
            <>
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={createUserIcon()}
              >
                <Popup>
                  <div className="p-1.5 font-sans">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C5C93] mb-0.5 dark:text-[#E0E0E0]">
                      <span className="w-2 h-2 rounded-full bg-[#1A3A6B] animate-ping"></span>
                      <span>{t('map_user_marker_title', 'You Are Here (Live GPS)')}</span>
                    </div>
                    <div className="text-[11px] text-[#14151A] font-mono dark:text-[#FFFFFF]">
                      {userLocation.lat.toFixed(5)}Ã‚Â° N, {userLocation.lng.toFixed(5)}Ã‚Â° E
                    </div>
                    {userLocation.accuracy && (
                      <div className="text-[10px] text-[#5A5C66] mt-1 font-sans dark:text-[#D0D0D0]">
                        {t('map_accuracy', 'Accuracy')}: Ã‚Â±{userLocation.accuracy}m
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy || 35}
                pathOptions={{
                  color: '#1A3A6B',
                  fillColor: '#1A3A6B',
                  fillOpacity: 0.15,
                  weight: 1.5,
                  dashArray: '4'
                }}
              />
            </>
          )}

        </MapContainer>

        {/* FLOATING ACTIVE SAFE EVACUATION ROUTE HUD */}
        {activeLayers.evacRoute && activeEvacuationRoute && (
          <div className="absolute top-4 left-4 bg-white border border-[#DCDCD8] p-3 rounded-xl shadow-lg z-20 max-w-xs pointer-events-auto animate-fade-in font-sans dark:bg-[#2F2F2F] dark:border-[#333333]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#14151A] flex items-center gap-1.5 dark:text-[#FFFFFF]">
                <Compass className="w-4 h-4 text-[#12294D] dark:text-[#FFFFFF]" />
                Active Safe Evacuation Corridor
              </span>
              <span className="text-[10px] font-bold font-data bg-[#F0F7F4] text-[#2A6B4A] px-1.5 py-0.5 rounded border border-[#CFE6D8] dark:text-[#D0D0D0] dark:border-[#14532D]">
                DRY
              </span>
            </div>
            <div className="text-[11px] text-[#5A5C66] mt-1 dark:text-[#D0D0D0]">
              To: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{activeEvacuationRoute.destinationName}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-data text-[#5A5C66] dark:text-[#D0D0D0]">
              <span>Distance: <strong>{activeEvacuationRoute.distanceKm} km</strong></span>
              <span>ETA: <strong>{activeEvacuationRoute.etaMinutes} mins</strong></span>
            </div>
          </div>
        )}

        {/* FLOATING MAP LEGEND HUD */}
        <div className="absolute bottom-4 left-4 bg-white border border-[#E4E4E0] p-2.5 rounded-xl shadow-lg z-20 text-[11px] flex flex-col gap-1.5 pointer-events-auto max-w-[220px] font-sans dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
          <div className="font-bold text-[#14151A] text-[10px] uppercase tracking-wider dark:text-[#FFFFFF]">{t('map_legend_title', 'Inundation & Assets Legend')}</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#B42318]/80 border border-[#B42318]"></span>
            <span>{t('map_legend_a', 'Zone A: Severe (>1.5m)')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#B5824A]/80 border border-[#B5824A]"></span>
            <span>{t('map_legend_b', 'Zone B: High (0.8mÃ¢â‚¬â€œ1.5m)')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#12294D]/80 border border-[#12294D]"></span>
            <span>{t('map_legend_c', 'Zone C: Moderate (<0.8m)')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#5E9C7E]/80 border border-[#5E9C7E]"></span>
            <span>{t('map_legend_d', 'Zone D: Dry Safe Corridor')}</span>
          </div>
          <div className="h-px bg-[#E4E4E0] my-0.5" />
          <div className="flex items-center gap-2 text-[10px] text-[#5A5C66] dark:text-[#D0D0D0]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#12294D]"></span>
            <span>{t('map_legend_route', 'Safe Route Polyline')}</span>
          </div>
          {userLocation && (
            <div className="flex items-center gap-2 text-[10px] text-[#2C5C93] font-semibold dark:text-[#E0E0E0]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A3A6B] animate-ping"></span>
              <span>{t('map_legend_user', 'Current User GPS')}</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
