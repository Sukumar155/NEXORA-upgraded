import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  LocateFixed,
  Play,
  Square,
  RotateCcw,
  Flag,
  Loader2,
  AlertTriangle,
  Satellite,
  Compass as CompassIcon
} from 'lucide-react';
import type { SafeEvacuationRoute } from '../../types/hospital';
import { haversineKm, bearingDeg } from '../../services/geolocationService';

/**
 * A deliberately bare map: basemap + the calculated route + its two endpoints.
 *
 * This is NOT `ZoneMap`. That component carries hazard zones, SOS beacons,
 * shelters, hospitals, sensor pins, rescue teams and drone damage, plus a layer
 * toolbar. For a route-planning box all of that is noise, so this renders the
 * corridor and nothing else â€” there are no layer toggles to switch on.
 *
 * "Start Journey" then runs the corridor against the operator's REAL position:
 * it snaps to the first GPS fix and only advances as they physically move.
 * Distance-to-go and ETA are measured by projecting that fix onto the route, so
 * leaving the corridor is detected rather than ignored.
 */

const TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  fallbackAttribution: '&copy; OpenStreetMap contributors'
};

/** Distance at which we warn that the operator has left the safe corridor. */
const OFF_ROUTE_TOLERANCE_KM = 0.15;
/** A fix within this radius of the destination counts as arrival. */
const ARRIVAL_RADIUS_KM = 0.08;

/** Keep the viewport framed on the route whenever it changes. */
const FitRoute: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
};

const originIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#1A3A6B;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#126B34;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

