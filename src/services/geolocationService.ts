/**
 * geolocationService.ts — browser location detection for the one-tap SOS Signal.
 *
 * Websites CAN detect a user's location (no native app required) via the
 * browser Geolocation API. Works in Chrome/Edge/Firefox/Safari on both mobile
 * (GPS) and desktop (WiFi/network positioning).
 *
 * Notes:
 * - Requires the user to approve the one-time browser permission prompt.
 * - Only available on secure contexts: https:// (or http://localhost in dev).
 */

export interface GeoResult {
  lat: number;
  lng: number;
  accuracy: number; // meters
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Resolves the current position via the browser Geolocation API. */
export function detectLocation(timeoutMs = 12000): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

/**
 * Best-effort reverse geocoding (free OpenStreetMap Nominatim, no API key).
 * Returns a human-readable place name, or `null` when unavailable/offline so
 * callers can fall back to the raw coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=0&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return typeof data.display_name === 'string' && data.display_name.trim()
      ? data.display_name
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Stable display label for a raw position. */
export function coordsLabel(lat: number, lng: number): string {
  return `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

/** Mean Earth radius in kilometres. */
const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points, in kilometres.
 *
 * Used to rank shelters by real proximity rather than by list order. The
 * haversine form is numerically stable at the short, city-scale distances this
 * app deals with, unlike the spherical law of cosines.
 */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, in degrees clockwise from north. */
export function bearingDeg(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** 16-point compass label for a bearing. */
export function compassLabel(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Rough travel-time estimate for an evacuation route.
 *
 * A straight-line distance under-states the real road distance; urban flood
 * corridors typically add 30-45%. Walking uses 4.5 km/h (an assisted-evacuation
 * pace, not a healthy adult's) and driving assumes a badly flooded 20 km/h.
 */
export function estimateTravel(distanceKm: number): {
  roadKm: number;
  walkMinutes: number;
  driveMinutes: number;
} {
  const roadKm = distanceKm * 1.35;
  return {
    roadKm: Number(roadKm.toFixed(1)),
    walkMinutes: Math.max(1, Math.round((roadKm / 4.5) * 60)),
    driveMinutes: Math.max(1, Math.round((roadKm / 20) * 60))
  };
}