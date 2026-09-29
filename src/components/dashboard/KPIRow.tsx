import React from 'react';
import { AlertCircle, Home, Navigation, TrendingUp, AlertTriangle, Droplets, CloudRain, Wind, Thermometer, ShieldAlert, ChevronRight } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { getTranslation } from '../../i18n/translations';

export const KPIRow: React.FC = () => {
  const { 
    sosReports, 
    shelters, 
    teams, 
    overallRiskLevel, 
    rainfallMmPerHour, 
    windSpeedKmh, 
    temperatureC, 
    humidityPct, 
    alerts, 
    setCurrentView,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  // Active metrics
  const activeSOSCount = sosReports.filter(r => r.status === 'PENDING' || r.status === 'TRIAGED').length;
  const criticalSOSCount = sosReports.filter(r => (r.status === 'PENDING' || r.status === 'TRIAGED') && r.priorityLevel === 'CRITICAL').length;

  const activeShelters = shelters.length;
  const totalShelterCapacity = shelters.reduce((acc, s) => acc + s.totalCapacity, 0);
  const totalOccupancy = shelters.reduce((acc, s) => acc + s.currentOccupancy, 0);
  const availableBeds = totalShelterCapacity - totalOccupancy;
  const shelterOccupancyRate = Math.round((totalOccupancy / totalShelterCapacity) * 100);

  const deployedTeams = teams.filter(t => t.status === 'EN_ROUTE' || t.status === 'ON_SCENE').length;
  const totalTeams = teams.length;
  const activeAlertsCount = alerts.filter(a => a.active).length;

  return (
    <div className="space-y-4 mb-6 text-[#14151A] dark:text-[#FFFFFF]">
      
      {/* 1. DISASTER STATUS HERO BANNER & LIVE ENVIRONMENTAL TELEMETRY STRIP */}
      <div className="card-interactive bg-white border border-[#E4E4E0] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
        
        {/* Risk Badge & Situation Summary */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs bg-[#FCF1F0] text-[#B42318] border border-[#F3CFC9] dark:text-[#FFFFFF] dark:bg-[#3F1414] dark:border-[#7F1D1D]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
                NEXORA Disaster Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FCF1F0] text-[#B42318] border border-[#F3CFC9] dark:text-[#FFFFFF] dark:bg-[#3F1414] dark:border-[#7F1D1D]">
                Overall Risk: {overallRiskLevel}
              </span>
            </div>
            <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] mt-0.5 dark:text-[#FFFFFF]">
              Brahmaputra River Basin Flash Inundation Grid
            </h1>
          </div>
        </div>

        {/* Live Weather / River Telemetry Pills */}
        <div className="w-full xl:w-auto flex flex-wrap items-center gap-2 text-xs">
          
          {/* Water Level */}
          <div className="flex items-center gap-2 bg-[#EFEFEC] border border-[#DCDCD8] px-3 py-1.5 rounded-xl dark:bg-[#262626] dark:border-[#333333]">
            <Droplets className="w-4 h-4 text-[#12294D] dark:text-[#FFFFFF]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#5A5C66] block leading-tight dark:text-[#D0D0D0]">{t('water_level', 'Water Level')}</span>
              <span className="font-data font-bold text-[#12294D] dark:text-[#FFFFFF]">82 cm <span className="text-[10px] font-normal text-[#5A5C66] dark:text-[#D0D0D0]">({t('danger_label', 'Danger: 95cm')})</span></span>
            </div>
          </div>

          {/* Rainfall */}
          <div className="flex items-center gap-2 bg-[#EFEFEC] border border-[#DCDCD8] px-3 py-1.5 rounded-xl dark:bg-[#262626] dark:border-[#333333]">
            <CloudRain className="w-4 h-4 text-[#12294D] dark:text-[#FFFFFF]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#5A5C66] block leading-tight dark:text-[#D0D0D0]">{t('rainfall', 'Rainfall')}</span>
              <span className="font-data font-bold text-[#12294D] dark:text-[#FFFFFF]">{rainfallMmPerHour} mm/h</span>
            </div>
          </div>

          {/* Wind Speed */}
          <div className="flex items-center gap-2 bg-[#F8F8F7] border border-[#E4E4E0] px-3 py-1.5 rounded-xl dark:bg-[#262626] dark:border-[#3D3D3D]">
            <Wind className="w-4 h-4 text-[#5A5C66] dark:text-[#D0D0D0]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#5A5C66] block leading-tight dark:text-[#D0D0D0]">{t('wind_speed', 'Wind Speed')}</span>
              <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">{windSpeedKmh} km/h</span>
            </div>
          </div>

          {/* Temp & Humidity */}
          <div className="flex items-center gap-2 bg-[#FBF7EC] border border-[#F7E9D6] px-3 py-1.5 rounded-xl dark:bg-[#3A2A0A] dark:border-[#78350F]">
            <Thermometer className="w-4 h-4 text-[#8A4D06] dark:text-[#E0E0E0]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#5A5C66] block leading-tight dark:text-[#D0D0D0]">Temp / Hum</span>
              <span className="font-data font-bold text-[#7A3E0B] dark:text-[#E0E0E0]">{temperatureC}°C • {humidityPct}%</span>
            </div>
          </div>

          {/* Quick AI Risk Page Jump */}
          <button
            onClick={() => setCurrentView('AI_RISK')}
            className="flex items-center gap-1 btn-primary-gradient text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto xl:ml-2"
          >
            <span>AI Risk Breakdown</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>

      {/* 2. OPERATIONAL KPI 4-CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. ACTIVE SOS CARD */}
        <div 
          onClick={() => setCurrentView('DISASTER_MAP')}
          className="card-interactive p-4 sm:p-5 rounded-xl bg-white border border-[#E4E4E0] relative overflow-hidden group hover:border-[#F3CFC9] hover:shadow-xs transition-all cursor-pointer dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] flex items-center gap-1.5 dark:text-[#D0D0D0]">
                <span>{t('active_incidents', 'Active SOS Reports')}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-data text-3xl font-bold text-[#B42318] dark:text-[#FFFFFF]">
                  {activeSOSCount}
                </span>
                <span className="text-xs font-bold text-[#B42318] bg-[#FCF1F0] px-2 py-0.5 rounded-full border border-[#F3CFC9] dark:text-[#FFFFFF] dark:bg-[#3F1414] dark:border-[#7F1D1D]">
                  {criticalSOSCount} {t('critical', 'Critical')}
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#FCF1F0] text-[#B42318] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform dark:text-[#FFFFFF] dark:bg-[#3F1414]">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E4E4E0] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
            <span className="flex items-center gap-1 text-[#B42318] font-medium dark:text-[#FFFFFF]">
              <TrendingUp className="w-3.5 h-3.5" />
              +3 in last 15 mins
            </span>
            <span className="text-[#12294D] font-semibold flex items-center gap-0.5 dark:text-[#FFFFFF]">
              Triage on Map <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 2. ACTIVE ALERTS & WARNINGS */}
        <div 
          onClick={() => setCurrentView('ALERTS')}
          className="card-interactive p-4 sm:p-5 rounded-xl bg-white border border-[#E4E4E0] relative overflow-hidden group hover:border-[#F7E9D6] hover:shadow-xs transition-all cursor-pointer dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] flex items-center gap-1.5 dark:text-[#D0D0D0]">
                <span>{t('alerts_active_title', 'Active Warnings')}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-data text-3xl font-bold text-[#8A4D06] dark:text-[#E0E0E0]">
                  {activeAlertsCount}
                </span>
                <span className="text-xs font-bold text-[#7A3E0B] bg-[#FBF7EC] px-2 py-0.5 rounded-full border border-[#F7E9D6] dark:text-[#E0E0E0] dark:bg-[#3A2A0A] dark:border-[#78350F]">
                  CAP Multi-Channel
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#FBF7EC] text-[#8A4D06] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform dark:text-[#E0E0E0] dark:bg-[#3A2A0A]">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E4E4E0] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
            <span className="text-[#7A3E0B] font-medium dark:text-[#E0E0E0]">Cell Broadcast Active</span>
            <span className="text-[#12294D] font-semibold flex items-center gap-0.5 dark:text-[#FFFFFF]">
              Open Alerts <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 3. SHELTERS & AVAILABLE CAPACITY */}
        <div 
          onClick={() => setCurrentView('SHELTER_EVACUATION')}
          className="card-interactive p-4 sm:p-5 rounded-xl bg-white border border-[#E4E4E0] relative overflow-hidden group hover:border-[#CFE6D8] hover:shadow-xs transition-all cursor-pointer dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] flex items-center gap-1.5 dark:text-[#D0D0D0]">
                <span>{t('citizen_find_shelter', 'Safe Shelters')}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-data text-3xl font-bold text-[#126B34] dark:text-[#D0D0D0]">
                  {activeShelters}
                </span>
                <span className="text-xs font-bold text-[#126B34] bg-[#F1F8F3] px-2 py-0.5 rounded-full border border-[#CFE6D8] dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:border-[#14532D]">
                  {availableBeds} {t('citizen_free_beds', 'beds free')}
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#F1F8F3] text-[#126B34] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform dark:text-[#D0D0D0] dark:bg-[#0A2E22]">
              <Home className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E4E4E0] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
            <span className="font-data text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">
              {shelterOccupancyRate}% Occupied
            </span>
            <span className="text-[#12294D] font-semibold flex items-center gap-0.5 dark:text-[#FFFFFF]">
              Safe Routes <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 4. EMERGENCY TEAMS & LOGISTICS */}
        <div 
          onClick={() => setCurrentView('EMERGENCY_RESOURCES')}
          className="card-interactive p-4 sm:p-5 rounded-xl bg-white border border-[#E4E4E0] relative overflow-hidden group hover:border-[#DCDCD8] hover:shadow-xs transition-all cursor-pointer dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] flex items-center gap-1.5 dark:text-[#D0D0D0]">
                <span>{t('resources_title', 'Rescue Logistics')}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-data text-3xl font-bold text-[#12294D] dark:text-[#FFFFFF]">
                  {deployedTeams} <span className="text-lg text-[#5A5C66] font-normal dark:text-[#D0D0D0]">/ {totalTeams}</span>
                </span>
                <span className="text-xs font-bold text-[#12294D] bg-[#EFEFEC] px-2 py-0.5 rounded-full border border-[#DCDCD8] dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]">
                  8 Ambulances, 5 Boats
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#EFEFEC] text-[#12294D] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform dark:text-[#FFFFFF] dark:bg-[#262626]">
              <Navigation className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E4E4E0] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
            <span className="text-[#5A5C66] font-medium dark:text-[#D0D0D0]">Avg ETA: 12m</span>
            <span className="text-[#12294D] font-semibold flex items-center gap-0.5 dark:text-[#FFFFFF]">
              Allocate Fleet <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
