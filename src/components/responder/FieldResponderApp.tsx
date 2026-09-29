import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Users,
  CheckCircle2,
  QrCode,
  Shield,
  Compass,
  Home,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowRight,
  Truck,
  AlertOctagon,
  Send,
  X
} from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { RiskBadge } from '../shared/RiskBadge';
import { getTranslation } from '../../i18n/translations';

export const FieldResponderApp: React.FC = () => {
  const {
    teams,
    sosReports,
    shelters,
    isOffline,
    toggleOfflineMode,
    queuedSyncCount,
    syncQueuedUpdates,
    responderMissionStatus,
    setResponderMissionStatus,
    queueOfflineAction,
    lastSyncTime,
    checkInArrival,
    currentLanguage
  } = useNexoraStore();

  const [activeTab, setActiveTab] = useState<'MISSION' | 'MAP' | 'SHELTERS' | 'PROFILE'>('MISSION');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [damageDescription, setDamageDescription] = useState('Bharalumukh Sluice Gate Approach blocked by 1.2m surge water');
  const [resourceType, setResourceType] = useState('Inflatable Motor Boat (Zodiac)');
  const [resourceQty, setResourceQty] = useState(2);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [rescuedCount, setRescuedCount] = useState(4);
  const [selectedShelterId, setSelectedShelterId] = useState(shelters[0].id);

  const activeMission = sosReports[0]; // SOS-2026-0841
  const assignedTeam = teams[0]; // NDRF 1st Bn Alpha

  const t = (key: string, fallback?: string) => getTranslation(currentLanguage, key, fallback);

  const flashNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleAdvanceStep = () => {
    if (responderMissionStatus === 'ASSIGNED') {
      setResponderMissionStatus('EN_ROUTE');
      queueOfflineAction("Status changed to EN_ROUTE");
      flashNotice("Status updated: En Route to Incident");
    } else if (responderMissionStatus === 'EN_ROUTE') {
      setResponderMissionStatus('ON_SCENE');
      queueOfflineAction("Status changed to ON_SCENE (Arrived Pandu Ghat)");
      flashNotice("Status updated: Arrived On Scene");
    } else if (responderMissionStatus === 'ON_SCENE') {
      setResponderMissionStatus('EVACUATING');
      queueOfflineAction(`Intake of ${rescuedCount} survivors confirmed on board`);
      flashNotice("Status updated: Survivors Boarded, Evacuating");
    } else if (responderMissionStatus === 'EVACUATING') {
      setShowQRModal(true);
    }
  };

  const handleConfirmShelterCheckin = () => {
    checkInArrival(selectedShelterId, "ARR-101");
    setResponderMissionStatus('COMPLETED');
    setShowQRModal(false);
    queueOfflineAction(`Shelter delivery confirmed at ${shelters.find(s => s.id === selectedShelterId)?.name}`);
    flashNotice("Handover Complete! Responders standing by.");
  };

  const handleReportDamage = (e: React.FormEvent) => {
    e.preventDefault();
    queueOfflineAction(`Damage reported: ${damageDescription}`);
    setShowDamageModal(false);
    flashNotice("Obstruction report recorded into offline queue");
  };

  const handleRequestResource = (e: React.FormEvent) => {
    e.preventDefault();
    queueOfflineAction(`Resource requested: ${resourceQty}x ${resourceType}`);
    setShowResourceModal(false);
    flashNotice(`Requested ${resourceQty}x ${resourceType}`);
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-[740px] bg-white dark:bg-[#212121] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-[32px] shadow-xl overflow-hidden flex flex-col relative text-[#14151A] dark:text-[#FFFFFF]">
      
      {/* MOBILE HEADER - MIDNIGHT NAVY ACCENTS & CLEAN */}
      <div className="bg-[#F8F8F7] dark:bg-[#2F2F2F] border-b border-[#E4E4E0] dark:border-[#B4B4B4] p-4 pt-5 pb-3 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4 text-[#14151A] dark:text-[#D0D0D0]" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm leading-tight text-[#14151A] dark:text-[#FFFFFF]">
                {t('responder_title', 'NEXORA FIELD OPS')}
              </div>
              <div className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] font-data mt-0.5">{assignedTeam.name}</div>
            </div>
          </div>

          {/* Toggle Offline Simulation Button - >=44px touch target */}
          <button
            data-testid="responder-offline-toggle"
            onClick={toggleOfflineMode}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs ${ isOffline ? 'bg-[#8A4D06] text-white' : 'bg-white dark:bg-[#171717] text-[#126B34] dark:text-[#D0D0D0] border border-[#CFE6D8] dark:border-[#14532D]/60' }`}
            title="Click to toggle network connectivity simulation"
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span>{isOffline ? t('offline', 'OFFLINE') : t('online', 'ONLINE')}</span>
          </button>
        </div>

        {/* OFFLINE STATUS & QUEUE STRIP */}
        <div className="flex items-center justify-between bg-white dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl px-3 py-2 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-[#8A4D06] animate-pulse' : 'bg-[#126B34]'}`} />
            <span className="font-semibold text-xs text-[#14151A] dark:text-[#FFFFFF]">
              {isOffline ? 'Offline Mesh Active' : 'Connected to SEOC'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {queuedSyncCount > 0 ? (
              <button
                onClick={syncQueuedUpdates}
                disabled={isOffline}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-data text-[10px] font-bold flex items-center gap-1 transition-all ${
                  isOffline
                    ? 'bg-[#FBF7EC] text-[#7A3E0B] border border-[#F7E9D6] cursor-not-allowed'
                    : 'bg-[#12294D] hover:bg-[#0F2140] text-white cursor-pointer'
                } dark:text-[#E0E0E0] dark:bg-[#3A2A0A] dark:border-[#78350F] `}
                title={isOffline ? 'Cannot sync while offline' : 'Sync now'}
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>{queuedSyncCount} {t('pending_sync', 'pending')}</span>
              </button>
            ) : (
              <span className="text-[10px] text-[#5A5C66] font-data dark:text-[#D0D0D0]">
                Synced {lastSyncTime}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Action Notification Toast */}
        {actionNotice && (
          <div className="mt-2 p-2 bg-[#EFEFEC] border border-[#DCDCD8] text-[#12294D] rounded-xl text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-1.5 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#126B34] dark:text-[#D0D0D0]" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* MOBILE MAIN CONTENT BODY */}
      <div className="flex-1 p-4 overflow-y-auto pb-24 space-y-4">
        
        {activeTab === 'MISSION' && (
          <div className="space-y-4">
            
            {/* CURRENT MISSION STATUS HEADER */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
                {t('responder_active_mission', 'Active Incident Order')}
              </span>
              <span className="font-data text-xs font-bold px-2.5 py-1 rounded-full bg-[#EFEFEC] text-[#12294D] border border-[#DCDCD8] dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]">
                {responderMissionStatus}
              </span>
            </div>

            {/* ASSIGNMENT CARD */}
            <div className="p-4 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] space-y-3.5 shadow-xs dark:bg-[#262626] dark:border-[#3D3D3D]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-data text-xs font-bold text-[#12294D] bg-white border border-[#E4E4E0] px-2 py-0.5 rounded dark:text-[#FFFFFF] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
                    {activeMission.id}
                  </span>
                  <h3 className="font-heading font-bold text-base text-[#14151A] mt-1.5 dark:text-[#FFFFFF]">
                    {activeMission.locationName}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-[#5A5C66] font-data mt-0.5 dark:text-[#D0D0D0]">
                    <MapPin className="w-3 h-3 text-[#12294D] dark:text-[#FFFFFF]" />
                    <span>26.1754Ã‚Â° N, 91.6842Ã‚Â° E</span>
                  </div>
                </div>
                <RiskBadge level={activeMission.priorityLevel} />
              </div>

              {/* VULNERABILITY FLAGS */}
              <div>
                <div className="text-[11px] font-bold text-[#5A5C66] uppercase tracking-wider mb-1.5 dark:text-[#D0D0D0]">
                  {t('responder_vulnerability', 'Vulnerability Needs:')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeMission.needs.map(n => (
                    <span
                      key={n}
                      className="px-2 py-0.5 rounded-md bg-white text-[#14151A] border border-[#E4E4E0] text-[11px] font-semibold dark:text-[#FFFFFF] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              {/* SURVIVOR HEADCOUNT */}
              <div className="p-3 bg-white border border-[#E4E4E0] rounded-xl flex items-center justify-between text-xs dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#12294D] dark:text-[#FFFFFF]" />
                  <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF]">{t('responder_trapped_count', 'Trapped Headcount')}</span>
                </div>
                <span className="font-data font-bold text-base text-[#B42318] dark:text-[#FFFFFF]">
                  {activeMission.peopleCount} Citizens
                </span>
              </div>

              {/* OFFLINE NAVIGATION BUTTON >= 44px */}
              <button
                onClick={() => flashNotice("Offline turn-by-turn guidance loaded via dry corridor")}
                className="w-full min-h-[44px] py-2.5 px-4 bg-white hover:bg-[#F8F8F7] border border-[#12294D] text-[#12294D] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all dark:text-[#FFFFFF] dark:bg-[#2F2F2F]"
              >
                <Compass className="w-4 h-4 text-[#12294D] dark:text-[#FFFFFF]" />
                <span>{t('responder_nav_offline', 'Launch Offline Route Guidance')}</span>
              </button>
            </div>

            {/* MISSION CHECKPOINTS */}
            <div className="bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl p-4 space-y-3 shadow-xs dark:bg-[#262626] dark:border-[#3D3D3D]">
              <div className="text-xs font-bold uppercase tracking-wider text-[#14151A] dark:text-[#FFFFFF]">
                {t('responder_checkpoints', 'Mission Checkpoints')}
              </div>

              <div className="space-y-2">
                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  responderMissionStatus !== 'ASSIGNED' ? 'bg-[#F1F8F3] border-[#CFE6D8] text-[#126B34]' : 'bg-white border-[#E4E4E0]'
                } dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:bg-[#2F2F2F] dark:border-[#14532D] dark:border-[#3D3D3D] `}>
                  <span className="font-medium">1. Acknowledge & Deploy</span>
                  {responderMissionStatus !== 'ASSIGNED' && <CheckCircle2 className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />}
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  responderMissionStatus === 'ON_SCENE' || responderMissionStatus === 'EVACUATING' || responderMissionStatus === 'COMPLETED'
                    ? 'bg-[#F1F8F3] border-[#CFE6D8] text-[#126B34]'
                    : 'bg-white border-[#E4E4E0]'
                } dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:bg-[#2F2F2F] dark:border-[#14532D] dark:border-[#3D3D3D] `}>
                  <span className="font-medium">2. On-Scene Arrival</span>
                  {(responderMissionStatus === 'ON_SCENE' || responderMissionStatus === 'EVACUATING' || responderMissionStatus === 'COMPLETED') && (
                    <CheckCircle2 className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
                  )}
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  responderMissionStatus === 'COMPLETED' ? 'bg-[#F1F8F3] border-[#CFE6D8] text-[#126B34]' : 'bg-white border-[#E4E4E0]'
                } dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:bg-[#2F2F2F] dark:border-[#14532D] dark:border-[#3D3D3D] `}>
                  <span className="font-medium">3. Shelter Transfer & QR Scan</span>
                  {responderMissionStatus === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />}
                </div>
              </div>

              {/* PRIMARY ADVANCE BUTTON - >= 46px TOUCH TARGET */}
              {responderMissionStatus !== 'COMPLETED' ? (
                <button
                  onClick={handleAdvanceStep}
                  className="w-full min-h-[46px] btn-primary-gradient text-white py-3 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 mt-2 cursor-pointer transition-all"
                >
                  {responderMissionStatus === 'ASSIGNED' && t('responder_step_assigned', 'Confirm En-Route to Scene')}
                  {responderMissionStatus === 'EN_ROUTE' && t('responder_step_en_route', 'Mark Arrived On-Scene')}
                  {responderMissionStatus === 'ON_SCENE' && t('responder_step_on_scene', 'Intake Complete Ã¢â‚¬â€ Begin Evac')}
                  {responderMissionStatus === 'EVACUATING' && t('responder_step_evacuating', 'Deliver to Shelter (Scan QR)')}
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              ) : (
                <div className="p-3 bg-[#F1F8F3] text-[#126B34] text-xs font-bold rounded-xl text-center border border-[#CFE6D8] dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:border-[#14532D]">
                  Ã¢Å“â€œ Mission Complete Ã¢â‚¬â€ Standing by for next dispatch
                </div>
              )}
            </div>

            {/* ACTION TILES: REPORT DAMAGE & REQUEST RESOURCES (LARGE TOUCH TARGETS >= 46px) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDamageModal(true)}
                className="min-h-[48px] p-3 rounded-xl bg-white border border-[#E4E4E0] hover:border-[#8A4D06] text-left cursor-pointer shadow-2xs transition-all flex flex-col justify-between group dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
              >
                <div className="w-8 h-8 rounded-xl bg-[#FBF7EC] text-[#8A4D06] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform dark:text-[#E0E0E0] dark:bg-[#3A2A0A]">
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div className="font-heading font-bold text-xs text-[#14151A] dark:text-[#FFFFFF]">{t('responder_report_damage', 'Report Obstruction')}</div>
                <div className="text-[10px] text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">Route flood / blocked bridge</div>
              </button>

              <button
                onClick={() => setShowResourceModal(true)}
                className="min-h-[48px] p-3 rounded-xl bg-white border border-[#E4E4E0] hover:border-[#4A4038] text-left cursor-pointer shadow-2xs transition-all flex flex-col justify-between group dark:bg-[#2F2F2F] dark:border-[#3D3D3D]"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F8F8F7] text-[#4A4038] dark:text-[#D0D0D0] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform dark:bg-[#262626]">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="font-heading font-bold text-xs text-[#14151A] dark:text-[#FFFFFF]">{t('responder_request_resources', 'Request Backup')}</div>
                <div className="text-[10px] text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">Boats, life jackets, fuel</div>
              </button>
            </div>

          </div>
        )}

        {activeTab === 'MAP' && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
              Tactical Offline Cache
            </div>
            <div className="h-64 bg-[#EFEFEC] rounded-xl border border-[#DCDCD8] relative overflow-hidden flex items-center justify-center dark:bg-[#262626] dark:border-[#333333]">
              <div className="text-center p-4">
                <Compass className="w-8 h-8 text-[#12294D] mx-auto mb-2 animate-spin-slow dark:text-[#FFFFFF]" />
                <div className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">Vector Offline Tiles Cached (15km)</div>
                <div className="text-[11px] text-[#5A5C66] mt-1 dark:text-[#D0D0D0]">Pandu Ghat Staging to Maligaon Safe Ridge</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] text-xs space-y-1 dark:bg-[#262626] dark:border-[#3D3D3D]">
              <div className="font-bold text-[#14151A] dark:text-[#FFFFFF]">Nearest Evacuation Corridor:</div>
              <div className="text-[#14151A] dark:text-[#FFFFFF]">Pandu Port Rd &rarr; Kamakhya Gate Link &rarr; Pragati High School</div>
              <div className="text-[11px] text-[#8A4D06] font-bold mt-1 dark:text-[#E0E0E0]">Ã¢Å¡Â  Avoid Bharalumukh Sluice (1.4m water)</div>
            </div>
          </div>
        )}

        {activeTab === 'SHELTERS' && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
              Available Relief Camps
            </div>
            {shelters.map(s => (
              <div key={s.id} className="p-3.5 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl space-y-2 dark:bg-[#262626] dark:border-[#3D3D3D]">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">{s.name}</span>
                  <span className="text-[11px] font-data font-bold text-[#126B34] bg-[#F1F8F3] border border-[#CFE6D8] px-2 py-0.5 rounded dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:border-[#14532D]">
                    {s.totalCapacity - s.currentOccupancy} Free
                  </span>
                </div>
                <div className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">{s.address}</div>
                <div className="pt-2 border-t border-[#E4E4E0] flex items-center justify-between text-[11px] dark:border-[#3D3D3D]">
                  <span className="text-[#14151A] dark:text-[#FFFFFF]">Food Rations: {s.resources.foodPackets} pkts</span>
                  <button
                    onClick={() => {
                      setSelectedShelterId(s.id);
                      setShowQRModal(true);
                    }}
                    className="min-h-[44px] px-3 py-1.5 bg-white hover:bg-[#EFEFEC] text-[#12294D] font-bold rounded-lg border border-[#DCDCD8] cursor-pointer dark:text-[#FFFFFF] dark:bg-[#2F2F2F] dark:border-[#333333]"
                  >
                    Check-in Here
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'PROFILE' && (
          <div className="space-y-4">
            <div className="p-5 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl space-y-3 text-center dark:bg-[#262626] dark:border-[#3D3D3D]">
              <div className="w-16 h-16 rounded-full bg-[#14151A] text-white text-xl font-bold flex items-center justify-center mx-auto shadow-sm">
                1A
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">Commander D. Gogoi</h3>
                <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">NDRF 1st Battalion Ã¢â‚¬â€ Inflatable Boat Column</p>
              </div>
              <div className="pt-3 border-t border-[#E4E4E0] grid grid-cols-2 gap-2 text-xs font-data dark:border-[#3D3D3D]">
                <div className="bg-white border border-[#E4E4E0] p-2.5 rounded-xl dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
                  <div className="text-[#5A5C66] text-[10px] dark:text-[#D0D0D0]">RESCUED TODAY</div>
                  <div className="font-bold text-lg text-[#14151A] dark:text-[#FFFFFF]">28</div>
                </div>
                <div className="bg-white border border-[#E4E4E0] p-2.5 rounded-xl dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
                  <div className="text-[#5A5C66] text-[10px] dark:text-[#D0D0D0]">SYNC STATUS</div>
                  <div className="font-bold text-lg text-[#126B34] dark:text-[#D0D0D0]">100% OK</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: QR SCAN / CHECK-IN CONFIRMATION */}
      {showQRModal && (
        <div className="absolute inset-0 z-50 bg-[#14151A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4 shadow-xl border border-[#E4E4E0] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-base text-[#14151A] flex items-center gap-1.5 dark:text-[#FFFFFF]">
                <QrCode className="w-5 h-5 text-[#12294D] dark:text-[#FFFFFF]" />
                Shelter Intake QR Scan
              </h4>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-[#5A5C66] hover:text-[#14151A] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center dark:text-[#D0D0D0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#14151A] dark:text-[#FFFFFF]">
              Handing over evacuees to{' '}
              <strong className="text-[#14151A] dark:text-[#FFFFFF]">{shelters.find(s => s.id === selectedShelterId)?.name}</strong>.
            </p>

            <div>
              <label className="text-xs font-bold text-[#14151A] block mb-1 dark:text-[#FFFFFF]">
                Confirm Citizen Headcount Arrived:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={rescuedCount}
                  onChange={(e) => setRescuedCount(Number(e.target.value))}
                  className="w-20 p-2.5 border border-[#E4E4E0] rounded-xl font-data font-bold text-base text-center bg-[#F8F8F7] text-[#14151A] dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                />
                <span className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">citizens verified on board</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 min-h-[44px] py-2.5 text-xs font-semibold rounded-xl border border-[#E4E4E0] hover:bg-[#F8F8F7] cursor-pointer text-[#14151A] dark:text-[#FFFFFF] dark:border-[#3D3D3D]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmShelterCheckin}
                className="flex-1 min-h-[44px] btn-primary-gradient text-white py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Confirm Intake
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORT DAMAGE / ROAD OBSTRUCTION */}
      {showDamageModal && (
        <div className="absolute inset-0 z-50 bg-[#14151A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleReportDamage} className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4 shadow-xl border border-[#E4E4E0] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-base text-[#14151A] flex items-center gap-1.5 dark:text-[#FFFFFF]">
                <AlertOctagon className="w-5 h-5 text-[#8A4D06] dark:text-[#E0E0E0]" />
                {t('responder_report_damage', 'Report Obstruction')}
              </h4>
              <button
                type="button"
                onClick={() => setShowDamageModal(false)}
                className="text-[#5A5C66] hover:text-[#14151A] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center dark:text-[#D0D0D0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              Queues route status immediately into offline store & forward buffer for SEOC map rerouting.
            </p>

            <div>
              <label className="text-xs font-bold text-[#14151A] block mb-1 dark:text-[#FFFFFF]">
                Obstruction / Damage Description:
              </label>
              <textarea
                rows={3}
                value={damageDescription}
                onChange={(e) => setDamageDescription(e.target.value)}
                className="w-full p-2.5 border border-[#E4E4E0] rounded-xl text-xs bg-[#F8F8F7] text-[#14151A] dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                required
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDamageModal(false)}
                className="flex-1 min-h-[44px] py-2.5 text-xs font-semibold rounded-xl border border-[#E4E4E0] hover:bg-[#F8F8F7] cursor-pointer text-[#14151A] dark:text-[#FFFFFF] dark:border-[#3D3D3D]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] bg-[#8A4D06] hover:bg-[#96540A] text-white py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Report</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: REQUEST BACKUP / RESOURCES */}
      {showResourceModal && (
        <div className="absolute inset-0 z-50 bg-[#14151A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRequestResource} className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4 shadow-xl border border-[#E4E4E0] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-base text-[#14151A] flex items-center gap-1.5 dark:text-[#FFFFFF]">
                <Truck className="w-5 h-5 text-[#12294D] dark:text-[#FFFFFF]" />
                {t('responder_request_resources', 'Request Field Backup')}
              </h4>
              <button
                type="button"
                onClick={() => setShowResourceModal(false)}
                className="text-[#5A5C66] hover:text-[#14151A] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center dark:text-[#D0D0D0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              Dispatches priority request to DDMO logistics coordinator.
            </p>

            <div>
              <label className="text-xs font-bold text-[#14151A] block mb-1 dark:text-[#FFFFFF]">
                Requested Equipment / Crew:
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full p-2.5 border border-[#E4E4E0] rounded-xl text-xs bg-[#F8F8F7] text-[#14151A] dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
              >
                <option value="Inflatable Motor Boat (Zodiac)">Inflatable Motor Boat (Zodiac)</option>
                <option value="Life Jackets & Throw Bags (20x)">Life Jackets & Throw Bags (20x)</option>
                <option value="Portable Fuel Jerry Cans (50L)">Portable Fuel Jerry Cans (50L)</option>
                <option value="Medical First Responder Team">Medical First Responder Team</option>
                <option value="High Clearance 4x4 Truck">High Clearance 4x4 Truck</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#14151A] block mb-1 dark:text-[#FFFFFF]">
                Units Needed:
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={resourceQty}
                onChange={(e) => setResourceQty(Number(e.target.value))}
                className="w-24 p-2.5 border border-[#E4E4E0] rounded-xl text-xs bg-[#F8F8F7] text-[#14151A] font-data font-bold dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowResourceModal(false)}
                className="flex-1 min-h-[44px] py-2.5 text-xs font-semibold rounded-xl border border-[#E4E4E0] hover:bg-[#F8F8F7] cursor-pointer text-[#14151A] dark:text-[#FFFFFF] dark:border-[#3D3D3D]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] btn-primary-gradient text-white py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MOBILE BOTTOM TAB BAR - >=44px TOUCH TARGETS */}
      <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-[#212121] border-t border-[#E4E4E0] dark:border-[#B4B4B4] px-4 py-2 flex items-center justify-around z-30 shadow-md">
        <button
          onClick={() => setActiveTab('MISSION')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all min-h-[44px] min-w-[54px] justify-center ${
            activeTab === 'MISSION' ? 'text-[#12294D] dark:text-[#D0D0D0] font-bold' : 'text-[#5A5C66] dark:text-[#D0D0D0]'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[10px]">Mission</span>
        </button>

        <button
          onClick={() => setActiveTab('MAP')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all min-h-[44px] min-w-[54px] justify-center ${
            activeTab === 'MAP' ? 'text-[#12294D] dark:text-[#D0D0D0] font-bold' : 'text-[#5A5C66] dark:text-[#D0D0D0]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Map</span>
        </button>

        <button
          onClick={() => setActiveTab('SHELTERS')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all min-h-[44px] min-w-[54px] justify-center ${
            activeTab === 'SHELTERS' ? 'text-[#12294D] dark:text-[#D0D0D0] font-bold' : 'text-[#5A5C66] dark:text-[#D0D0D0]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Shelters</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all min-h-[44px] min-w-[54px] justify-center ${
            activeTab === 'PROFILE' ? 'text-[#12294D] dark:text-[#D0D0D0] font-bold' : 'text-[#5A5C66] dark:text-[#D0D0D0]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>

    </div>
  );
};
