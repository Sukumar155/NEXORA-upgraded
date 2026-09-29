import React from 'react';
import {
  Shield, Smartphone, Home, Droplets, CloudRain, Wind,
  ArrowRight, AlertTriangle, Compass, ChevronRight,
} from 'lucide-react';
import { TopBar } from '../components/dashboard/TopBar';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

export const DashboardPage: React.FC = () => {
  const {
    currentLanguage,
    overallRiskLevel,
    rainfallMmPerHour,
    riverLevelMeters,
    dangerMarkMeters,
    windSpeedKmh,
    sosReports,
    shelters,
    teams,
    isOffline,
    commTier,
    setCurrentView
  } = useNexoraStore();

  const t = (key: string, fallback?: string) => getTranslation(currentLanguage, key, fallback);

  const activeSOS = sosReports.filter(r => r.status === 'PENDING' || r.status === 'TRIAGED').length;
  const criticalSOS = sosReports.filter(r => r.priorityLevel === 'CRITICAL' && r.status !== 'RESCUED').length;
  const totalShelterBeds = shelters.reduce((acc, s) => acc + s.totalCapacity, 0);
  const totalOccupiedBeds = shelters.reduce((acc, s) => acc + s.currentOccupancy, 0);
  const occupancyPct = Math.round((totalOccupiedBeds / totalShelterBeds) * 100);
  const freeBeds = totalShelterBeds - totalOccupiedBeds;
  const availableTeams = teams.filter(t => t.status === 'AVAILABLE' || t.status === 'STANDBY').length;
  const isCritical = overallRiskLevel === 'CRITICAL';

  // 3 Authority Role Tiles strictly on Dashboard landing
  const roleCards = [
    {
      id: 'DDMO_AUTHORITY',
      title: t('role_ddmo_title', 'DDMO Authority'),
      desc: t('role_ddmo_desc', 'Command, intelligence and disaster monitoring'),
      icon: Shield,
      iconColor: 'text-[#14151A]',
      iconBg: 'bg-[#EEF2F8] border-[#1A3A6B]/40',
      badge: isCritical ? t('critical', 'CRITICAL') : `${overallRiskLevel} ${t('overall_risk', 'RISK')}`,
      badgeColor: isCritical ? 'bg-[#B42318]/10 text-[#B42318] border-[#B42318]/30' : 'bg-[#EEF2F8] text-[#14151A] border-[#1A3A6B]/40',
      metricLabel: t('role_ddmo_metric', 'Active Command Monitoring'),
      metricValue: `${activeSOS} ${t('active_incidents', 'Active Incidents')} (${criticalSOS} ${t('critical', 'Critical')})`,
      actionText: t('role_ddmo_action', 'Open Command Center'),
      targetView: 'DDMO_AUTHORITY' as const,
      accentBorder: 'hover:border-[#1A3A6B] hover:shadow-md',
      btnHover: 'group-hover:bg-[#1A3A6B] group-hover:text-white group-hover:border-[#1A3A6B]'
    },
    {
      id: 'FIELD_RESPONDER',
      title: t('role_responder_title', 'Field Responder'),
      desc: t('role_responder_desc', 'Mobile-first emergency field operations'),
      icon: Smartphone,
      iconColor: 'text-[#1A3A6B]',
      iconBg: 'bg-[#EEF2F8] border-[#1A3A6B]/30',
      badge: isOffline ? 'OFFLINE MESH' : 'MOBILE FIRST',
      badgeColor: isOffline ? 'bg-[#A15C07]/10 text-[#A15C07] border-[#A15C07]/30' : 'bg-[#EEF2F8] text-[#1A3A6B] border-[#1A3A6B]/30',
      metricLabel: t('role_responder_metric', 'Field Mobile Mode'),
      metricValue: `${availableTeams} Ready Columns â€¢ ${teams[0]?.name.split('â€”')[0]}`,
      actionText: t('role_responder_action', 'Open Responder'),
      targetView: 'FIELD_RESPONDER' as const,
      accentBorder: 'hover:border-[#1A3A6B] hover:shadow-md',
      btnHover: 'group-hover:bg-[#1A3A6B] group-hover:text-white group-hover:border-[#1A3A6B]'
    },
    {
      id: 'SHELTER_MANAGER',
      title: t('role_shelter_title', 'Shelter Manager'),
      desc: t('role_shelter_desc', 'Shelter capacity, intake and resource management'),
      icon: Home,
      iconColor: 'text-[#A15C07]',
      iconBg: 'bg-[#A15C07]/10 border-[#A15C07]/30',
      badge: `${occupancyPct}% CAPACITY`,
      badgeColor: occupancyPct > 80 ? 'bg-[#B42318]/10 text-[#B42318] border-[#B42318]/30' : 'bg-[#A15C07]/10 text-[#A15C07] border-[#A15C07]/30',
      metricLabel: t('role_shelter_metric', 'Camp Logistics Mode'),
      metricValue: `${totalOccupiedBeds} ${t('shelter_occupied', 'Occupied')} / ${totalShelterBeds} Total`,
      actionText: t('role_shelter_action', 'Open Shelter Manager'),
      targetView: 'SHELTER_MANAGER' as const,
      accentBorder: 'hover:border-[#A15C07] hover:shadow-md',
      btnHover: 'group-hover:bg-[#A15C07] group-hover:text-white group-hover:border-[#A15C07]'
    }
  ];

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body transition-colors">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* EXECUTIVE DISASTER COMMAND HEADER BANNER */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 px-5 py-5 sm:px-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 h-5 px-2 bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-sm font-data text-[10px] font-medium text-[#5A5C66] dark:text-[#D0D0D0] mb-2.5">
              {isOffline ? 'LoRa Mesh Mode' : `Tier 1 Cellular Â· ${commTier}`}
            </span>

            <h1 className="font-heading text-[22px] sm:text-[26px] font-semibold text-[#14151A] dark:text-[#FFFFFF] tracking-[-0.025em] leading-[1.2]">
              {t('overview_title', 'NEXORA Disaster Command Overview')}
            </h1>
            <p className="text-[13px] sm:text-sm text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed mt-1.5">
              {t('overview_subtitle', 'Real-time multi-agency flood resilience and emergency response coordination')}
            </p>
          </div>

          {/* Live telemetry â€” borderless metric columns divided by hairlines,
              so the header reads as one instrument panel rather than three
              nested boxes. */}
          <div className="flex items-stretch divide-x divide-[#E4E4E0] dark:divide-[#B4B4B4] w-full lg:w-auto shrink-0">
            {[
              { icon: Droplets, label: t('water_level', 'River Stage'), value: '82 cm', suffix: '/ 95cm max' },
              { icon: CloudRain, label: t('rainfall', 'Precipitation'), value: `${rainfallMmPerHour} mm/h`, suffix: 'last hour' },
              { icon: Wind, label: t('wind_speed', 'Wind Velocity'), value: `${windSpeedKmh} km/h`, suffix: 'sustained' },
            ].map(({ icon: Icon, label, value, suffix }, i) => (
              <div key={label} className={`flex items-center gap-2.5 px-4 sm:px-5 ${i === 0 ? 'pl-0 lg:pl-5' : ''}`}>
                <Icon className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0] shrink-0" strokeWidth={1.9} />
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#5A5C66] dark:text-[#E0E0E0] leading-tight">
                    {label}
                  </span>
                  <span className="block font-data text-[15px] font-semibold text-[#14151A] dark:text-[#FFFFFF] leading-tight mt-1">
                    {value}
                  </span>
                  <span className="block text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] leading-tight mt-0.5">
                    {suffix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: THE 3 AUTHORITY ROLE CARDS STRICTLY ON DASHBOARD */}
        <div>
          <div className="mb-3.5">
            <h2 className="font-heading text-[17px] font-semibold text-[#14151A] dark:text-[#FFFFFF] tracking-[-0.015em]">
              {t('role_section_title', 'Operational Role Portals')}
            </h2>
            <p className="text-[13px] text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
              {t('role_section_desc', 'Select an operational role to enter its dedicated workspace')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {roleCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  data-role={card.id}
                  onClick={() => setCurrentView(card.targetView)}
                  className={`card-interactive bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 cursor-pointer flex flex-col justify-between group ${card.accentBorder}`}
                >
                  <div className="space-y-3">
                    {/* Header: Icon & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${card.iconBg}`}>
                        <Icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-data border ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-heading font-semibold text-[15px] text-[#14151A] dark:text-[#FFFFFF] group-hover:text-[#1A3A6B] dark:group-hover:text-[#9DB8DC] transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1 line-clamp-2 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                  </div>

                  {/* Status / Metric preview & Action Button */}
                  <div className="mt-4 pt-4 border-t border-[#E4E4E0] dark:border-[#B4B4B4] space-y-3">
                    <div className="bg-[#F1F1EF] dark:bg-[#171717] px-3 py-2 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                      <span className="text-[10px] font-semibold text-[#5A5C66] dark:text-[#E0E0E0] uppercase tracking-wider block font-data">
                        {card.metricLabel}
                      </span>
                      <span className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF] block truncate mt-0.5">
                        {card.metricValue}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-role-btn={card.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentView(card.targetView);
                      }}
                      className={`w-full h-8 px-3.5 rounded-lg bg-[#F1F1EF] dark:bg-[#171717] ${card.btnHover} text-[#14151A] dark:text-[#FFFFFF] border border-[#E4E4E0] dark:border-[#B4B4B4] text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer`}
                    >
                      <span>{card.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0] group-hover:translate-x-1 group-hover:text-current transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SUMMARY EMERGENCY SNAPSHOT: ACTIVE INCIDENTS & MAP PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left: Quick Incidents & Triage Summary */}
          <div className="lg:col-span-6 bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E0] dark:border-[#B4B4B4]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B42318] dark:text-[#FFFFFF]" />
                <h3 className="font-heading font-semibold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                  {t('dash_triage_title', 'Immediate Emergency Triage Summary')}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('DDMO_AUTHORITY')}
                className="text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t('dash_triage_full', 'Full Triage Queue')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#E0E0E0]" />
              </button>
            </div>

            <div className="space-y-2.5">
              {sosReports.slice(0, 3).map((sos) => {
                const isCrit = sos.priorityLevel === 'CRITICAL';
                return (
                  <div
                    key={sos.id}
                    onClick={() => setCurrentView('DDMO_AUTHORITY')}
                    className="p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] bg-[#F1F1EF] dark:bg-[#171717] hover:bg-[#EEF2F8] hover:dark:bg-[#B4B4B4] transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">{sos.id}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-data ${
                          isCrit ? 'bg-[#B42318]/10 text-[#B42318] border border-[#B42318]/30' : 'bg-[#A15C07]/10 text-[#A15C07] border border-[#A15C07]/30'
                        } dark:text-[#FFFFFF] dark:text-[#E0E0E0] `}>
                          {sos.priorityLevel}
                        </span>
                        <span className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                          {sos.peopleCount} {t('responder_trapped_count', 'trapped')}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF] truncate mt-1">
                        {sos.locationName}
                      </div>
                    </div>

                    <span className="text-xs font-data font-bold text-[#14151A] dark:text-[#FFFFFF] px-2 py-1 bg-white dark:bg-[#ECECEC] rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4]">
                      {sos.priorityScore} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Evacuation & Relief Status Summary */}
          <div className="lg:col-span-6 bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E0] dark:border-[#B4B4B4]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                <h3 className="font-heading font-semibold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                  {t('dash_gis_title', 'GIS Threat Map & Evacuation Hub')}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('DISASTER_MAP')}
                className="text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t('dash_gis_open', 'Open GIS Threat Map')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#E0E0E0]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-data text-xs">
              <div className="p-3 bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl">
                <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block font-sans">Active Safe Corridors</span>
                <span className="font-bold text-base text-[#126B34] dark:text-[#D0D0D0] block mt-0.5">2 Corridors Open</span>
                <span className="text-[11px] text-[#5A5C66] dark:text-[#E0E0E0] mt-1 block">Avoiding AT Road inundation</span>
              </div>

              <div className="p-3 bg-[#F1F1EF] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl">
                <span className="text-[#5A5C66] dark:text-[#D0D0D0] text-[10px] block font-sans">{t('citizen_free_beds', 'Shelter Free Beds')}</span>
                <span className="font-bold text-base text-[#14151A] dark:text-[#FFFFFF] block mt-0.5">{freeBeds} Beds Available</span>
                <span className="text-[11px] text-[#5A5C66] dark:text-[#E0E0E0] mt-1 block">Across {shelters.length} relief camps</span>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('DISASTER_MAP')}
              className="w-full h-9 px-4 btn-primary-gradient text-white text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-white" />
              <span>{t('dash_gis_open', 'Launch Interactive Multi-Layer GIS Threat Map')}</span>
            </button>
          </div>

        </div>

      </main>

      <footer className="bg-white dark:bg-[#1E3A5F] border-t border-[#E4E4E0] dark:border-[#B4B4B4] py-4 px-6 mt-12 text-center text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-data">
          <span>NEXORA â€” Monsoon Resilience Disaster Intelligence Framework</span>
          <span>Guwahati River Basin SEOC â€¢ Incident Command System ICS-2026</span>
        </div>
      </footer>
    </div>
  );
};
