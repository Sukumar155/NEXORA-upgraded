/**
 * DryCorridorPlanner â€” the "Dry Evacuation Corridor (Avoiding Submerged Roads)"
 * box. Shared by the authority Evacuation page and the citizen portal so the
 * two can never drift apart.
 *
 * The routing itself is real: `planDryCorridor()` in
 * `src/services/corridorPlanner.ts` measures the live roadblock list against
 * the corridor and detours around whatever it finds, then reports a risk rating
 * that reflects what was actually detected:
 *
 *   DRY_CORRIDOR_SAFE     â€” nothing active on the corridor
 *   CAUTION_SHALLOW_SURGE â€” detoured around a blockage, longer on purpose
 *   BLOCKED                â€” the corridor could not be cleared; do not use it
 *
 * `tone="citizen"` swaps the operator phrasing for plainer language and always
 * shows the risk banner, because a member of the public is the one most likely
 * to act on the word "SAFE" without a second opinion.
 */
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Compass, Loader2, Navigation, ShieldAlert, ShieldCheck, XCircle,
} from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { RouteMap, LocateButton } from '../routing/RouteMap';
import { detectLocation, isGeolocationSupported } from '../../services/geolocationService';
import type { SafeEvacuationRoute } from '../../types/hospital';

const RISK_UI: Record<
  SafeEvacuationRoute['riskRating'],
  { label: string; tone: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  DRY_CORRIDOR_SAFE: {
    label: 'Corridor clear',
    tone: 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border-[#CFE6D8] dark:border-[#14532D]/60',
    Icon: ShieldCheck,
  },
  CAUTION_SHALLOW_SURGE: {
    label: 'Detour route â€” passable with care',
    tone: 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0] border-[#EFE3C4] dark:border-[#78350F]',
    Icon: AlertTriangle,
  },
  BLOCKED: {
    label: 'Route blocked â€” do not use',
    tone: 'bg-[#FCF1F0] dark:bg-[#3F1414]/40 text-[#B42318] dark:text-[#C0C0C0] border-[#F3CFC9] dark:border-[#7F1D1D]/60',
    Icon: XCircle,
  },
};

interface Props {
  tone?: 'authority' | 'citizen';
  /** Citizen copy overrides the operator phrasing. */
  title?: string;
  subtitle?: string;
  className?: string;
  /**
   * Optional controlled selection. The Evacuation page wires this up so a
   * shelter card's "Route Here" button can drive the planner.
   */
  selectedShelterId?: string;
  onSelectedShelterIdChange?: (id: string) => void;
  /** Scroll this element into view when the selection changes from outside. */
  focusRequestKey?: string | number;
}

export const DryCorridorPlanner: React.FC<Props> = ({
  tone = 'authority',
  title,
  subtitle,
  className = '',
  selectedShelterId: controlledShelterId,
  onSelectedShelterIdChange,
  focusRequestKey,
}) => {
  const isCitizen = tone === 'citizen';
  const {
    shelters,
    calculateSafeRoute,
    blockedRoads,
    districtSite,
  } = useNexoraStore();

  const [internalShelterId, setInternalShelterId] = useState(shelters[0]?.id || 'SHELTER-01');
  const selectedShelterId = controlledShelterId ?? internalShelterId;

  const setSelectedShelterId = (id: string) => {
    if (controlledShelterId === undefined) setInternalShelterId(id);
    onSelectedShelterIdChange?.(id);
    setRoute(null);
  };

  const [route, setRoute] = useState<SafeEvacuationRoute | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{
    lat: number;
    lng: number;
    label: string;
    isRealFix: boolean;
  } | null>(null);

  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // An external "route here" request: adopt the shelter and bring it into view.
  useEffect(() => {
    if (focusRequestKey === undefined) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusRequestKey]);

  const activeBlockers = blockedRoads.filter((r) => r.active);

  const setFallback = () => {
    setOrigin({
      lat: districtSite.latitude,
      lng: districtSite.longitude,
      label: `${districtSite.latitude.toFixed(3)}, ${districtSite.longitude.toFixed(3)} (area centre)`,
      isRealFix: false,
    });
    setRoute(null);
  };

  /** Detect the visitor's real position; fall back to the district centre. */
  const detectMyLocation = async () => {
    if (!isGeolocationSupported()) {
      setLocateError('This browser cannot share your location.');
      setFallback();
      return;
    }

    setLocating(true);
    setLocateError(null);
    try {
      const pos = await detectLocation(10000);
      setOrigin({ lat: pos.lat, lng: pos.lng, label: 'My current location', isRealFix: true });
      setRoute(null);
    } catch {
      setLocateError('Location permission was not granted.');
      setFallback();
    } finally {
      setLocating(false);
    }
  };

  const handleGenerateRoute = () => {
    if (!origin) return;
    const result = calculateSafeRoute(origin.label, selectedShelterId, {
      lat: origin.lat,
      lng: origin.lng,
    });
    setRoute(result);
  };

  const risk = route ? RISK_UI[route.riskRating] : null;
  const RiskIcon = risk?.Icon;

  return (
    <div
      ref={rootRef}
      data-testid="dry-corridor-planner"
      className={`nexora-card p-5 sm:p-6 border border-[#E4E4E0] dark:border-[#B4B4B4] bg-white dark:bg-[#1E3A5F] space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E4E0]/80 dark:border-[#B4B4B4] pb-3">
        <div>
          <h2 className="font-heading font-bold text-base text-[#12294D] dark:text-[#FFFFFF] flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
            {title ?? (isCitizen
              ? 'Find a Safe Route to a Shelter'
              : 'Dry Evacuation Corridor Algorithm (Avoiding Submerged Roads)')}
          </h2>
          <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
            {subtitle ?? (isCitizen
              ? 'We check your path against flooded and blocked roads, and route you around them.'
              : 'Calculates highest-elevation escape trajectory bypassing inundated roads and river surges.')}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#CFE6D8] dark:border-[#14532D]/60 self-start sm:self-center whitespace-nowrap">
          Active Roadblocks Avoided: {activeBlockers.length}
        </span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-5">
          <label className="block text-xs font-bold text-[#5A5C66] dark:text-[#D0D0D0] mb-1">
            {isCitizen ? 'Where are you now?' : 'Your Current Location'}
          </label>
          <div className="flex items-center gap-2">
            <div
              data-testid="origin-readout"
              className="flex-1 min-w-0 px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl shadow-xs"
            >
              {locating ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Detecting your locationâ€¦
                </span>
              ) : origin ? (
                <span className="block min-w-0">
                  <span className="block text-xs font-bold text-[#14151A] dark:text-[#FFFFFF] truncate">
                    {origin.label}
                  </span>
                  <span className="block text-[10px] font-data text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5">
                    {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                    {origin.isRealFix ? '' : ' Â· approx.'}
                  </span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#A1A3AC] dark:text-[#C0C0C0]">
                  Press â€œMy Locationâ€ to set your position
                </span>
              )}
            </div>
            <LocateButton
              onClick={() => void detectMyLocation()}
              loading={locating}
              reason={locateError}
            />
          </div>
        </div>

        <div className="md:col-span-5">
          <label className="block text-xs font-bold text-[#5A5C66] dark:text-[#D0D0D0] mb-1">
            {isCitizen ? 'Shelter you want to reach' : 'Target Safe Relief Camp'}
          </label>
          <select
            value={selectedShelterId}
            onChange={(e) => setSelectedShelterId(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 shadow-xs"
          >
            {shelters.map((s) => {
              const free = s.totalCapacity - s.currentOccupancy;
              return (
                <option key={s.id} value={s.id}>
                  {s.name} â€” {free > 0 ? `${free} beds free` : 'FULL'}
                </option>
              );
            })}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            onClick={handleGenerateRoute}
            disabled={!origin}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1A3A6B] hover:bg-[#12294D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{isCitizen ? 'Show Route' : 'Calculate Path'}</span>
          </button>
        </div>
      </div>

      {/* Never present an approximation as a real fix */}
      {origin && !origin.isRealFix && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 border border-[#EFE3C4] dark:border-[#78350F]">
          <AlertTriangle className="w-3.5 h-3.5 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#A15C07] dark:text-[#D0D0D0] leading-snug">
            {locateError ? `${locateError} ` : ''}
            Using <strong>{origin.label}</strong> as your starting point. Grant location access
            and press <strong>My Location</strong> for an accurate route.
          </p>
        </div>
      )}

      {/* Result banner â€” the honest verdict on the corridor */}
      {route && risk && RiskIcon && (
        <div
          data-testid="corridor-risk"
          className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${risk.tone}`}
        >
          <RiskIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold">{risk.label}</p>
            <p className="text-[11px] mt-1 leading-relaxed">
              {route.distanceKm.toFixed(1)} km Â· about {route.etaMinutes} min walking
              {route.waypoints.length > 2 && ' Â· includes a detour around blocked roads'}
            </p>
          </div>
        </div>
      )}

      {/* Turn-by-turn */}
      {route && (
        <ol className="space-y-1.5" data-testid="corridor-directions">
          {route.directions.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-[#14151A] dark:text-[#FFFFFF] leading-relaxed">
              <span className="font-data font-bold text-[#1A3A6B] dark:text-[#D0D0D0] flex-shrink-0 w-4">
                {i + 1}.
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Blocked roads the citizen should know about, regardless of route */}
      {activeBlockers.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] mb-1.5 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Roads to avoid right now
          </p>
          <ul className="space-y-1">
            {activeBlockers.map((r) => (
              <li key={r.id} className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed">
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF]">{r.name}</span>
                {' â€” '}
                {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RouteMap
        route={route}
        center={origin ? [origin.lat, origin.lng] : [districtSite.latitude, districtSite.longitude]}
        className="h-[340px] sm:h-[420px]"
      />
    </div>
  );
};
