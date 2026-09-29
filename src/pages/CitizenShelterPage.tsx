import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  MapPin,
  Navigation,
  Loader2,
  LocateFixed,
  AlertTriangle,
  CheckCircle2,
  Navigation as NavIcon,
  HeartPulse,
  Users,
  Clock
} from 'lucide-react';
import { TopBar } from '../components/dashboard/TopBar';
import { useNexoraStore } from '../store/useNexoraStore';
import {
  detectLocation,
  isGeolocationSupported,
  haversineKm,
  bearingDeg,
  compassLabel,
  estimateTravel
} from '../services/geolocationService';
import { getTranslation } from '../i18n/translations';

type LocateState = 'IDLE' | 'LOCATING' | 'RESOLVED' | 'DENIED' | 'UNSUPPORTED';

interface Origin {
  lat: number;
  lng: number;
  label: string;
  /** False when we fell back to the district centre rather than real GPS. */
  isRealFix: boolean;
}

interface RankedShelter {
  shelter: ReturnType<typeof useNexoraStore.getState>['shelters'][number];
  straightKm: number;
  roadKm: number;
  walkMinutes: number;
  driveMinutes: number;
  heading: string;
  freeBeds: number;
  isFull: boolean;
}

export const CitizenShelterPage: React.FC = () => {
  const {
    shelters,
    district,
    districtSite,
    currentLanguage,
    calculateSafeRoute,
    setCurrentView
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  const [locate, setLocate] = useState<LocateState>('IDLE');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [onlyWithBeds, setOnlyWithBeds] = useState(false);

  // Resolve the visitor's position once, falling back to the district centre.
  const locateUser = async () => {
    if (!isGeolocationSupported()) {
      setLocate('UNSUPPORTED');
      setOrigin({
        lat: districtSite.latitude,
        lng: districtSite.longitude,
        label: `${district} district centre`,
        isRealFix: false
      });
      return;
    }

    setLocate('LOCATING');
    try {
      const pos = await detectLocation(10000);
      setOrigin({
        lat: pos.lat,
        lng: pos.lng,
        label: 'Your current location',
        isRealFix: true
      });
      setLocate('RESOLVED');
    } catch {
      setLocate('DENIED');
      setOrigin({
        lat: districtSite.latitude,
        lng: districtSite.longitude,
        label: `${district} district centre`,
        isRealFix: false
      });
    }
  };

  useEffect(() => {
    void locateUser();
    // Intentionally once on mount; the button re-runs it on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Shelters ranked by true distance from the resolved origin. */
  const ranked = useMemo<RankedShelter[]>(() => {
    if (!origin) return [];
    return shelters
      .map(shelter => {
        const straightKm = haversineKm(origin.lat, origin.lng, shelter.lat, shelter.lng);
        const travel = estimateTravel(straightKm);
        const freeBeds = shelter.totalCapacity - shelter.currentOccupancy;
        return {
          shelter,
          straightKm,
          roadKm: travel.roadKm,
          walkMinutes: travel.walkMinutes,
          driveMinutes: travel.driveMinutes,
          heading: compassLabel(bearingDeg(origin.lat, origin.lng, shelter.lat, shelter.lng)),
          freeBeds,
          isFull: freeBeds <= 0
        };
      })
      .filter(s => (onlyWithBeds ? s.freeBeds > 0 : true))
      .sort((a, b) => {
        // Never recommend a full shelter first â€” route to a usable one instead.
        if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
        return a.straightKm - b.straightKm;
      });
  }, [origin, shelters, onlyWithBeds]);

  const showOnMap = (r: RankedShelter) => {
    if (!origin) return;
    calculateSafeRoute(origin.label, r.shelter.id, { lat: origin.lat, lng: origin.lng });
    setCurrentView('CITIZEN_MAP');
  };

  const mapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body">
      <TopBar />

      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* HEADER */}
        <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E4F3E9] dark:bg-[#0A2E22]/40 text-[#126B34] dark:text-[#D0D0D0] flex items-center justify-center flex-shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF]">
                {t('citizen_find_shelter', 'Find Safe Shelter')}
              </h1>
              <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0]">
                Relief camps ranked by true distance from you
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setOnlyWithBeds(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                onlyWithBeds
                  ? 'bg-[#126B34] text-white border-[#126B34]'
                  : 'bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#5A5C66] dark:text-[#D0D0D0] border-[#DEDEDA] dark:border-[#B4B4B4]'
              }`}
            >
              Free beds only
            </button>
            <button
              onClick={() => void locateUser()}
              disabled={locate === 'LOCATING'}
              className="px-3 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#2F2F2F] dark:hover:bg-[#2E3038] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {locate === 'LOCATING' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              <span>Use my location</span>
            </button>
            <button
              onClick={() => setCurrentView('CITIZEN_PORTAL')}
              className="px-3 py-1.5 rounded-lg bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#5A5C66] dark:text-[#D0D0D0] text-xs font-bold transition-colors cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>

        {/* ORIGIN / FALLBACK NOTICE â€” never imply a GPS fix we don't have */}
        {locate === 'LOCATING' && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#EEF2F8] dark:bg-[#171717] border border-[#C3D0E4] dark:border-[#B4B4B4]">
            <Loader2 className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0] animate-spin flex-shrink-0" />
            <p className="text-xs text-[#1A3A6B] dark:text-[#D0D0D0]">
              Getting your location to sort shelters by real distanceâ€¦
            </p>
          </div>
        )}

        {origin && !origin.isRealFix && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 border border-[#EFE3C4] dark:border-[#78350F]">
            <AlertTriangle className="w-4 h-4 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A3E0B] dark:text-[#D0D0D0] leading-snug">
              {locate === 'UNSUPPORTED'
                ? 'This browser cannot share your location, '
                : 'Location permission was not granted, '}
              so distances below are measured from <strong>{origin.label}</strong> rather than your exact
              position. Tap <strong>Use my location</strong> for accurate distances.
            </p>
          </div>
        )}

        {origin?.isRealFix && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#E4F3E9] dark:bg-[#0A2E22]/40 border border-[#CFE6D8] dark:border-[#14532D]">
            <CheckCircle2 className="w-4 h-4 text-[#126B34] dark:text-[#E0E0E0] flex-shrink-0" />
            <p className="text-xs text-[#126B34] dark:text-[#E0E0E0]">
              Distances measured from your live location ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}).
            </p>
          </div>
        )}

        {/* RESULTS */}
        {origin && ranked.length === 0 && (
          <div className="nexora-card p-10 text-center space-y-2">
            <Home className="w-8 h-8 text-[#6B6D77] dark:text-[#D0D0D0] mx-auto" />
            <p className="text-sm font-bold text-[#12294D] dark:text-[#FFFFFF]">No shelters match that filter</p>
            <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0]">
              Every camp is currently full. Turn off <strong>Free beds only</strong> to see all of them.
            </p>
          </div>
        )}

        {ranked.map((r, idx) => {
          const s = r.shelter;
          return (
            <div
              key={s.id}
              data-testid="shelter-result"
              className={`nexora-card p-5 space-y-4 ${
                idx === 0 && !r.isFull ? 'border-[#7CC99A] dark:border-[#14532D] ring-1 ring-[#CFE6D8] dark:ring-[#14532D]' : ''
              } ${r.isFull ? 'opacity-75' : ''}`}
            >
              {/* Rank + name */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-data font-bold text-sm ${
                      r.isFull
                        ? 'bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#A1A3AC]'
                        : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/40 text-[#126B34] dark:text-[#E0E0E0]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                        {s.name}
                      </h2>
                      {idx === 0 && !r.isFull && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-data bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#CFE6D8] dark:border-[#14532D]">
                          NEAREST WITH SPACE
                        </span>
                      )}
                      {r.isFull && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-data bg-[#FCF1F0] dark:bg-[#3F1414]/60 text-[#B42318] dark:text-[#C0C0C0] border border-[#FBE9E7] dark:border-[#7F1D1D]">
                          FULL
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {s.address}
                    </p>
                  </div>
                </div>

                {/* Distance â€” the number the user came for */}
                <div className="text-right flex-shrink-0">
                  <div className="font-data text-2xl font-black tracking-tight text-[#12294D] dark:text-[#FFFFFF]">
                    {r.roadKm}
                    <span className="text-sm font-bold text-[#6B6D77] dark:text-[#D0D0D0] ml-0.5">km</span>
                  </div>
                  <div className="text-[10px] font-data font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                    {r.heading} Â·{' '}
                    {r.walkMinutes > 60 ? (
                      <span className="text-[#B42318] dark:text-[#C0C0C0]">
                        {r.walkMinutes} min walk â€” too far on foot
                      </span>
                    ) : (
                      `${r.walkMinutes} min walk`
                    )}
                  </div>
                </div>
              </div>

              {/* Capacity + facilities */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div
                  className={`p-2.5 rounded-lg border font-data ${
                    r.isFull
                      ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/30 border-[#FBE9E7] dark:border-[#7F1D1D]'
                      : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/30 border-[#CFE6D8] dark:border-[#14532D]'
                  }`}
                >
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                    <Users className="w-3 h-3" />
                    Free beds
                  </span>
                  <span
                    className={`block text-base font-bold mt-0.5 ${
                      r.isFull ? 'text-[#B42318] dark:text-[#C0C0C0]' : 'text-[#126B34] dark:text-[#E0E0E0]'
                    }`}
                  >
                    {r.freeBeds}
                    <span className="text-[10px] text-[#6B6D77] dark:text-[#D0D0D0]"> / {s.totalCapacity}</span>
                  </span>
                </div>

                <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] font-data">
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                    <Clock className="w-3 h-3" />
                    By vehicle
                  </span>
                  <span className="block text-base font-bold text-[#12294D] dark:text-[#FFFFFF] mt-0.5">
                    {r.driveMinutes} min
                  </span>
                </div>

                <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] font-data">
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                    <HeartPulse className="w-3 h-3" />
                    Medical
                  </span>
                  <span className="block text-xs font-bold text-[#12294D] dark:text-[#FFFFFF] mt-1">
                    {s.hasMedicalFacility ? 'On site' : 'First aid'}
                  </span>
                </div>

                <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] font-data">
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                    <Home className="w-3 h-3" />
                    Accessibility
                  </span>
                  <span className="block text-base font-bold text-[#12294D] dark:text-[#FFFFFF] mt-0.5">
                    {s.accessibilityScore}
                    <span className="text-[10px] text-[#6B6D77] dark:text-[#D0D0D0]"> / 100</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => showOnMap(r)}
                  className="px-3.5 py-2 rounded-lg bg-[#126B34] hover:bg-[#0E5230] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <NavIcon className="w-3.5 h-3.5" />
                  <span>Show safe route</span>
                </button>
                <a
                  href={mapsUrl(s.lat, s.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#2F2F2F] dark:hover:bg-[#2E3038] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-[#1A3A6B] dark:border-[#B4B4B4]"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Directions</span>
                </a>
                <span className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] ml-auto">
                  Straight-line {r.straightKm.toFixed(1)} km
                </span>
              </div>

              {/* Beyond ~4.5 km an assisted walk is not a safe suggestion in a
                  flood, so say so rather than quietly showing a 7-hour walk. */}
              {r.walkMinutes > 60 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FCF1F0] dark:bg-[#3F1414]/30 border border-[#FBE9E7] dark:border-[#7F1D1D]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] dark:text-[#C0C0C0] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#7A1C13] dark:text-[#C0C0C0] leading-snug">
                    <strong>Do not attempt this on foot.</strong> {r.roadKm} km through flood-affected
                    streets is not walkable. Ask for transport â€” call <strong>1070</strong> or use SOS
                    Signal so responders can reach you. A closer shelter may be a better option if you
                    can move safely.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Safety footer */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FCF1F0] dark:bg-[#3F1414]/30 border border-[#FBE9E7] dark:border-[#7F1D1D]">
          <AlertTriangle className="w-4 h-4 text-[#B42318] dark:text-[#C0C0C0] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#7A1C13] dark:text-[#C0C0C0] leading-relaxed">
            <strong>Confirm before you travel.</strong> Camp capacity changes minute to minute during an
            emergency â€” call the helpline on 1070 before setting out, and never cross flowing water to
            reach a camp.
          </p>
        </div>
      </main>
    </div>
  );
};
