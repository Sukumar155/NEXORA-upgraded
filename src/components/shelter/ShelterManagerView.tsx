import React, { useState } from 'react';
import { Home, Users, Package, Droplets, HeartPulse, Plus, Minus } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { getTranslation } from '../../i18n/translations';

export const ShelterManagerView: React.FC = () => {
  const { shelters, checkInArrival, updateShelterResource, currentLanguage } = useNexoraStore();
  const [selectedShelterIndex, setSelectedShelterIndex] = useState(0);

  const shelter = shelters[selectedShelterIndex] || shelters[0];

  const total = shelter.totalCapacity;
  const occupied = shelter.currentOccupancy;
  const reserved = shelter.reservedSpaces;
  const available = Math.max(0, total - occupied - reserved);

  const occupiedPct = Math.round((occupied / total) * 100);
  const reservedPct = Math.round((reserved / total) * 100);
  const availablePct = 100 - occupiedPct - reservedPct;

  // Stock warning flags
  const isFoodLow = shelter.resources.foodPackets < shelter.resources.foodLowThreshold;
  const isWaterLow = shelter.resources.waterLiters < shelter.resources.waterLowThreshold;
  const isMedLow = shelter.resources.medicalKits < shelter.resources.medicalLowThreshold;

  const t = (key: string, fallback?: string) => getTranslation(currentLanguage, key, fallback);

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[#14151A] dark:text-[#FFFFFF]">
      
      {/* VIEW HEADER & SHELTER SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#212121] p-5 sm:p-6 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#EFEFEC] dark:bg-[#2F2F2F] text-[#12294D] dark:text-[#D0D0D0] flex items-center justify-center shadow-xs border border-[#DCDCD8] dark:border-[#B4B4B4]">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF]">
              {t('shelter_heading', 'Shelter Management & Survivor Intake')}
            </h2>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              {t('shelter_subtitle', 'Real-time bed allocation, arriving boat columns, and ration replenishment')}
            </p>
          </div>
        </div>

        {/* Camp Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
            {t('shelter_active_camp', 'Active Camp:')}
          </label>
          <select
            value={selectedShelterIndex}
            onChange={(e) => setSelectedShelterIndex(Number(e.target.value))}
            className="px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs font-bold text-[#14151A] dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20 cursor-pointer"
          >
            {shelters.map((s, idx) => (
              <option key={s.id} value={idx}>
                {s.name} ({s.totalCapacity - s.currentOccupancy} {t('citizen_free_beds', 'free')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP ROW: OCCUPANCY RING CHART & SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* DONUT RING CHART CARD */}
        <div className="lg:col-span-5 p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
              {t('shelter_capacity_donut', 'Bed Capacity Allocation')}
            </h3>
            <span className="font-data text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EFEFEC] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] border border-[#DCDCD8] dark:border-[#B4B4B4]">
              Total: {total}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-4">
            {/* SVG DONUT CHART IN MIDNIGHT NAVY & WARM BROWN PALETTE */}
            <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring - Light Grey #E4E4E0 / Dark border */}
                <circle cx="50" cy="50" r="40" stroke="currentColor" className="text-[#E4E4E0] dark:text-[#D0D0D0]" strokeWidth="14" fill="none" />
                
                {/* Occupied Slice - Midnight Navy / Deep Blue #12294D */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#12294D"
                  strokeWidth="14"
                  strokeDasharray={`${occupiedPct * 2.51} 251.2`}
                  strokeDashoffset="0"
                  fill="none"
                  className="transition-all duration-700"
                />

                {/* Reserved Slice - Warm Brown #6B5545 */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#6B5545"
                  strokeWidth="14"
                  strokeDasharray={`${reservedPct * 2.51} 251.2`}
                  strokeDashoffset={`-${occupiedPct * 2.51}`}
                  fill="none"
                  className="transition-all duration-700"
                />

                {/* Available Slice - Safe Green #126B34 */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#126B34"
                  strokeWidth="14"
                  strokeDasharray={`${availablePct * 2.51} 251.2`}
                  strokeDashoffset={`-${(occupiedPct + reservedPct) * 2.51}`}
                  fill="none"
                  className="transition-all duration-700"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="font-data text-2xl font-bold text-[#14151A] dark:text-[#FFFFFF]">
                  {occupiedPct}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-bold">
                  {t('shelter_occupied', 'Occupied')}
                </span>
              </div>
            </div>

            {/* Legend & Count stats */}
            <div className="space-y-3 text-xs w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="w-3 h-3 rounded-full bg-[#12294D] flex-shrink-0" />
                <span className="text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_occupied', 'Filled Beds')}:</span>
                <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">{occupied}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="w-3 h-3 rounded-full bg-[#6B5545] flex-shrink-0" />
                <span className="text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_reserved', 'In-Transit')}:</span>
                <span className="font-data font-bold text-[#6B5545] dark:text-[#E0E0E0]">{reserved}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="w-3 h-3 rounded-full bg-[#126B34] flex-shrink-0" />
                <span className="text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_available', 'Available Free')}:</span>
                <span className="font-data font-bold text-[#126B34] dark:text-[#D0D0D0]">{available}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
            <span>Accessibility Score: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{shelter.accessibilityScore}/100</strong></span>
            <span>Medical Bay: <strong className="text-[#126B34] dark:text-[#D0D0D0]">Operational</strong></span>
          </div>
        </div>

        {/* RESOURCE TRACKER WITH LOW-STOCK WARNINGS */}
        <div className="lg:col-span-7 p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
                {t('shelter_rations', 'Camp Emergency Rations & Medical Stock')}
              </h3>
              <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                {t('shelter_rations_desc', 'Automatic alert triggers when inventory drops below 24-hour survival threshold')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            
            {/* 1. FOOD PACKETS */}
            <div className={`p-4 rounded-xl border transition-all ${ isFoodLow ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/40 border-[#F3CFC9] dark:border-[#7F1D1D]/60' : 'bg-[#F8F8F7] dark:bg-[#171717] border-[#E4E4E0] dark:border-[#B4B4B4]' }`}>
              <div className="flex items-center justify-between mb-2">
                <Package className={`w-5 h-5 ${isFoodLow ? 'text-[#B42318]' : 'text-[#12294D] dark:text-[#D0D0D0]'}`} />
                {isFoodLow && (
                  <span className="text-[10px] font-bold text-[#B42318] bg-[#F3CFC9] dark:text-[#F0A0A0] dark:bg-[#3F1414]/60 px-1.5 py-0.5 rounded uppercase">
                    Low Stock
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_food', 'Ready Meals')}</div>
              <div className="font-data text-2xl font-bold text-[#14151A] dark:text-[#FFFFFF] my-1">
                {shelter.resources.foodPackets}
              </div>
              <div className="text-[10px] text-[#5A5C66] dark:text-[#E0E0E0]">
                Min Safety: {shelter.resources.foodLowThreshold} pkts
              </div>

              {/* Quick Restock / Consume controls */}
              <div className="mt-3 pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <button
                  onClick={() => updateShelterResource(shelter.id, 'foodPackets', -50)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                  title="Distribute 50 rations"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] font-semibold">Distribute / Restock</span>
                <button
                  onClick={() => updateShelterResource(shelter.id, 'foodPackets', 200)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                  title="Restock 200 rations"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. DRINKING WATER */}
            <div className={`p-4 rounded-xl border transition-all ${ isWaterLow ? 'bg-[#FBF7EC] dark:bg-[#3A2A0A]/40 border-[#F7E9D6] dark:border-[#78350F]/60' : 'bg-[#F8F8F7] dark:bg-[#171717] border-[#E4E4E0] dark:border-[#B4B4B4]' }`}>
              <div className="flex items-center justify-between mb-2">
                <Droplets className={`w-5 h-5 ${isWaterLow ? 'text-[#8A4D06]' : 'text-[#12294D] dark:text-[#D0D0D0]'}`} />
                {isWaterLow && (
                  <span className="text-[10px] font-bold text-[#8A4D06] bg-[#F7E9D6] dark:text-[#F5C77E] dark:bg-[#3A2A0A]/60 px-1.5 py-0.5 rounded uppercase">
                    Critical
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_water', 'Potable Water')}</div>
              <div className="font-data text-2xl font-bold text-[#14151A] dark:text-[#FFFFFF] my-1">
                {shelter.resources.waterLiters} L
              </div>
              <div className="text-[10px] text-[#5A5C66] dark:text-[#E0E0E0]">
                Min Safety: {shelter.resources.waterLowThreshold} L
              </div>

              <div className="mt-3 pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <button
                  onClick={() => updateShelterResource(shelter.id, 'waterLiters', -100)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                  title="Dispense 100L"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] font-semibold">Bowser Fill</span>
                <button
                  onClick={() => updateShelterResource(shelter.id, 'waterLiters', 500)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                  title="Add 500L bowser tanker"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. MEDICAL KITS */}
            <div className={`p-4 rounded-xl border transition-all ${ isMedLow ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/40 border-[#F3CFC9] dark:border-[#7F1D1D]/60' : 'bg-[#F8F8F7] dark:bg-[#171717] border-[#E4E4E0] dark:border-[#B4B4B4]' }`}>
              <div className="flex items-center justify-between mb-2">
                <HeartPulse className={`w-5 h-5 ${isMedLow ? 'text-[#B42318]' : 'text-[#126B34] dark:text-[#D0D0D0]'}`} />
                {isMedLow && (
                  <span className="text-[10px] font-bold text-[#B42318] bg-[#F3CFC9] dark:text-[#F0A0A0] dark:bg-[#3F1414]/60 px-1.5 py-0.5 rounded uppercase">
                    Restock
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">{t('shelter_med', 'Trauma / Med Kits')}</div>
              <div className="font-data text-2xl font-bold text-[#14151A] dark:text-[#FFFFFF] my-1">
                {shelter.resources.medicalKits}
              </div>
              <div className="text-[10px] text-[#5A5C66] dark:text-[#E0E0E0]">
                Min Safety: {shelter.resources.medicalLowThreshold} kits
              </div>

              <div className="mt-3 pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <button
                  onClick={() => updateShelterResource(shelter.id, 'medicalKits', -5)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] font-semibold">Paramedic Unit</span>
                <button
                  onClick={() => updateShelterResource(shelter.id, 'medicalKits', 20)}
                  className="p-1 rounded-lg bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] hover:bg-[#F8F8F7] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* BOTTOM ROW: EXPECTED INBOUND ARRIVALS LIST WITH ONE-CLICK CHECK-IN */}
      <div className="p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#12294D] dark:text-[#D0D0D0]" />
              {t('shelter_arrivals', 'Expected Inbound Evacuation Columns')}
            </h3>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              {t('shelter_arrivals_desc', 'Rescue motorboats and trucks currently routing survivors')} to {shelter.name}.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[#E4E4E0] dark:divide-[#B4B4B4] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl overflow-hidden">
          {shelter.expectedArrivals.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              No inbound convoys currently dispatched to this shelter.
            </div>
          ) : (
            shelter.expectedArrivals.map((arrival) => (
              <div
                key={arrival.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${ arrival.checkedIn ? 'bg-[#F1F8F3] dark:bg-[#0A2E22]/30' : 'hover:bg-[#F8F8F7] dark:hover:bg-[#0D0E12]' }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                      {arrival.teamName}
                    </span>
                    <span className="font-data text-xs font-bold text-[#12294D] dark:text-[#D0D0D0] bg-[#EFEFEC] dark:bg-[#171717] px-2 py-0.5 rounded border border-[#DCDCD8] dark:border-[#B4B4B4]">
                      ETA: {arrival.eta}
                    </span>
                    {arrival.checkedIn && (
                      <span className="text-[10px] font-bold text-[#126B34] dark:text-[#D0D0D0] bg-[#CFE6D8] dark:bg-[#0A2E22]/60 px-2 py-0.5 rounded-full uppercase">
                        Ã¢Å“â€œ Intake Verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                    Special Needs: <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF]">{arrival.needsSummary}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-[#5A5C66] dark:text-[#D0D0D0] uppercase">Headcount</div>
                    <div className="font-data text-base font-bold text-[#B42318] dark:text-[#C0C0C0]">
                      {arrival.headcount} Citizens
                    </div>
                  </div>

                  <button
                    disabled={arrival.checkedIn}
                    onClick={() => checkInArrival(shelter.id, arrival.id)}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      arrival.checkedIn
                        ? 'opacity-50 cursor-not-allowed bg-[#F1F1EF] dark:bg-[#B4B4B4] text-[#6B6D77] dark:text-[#E0E0E0]'
                        : 'bg-[#12294D] hover:bg-[#0F2140] text-white shadow-xs'
                    }`}
                  >
                    {arrival.checkedIn ? 'Checked-In' : t('shelter_checkin_btn', 'Confirm Check-In')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