/** Rotatable traveller puck. The arrow is rotated imperatively per frame. */
const travelerIcon = L.divIcon({
  className: '',
  html: `<div class="nx-traveler" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;will-change:transform">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))">
        <circle cx="12" cy="12" r="11" fill="#1A3A6B" stroke="#fff" stroke-width="2"/>
        <path d="M12 4 L18 19 L12 15.5 L6 19 Z" fill="#fff"/>
      </svg>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

/* â”€â”€ Route geometry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface Segments {
  cumulative: number[];
  totalKm: number;
}

function buildSegments(points: [number, number][]): Segments {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    cumulative.push(total);
  }
  return { cumulative, totalKm: total };
}

/**
 * Project a point onto the polyline and report where it lands.
 *
 * Local equirectangular projection is accurate well past the ~25 km spans this
 * app deals with, and avoids the cost of a full geodesic solve per GPS fix.
 */
function projectOntoRoute(
  points: [number, number][],
  segs: Segments,
  lat: number,
  lng: number
): { alongKm: number; offKm: number } {
  if (points.length < 2 || segs.totalKm <= 0) {
    return { alongKm: 0, offKm: points.length ? haversineKm(lat, lng, points[0][0], points[0][1]) : 0 };
  }

  const mPerDegLat = 111132;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const px = lng * mPerDegLng;
  const py = lat * mPerDegLat;

  let best = { alongKm: 0, offKm: Infinity };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const ax = a[1] * mPerDegLng;
    const ay = a[0] * mPerDegLat;
    const bx = b[1] * mPerDegLng;
    const by = b[0] * mPerDegLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    // Parameter along the segment, clamped to the segment.
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.min(1, Math.max(0, t));

    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const offM = Math.hypot(px - cx, py - cy);
    const offKm = offM / 1000;

    if (offKm < best.offKm) {
      const segLen = segs.cumulative[i] - segs.cumulative[i - 1];
      best = { alongKm: segs.cumulative[i - 1] + segLen * t, offKm };
    }
  }

  return best;
}

/** Walk `points` up to `frac` of their total length (used by the no-GPS preview). */
function locateAlong(
  points: [number, number][],
  segs: Segments,
  frac: number
): { lat: number; lng: number; remainingKm: number } {
  if (points.length < 2 || segs.totalKm <= 0) {
    const p = points[0] ?? [0, 0];
    return { lat: p[0], lng: p[1], remainingKm: 0 };
  }
  const target = segs.totalKm * Math.min(1, Math.max(0, frac));
  for (let i = 1; i < points.length; i++) {
    const segStart = segs.cumulative[i - 1];
    const segLen = segs.cumulative[i] - segStart;
    if (target <= segStart + segLen || i === points.length - 1) {
      const t = segLen > 0 ? Math.min(1, Math.max(0, (target - segStart) / segLen)) : 0;
      const a = points[i - 1];
      const b = points[i];
      return {
        lat: a[0] + (b[0] - a[0]) * t,
        lng: a[1] + (b[1] - a[1]) * t,
        remainingKm: Math.max(0, segs.totalKm - target)
      };
    }
  }
  const last = points[points.length - 1];
  return { lat: last[0], lng: last[1], remainingKm: 0 };
}

const JOURNEY_MIN_MS = 18_000;
const JOURNEY_MAX_MS = 55_000;
const previewDurationMs = (roadKm: number) =>
  Math.round(Math.min(JOURNEY_MAX_MS, Math.max(JOURNEY_MIN_MS, roadKm * 2600)));

/** Pans the map to follow the traveller without fighting the user's own panning. */
const FollowTraveller: React.FC<{ position: [number, number] | null }> = ({ position }) => {
  const map = useMap();
  const last = useRef(0);
  useEffect(() => {
    if (!position) return;
    const now = Date.now();
    if (now - last.current < 900) return;
    last.current = now;
    map.panTo(position, { animate: true, duration: 0.4 });
  }, [position, map]);
  return null;
};

type JourneyState = 'idle' | 'tracking' | 'preview' | 'arrived';

interface Fix {
  lat: number;
  lng: number;
  at: number;
}

interface RouteMapProps {
  route: SafeEvacuationRoute | null;
  center: [number, number];
  className?: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({ route, center, className = '' }) => {
  const [usingFallback, setUsingFallback] = useState(false);
  const [journey, setJourney] = useState<JourneyState>('idle');
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  /** Preview-only position, driven by rAF when there is no GPS. */
  const [previewPos, setPreviewPos] = useState<[number, number] | null>(null);

  const watchRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const lastHeadingRef = useRef<{ lat: number; lng: number } | null>(null);

  const points = useMemo<[number, number][]>(
    () => (route?.waypoints ?? []) as [number, number][],
    [route]
  );
  const segs = useMemo(() => buildSegments(points), [points]);

  const stopAll = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // A new route invalidates any run. Also release the GPS watch on unmount â€”
  // leaving watchPosition running would keep the GPS light on indefinitely.
  const routeKey = route?.id ?? 'no-route';
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (prevRouteKey !== routeKey) {
    setPrevRouteKey(routeKey);
    setJourney('idle');
    setFix(null);
    setPreviewPos(null);
  }

  useEffect(() => {
    stopAll();
  }, [routeKey, stopAll]);

  useEffect(() => stopAll, [stopAll]);

  const tiles = usingFallback
    ? { url: TILES.fallbackUrl, attribution: TILES.fallbackAttribution }
    : { url: TILES.url, attribution: TILES.attribution };

  const gpsAvailable = typeof navigator !== 'undefined' && !!navigator.geolocation;

  /** Live-tracking mode: the puck follows the operator's real movement. */
  const startTracking = useCallback(() => {
    if (!gpsAvailable) return;
    setGpsError(null);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: pos.timestamp };
        setFix(next);

        // Rotate the arrow to face the way they're actually heading.
        const marker = markerRef.current;
        if (marker) {
          marker.setLatLng([next.lat, next.lng]);
          const prev = lastHeadingRef.current;
          if (prev && (Math.abs(prev.lat - next.lat) > 1e-6 || Math.abs(prev.lng - next.lng) > 1e-6)) {
            const el = marker.getElement()?.querySelector('.nx-traveler') as HTMLElement | null;
            if (el) el.style.transform = `rotate(${bearingDeg(prev.lat, prev.lng, next.lat, next.lng)}deg)`;
          }
          lastHeadingRef.current = { lat: next.lat, lng: next.lng };
        }

        if (points.length > 1) {
          const { alongKm } = projectOntoRoute(points, segs, next.lat, next.lng);
          const dest = points[points.length - 1];
          const straightToDest = haversineKm(next.lat, next.lng, dest[0], dest[1]);
          if (straightToDest <= ARRIVAL_RADIUS_KM || alongKm >= segs.totalKm - ARRIVAL_RADIUS_KM) {
            stopAll();
            setJourney('arrived');
          }
        }
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'GPS position unavailable.'
            : 'GPS timed out.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 }
    );

    setJourney('tracking');
  }, [gpsAvailable, points, segs, stopAll]);

  /** No-GPS fallback: replay the corridor at accelerated pace. */
  const startPreview = useCallback(() => {
    if (!route || points.length < 2) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const duration = previewDurationMs(route.distanceKm);
    const started = performance.now();
    setPreviewPos([route.originLat, route.originLng]);
    setJourney('preview');

    const step = (now: number) => {
      const frac = Math.min(1, (now - started) / duration);
      const next = locateAlong(points, segs, frac);
      setPreviewPos([next.lat, next.lng]);

      const marker = markerRef.current;
      if (marker) {
        marker.setLatLng([next.lat, next.lng]);
        const look = locateAlong(points, segs, Math.min(1, frac + 0.004));
        const el = marker.getElement()?.querySelector('.nx-traveler') as HTMLElement | null;
        if (el) el.style.transform = `rotate(${bearingDeg(next.lat, next.lng, look.lat, look.lng)}deg)`;
      }

      if (frac >= 1) {
        setJourney('arrived');
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [route, points, segs]);

  const startJourney = useCallback(() => {
    setJourney('idle');
    if (gpsAvailable) startTracking();
    else startPreview();
  }, [gpsAvailable, startTracking, startPreview]);

  const stopJourney = useCallback(() => {
    stopAll();
    setJourney('idle');
    setFix(null);
    setPreviewPos(null);
    lastHeadingRef.current = null;
  }, [stopAll]);

  /* â”€â”€ Derived HUD figures â”€â”€ */
  const roadKm = route?.distanceKm ?? 0;
  const active = journey !== 'idle';

  const currentPos: [number, number] | null =
    journey === 'tracking' && fix ? [fix.lat, fix.lng] : previewPos;

  let remainingStraightKm = roadKm;
  let offRouteKm: number | null = null;
  let movedKm = 0;

  if (journey === 'tracking' && fix && points.length > 1) {
    const { alongKm, offKm } = projectOntoRoute(points, segs, fix.lat, fix.lng);
    // Remaining along the corridor, converted to the same road-distance basis
    // the route summary uses so the two numbers stay comparable.
    remainingStraightKm = Math.max(0, (segs.totalKm - alongKm) * 1.35);
    offRouteKm = offKm;
    movedKm = alongKm * 1.35;
  } else if (journey === 'preview' && previewPos && points.length > 1) {
    const { alongKm } = projectOntoRoute(points, segs, previewPos[0], previewPos[1]);
    remainingStraightKm = Math.max(0, (segs.totalKm - alongKm) * 1.35);
    movedKm = alongKm * 1.35;
  }

  const remainingKm = Number(remainingStraightKm.toFixed(1));
  const remainingMin = roadKm > 0 ? Math.max(0, Math.round((remainingStraightKm / 4.5) * 60)) : 0;
  const pctLeft = roadKm > 0 ? Math.min(100, Math.max(0, (remainingStraightKm / roadKm) * 100)) : 0;
  const isOffRoute = offRouteKm !== null && offRouteKm > OFF_ROUTE_TOLERANCE_KM;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[#DEDEDA] dark:border-[#B4B4B4] ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={19}
          eventHandlers={{ tileerror: () => setUsingFallback(true) }}
        />

        {points.length > 0 && <FitRoute points={points} />}
        <FollowTraveller position={active ? currentPos : null} />

        {/* The corridor */}
        {points.length > 1 && (
          <>
            <Polyline
              positions={points}
              pathOptions={{ color: '#FFFFFF', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={points}
              pathOptions={{ color: '#1A3A6B', weight: 4.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )}

        {/* Traveller */}
        {active && route && currentPos && (
          <Marker
            ref={markerRef}
            position={currentPos}
            icon={travelerIcon}
            zIndexOffset={1000}
          />
        )}

        {/* Origin */}
        <Marker position={[route?.originLat ?? center[0], route?.originLng ?? center[1]]} icon={originIcon}>
          <Popup>
            <div className="text-xs">
              <div className="font-bold text-[#14151A] dark:text-[#FFFFFF]">Start</div>
              <div className="text-[#5A5C66] dark:text-[#D0D0D0]">{route?.originName ?? 'Your location'}</div>
            </div>
          </Popup>
        </Marker>

        {/* Destination */}
        {route && points.length > 0 && (
          <Marker position={[points[points.length - 1][0], points[points.length - 1][1]]} icon={destIcon}>
            <Popup>
              <div className="text-xs">
                <div className="font-bold text-[#14151A] dark:text-[#FFFFFF]">Safe relief camp</div>
                <div className="text-[#5A5C66] dark:text-[#D0D0D0]">{route.destinationName}</div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* â”€â”€ Journey control â”€â”€ */}
      {route && (
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-1.5">
          {journey === 'idle' ? (
            <button
              type="button"
              onClick={startJourney}
              data-testid="start-journey"
              className="px-3.5 py-2 rounded-lg bg-[#126B34] hover:bg-[#0E5230] text-white text-xs font-bold shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Journey</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={journey === 'arrived' ? startJourney : stopJourney}
              data-testid="stop-journey"
              className="px-3.5 py-2 rounded-lg bg-white/95 dark:bg-[#212121]/95 hover:bg-[#F1F1EF] dark:hover:bg-[#1C1D22] text-[#14151A] dark:text-[#FFFFFF] border border-[#DEDEDA] dark:border-[#B4B4B4] text-xs font-bold shadow-lg transition-colors cursor-pointer flex items-center gap-1.5 backdrop-blur"
            >
              {journey === 'arrived' ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </>
              )}
            </button>
          )}

          {/* GPS problems are surfaced here, next to the control that caused them */}
          {gpsError && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[#FCF1F0]/95 dark:bg-[#3F1414]/95 border border-[#FBE9E7] dark:border-[#7F1D1D] text-[10px] font-bold text-[#B42318] dark:text-[#C0C0C0] shadow-lg backdrop-blur flex items-center gap-1.5 max-w-[230px]">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Journey HUD â”€â”€ */}
      {route && active && (
        <div
          data-testid="journey-hud"
          className="absolute left-3 bottom-3 z-[500] w-[252px] rounded-lg bg-white/95 dark:bg-[#212121]/95 border border-[#DEDEDA] dark:border-[#B4B4B4] shadow-lg backdrop-blur overflow-hidden"
        >
          {journey === 'arrived' ? (
            <div className="flex items-center gap-2.5 px-3.5 py-3">
              <span className="w-8 h-8 rounded-full bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] flex items-center justify-center flex-shrink-0">
                <Flag className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">Arrived at camp</p>
                <p className="text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0] truncate">
                  {route.destinationName}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] font-data min-w-0">
                  {journey === 'tracking' ? (
                    <Satellite className="w-3.5 h-3.5 text-[#126B34] dark:text-[#E0E0E0] flex-shrink-0" />
                  ) : (
                    <CompassIcon className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0] flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {journey === 'tracking' ? 'GPS Tracking' : 'Route Preview'}
                  </span>
                </span>
                <span className="text-[10px] font-data font-bold text-[#126B34] dark:text-[#E0E0E0] flex-shrink-0">
                  {Math.round(100 - pctLeft)}% done
                </span>
              </div>

              <div className="w-full h-1.5 bg-[#E4E4E0] dark:bg-[#B4B4B4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#126B34] rounded-full transition-[width] duration-300 ease-linear"
                  style={{ width: `${100 - pctLeft}%` }}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-baseline gap-0.5">
                  <span className="font-data text-xl font-black text-[#12294D] dark:text-[#FFFFFF]">
                    {remainingKm}
                  </span>
                  <span className="text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">km left</span>
                </span>
                <span className="w-px h-4 bg-[#E4E4E0] dark:bg-[#B4B4B4]" />
                <span className="flex items-baseline gap-0.5">
                  <span className="font-data text-xl font-black text-[#12294D] dark:text-[#FFFFFF]">
                    {remainingMin}
                  </span>
                  <span className="text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">min</span>
                </span>
                {movedKm > 0.02 && (
                  <>
                    <span className="w-px h-4 bg-[#E4E4E0] dark:bg-[#B4B4B4]" />
                    <span className="flex items-baseline gap-0.5">
                      <span className="font-data text-sm font-bold text-[#126B34] dark:text-[#E0E0E0]">
                        {movedKm.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">
                        km covered
                      </span>
                    </span>
                  </>
                )}
              </div>

              {/* Off-corridor detection â€” the whole point of a "dry corridor" */}
              {isOffRoute && (
                <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#FCF1F0] dark:bg-[#3F1414]/50 border border-[#FBE9E7] dark:border-[#7F1D1D]">
                  <AlertTriangle className="w-3 h-3 text-[#B42318] dark:text-[#C0C0C0] flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#7A1C13] dark:text-[#C0C0C0] leading-tight">
                    <strong>Off the safe corridor</strong> â€” you are{' '}
                    {Math.round((offRouteKm ?? 0) * 1000)} m from the route. Rejoin it or turn back;
                    the detour may cross submerged roads.
                  </p>
                </div>
              )}

              <p className="text-[9px] text-[#A1A3AC] leading-tight dark:text-[#C0C0C0]">
                {journey === 'tracking'
                  ? 'Advances only as you move. Distance measured along the corridor.'
                  : 'No GPS â€” replaying the route at accelerated pace. Distances are real.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Static summary chip â”€â”€ */}
      {route && !active && (
        <div className="absolute left-3 bottom-3 z-[500] flex items-center gap-3 px-3 py-2 rounded-lg bg-white/95 dark:bg-[#212121]/95 border border-[#DEDEDA] dark:border-[#B4B4B4] shadow-lg backdrop-blur">
          <span className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
            <span className="text-[11px] font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">
              {route.distanceKm} km
            </span>
          </span>
          <span className="w-px h-3.5 bg-[#DEDEDA] dark:bg-[#B4B4B4]" />
          <span className="text-[11px] font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">
            {route.etaMinutes} min
          </span>
          <span className="w-px h-3.5 bg-[#DEDEDA] dark:bg-[#B4B4B4]" />
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#126B34] dark:text-[#D0D0D0]" />
            <span className="text-[11px] font-data font-bold text-[#126B34] dark:text-[#D0D0D0]">
              Dry corridor
            </span>
          </span>
        </div>
      )}

      {/* â”€â”€ Empty state â”€â”€ */}
      {!route && (
        <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-1.5 bg-white/70 dark:bg-[#212121]/70 backdrop-blur-[1px] pointer-events-none">
          <LocateFixed className="w-5 h-5 text-[#6B6D77] dark:text-[#D0D0D0]" />
          <p className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">No route calculated yet</p>
          <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">
            Set your location, choose a camp, then press Calculate Path
          </p>
        </div>
      )}
    </div>
  );
};

/** Small presentational helper reused by the planner card. */
export const LocateButton: React.FC<{
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  reason?: string | null;
}> = ({ onClick, loading, disabled, reason }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading || disabled}
    className="px-3 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#2F2F2F] dark:hover:bg-[#2E3038] text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
  >
    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
    <span>My Location</span>
    {reason && <AlertTriangle className="w-3 h-3 text-[#F5C77E]" />}
  </button>
);
