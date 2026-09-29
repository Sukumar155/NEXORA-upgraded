import React from 'react';
import {
  Shield, Bell, MapPin, Radio, LogOut, ChevronDown,
  Home, Compass, AlertTriangle, BarChart3, Navigation, RefreshCw, Send, Globe,
  Sun, Moon, Monitor, CloudSun, ScanSearch
} from 'lucide-react';
import { useNexoraStore, AppView } from '../../store/useNexoraStore';
import { AuthoritySwitcher } from '../shared/AuthoritySwitcher';
import { LANGUAGE_OPTIONS, getTranslation } from '../../i18n/translations';

/**
 * TopBar â€” application chrome.
 *
 * Two rows, both on white with a single hairline between them:
 *   1. Utility row â€” brand, sector, language, theme  Â·  status, actions, account
 *   2. Navigation  â€” six primary destinations with a bottom-anchored indicator
 *
 * The active destination is marked with a 2px cobalt rule rather than a filled
 * pill, which keeps the bar quiet and lets the data below carry the emphasis.
 */

export const TopBar: React.FC = () => {
  const {
    userName,
    district,
    setDistrict,
    notificationCount,
    logout,
    commTier,
    isOffline,
    toggleOfflineMode,
    syncQueuedUpdates,
    queuedSyncCount,
    currentView,
    setCurrentView,
    toggleIncidentModal,
    toggleUSSDModal,
    userRole,
    currentLanguage,
    setLanguage,
    theme,
    setTheme,
    mapDataStatus
  } = useNexoraStore();

  // Citizens stay entirely inside the Citizen Portal UI â€” no authority nav/switcher.
  const isCitizen = userRole === 'CITIZEN';

  const districtList = [
    "Chennai Coastal Metropolitan Area",
    "Cuddalore Coastal Delta",
    "Kochi Backwaters Sector",
    "Chennai Perumbakkam / Mangadu"
  ];

  const t = (key: string, fallback?: string) => getTranslation(currentLanguage, key, fallback);

  // 8 Primary Navigation Items (role portals live strictly in Dashboard)
  const navItems: { view: AppView; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; badge?: string }[] = [
    { view: 'COMMAND_DASHBOARD', label: t('nav_dashboard', 'Dashboard'), icon: Home },
    { view: 'DISASTER_MAP', label: t('nav_disaster_map', 'Disaster Map'), icon: Compass },
    { view: 'ALERTS', label: t('nav_alerts', 'Alerts'), icon: AlertTriangle, badge: '3' },
    { view: 'SHELTER_EVACUATION', label: t('nav_shelters', 'Shelters & Evac'), icon: Home },
    { view: 'EMERGENCY_RESOURCES', label: t('nav_resources', 'Resources'), icon: Navigation },
    { view: 'ANALYTICS', label: t('nav_analytics', 'Analytics'), icon: BarChart3 },
    { view: 'SENSORS', label: t('nav_sensors', 'Sensors'), icon: Radio },
    { view: 'WEATHER', label: t('nav_weather', 'Weather'), icon: CloudSun },
    // "Predict" is the YOLO vision tool on its own â€” a single-purpose view,
    // deliberately not the whole citizen portal.
    { view: 'YOLO_PREDICT', label: t('nav_predict', 'Predict'), icon: ScanSearch }
  ];

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-30 bg-white font-body dark:bg-[#2F2F2F]">

      {/* â”€â”€ 1. UTILITY ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="border-b border-[#EDEDEA] dark:border-[#3D3D3D]">
        <div className="nx-container h-14 flex items-center justify-between gap-3">

          {/* Brand Â· sector Â· language Â· theme */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setCurrentView('COMMAND_DASHBOARD')}
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
              aria-label="NEXORA â€” go to dashboard"
            >
              <span className="w-8 h-8 rounded-lg bg-[#1A3A6B] flex items-center justify-center transition-colors dark:bg-[#2563EB] group-hover:bg-[#142C52]">
                <Shield className="w-[17px] h-[17px] text-white" strokeWidth={2.1} />
              </span>
              <span className="hidden sm:block text-left leading-none">
                <span className="block font-heading text-[15px] font-semibold tracking-[-0.02em] text-[#14151A] dark:text-[#FFFFFF]">NEXORA AI</span>
                <span className="block font-data text-[9px] font-medium tracking-[0.14em] uppercase text-[#6B6D77] mt-[3px] dark:text-[#D0D0D0]">
                  Disaster Intelligence
                </span>
              </span>
            </button>

            <span className="hidden md:block h-5 w-px bg-[#E4E4E0] dark:bg-[#3D3D3D]" />

            {/* Sector selector */}
            <div className="relative hidden sm:flex items-center">
              <MapPin className="w-3.5 h-3.5 text-[#6B6D77] dark:text-[#D0D0D0] absolute left-2.5 pointer-events-none" />
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="pl-8 pr-7 h-8 bg-[#F1F1EF] border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D] rounded-md text-[12px] font-medium text-[#2E3038] hover:bg-[#EFEFEC] dark:text-[#E0E0E0] dark:hover:bg-[#2F2F2F] focus:outline-none focus:border-[#1A3A6B] focus:ring-0 cursor-pointer appearance-none transition-colors max-w-[190px] truncate"
                title={t('location', 'Current Location')}
                aria-label="Location Selector"
              >
                {districtList.map(d => (
                  <option key={d} value={d} className="bg-white text-[#14151A] dark:bg-[#2F2F2F] dark:text-[#FFFFFF]">{d}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#6B6D77] dark:text-[#D0D0D0] absolute right-2 pointer-events-none" />
            </div>

            {/* Language selector â€” 6 supported languages */}
            <div className="relative hidden sm:flex items-center">
              <Globe className="w-3.5 h-3.5 text-[#6B6D77] dark:text-[#D0D0D0] absolute left-2 pointer-events-none" />
              <select
                value={currentLanguage}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="pl-7 pr-6 h-8 bg-[#F1F1EF] border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D] rounded-md text-[12px] font-medium text-[#2E3038] hover:bg-[#EFEFEC] dark:text-[#E0E0E0] dark:hover:bg-[#2F2F2F] focus:outline-none focus:border-[#1A3A6B] focus:ring-0 cursor-pointer appearance-none transition-colors"
                aria-label="Language Selector"
              >
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white text-[#14151A] dark:bg-[#2F2F2F] dark:text-[#FFFFFF]">
                    {lang.nativeLabel}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#6B6D77] dark:text-[#D0D0D0] absolute right-2 pointer-events-none" />
            </div>

            {/* Theme selector */}
            <div className="relative hidden sm:flex items-center">
              <ThemeIcon className="w-3.5 h-3.5 text-[#6B6D77] dark:text-[#D0D0D0] absolute left-2 pointer-events-none" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="pl-7 pr-6 h-8 bg-[#F1F1EF] border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D] rounded-md text-[12px] font-medium text-[#2E3038] hover:bg-[#EFEFEC] dark:text-[#E0E0E0] dark:hover:bg-[#2F2F2F] focus:outline-none focus:border-[#1A3A6B] focus:ring-0 cursor-pointer appearance-none transition-colors"
                aria-label="Theme Selector"
                title="Theme: Light, Dark, or System"
              >
                <option value="system" className="bg-white text-[#14151A] dark:bg-[#2F2F2F] dark:text-[#FFFFFF]">{t('theme_system', 'System')}</option>
                <option value="light" className="bg-white text-[#14151A] dark:bg-[#2F2F2F] dark:text-[#FFFFFF]">{t('theme_light', 'Light')}</option>
                <option value="dark" className="bg-white text-[#14151A] dark:bg-[#2F2F2F] dark:text-[#FFFFFF]">{t('theme_dark', 'Dark')}</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#6B6D77] dark:text-[#D0D0D0] absolute right-2 pointer-events-none" />
            </div>
          </div>

          {/* Status Â· actions Â· account */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Network / sync status â€” a quiet instrument readout */}
            <div className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 bg-[#F1F1EF] border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D] rounded-md">
              <button
                data-testid="topbar-offline-toggle"
                onClick={toggleOfflineMode}
                title="Click to toggle Network Simulation"
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <span className={`w-[6px] h-[6px] rounded-full ${
                  isOffline || mapDataStatus === 'OFFLINE'
                    ? 'bg-[#B54708]'
                    : mapDataStatus === 'SYNCING'
                    ? 'bg-[#1A3A6B] animate-spin rounded-[2px]'
                    : 'bg-[#126B34]'
                }`} />
                <span className="font-data text-[11px] font-medium text-[#5A5C66] dark:text-[#D0D0D0] whitespace-nowrap">
                  {isOffline || mapDataStatus === 'OFFLINE'
                    ? t('offline', 'OFFLINE')
                    : mapDataStatus === 'SYNCING'
                    ? t('data_syncing', 'SYNCING...')
                    : `${t('online', 'Online')} Â· ${commTier}`}
                </span>
              </button>

              {queuedSyncCount > 0 && (
                <button
                  onClick={syncQueuedUpdates}
                  title="Sync queued changes"
                  className="flex items-center gap-1 h-6 px-1.5 bg-[#EEF2F8] text-[#1A3A6B] border border-[#C3D0E4] dark:bg-[#1F2937] dark:text-[#D0D0D0] dark:border-[#374151] rounded-sm font-data text-[10px] font-semibold hover:bg-[#E3EAF4] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${mapDataStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
                  <span>{queuedSyncCount}</span>
                </button>
              )}
            </div>

            {/* Report incident â€” authority only; citizens report from inside their portal */}
            {!isCitizen && (
              <button
                onClick={() => toggleIncidentModal(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#B42318] hover:bg-[#9A1C13] text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span className="hidden sm:inline">{t('report_incident', 'Report Incident')}</span>
              </button>
            )}

            {/* USSD (*123#) compact utility */}
            <button
              onClick={() => toggleUSSDModal(true)}
              className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium bg-white text-[#2E3038] dark:text-[#E0E0E0] hover:bg-[#F1F1EF] border border-[#E4E4E0] dark:bg-[#262626] dark:border-[#3D3D3D] transition-colors cursor-pointer"
              title="Simulate 2G USSD (*123#) Flow"
            >
              <Radio className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
              <span className="font-data text-[11px] font-medium">*123#</span>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setCurrentView('ALERTS')}
                className="w-8 h-8 rounded-md border border-[#E4E4E0] bg-white hover:bg-[#F1F1EF] dark:border-[#3D3D3D] dark:bg-[#2F2F2F] dark:hover:bg-[#3D3D3D] flex items-center justify-center text-[#2E3038] dark:text-[#E0E0E0] relative cursor-pointer transition-colors"
                aria-label={`Notifications, ${notificationCount} unread`}
              >
                <Bell className="w-[15px] h-[15px]" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#B42318] text-white text-[9px] font-semibold font-data flex items-center justify-center border-2 border-white">
                    {notificationCount}
                  </span>
                )}
              </button>
            </div>

            {/* Account */}
            <div className="flex items-center gap-2 pl-2.5 border-l border-[#E4E4E0] dark:border-l-[#3D3D3D]">
              <div className="w-7 h-7 rounded-md bg-[#EEF2F8] text-[#1A3A6B] border border-[#C3D0E4] dark:bg-[#1F2937] dark:text-[#D0D0D0] dark:border-[#374151] font-semibold text-[11px] flex items-center justify-center">
                {userName.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="hidden xl:block text-left leading-none">
                <div className="text-[12px] font-medium text-[#14151A] dark:text-[#FFFFFF]">{userName}</div>
                <div className="text-[10px] font-medium text-[#6B6D77] mt-1 tracking tracking-[-0.02em] dark:text-[#D0D0D0]">
                  {userRole.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={logout}
                title={t('logout', 'Sign Out')}
                aria-label={t('logout', 'Sign Out')}
                className="w-7 h-7 flex items-center justify-center text-[#6B6D77] hover:text-[#B42318] dark:text-[#D0D0D0] hover:bg-[#FCF1F0] dark:hover:bg-[#3F1414] rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-[15px] h-[15px]" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* â”€â”€ 2. NAVIGATION â€” authority only; citizens stay in the Citizen Portal UI â”€â”€ */}
      {!isCitizen && (
        <nav aria-label="Main Navigation" className="border-b border-[#E4E4E0] bg-white dark:border-[#3D3D3D] dark:bg-[#2F2F2F]">
          <div className="nx-container flex items-center justify-between overflow-x-auto scrollbar-none h-11 gap-1">

            <div className="flex items-center h-full">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.view || (item.view === 'COMMAND_DASHBOARD' && currentView === 'DDMO_AUTHORITY');
                return (
                  <button
                    key={item.view}
                    data-nav-view={item.view}
                    onClick={() => setCurrentView(item.view)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex items-center gap-1.5 h-full px-3 text-[13px] whitespace-nowrap cursor-pointer transition-colors ${
                      isActive
                        ? 'text-[#1A3A6B] dark:text-[#D0D0D0] font-semibold after:absolute after:left-2.5 after:right-2.5 after:bottom-0 after:h-[2px] after:bg-[#1A3A6B] dark:after:bg-[#60A5FA] after:rounded-full'
                        : 'text-[#5A5C66] font-medium hover:text-[#14151A] dark:text-[#D0D0D0] dark:hover:text-[#FFFFFF] hover:bg-[#F8F8F7] dark:hover:bg-[#262626]'
                    }`}
                  >
                    <Icon className="w-[15px] h-[15px]" strokeWidth={isActive ? 2.1 : 1.9} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`font-data text-[9px] font-semibold px-1.5 py-0.5 rounded-sm ${
                        isActive
                          ? 'bg-[#EEF2F8] dark:bg-[#1F2937] text-[#1A3A6B] dark:text-[#D0D0D0]'
                          : 'bg-[#F1F1EF] dark:bg-[#262626] text-[#5A5C66] dark:text-[#D0D0D0]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Authority workspace switcher â€” DDMO / Field Responder / Shelter Manager */}
            <AuthoritySwitcher className="hidden xl:flex" />

          </div>
        </nav>
      )}

    </header>
  );
};
