import React, { Suspense } from 'react';
import { useNexoraStore, type AppView } from './store/useNexoraStore';
import { LoginPage } from './pages/Login';
import { liveMapService } from './services/liveMapService';
import { useWeatherFeed } from './hooks/useWeatherFeed';
import { MonitoringBackground } from './components/shared/MonitoringBackground';

// Principle #7: React.lazy code splitting — heavy pages load on-demand
const DashboardPage = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.DashboardPage })));
const DisasterMapPage = React.lazy(() => import('./pages/DisasterMapPage').then(m => ({ default: m.DisasterMapPage })));
const AIRiskPage = React.lazy(() => import('./pages/AIRiskPage').then(m => ({ default: m.AIRiskPage })));
const SensorsPage = React.lazy(() => import('./pages/SensorsPage').then(m => ({ default: m.SensorsPage })));
const WeatherPage = React.lazy(() => import('./pages/WeatherPage').then(m => ({ default: m.WeatherPage })));
const AlertsPage = React.lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const EvacuationPage = React.lazy(() => import('./pages/EvacuationPage').then(m => ({ default: m.EvacuationPage })));
const ResourcesPage = React.lazy(() => import('./pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const DamageDetectionPage = React.lazy(() => import('./pages/DamageDetectionPage').then(m => ({ default: m.DamageDetectionPage })));
const CitizenPortalPage = React.lazy(() => import('./pages/CitizenPortalPage').then(m => ({ default: m.CitizenPortalPage })));
const PredictPage = React.lazy(() => import('./pages/PredictPage').then(m => ({ default: m.PredictPage })));
const CitizenMapPage = React.lazy(() => import('./pages/CitizenMapPage').then(m => ({ default: m.CitizenMapPage })));
const CitizenShelterPage = React.lazy(() => import('./pages/CitizenShelterPage').then(m => ({ default: m.CitizenShelterPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const MissionPage = React.lazy(() => import('./pages/Mission').then(m => ({ default: m.MissionPage })));
const ShelterPage = React.lazy(() => import('./pages/Shelter').then(m => ({ default: m.ShelterPage })));
const DDMOAuthorityPage = React.lazy(() => import('./pages/DDMOAuthorityPage').then(m => ({ default: m.DDMOAuthorityPage })));

// Global modals & tools — lazy loaded
const SOSDetailDrawer = React.lazy(() => import('./components/response/SOSDetailDrawer').then(m => ({ default: m.SOSDetailDrawer })));
const ResponsePlanReview = React.lazy(() => import('./components/response/ResponsePlanReview').then(m => ({ default: m.ResponsePlanReview })));
const USSDSimulator = React.lazy(() => import('./components/auth/USSDSimulator').then(m => ({ default: m.USSDSimulator })));
const IncidentReportModal = React.lazy(() => import('./components/incident/IncidentReportModal').then(m => ({ default: m.IncidentReportModal })));
const NexoraChatbot = React.lazy(() => import('./components/chat/NexoraChatbot').then(m => ({ default: m.NexoraChatbot })));

/** Skeleton fallback while lazy chunks load (Principle #4) */
const PageSkeleton = () => (
  <div className="min-h-screen bg-[#F8F8F7] flex flex-col dark:bg-[#262626]">
    {/* Top bar skeleton */}
    <div className="h-16 bg-white border-b border-[#DEDEDA] sticky top-0 z-30 dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
      <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center gap-4">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="skeleton w-28 h-5 rounded" />
        <div className="flex-1" />
        <div className="skeleton w-24 h-8 rounded-xl" />
        <div className="skeleton w-9 h-9 rounded-xl" />
      </div>
    </div>
    {/* Nav tabs skeleton */}
    <div className="h-10 bg-[#F1F1EF] border-b border-[#DEDEDA] px-6 dark:bg-[#262626] dark:border-[#3D3D3D]">
      <div className="max-w-[1600px] mx-auto flex items-center gap-2 h-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton w-20 h-6 rounded-lg" />
        ))}
      </div>
    </div>
    {/* Content skeleton */}
    <div className="flex-1 max-w-[1600px] w-full mx-auto p-6 space-y-6">
      <div className="skeleton w-full h-28 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-xl" />
        ))}
      </div>
      <div className="skeleton w-full h-80 rounded-xl" />
    </div>
  </div>
);

