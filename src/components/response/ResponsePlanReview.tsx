import React from 'react';
import { X, Navigation, Home, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, MapPin, Gauge } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNexoraStore } from '../../store/useNexoraStore';

export const ResponsePlanReview: React.FC = () => {
  const {
    isResponsePlanOpen,
    closeResponsePlan,
    selectedSOSId,
    sosReports,
    teams,
    shelters,
    approveResponsePlan,
    rejectResponsePlan,
    activePlanCommitted
  } = useNexoraStore();

  if (!isResponsePlanOpen || !selectedSOSId) return null;

  const report = sosReports.find(r => r.id === selectedSOSId);
  const proposedTeam = teams[0]; // NDRF 1st Bn Alpha
  const proposedShelter = shelters[0]; // Pragati High School

  if (!report) return null;

  const handleApprove = () => {
    approveResponsePlan(report.id, proposedTeam.id, proposedShelter.id);
    // Fire confetti confirmation
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#126B34', '#7E9AC4', '#12294D']
      });
    } catch (e) {
      console.warn("Confetti animation:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-[#14151A]/60 backdrop-blur-xs animate-fadeIn dark:text-[#FFFFFF]">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#212121] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between bg-white dark:bg-[#212121]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-data text-xs font-bold text-[#12294D] dark:text-[#D0D0D0] bg-[#F1F1EF] dark:bg-[#171717] px-2 py-0.5 rounded border border-[#DEDEDA] dark:border-[#B4B4B4]">
                PLAN #{report.id}
              </span>
              {activePlanCommitted ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#126B34]/15 text-[#126B34] border border-[#126B34]/30 uppercase tracking-wider dark:text-[#D0D0D0]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  DISPATCH COMMITTED
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EFEFEC] dark:bg-[#2F2F2F]/60 text-[#12294D] dark:text-[#D0D0D0] border border-[#DCDCD8] dark:border-[#B4B4B4] uppercase tracking-wider">
                  AI DISPATCH PROPOSAL
                </span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-1">
              Response Plan & Evacuation Corridor
            </h2>
          </div>

          <button
            onClick={closeResponsePlan}
            className="w-8 h-8 rounded-full bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#6B6D77] dark:text-[#D0D0D0] flex items-center justify-center cursor-pointer transition-all"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* COMMITTED STATE BANNER */}
          {activePlanCommitted && (
            <div className="p-4 rounded-xl bg-[#126B34]/10 border border-[#126B34] flex items-center gap-3.5 text-[#126B34] dark:text-[#D0D0D0]">
              <ShieldCheck className="w-8 h-8 flex-shrink-0" />
              <div>
                <div className="font-heading font-bold text-base text-[#126B34] dark:text-[#D0D0D0]">
                  Mission Dispatched & Encrypted to Field Tablet
                </div>
                <div className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5">
                  {proposedTeam.name} has accepted coordinates. Evacuation bed reservation locked at {proposedShelter.name}.
                </div>
              </div>
            </div>
          )}

          {/* TWO CARDS GRID: TEAM + SHELTER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. PROPOSED TEAM CARD */}
            <div className="bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                  Assigned Column
                </span>
                <span className="font-data text-xs font-bold text-[#126B34] bg-[#F1F8F3] dark:text-[#6EE7B7] dark:bg-[#0A2E22]/60 px-2 py-0.5 rounded border border-[#E4F3E9] dark:border-[#14532D]/60">
                  ETA: {proposedTeam.etaMinutes} mins
                </span>
              </div>

              <div>
                <h4 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#D0D0D0]">
                  {proposedTeam.name}
                </h4>
                <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0] mt-0.5">
                  Base: {proposedTeam.currentLocation} ({proposedTeam.distanceKm} km away)
                </p>
              </div>

              <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4]">
                <div className="text-[11px] font-semibold text-[#5A5C66] dark:text-[#D0D0D0] mb-1.5">Capabilities:</div>
                <div className="flex flex-wrap gap-1">
                  {proposedTeam.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded bg-[#F1F1EF] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] text-[10px] font-medium"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. PROPOSED SHELTER CARD */}
            <div className="bg-white dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-[#126B34] dark:text-[#D0D0D0]" />
                  Designated Camp
                </span>
                <span className="font-data text-xs font-bold text-[#12294D] dark:text-[#D0D0D0] bg-[#EFEFEC] dark:bg-[#2F2F2F]/60 px-2 py-0.5 rounded border border-[#DCDCD8] dark:border-[#B4B4B4]">
                  {proposedShelter.accessibilityScore}% Access Score
                </span>
              </div>

              <div>
                <h4 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#D0D0D0]">
                  {proposedShelter.name}
                </h4>
                <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0] mt-0.5">
                  {proposedShelter.address}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4]">
                <div className="flex items-center justify-between text-xs font-data">
                  <span className="text-[#5A5C66] dark:text-[#D0D0D0]">Available Beds:</span>
                  <span className="font-bold text-[#126B34] dark:text-[#D0D0D0]">
                    {proposedShelter.totalCapacity - proposedShelter.currentOccupancy} of {proposedShelter.totalCapacity}
                  </span>
                </div>
                <div className="text-[10px] text-[#6B6D77] dark:text-[#E0E0E0] mt-1">
                  Includes Medical Isolation Unit + Wheelchair Ramp
                </div>
              </div>
            </div>

          </div>

          {/* 3. ROUTE TELEMETRY PREVIEW */}
          <div className="bg-[#F8F8F7] dark:bg-[#171717] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-[#12294D] flex items-center gap-1.5 dark:text-[#FFFFFF]">
                <Gauge className="w-4 h-4 text-[#1A3A6B] dark:text-[#E0E0E0]" />
                Route Inundation Telemetry
              </span>
              <span className="font-data font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">
                Transit Distance: 5.2 km â€¢ Drive Time: ~14 mins
              </span>
            </div>

            {/* Visual polyline track representation */}
            <div className="relative w-full h-12 bg-white dark:bg-[#212121] rounded-xl border border-[#DEDEDA] dark:border-[#B4B4B4] p-2 flex items-center justify-between px-6 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#126B34]" />
                <span className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">Pandu Port</span>
              </div>
              <div className="flex-1 mx-4 h-1.5 bg-gradient-to-r from-[#126B34] via-[#A15C07] to-[#B42318] rounded-full relative">
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-data font-bold text-[#A15C07] dark:text-[#D0D0D0] bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 px-1 border border-[#EFE3C4] dark:border-[#78350F]/60 rounded">
                  0.8m Surge
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#B42318] pulse-beacon" />
                <span className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">Target SOS</span>
              </div>
            </div>

            {/* 4. CONSTRAINT WARNING BOX (Exact prompt specification) */}
            <div className="p-3.5 rounded-xl bg-[#FAF0D8]/90 dark:bg-[#3A2A0A]/40 border border-[#EFE3C4] dark:text-[#E0E0E0]/60 flex items-start gap-3 text-xs text-[#7A3E0B] dark:text-[#D0D0D0]">
              <AlertTriangle className="w-4 h-4 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Constraint Warning: </strong>
                Route passes through Zone C â€” water level 0.8m and rising at 4cm/hr. Requires inflatable rescue boat (IRB) or high-clearance 4x4 troop carrier.
              </div>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-6 border-t border-[#E4E4E0] dark:border-[#B4B4B4] bg-[#FFFFFF] dark:bg-[#212121] flex flex-col sm:flex-row items-center justify-end gap-3">
          {!activePlanCommitted ? (
            <>
              <button
                type="button"
                onClick={() => rejectResponsePlan(report.id)}
                className="w-full sm:w-auto btn-ghost-outline py-2.5 px-5 text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#B4B4B4] dark:hover:bg-[#1C1D22] order-2 sm:order-1"
              >
                Reject / Re-route
              </button>

              <button
                type="button"
                onClick={handleApprove}
                className="w-full sm:w-auto btn-primary-gradient py-3 px-6 text-sm font-bold shadow-md flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                <span>Approve & Dispatch Column</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={closeResponsePlan}
              className="w-full sm:w-auto btn-primary-gradient py-2.5 px-6 text-xs font-bold"
            >
              Close & Track on Incident Map
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
