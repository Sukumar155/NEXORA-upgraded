/**
 * corridorPlanner.ts — geometry for the "Dry Evacuation Corridor" route.
 *
 * Pure functions only: no store, no React, no I/O. That keeps the routing maths
 * independently testable (`node scripts/verify-corridor.mjs`) and stops it
 * quietly drifting away from what the UI claims.
 *
 * Why this exists: the evacuation box used to hardcode
 * `riskRating: "DRY_CORRIDOR_SAFE"`, offset the midpoint by a fixed 0.0025° and
 * print a canned "avoid the Otteri nullah roadblock" direction — without ever
 * reading the roadblock list. It said it avoided submerged roads while drawing
 * a straight line through them. Tolerable on an operator screen; not tolerable
 * on the citizen portal, where someone wading through floodwater trusts the
 * word "SAFE".
 */
import type { BlockedRoad } from '../types/scenario';
import type { SafeEvacuationRoute } from '../types/hospital';

/** Metres per degree of latitude; longitude is scaled by cos(lat) at the line's mid-latitude. */
const metresPerDegLat = 111_320;

/** A roadblock within this distance of the centreline counts as "on the corridor". */
export const CORRIDOR_HALF_WIDTH_M = 120;

/** Extra clearance a detour must achieve beyond the blocking radius. */
export const DETOUR_CLEARANCE_M = 200;

/** Shortest distance in metres from point P to segment AB, plus the projection ratio t. */
export function pointToSegmentM(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
  pLat: number, pLng: number
): { metres: number; t: number } {
  const midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const mPerLng = metresPerDegLat * Math.cos(midLatRad) || metresPerDegLat;

  // Local planar frame (metres) — over a few km the curvature error is negligible.
  const ax = 0, ay = 0;
  const bx = (bLng - aLng) * mPerLng;
  const by = (bLat - aLat) * metresPerDegLat;
  const px = (pLng - aLng) * mPerLng;
  const py = (pLat - aLat) * metresPerDegLat;

  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { metres: Math.hypot(px, py), t: 0 };

  const rawT = (px * dx + py * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { metres: Math.hypot(px - cx, py - cy), t };
}

export interface CorridorPlan {
  waypoints: [number, number][];
  riskRating: SafeEvacuationRoute['riskRating'];
  /** Roadblocks that were on the straight line and are now detoured around. */
  avoided: BlockedRoad[];
  /** Roadblocks sitting on the corridor (whether detoured or not). */
  onRoute: BlockedRoad[];
  /** Lateral push applied at the midpoint, in metres. 0 when no detour was needed. */
  detourMetres: number;
}

/** Successive lateral pushes tried when clearing blockers, in metres. */
const DETOUR_STEPS = [150, 300, 500, 800, 1200, 1800, 2500];

/**
 * Plan a corridor from `from` to `to` that avoids active roadblocks.
 *
 * Tests the straight line first. If a blocker sits on it, the midpoint is pushed
 * perpendicular to the corridor — away from the blockers — until every one of
 * them is clear. The smallest sufficient push wins, so nobody is sent on a wild
 * detour when a short one exists. If even the largest push cannot clear the
 * corridor, the route is honestly reported as `BLOCKED`.
 */
export function planDryCorridor(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  blockedRoads: BlockedRoad[]
): CorridorPlan {
  const active = blockedRoads.filter((r) => r.active);

  const onRoute = active.filter(
    (r) => pointToSegmentM(from.lat, from.lng, to.lat, to.lng, r.lat, r.lng).metres
      <= CORRIDOR_HALF_WIDTH_M
  );

  if (!onRoute.length) {
    return {
      waypoints: [[from.lat, from.lng], [to.lat, to.lng]],
      riskRating: 'DRY_CORRIDOR_SAFE',
      avoided: [],
      onRoute: [],
      detourMetres: 0,
    };
  }

  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const mPerLng = metresPerDegLat * Math.cos((midLat * Math.PI) / 180) || metresPerDegLat;

  // Mean blocker position, used to orient the perpendicular away from them.
  const meanLat = onRoute.reduce((s, r) => s + r.lat, 0) / onRoute.length;
  const meanLng = onRoute.reduce((s, r) => s + r.lng, 0) / onRoute.length;

  // Corridor vector in the local plane (metres), then its unit normal converted
  // back to DEGREES PER METRE — so a waypoint is simply `mid + n * pushMetres`.
  const vLatM = (to.lat - from.lat) * metresPerDegLat;
  const vLngM = (to.lng - from.lng) * mPerLng;
  const len = Math.hypot(vLatM, vLngM) || 1;
  let nLat = (-vLngM / len) / metresPerDegLat;
  let nLng = (vLatM / len) / mPerLng;

  // Flip the normal so it points away from the blockers.
  if ((meanLat - midLat) * nLat + (meanLng - midLng) * nLng > 0) {
    nLat = -nLat;
    nLng = -nLng;
  }

  for (const push of DETOUR_STEPS) {
    const wpLat = midLat + nLat * push;
    const wpLng = midLng + nLng * push;
    const waypoints: [number, number][] = [[from.lat, from.lng], [wpLat, wpLng], [to.lat, to.lng]];

    const clear = onRoute.every((r) => {
      const d1 = pointToSegmentM(waypoints[0][0], waypoints[0][1], waypoints[1][0], waypoints[1][1], r.lat, r.lng).metres;
      const d2 = pointToSegmentM(waypoints[1][0], waypoints[1][1], waypoints[2][0], waypoints[2][1], r.lat, r.lng).metres;
      return Math.min(d1, d2) >= CORRIDOR_HALF_WIDTH_M + DETOUR_CLEARANCE_M;
    });

    if (clear) {
      return {
        waypoints,
        // Detoured, but the corridor still runs past a known flood zone.
        riskRating: 'CAUTION_SHALLOW_SURGE',
        avoided: onRoute,
        onRoute,
        detourMetres: push,
      };
    }
  }

  // Could not clear the corridor even at maximum push.
  return {
    waypoints: [[from.lat, from.lng], [to.lat, to.lng]],
    riskRating: 'BLOCKED',
    avoided: [],
    onRoute,
    detourMetres: 0,
  };
}