export function App() {
  const { currentView, isAuthenticated, theme, userRole } = useNexoraStore();

  // Apply Light / Dark / System Theme
  React.useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        theme === 'dark' || 
        (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    };

    applyTheme();

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        if (theme === 'system') applyTheme();
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Start real-time telemetry service heartbeat
  React.useEffect(() => {
    liveMapService.startTelemetryHeartbeat();
    return () => liveMapService.stopTelemetryHeartbeat();
  }, []);

  // Keep the Open-Meteo snapshot fresh app-wide, so the Weather page and the
  // Citizen Portal strip both render a warm reading on first paint.
  useWeatherFeed();

  // Route view rendering based on active tab or role
  const renderCurrentView = () => {
    if (!isAuthenticated || currentView === 'LOGIN') {
      return <LoginPage />;
    }

    // Citizens stay inside the Citizen Portal UI and never reach authority
    // views. The CITIZEN_* views are the sanctioned exceptions: the map renders
    // with `audience="public"` (no SOS beacons) and the shelter finder is a
    // citizen-scoped read-only view.
    const CITIZEN_VIEWS: AppView[] = ['CITIZEN_PORTAL', 'CITIZEN_MAP', 'CITIZEN_SHELTERS'];
    if (userRole === 'CITIZEN' && !CITIZEN_VIEWS.includes(currentView)) {
      return <CitizenPortalPage />;
    }

    switch (currentView) {
      case 'DISASTER_MAP':
        return <DisasterMapPage />;
      case 'AI_RISK':
        return <AIRiskPage />;
      case 'SENSORS':
        return <SensorsPage />;
      case 'WEATHER':
        return <WeatherPage />;
      case 'ALERTS':
        return <AlertsPage />;
      case 'SHELTER_EVACUATION':
        return <EvacuationPage />;
      case 'EMERGENCY_RESOURCES':
        return <ResourcesPage />;
      case 'DAMAGE_DETECTION':
        return <DamageDetectionPage />;
      case 'CITIZEN_PORTAL':
        return <CitizenPortalPage />;
      case 'YOLO_PREDICT':
        return <PredictPage />;
      case 'CITIZEN_MAP':
        return <CitizenMapPage />;
      case 'CITIZEN_SHELTERS':
        return <CitizenShelterPage />;
      case 'ANALYTICS':
        return <AnalyticsPage />;
      case 'FIELD_RESPONDER':
        return <MissionPage />;
      case 'SHELTER_MANAGER':
        return <ShelterPage />;
      case 'DDMO_AUTHORITY':
        return <DDMOAuthorityPage />;
      case 'COMMAND_DASHBOARD':
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="relative isolate min-h-screen text-[var(--color-text-primary,#14151A)] dark:text-[#FFFFFF] antialiased transition-colors duration-200">
      {/* Branded environmental sensor-network background (behind all content) */}
      <MonitoringBackground />

      {/* Keep the animated canvas behind every page, modal, and assistant surface. */}
      <div className="relative z-10">
        {/* Suspense boundary with skeleton fallback (Principles #4 & #7) */}
        <Suspense fallback={<PageSkeleton />}>
          {/* Active Page View */}
          {renderCurrentView()}

          {/* Global Modals & Drawers */}
          <SOSDetailDrawer />
          <ResponsePlanReview />
          <USSDSimulator />
          <IncidentReportModal />
          
          {/* Floating NEXORA AI Chatbot Assistant */}
          <NexoraChatbot />
        </Suspense>
      </div>
    </div>
  );
}

export default App;
