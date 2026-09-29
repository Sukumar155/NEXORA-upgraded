import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { KPIRow } from '../components/dashboard/KPIRow';
import { ZoneMap } from '../components/dashboard/ZoneMap';
import { SOSQueue } from '../components/dashboard/SOSQueue';
import { CommTierStrip } from '../components/dashboard/CommTierStrip';
import { ScenarioPanel } from '../components/dashboard/ScenarioPanel';
import {
  Shield, ArrowLeft, Radio, Cpu, Camera, AlertTriangle, Home, Navigation,
} from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

/* â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export const DDMOAuthorityPage: React.FC = () => {
  const { setCurrentView, currentLanguage, overallRiskLevel, rainfallMmPerHour, windSpeedKmh, sosReports, embankmentBreached } = useNexoraStore();
  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  const isCritical  = overallRiskLevel === 'CRITICAL';
  const activeSOS   = sosReports.filter(r => r.status === 'PENDING' || r.status === 'TRIAGED').length;
  const peopleAtRisk = sosReports.filter(r => r.status !== 'RESCUED' && r.status !== 'FALSE_ALARM').reduce((acc, c) => acc + c.peopleCount, 0) * 120 + (embankmentBreached ? 840 : 0);

  return (
    <div data-testid="ddmo-authority-page" className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-5">

        {/* COMMAND PAGE HEADER */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('COMMAND_DASHBOARD')}
              className="p-2 rounded-xl bg-[#F1F1EF] dark:bg-[#171717] hover:bg-[#EEF2F8] dark:hover:bg-[#14151A] text-[#5A5C66] dark:text-[#D0D0D0] hover:text-[#1A3A6B] dark:hover:text-[#F1F1EF] border border-[#E4E4E0] dark:border-[#B4B4B4] transition-colors cursor-pointer"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-[#1A3A6B] dark:bg-[#ECECEC] border border-[#1A3A6B] dark:border-[#B4B4B4] flex items-center justify-center flex-shrink-0 shadow-xs">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  {t('role_ddmo_title', 'DDMO Authority')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-data border ${
                  isCritical ? 'bg-[#B42318]/10 text-[#B42318] border-[#B42318]/30' : 'bg-[#126B34]/10 text-[#126B34] dark:text-[#D0D0D0] border-[#126B34]/30'
                }`}>
                  {isCritical ? t('critical', 'CRITICAL') : 'OPERATIONAL MONITORING'}
                </span>
              </div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-0.5">
                {t('ddmo_title', 'DDMO Disaster Authority & Command Center')}
              </h1>
            </div>
          </div>

          {/* Quick status telemetry pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-data">
            <div className="bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block">{t('active_incidents', 'Active Incidents')}</span>
              <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{activeSOS} Calls</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block">{t('affected_pop', 'Population At Risk')}</span>
              <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">~{peopleAtRisk.toLocaleString()}</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block">{t('water_level', 'Water Depth')}</span>
              <span className="font-bold text-[#1A3A6B] dark:text-[#D0D0D0]">82 cm (Danger: 95cm)</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block">{t('rainfall', 'Rainfall')}</span>
              <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{rainfallMmPerHour} mm/h</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block">{t('wind_speed', 'Wind')}</span>
              <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{windSpeedKmh} km/h</span>
            </div>
          </div>
        </div>

        {/* 4 OPERATIONAL KPI METRICS ROW */}
        <KPIRow />

        {/* MAIN OPERATIONAL GRID: MAP + PRIORITY QUEUE SIDE-BY-SIDE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8"><ZoneMap /></div>
          <div className="lg:col-span-4"><SOSQueue /></div>
        </div>

        {/* CONNECTED LIFECYCLE QUICK WORKFLOW SHORTCUTS */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-heading font-bold text-[#14151A] dark:text-[#FFFFFF] uppercase tracking-wider text-[11px]">Command Lifecycle:</span>
            <span className="text-[#5A5C66] dark:text-[#D0D0D0] hidden sm:inline">Sensors â†’ AI Risk â†’ Drone Vision â†’ Alerts â†’ Evacuation â†’ Resources</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCurrentView('SENSORS')}
              className="px-3 py-1.5 rounded-lg bg-[#EEF2F8] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#E3EAF4] dark:hover:bg-[#14151A] border border-[#1A3A6B]/30 dark:border-[#B4B4B4] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" /><span>Sensors</span>
            </button>
            <button onClick={() => setCurrentView('AI_RISK')}
              className="px-3 py-1.5 rounded-lg bg-[#EEF2F8] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#E3EAF4] dark:hover:bg-[#14151A] border border-[#1A3A6B]/30 dark:border-[#B4B4B4] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" /><span>AI Risk</span>
            </button>
            <button onClick={() => setCurrentView('DAMAGE_DETECTION')}
              className="px-3 py-1.5 rounded-lg bg-[#EEF2F8] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#E3EAF4] dark:hover:bg-[#14151A] border border-[#1A3A6B]/30 dark:border-[#B4B4B4] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" /><span>Drone Vision</span>
            </button>
            <button onClick={() => setCurrentView('ALERTS')}
              className="px-3 py-1.5 rounded-lg bg-[#B42318]/10 text-[#B42318] hover:bg-[#B42318]/20 border border-[#B42318]/20 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 dark:text-[#FFFFFF]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] dark:text-[#FFFFFF]" /><span>Broadcast Alerts</span>
            </button>
            <button onClick={() => setCurrentView('SHELTER_EVACUATION')}
              className="px-3 py-1.5 rounded-lg bg-[#126B34]/10 text-[#126B34] dark:text-[#D0D0D0] hover:bg-[#126B34]/20 border border-[#126B34]/20 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-[#126B34] dark:text-[#D0D0D0]" /><span>Safe Routes</span>
            </button>
            <button onClick={() => setCurrentView('EMERGENCY_RESOURCES')}
              className="px-3 py-1.5 rounded-lg bg-[#EEF2F8] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#E3EAF4] dark:hover:bg-[#14151A] border border-[#1A3A6B]/30 dark:border-[#B4B4B4] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" /><span>Fleet Logistics</span>
            </button>
          </div>
        </div>

        {/* COMMUNICATION TIER TELEMETRY STRIP */}
        <CommTierStrip />

        {/* SCENARIO SIMULATION CONTROLS */}
        <ScenarioPanel />

      </main>

      <footer className="bg-white dark:bg-[#1E3A5F] border-t border-[#E4E4E0] dark:border-[#B4B4B4] py-4 px-6 mt-8 text-center text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-data">
          <span>NEXORA Disaster Command â€¢ State Emergency Operations Centre (SEOC)</span>
          <span>Incident Command System ICS-2026 Protocol</span>
        </div>
      </footer>
    </div>
  );
};
