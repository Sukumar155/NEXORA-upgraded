import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { ZoneMap } from '../components/dashboard/ZoneMap';
import { SOSQueue } from '../components/dashboard/SOSQueue';
import { Compass, AlertTriangle } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

export const DisasterMapPage: React.FC = () => {
  const {
    activeEvacuationRoute,
    blockedRoads,
    toggleIncidentModal,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body transition-colors">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 space-y-4">
        
        {/* MAP OPERATIONAL CONTROL BANNER */}
        <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A3A6B] flex items-center justify-center font-bold shadow-xs border border-[#1A3A6B]">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-base sm:text-lg font-bold text-[#14151A] dark:text-[#FFFFFF] leading-tight">
                {t('map_title', 'Live Disaster Inundation & Tactical Map')}
              </h1>
              <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">
                {t('map_subtitle', 'Leaflet GIS â€¢ High / Moderate / Low Risk Zones â€¢ Live Sensor Pins â€¢ Evacuation Waypoints')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleIncidentModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#B42318] hover:bg-[#9A1C13] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('report_incident', 'Report Incident')}</span>
            </button>
          </div>
        </div>

        {/* MAP â€” full width, original full-screen height preserved. The SOS
            queue used to sit in a right sidebar; it is now a strip below. */}
        <ZoneMap fullScreen={true} />

        {/* Active Evacuation Route summary â€” a full-width strip under the map */}
        {activeEvacuationRoute && (
          <div className="p-4 rounded-xl border border-[#1A3A6B]/30 bg-[#EEF2F8]/50 dark:bg-[#2F2F2F] shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                  Selected Safe Evacuation Path
                </span>
                <div className="text-xs text-[#E4F3E9] dark:text-[#FFFFFF] font-semibold mt-1 truncate">
                  {activeEvacuationRoute.originName} â†’ {activeEvacuationRoute.destinationName}
                </div>
                <div className="text-[11px] text-[#126B34] dark:text-[#D0D0D0] mt-0.5">
                  Bypassing {blockedRoads.filter(r => r.active).length} flooded roadway(s) via the dry corridor.
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-data text-[#E4F3E9] dark:text-[#E0E0E0]">
                  Distance: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{activeEvacuationRoute.distanceKm} km</strong>
                </span>
                <span className="text-xs font-data text-[#6B6D77] dark:text-[#D0D0D0]">
                  Walking ETA: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{activeEvacuationRoute.etaMinutes} mins</strong>
                </span>
                <span className="text-[10px] font-bold font-data bg-[#14151A] dark:bg-[#ECECEC] text-[#6B6D77] dark:text-[#E0E0E0] border border-[#DEDEDA] dark:border-[#B4B4B4] px-2 py-0.5 rounded whitespace-nowrap">
                  {activeEvacuationRoute.riskRating.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Priority SOS Triage â€” a horizontal strip of cards below the map */}
        <SOSQueue layout="horizontal" />

      </main>
    </div>
  );
};
