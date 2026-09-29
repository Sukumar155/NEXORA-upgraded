import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { ZoneMap } from '../components/dashboard/ZoneMap';
import { WeatherStrip } from '../components/weather/WeatherStrip';
import { LiveSensorStrip } from '../components/shared/LiveSensorStrip';
import { Compass, Home, ArrowRight, Info, ShieldCheck, Navigation } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

/**
 * Citizen-facing disaster map.
 *
 * Renders the same Leaflet map as the authority dashboard, but with
 * `audience="public"` so SOS beacons â€” the precise coordinates of trapped
 * people â€” are never drawn. Everything a citizen needs for self-protective
 * decisions is present: inundation zones, flooded roads, shelters, hospitals,
 * sensor pins and drone damage.
 */
export const CitizenMapPage: React.FC = () => {
  const {
    shelters,
    blockedRoads,
    activeEvacuationRoute,
    overallRiskLevel,
    setCurrentView,
    calculateSafeRoute,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  const activeFlooded = blockedRoads.filter((r) => r.active);
  const nearest = shelters[0];
  const freeBeds = shelters.reduce((acc, s) => acc + (s.totalCapacity - s.currentOccupancy), 0);

  const riskTone =
    overallRiskLevel === 'CRITICAL'
      ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/40 border-[#FBE9E7] dark:border-[#7F1D1D] text-[#B42318] dark:text-[#C0C0C0]'
      : overallRiskLevel === 'HIGH'
      ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 border-[#EFE3C4] dark:border-[#78350F] text-[#A15C07] dark:text-[#D0D0D0]'
      : 'bg-[#F1F1EF] dark:bg-[#2F2F2F] border-[#DEDEDA] dark:border-[#B4B4B4] text-[#126B34] dark:text-[#E0E0E0]';

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* HEADER */}
        <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A3A6B] flex items-center justify-center flex-shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-base sm:text-lg font-bold text-[#14151A] dark:text-[#FFFFFF] leading-tight">
                {t('map_title', 'Live Disaster Inundation & Safe Route Map')}
              </h1>
              <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">
                Flooded roads, risk zones, shelters and hospitals near you
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-data border ${riskTone}`}>
              RISK: {overallRiskLevel}
            </span>
            <button
              onClick={() => setCurrentView('CITIZEN_PORTAL')}
              className="px-3 py-1.5 rounded-xl bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#5A5C66] dark:text-[#D0D0D0] text-xs font-bold transition-colors cursor-pointer"
            >
              Back to Portal
            </button>
          </div>
        </div>

        <WeatherStrip />
        <LiveSensorStrip variant="compact" subtitle="Live from SEOC gauges â€¢ updates every 5s" />

        {/* MAP + SAFETY SIDEBAR */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8">
            <ZoneMap fullScreen={true} audience="public" />
          </div>

          <div className="xl:col-span-4 space-y-4">
            {/* Why SOS pins are absent â€” better to explain than look broken. */}
            <div className="nexora-card p-4 space-y-2">
              <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
                Personal Safety View
              </h3>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed">
                This map shows hazard and shelter information only. SOS beacons are held on a
                separate authority network â€” they mark the exact locations of people who need
                rescue, so they are never shown publicly.
              </p>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed">
                If <strong>you</strong> need help, use SOS Signal on the portal â€” it shares your
                location directly with the authorities.
              </p>
            </div>

            {/* Flooded road warnings */}
            <div className="nexora-card p-4 space-y-2.5">
              <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">
                Road Status
              </h3>
              {activeFlooded.length === 0 ? (
                <p className="text-[11px] text-[#126B34] dark:text-[#E0E0E0]">
                  No roads are currently reported flooded.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {activeFlooded.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2 text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B42318] mt-1 flex-shrink-0" />
                      <span>
                        <strong className="text-[#14151A] dark:text-[#FFFFFF]">{r.name}</strong> â€” impassable
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] pt-1">
                Never walk or drive through flowing water, even 15 cm deep.
              </p>
            </div>

            {/* Active safe route */}
            {activeEvacuationRoute && (
              <div className="nexora-card p-4 space-y-2 border border-[#1A3A6B]/30 bg-[#EEF2F8]/50 dark:bg-[#2F2F2F]">
                <span className="text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] flex items-center gap-1.5">
                  <Navigation className="w-4 h-4" />
                  Recommended Safe Route
                </span>
                <div className="text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF]">
                  {activeEvacuationRoute.originName} â†’ {activeEvacuationRoute.destinationName}
                </div>
                <div className="flex items-center justify-between text-xs font-data text-[#6B6D77] dark:text-[#D0D0D0]">
                  <span>
                    <strong className="text-[#14151A] dark:text-[#FFFFFF]">
                      {activeEvacuationRoute.distanceKm} km
                    </strong>{' '}
                    distance
                  </span>
                  <span>
                    <strong className="text-[#14151A] dark:text-[#FFFFFF]">
                      {activeEvacuationRoute.etaMinutes} min
                    </strong>{' '}
                    walk
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] italic pt-1 border-t border-[#DEDEDA] dark:border-[#B4B4B4]">
                  Avoids {activeFlooded.length} flooded road{activeFlooded.length === 1 ? '' : 's'} via an
                  elevated corridor.
                </p>
              </div>
            )}

            {/* Nearest shelter with free beds + routing */}
            {nearest && (
              <div className="nexora-card p-4 space-y-2.5">
                <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
                  Nearest Shelter with Space
                </h3>
                <div className="text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF]">{nearest.name}</div>
                <div className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">{nearest.address}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-data bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#E4F3E9] dark:border-[#14532D]">
                    {nearest.totalCapacity - nearest.currentOccupancy} FREE BEDS
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-data bg-[#EEF2F8] dark:bg-[#2F2F2F] text-[#1A3A6B] dark:text-[#D0D0D0]">
                    {freeBeds} free district-wide
                  </span>
                </div>
                <button
                  onClick={() => {
                    calculateSafeRoute('My Location', nearest.id);
                    setCurrentView('CITIZEN_MAP');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#126B34] hover:bg-[#0E5230] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Route Me to Shelter</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#F1F1EF] dark:bg-[#171717] border border-[#DEDEDA] dark:border-[#B4B4B4]">
              <Info className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] leading-snug">
                Map data updates as the control room reports conditions. In an offline area, rely on
                the printed Safe Route card and the USSD code.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
