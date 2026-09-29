import React, { useState } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { AlertTriangle, Home, Compass, PhoneCall, Send, ArrowRight, ShieldCheck, ExternalLink, MapPin } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';
import { detectLocation, reverseGeocode, isGeolocationSupported, coordsLabel } from '../services/geolocationService';
import { LiveSensorStrip } from '../components/shared/LiveSensorStrip';
import { WeatherStrip } from '../components/weather/WeatherStrip';
import { SosSignalButton } from '../components/shared/SosSignalButton';
import { DryCorridorPlanner } from '../components/routing/DryCorridorPlanner';

export const CitizenPortalPage: React.FC = () => {
  const {
    currentLanguage,
    shelters,
    districtSite,
    toggleIncidentModal,
    calculateSafeRoute,
    setCurrentView,
    submitQuickSOS
  } = useNexoraStore();

  const t = (key: string, fallback?: string) => getTranslation(currentLanguage, key, fallback);

  // One-tap SOS Signal state machine
  const [sosState, setSosState] = useState<'IDLE' | 'LOCATING' | 'SENDING' | 'SENT' | 'ERROR'>('IDLE');
  const [sosMessage, setSosMessage] = useState('');

  const handleSOSSignal = async () => {
    if (sosState === 'LOCATING' || sosState === 'SENDING') return;

    if (!isGeolocationSupported()) {
      setSosState('ERROR');
      setSosMessage('Location detection is not supported on this browser/device. Please use the Report form or call 1077.');
      return;
    }

    setSosState('LOCATING');
    setSosMessage('');

    try {
      const pos = await detectLocation(12000);

      setSosState('SENDING');

      // Best-effort reverse geocoding so authorities see a place name, not just coordinates
      let placeName = coordsLabel(pos.lat, pos.lng);
      const place = await reverseGeocode(pos.lat, pos.lng);
      if (place) placeName = place;

      submitQuickSOS({
        lat: pos.lat,
        lng: pos.lng,
        locationName: placeName,
        accuracy: pos.accuracy
      });

      setSosState('SENT');
      setSosMessage('SOS signal sent with your live location â€” authorities have been alerted.');
      setTimeout(() => { setSosState('IDLE'); setSosMessage(''); }, 6000);
    } catch (err) {
      const code = (err as GeolocationPositionError)?.code;
      const reason =
        code === 1
          ? 'Location access was blocked. Allow location permission in your browser, then tap SOS Signal again.'
          : code === 2
          ? 'Your location could not be determined right now. Try again, or use the full Report form.'
          : 'Could not detect your location. Please use the full Report form or call the helpline 1077.';
      setSosState('ERROR');
      setSosMessage(reason);
      setTimeout(() => { setSosState('IDLE'); setSosMessage(''); }, 8000);
    }
  };

  return (
    <div data-testid="citizen-portal-page" className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body">
      <TopBar />

      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* CITIZEN EMERGENCY WARNING BANNER */}
        <div className="bg-[#FCF1F0] dark:bg-[#3F1414]/30 border border-[#FCF1F0] dark:border-[#7F1D1D]/60 rounded-xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FCF1F0] dark:bg-[#3F1414]/40 flex items-center justify-center flex-shrink-0 text-[#B42318] dark:text-[#C0C0C0]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-[#FCF1F0] dark:bg-[#3F1414]/40 text-[#B42318] dark:text-[#C0C0C0] px-2.5 py-0.5 rounded-full font-data border border-[#FCF1F0] dark:border-[#7F1D1D]/60">
                    Official Advisory â€¢ SEOC
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#B42318] animate-ping" />
                </div>
                <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-1.5">
                  {t('citizen_alert_title', 'Disaster Warning & Safety Guidance')}
                </h1>
                <p className="text-xs sm:text-sm text-[#5A5C66] dark:text-[#D0D0D0] mt-1 max-w-2xl leading-relaxed">
                  {t('citizen_alert_desc', 'Heavy monsoon precipitation is causing river surges in low-lying sectors. Follow safety instructions immediately.')}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* SOS SIGNAL â€” deliberate activation (3 taps or 5s hold) */}
                <SosSignalButton
                  onConfirm={handleSOSSignal}
                  busyState={sosState}
                />

                {/* FULL REPORT FORM */}
                <button
                  onClick={() => toggleIncidentModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#ECECEC] dark:hover:bg-[#2E3038] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer justify-center border border-[#1A3A6B] dark:border-[#B4B4B4]"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('citizen_report_sos', 'Report Trapped Person (SOS)')}</span>
                </button>
              </div>

              {/* SOS STATUS MESSAGE */}
              {(sosState === 'SENT' || sosState === 'ERROR') && (
                <div
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 max-w-xs ${ sosState === 'SENT' ? 'bg-[#E4F3E9] dark:bg-[#0A2E22]/50 text-[#126B34] dark:text-[#E0E0E0] border-[#E4F3E9] dark:border-[#14532D]/60' : 'bg-[#FCF1F0] dark:bg-[#3F1414]/40 text-[#8A1A12] dark:text-[#D0D0D0] border-[#FCF1F0] dark:border-[#7F1D1D]/60' }`}
                >
                  {sosState === 'SENT' ? (
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span>{sosMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LIVE WEATHER â€” what a citizen checks before deciding to move */}
        <WeatherStrip />

        {/* 5 LIVE SENSOR READINGS â€” same feed as the Sensors page */}
        <LiveSensorStrip
          variant="compact"
          subtitle="Live from SEOC gauges in your district â€¢ updates every 5s"
        />

        {/* 3 ACTION TILES FOR CITIZENS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Tile 1: Report Emergency */}
          <div
            onClick={() => toggleIncidentModal(true)}
            className="p-5 rounded-xl bg-white dark:bg-[#1E3A5F] border border-[#FCF1F0] dark:border-[#B4B4B4] hover:border-[#B42318] dark:hover:text-[#E0776C] shadow-xs hover:shadow-card transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#FCF1F0] dark:bg-[#3F1414]/40 text-[#B42318] dark:text-[#C0C0C0] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">{t('report_incident', 'Report Emergency')}</h2>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
              {t('citizen_report_sos', 'Report stranded family, trapped individuals or urgent medical needs.')}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B42318] dark:text-[#C0C0C0] mt-3">
              <span>SOS Form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Tile 2: Find Safe Shelter â€” opens the shelter finder, which ranks
              camps by real distance from the visitor's own location. */}
          <div
            onClick={() => setCurrentView('CITIZEN_SHELTERS')}
            className="p-5 rounded-xl bg-white dark:bg-[#1E3A5F] border border-[#E4F3E9] dark:border-[#B4B4B4] hover:border-[#126B34] dark:hover:border-[#5BBF7A] shadow-xs hover:shadow-card transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E4F3E9] dark:bg-[#0A2E22]/40 text-[#126B34] dark:text-[#D0D0D0] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5" />
            </div>
            <h2 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">{t('citizen_find_shelter', 'Find Safe Shelter')}</h2>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
              Locate designated relief camps with free beds, water, food and first aid.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#126B34] dark:text-[#D0D0D0] mt-3">
              <span>View Camps</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Tile 3: Live Threat Map */}
          <div
            onClick={() => setCurrentView('CITIZEN_MAP')}
            className="p-5 rounded-xl bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:border-[#1A3A6B] dark:hover:border-[#5B7BA8] shadow-xs hover:shadow-card transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EEF2F8] dark:bg-[#171717] text-[#1A3A6B] dark:text-[#D0D0D0] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <h2 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">{t('citizen_threat_map', 'Live Threat Map')}</h2>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
              Inspect live inundation zones, flooded roads and high safe grounds.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] mt-3">
              <span>Open Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

        </div>

        {/* SAFE EVACUATION ROUTE â€” the dry-corridor planner, same component the
            authority Evacuation page uses. It measures the live roadblock list
            against your path and detours around anything flooded, and it tells
            you plainly when a route is not safe. */}
        <DryCorridorPlanner tone="citizen" />

        {/* NEARBY SAFE SHELTERS & SAFE ROUTE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Shelters List */}
          <div id="citizen-shelter-list" className="lg:col-span-7 bg-white dark:bg-[#1E3A5F] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
              <div>
                <h2 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
                  {t('citizen_shelters_title', 'Nearest Available Relief Shelters')}
                </h2>
                <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                  {t('citizen_shelters_desc', 'Designated high-elevation flood camps with power backup & medical staff')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {shelters.map((shelter) => {
                const freeBeds = shelter.totalCapacity - shelter.currentOccupancy;
                return (
                  <div
                    key={shelter.id}
                    className="p-4 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] bg-[#F1F1EF] dark:bg-[#171717] hover:bg-white dark:hover:bg-[#14151A] hover:border-[#E4F3E9] dark:hover:border-[#5B7BA8]/50 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#12294D] dark:text-[#D0D0D0] bg-[#E4F3E9] dark:bg-[#0A2E22]/60 border border-[#E4F3E9] dark:border-[#14532D]/60 px-2 py-0.5 rounded font-data">
                            {freeBeds} {t('citizen_free_beds', 'Free Beds')}
                          </span>
                          <span className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] font-data">Distance: ~1.8 km</span>
                        </div>
                        <h3 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF] mt-1">
                          {shelter.name}
                        </h3>
                        <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">{shelter.address}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
                        <button
                          onClick={() => {
                            calculateSafeRoute("Citizen GPS Location", shelter.id, {
                              lat: districtSite.latitude,
                              lng: districtSite.longitude
                            });
                            setCurrentView('CITIZEN_MAP');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#1A3A6B] dark:bg-[#ECECEC] hover:bg-[#12294D] dark:hover:bg-[#2E3038] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-[#1A3A6B] dark:border-[#B4B4B4]"
                        >
                          <Compass className="w-3.5 h-3.5 text-white" />
                          <span>{t('citizen_safe_route', 'Safe Route')}</span>
                        </button>
                        {shelter.lat && shelter.lng && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${shelter.lat},${shelter.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1 cursor-pointer border border-[#1A3A6B]/30"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-white" />
                            <span>Maps</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                      <span>{t('citizen_food', 'Food')}: {shelter.resources.foodPackets} packs</span>
                      <span>{t('citizen_water', 'Drinking Water')}: {shelter.resources.waterLiters}L</span>
                      <span>{t('citizen_med', 'Medical Facility')}: {shelter.hasMedicalFacility ? 'Available' : 'First Aid Only'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EMERGENCY CONTACTS & SAFETY CHECKLIST */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Toll-Free Helplines */}
            <div className="bg-white dark:bg-[#1E3A5F] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] p-5 space-y-3 shadow-xs">
              <h3 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                {t('citizen_helplines', 'Emergency Helpline Directory (24x7)')}
              </h3>
              
              <div className="space-y-2 text-xs font-data">
                <div className="flex items-center justify-between bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">National Disaster Response (NDRF)</span>
                  <a href="tel:1078" className="font-bold text-[#B42318] dark:text-[#C0C0C0] text-sm hover:underline">1078</a>
                </div>

                <div className="flex items-center justify-between bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">Emergency Medical / Ambulance</span>
                  <a href="tel:108" className="font-bold text-[#1A3A6B] dark:text-[#D0D0D0] text-sm hover:underline">108</a>
                </div>

                <div className="flex items-center justify-between bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">State Disaster Management Cell</span>
                  <a href="tel:1070" className="font-bold text-[#126B34] dark:text-[#D0D0D0] text-sm hover:underline">1070</a>
                </div>

                <div className="flex items-center justify-between bg-[#F1F1EF] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">Police Emergency Helpline</span>
                  <a href="tel:112" className="font-bold text-[#14151A] dark:text-[#FFFFFF] text-sm hover:underline">112</a>
                </div>
              </div>
            </div>

            {/* Dos and Don'ts */}
            <div className="bg-[#EEF2F8]/50 dark:bg-[#171717] border border-[#1A3A6B]/30 dark:border-[#B4B4B4] p-5 rounded-xl space-y-2.5 text-xs text-[#14151A] dark:text-[#FFFFFF]">
              <div className="font-bold flex items-center gap-1.5 text-[#14151A] dark:text-[#FFFFFF]">
                <ShieldCheck className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
                <span>{t('citizen_safety_title', 'Flood Safety Instructions:')}</span>
              </div>
              <ul className="space-y-1.5 text-[#5A5C66] dark:text-[#D0D0D0] pl-4 list-disc text-[11px] leading-relaxed">
                <li>Turn off main electrical breaker and gas cylinders before leaving home.</li>
                <li>Do not attempt to walk or drive through flowing floodwaters (even 15cm can sweep you off feet).</li>
                <li>Keep mobile phones charged and conserve battery for emergency calls.</li>
                <li>Drink only boiled or bottled water to avoid waterborne illness.</li>
              </ul>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
};
