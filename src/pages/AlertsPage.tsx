import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { AlertTriangle, Bell, Radio, Send, ShieldAlert, CheckCircle2, Volume2, MessageSquare, Smartphone, Users, ExternalLink, ChevronDown, History, RotateCcw, Trash2 } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { BroadcastChannel, AlertSeverity } from '../types/alert';
import { getTranslation } from '../i18n/translations';

/** Resolved bulletins live in the history strip for 24 hours, then are deleted. */
const ALERT_HISTORY_TTL = 24 * 60 * 60 * 1000;

export const AlertsPage: React.FC = () => {
  const {
    alerts,
    broadcastNewAlert,
    dismissAlert,
    restoreAlert,
    setCurrentView,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  const [title, setTitle] = useState('FLASH FLOOD SURGE EMERGENCY â€” EVACUATION NOTICE');
  const [severity, setSeverity] = useState<AlertSeverity>('CRITICAL');
  const [zone, setZone] = useState('Zone A: Pandu Ghat & Lowlands');
  const [locationName, setLocationName] = useState('Pandu Lowlands & Temple Road, Ward 14');
  const [reason, setReason] = useState('Brahmaputra water level rapidly approaching danger crest (82cm, rising +14cm/hr). Embankment scouring active.');
  const [recommendedAction, setRecommendedAction] = useState('Immediate evacuation to Pragati High School camp. Pack dry rations and essential medicine. Avoid Pandu viaduct.');
  const [channels, setChannels] = useState<BroadcastChannel[]>(['CAP_PROTOCOL', 'CELL_BROADCAST', 'SMS_GATEWAY', 'USSD', 'SIREN_NETWORK']);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Collapsed-by-default bulletin cards: only the summary row shows until the
  // operator clicks it. Keeps the feed scannable instead of a wall of panels.
  const [expandedAlerts, setExpandedAlerts] = useState<string[]>([]);

  // Resolved-history strip starts collapsed, like the bulletin cards.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Resolved bulletins leave the active feed and land here, then are deleted
  // automatically once they pass the 24-hour retention window.
  const activeAlerts = alerts.filter((a) => a.active);
  const resolvedAlerts = alerts
    .filter((a) => !a.active && a.resolvedAt)
    .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());

  // Ticks every 30s so the "deletes in 23h 12m" countdowns stay honest and
  // entries vanish the moment they expire, without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      useNexoraStore.getState().purgeExpiredAlertHistory();
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Pull server bulletins once on mount so the active feed and the history
  // strip both survive a page reload.
  useEffect(() => {
    void useNexoraStore.getState().hydrateAlerts();
  }, []);

  const msUntilExpiry = (resolvedAt?: string | null) =>
    resolvedAt ? ALERT_HISTORY_TTL - (now - new Date(resolvedAt).getTime()) : 0;

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return 'expired';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h >= 1) return `${h}h ${m}m`;
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  };

  const toggleAlert = (id: string) =>
    setExpandedAlerts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );

  const activeAlertIds = alerts.filter(a => a.active).map(a => a.id);
  const allExpanded = activeAlertIds.length > 0 && activeAlertIds.every(id => expandedAlerts.includes(id));

  const toggleAll = () =>
    setExpandedAlerts(allExpanded ? [] : activeAlertIds);

  const toggleChannel = (ch: BroadcastChannel) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter(c => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    broadcastNewAlert({
      title,
      severity,
      zone,
      locationName,
      lat: 26.178,
      lng: 91.702,
      reason,
      recommendedAction,
      issuedBy: "SEOC Incident Command System (ICS)",
      channels,
      affectedPopulation: 6800
    });

    setBroadcastSuccess(true);
    setTimeout(() => {
      setBroadcastSuccess(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body transition-colors">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FCF1F0] dark:bg-[#ECECEC] text-[#B42318] dark:text-[#C0C0C0] border border-[#F3CFC9] dark:border-[#7F1D1D]/60 flex items-center justify-center shadow-xs flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  {t('alerts_subtitle', 'Common Alerting Protocol (CAP v1.2) â€¢ SEOC Early Warning')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FCF1F0] dark:bg-[#ECECEC] text-[#B42318] dark:text-[#C0C0C0] border border-[#F3CFC9] dark:border-[#7F1D1D]/60">
                  SEOC Early Warning
                </span>
              </div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-0.5">
                {t('alerts_title', 'Alerts & Multi-Channel Early Warning')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block font-data">
              <span className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] block">CAP v1.2 Standard</span>
              <span className="text-[11px] font-bold text-[#126B34] dark:text-[#D0D0D0]">Carrier Gateways Connected</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: ACTIVE ALERTS FEED */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-2">
                <span>{t('alerts_active_bulletins', 'Active Emergency Bulletins')}</span>
                <span className="px-2 py-0.5 text-xs font-data font-bold rounded-full bg-[#F1F1EF] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] border border-[#E4E4E0] dark:border-[#B4B4B4]">
                  {alerts.filter(a => a.active).length} Active
                </span>
              </h2>

              {activeAlertIds.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#5A5C66] dark:text-[#D0D0D0] hover:text-[#12294D] dark:hover:text-[#9DB8DC] px-2.5 py-1 rounded-lg hover:bg-[#F1F1EF] dark:hover:bg-[#0D0E12] transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {activeAlerts.map((alert) => {
                const isCritical = alert.severity === 'CRITICAL';
                const isSevere = alert.severity === 'SEVERE';
                const isOpen = expandedAlerts.includes(alert.id);
                const panelId = `bulletin-panel-${alert.id}`;

                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] border-l-4 shadow-xs transition-all ${
                      isCritical
                        ? 'border-l-[#B42318]'
                        : isSevere
                        ? 'border-l-[#8A4D06]'
                        : 'border-l-[#12294D] dark:border-l-[#93C5FD]'
                    } ${!alert.active ? 'opacity-60' : ''} ${isOpen ? 'ring-1 ring-[#12294D]/10 dark:ring-[#93C5FD]/15' : ''}`}
                  >
                    {/* â”€â”€ Summary row (click to expand) â”€â”€ */}
                    <button
                      type="button"
                      onClick={() => toggleAlert(alert.id)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 rounded-xl hover:bg-[#F8F8F7] dark:hover:bg-[#0D0E12] transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-data ${
                            isCritical
                              ? 'bg-[#FCF1F0] dark:bg-[#ECECEC] text-[#B42318] dark:text-[#C0C0C0] border border-[#F3CFC9] dark:border-[#7F1D1D]/60'
                              : isSevere
                              ? 'bg-[#FAF0D8] dark:bg-[#ECECEC] text-[#8A4D06] dark:text-[#D0D0D0] border border-[#EFE3C4] dark:border-[#B4B4B4]'
                              : 'bg-[#F1F1EF] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] border border-[#E4E4E0] dark:border-[#B4B4B4]'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs font-data text-[#5A5C66] dark:text-[#D0D0D0]">{alert.timestamp}</span>
                          <span className="text-xs font-data text-[#5A5C66] dark:text-[#D0D0D0]">â€¢ {alert.zone}</span>
                          {!alert.active && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1F1EF] dark:bg-[#171717] text-[#5A5C66] dark:text-[#D0D0D0] border border-[#E4E4E0] dark:border-[#B4B4B4] font-data">
                              RESOLVED
                            </span>
                          )}
                        </div>
                        <h3 className="font-heading font-bold text-sm sm:text-base text-[#14151A] dark:text-[#FFFFFF] mt-1">
                          {alert.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="hidden sm:inline text-[11px] font-data text-[#5A5C66] dark:text-[#D0D0D0]">
                          {isOpen ? 'Hide details' : 'View details'}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#5A5C66] dark:text-[#D0D0D0] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    {/* â”€â”€ Expandable detail panel â”€â”€ */}
                    <div
                      id={panelId}
                      role="region"
                      aria-label={alert.title}
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-3">

                          {/* Threat Diagnostic */}
                          <div className="bg-[#F8F8F7] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] text-xs text-[#14151A] dark:text-[#FFFFFF] leading-relaxed">
                            <strong className="text-[#14151A] dark:text-[#D0D0D0] block mb-0.5">{t('alerts_diagnostic', 'Threat Diagnostic / Hydro Reason')}:</strong>
                            {alert.reason}
                          </div>

                          {/* Recommended Action */}
                          <div className="bg-[#FAF0D8] dark:bg-[#ECECEC] border border-[#EFE3C4] dark:border-[#B4B4B4] p-3 rounded-xl text-xs text-[#A15C07] dark:text-[#FFFFFF] leading-relaxed">
                            <strong className="block text-[#A15C07] dark:text-[#D0D0D0] mb-0.5 flex items-center gap-1.5 font-bold">
                              <ShieldAlert className="w-3.5 h-3.5 text-[#8A4D06] dark:text-[#D0D0D0]" />
                              {t('alerts_citizen_action', 'Recommended Action for Citizens')}:
                            </strong>
                            {alert.recommendedAction}
                          </div>

                          {/* Distribution Channels & Demographics */}
                          <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF]">{t('alerts_channels', 'Broadcast Channels')}:</span>
                              <div className="flex items-center gap-1">
                                {alert.channels.map((ch, idx) => (
                                  <span key={idx} className="bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-1.5 py-0.5 rounded text-[#5A5C66] dark:text-[#D0D0D0] text-[10px]">
                                    {ch.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-[#14151A] dark:text-[#FFFFFF]">
                              <Users className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                              <span>~{alert.affectedPopulation.toLocaleString()} citizens targeted</span>
                            </div>
                          </div>

                          {/* Resolve */}
                          {alert.active && (
                            <div className="pt-1">
                              <button
                                onClick={() => dismissAlert(alert.id)}
                                className="text-xs font-bold text-[#B42318] dark:text-[#C0C0C0] bg-[#FCF1F0] dark:bg-[#ECECEC] border border-[#F3CFC9] dark:border-[#7F1D1D]/60 px-3 py-1.5 rounded-lg hover:bg-[#F3CFC9] dark:hover:bg-[#2A1614] transition-colors cursor-pointer"
                              >
                                {t('alerts_resolve', 'Resolve')}
                              </button>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* â”€â”€ RESOLVED HISTORY (24h retention) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div
              data-testid="alert-history"
              className="rounded-xl bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                aria-controls="alert-history-panel"
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F8F8F7] dark:hover:bg-[#0D0E12] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <History className="w-4 h-4 text-[#5A5C66] dark:text-[#D0D0D0] flex-shrink-0" />
                  <span className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                    Resolved History
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-data font-bold rounded-full bg-[#F1F1EF] dark:bg-[#171717] text-[#5A5C66] dark:text-[#D0D0D0] border border-[#E4E4E0] dark:border-[#B4B4B4]">
                    {resolvedAlerts.length}
                  </span>
                  <span className="hidden sm:inline text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                    auto-deleted after 24h
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-[#5A5C66] dark:text-[#D0D0D0] flex-shrink-0 transition-transform duration-300 ${historyOpen ? 'rotate-180' : ''}`} />
              </button>

              <div
                id="alert-history-panel"
                role="region"
                aria-label="Resolved alert history"
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: historyOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 pt-1">
                    {resolvedAlerts.length === 0 ? (
                      <p className="text-[12px] text-[#5A5C66] dark:text-[#D0D0D0] py-2">
                        Nothing resolved in the last 24 hours.
                      </p>
                    ) : (
                      <ul className="space-y-1.5" data-testid="alert-history-list">
                        {resolvedAlerts.map((a) => {
                          const remaining = msUntilExpiry(a.resolvedAt);
                          return (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-data bg-[#F1F1EF] dark:bg-[#ECECEC] text-[#5A5C66] dark:text-[#D0D0D0] border border-[#E4E4E0] dark:border-[#B4B4B4]">
                                    {a.severity}
                                  </span>
                                  <span className="text-xs font-semibold text-[#14151A] dark:text-[#FFFFFF] truncate">
                                    {a.title}
                                  </span>
                                </div>
                                <p className="text-[10px] font-data text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5">
                                  {a.zone}
                                  {a.resolvedBy ? ` Â· resolved by ${a.resolvedBy}` : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span
                                  className="text-[10px] font-data font-bold px-1.5 py-0.5 rounded bg-[#FCF1F0] dark:bg-[#3F1414]/40 text-[#B42318] dark:text-[#C0C0C0]"
                                  title="Deletes automatically 24 hours after resolution"
                                >
                                  <Trash2 className="w-2.5 h-2.5 inline mr-1" />
                                  {formatRemaining(remaining)}
                                </span>
                                <button
                                  onClick={() => restoreAlert(a.id)}
                                  title="Re-open this bulletin"
                                  className="text-[10px] font-bold text-[#1A3A6B] dark:text-[#D0D0D0] hover:underline cursor-pointer px-1.5 py-1 rounded hover:bg-[#EEF2F8] dark:hover:bg-[#0D0E12] flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Re-open
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: AUTHORITY CAP BROADCAST COMPOSER */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-white dark:bg-[#1E3A5F] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
                <div>
                  <h2 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#12294D] dark:text-[#D0D0D0]" />
                    {t('alerts_cap_composer', 'CAP Broadcast Dispatcher')}
                  </h2>
                  <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                    {t('alerts_cap_desc', 'Dispatches synchronized alerts across Cell Broadcast, USSD, SMS & Sirens')}
                  </p>
                </div>
              </div>

              {broadcastSuccess && (
                <div className="bg-[#F1F8F3] border border-[#CFE6D8] p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-[#126B34] animate-fade-in dark:text-[#D0D0D0] dark:bg-[#0A2E22] dark:border-[#14532D]">
                  <CheckCircle2 className="w-4 h-4 text-[#126B34] flex-shrink-0 dark:text-[#D0D0D0]" />
                  <span>Alert broadcast successfully pushed to telecommunication carriers & SEOC mesh!</span>
                </div>
              )}

              <form onSubmit={handleBroadcast} className="space-y-3.5">
                
                {/* Severity Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5C66] mb-1.5 dark:text-[#D0D0D0]">
                    {t('alerts_severity_label', 'Alert Severity Level')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['CRITICAL', 'SEVERE', 'MODERATE', 'ADVISORY'] as AlertSeverity[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSeverity(lvl)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          severity === lvl
                            ? lvl === 'CRITICAL'
                              ? 'bg-[#B42318] text-white border-[#B42318]'
                              : lvl === 'SEVERE'
                              ? 'bg-[#8A4D06] text-white border-[#8A4D06]'
                              : lvl === 'MODERATE'
                              ? 'bg-[#B5824A] text-[#14151A] border-[#B5824A]'
                              : 'bg-[#126B34] text-white border-[#126B34]'
                            : 'bg-[#F8F8F7] text-[#14151A] border-[#E4E4E0] hover:bg-[#F1F1EF]'
                        } dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D] `}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Zone */}
                <div>
                  <label className="block text-xs font-bold text-[#14151A] mb-1 dark:text-[#FFFFFF]">
                    {t('alerts_target_zone', 'Target Threat Zone')}
                  </label>
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl text-xs text-[#14151A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 cursor-pointer dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                  >
                    <option value="Zone A: Pandu Ghat & Lowlands">Zone A: Pandu Ghat & Lowlands</option>
                    <option value="Zone B: Bharalu River Confluence">Zone B: Bharalu River Confluence</option>
                    <option value="Zone C: Jalukbari Outer Basin">Zone C: Jalukbari Outer Basin</option>
                    <option value="All Kamrup Metro Basin">All Kamrup Metro Basin (District-Wide)</option>
                  </select>
                </div>

                {/* Headline */}
                <div>
                  <label className="block text-xs font-bold text-[#14151A] mb-1 dark:text-[#FFFFFF]">
                    {t('alerts_headline', 'Alert Headline')}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl text-xs text-[#14151A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                  />
                </div>

                {/* Diagnosis / Reason */}
                <div>
                  <label className="block text-xs font-bold text-[#14151A] mb-1 dark:text-[#FFFFFF]">
                    {t('alerts_diagnostic', 'Threat Diagnostic / Hydro Reason')}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl text-xs text-[#14151A] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                  />
                </div>

                {/* Citizen Advice */}
                <div>
                  <label className="block text-xs font-bold text-[#14151A] mb-1 dark:text-[#FFFFFF]">
                    {t('alerts_citizen_action', 'Direct Citizen Directive / Evacuation Route')}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] border border-[#E4E4E0] rounded-xl text-xs text-[#14151A] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D]"
                  />
                </div>

                {/* Channel Checkboxes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5C66] mb-2 dark:text-[#D0D0D0]">
                    {t('alerts_channels', 'Multi-Channel Carriers')}
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] cursor-pointer dark:bg-[#262626] dark:border-[#3D3D3D]">
                      <input
                        type="checkbox"
                        checked={channels.includes('CELL_BROADCAST')}
                        onChange={() => toggleChannel('CELL_BROADCAST')}
                        className="rounded accent-[#12294D]"
                      />
                      <Smartphone className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                      <span>Cell Broadcast</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] cursor-pointer dark:bg-[#262626] dark:border-[#3D3D3D]">
                      <input
                        type="checkbox"
                        checked={channels.includes('USSD')}
                        onChange={() => toggleChannel('USSD')}
                        className="rounded accent-[#12294D]"
                      />
                      <Radio className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                      <span>2G USSD (*123#)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] cursor-pointer dark:bg-[#262626] dark:border-[#3D3D3D]">
                      <input
                        type="checkbox"
                        checked={channels.includes('SMS_GATEWAY')}
                        onChange={() => toggleChannel('SMS_GATEWAY')}
                        className="rounded accent-[#12294D]"
                      />
                      <MessageSquare className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                      <span>SMS Broadcast</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F8F7] border border-[#E4E4E0] cursor-pointer dark:bg-[#262626] dark:border-[#3D3D3D]">
                      <input
                        type="checkbox"
                        checked={channels.includes('SIREN_NETWORK')}
                        onChange={() => toggleChannel('SIREN_NETWORK')}
                        className="rounded accent-[#12294D]"
                      />
                      <Volume2 className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                      <span>Acoustic Sirens</span>
                    </label>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#B42318] hover:bg-[#8A1A12] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t('alerts_broadcast_btn', 'Broadcast Common Alerting Protocol Notice')}</span>
                  </button>
                </div>

              </form>

            </div>
          </div>

        </div>

      </main>
    </div>
  );
};
