import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { Home, Droplets, Utensils, HeartPulse, ExternalLink } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';

export const EvacuationPage: React.FC = () => {
  // Route planning lives in the citizen portal only â€” see DryCorridorPlanner.
  const { shelters, setCurrentView } = useNexoraStore();

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl text-[#126B34] text-white flex items-center justify-center shadow-md flex-shrink-0 dark:text-[#D0D0D0]">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  Citizen Safety & Evacuation Logistics
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#E4F3E9] dark:border-[#14532D]/60">
                  Shelter Capacity
                </span>
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#12294D] dark:text-[#D0D0D0] mt-0.5">
                Safe Shelters & Relief Camp Capacity
              </h1>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
                Citizen route planning lives in the Citizen Portal &rarr; &ldquo;Find a Safe Route to a Shelter&rdquo;.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('DISASTER_MAP')}
              className="px-4 py-2 rounded-xl bg-[#12294D] hover:bg-[#12294D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>View Evacuation Map</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SHELTERS LIST & CAPACITY METRICS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-base text-[#12294D] dark:text-[#FFFFFF]">
                Active Designated Relief Camps ({shelters.length})
              </h2>
              <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                Real-time occupancy tracking, rations supply, and bed availability
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shelters.map((shelter) => {
              const freeBeds = shelter.totalCapacity - shelter.currentOccupancy;
              const occupancyPct = Math.round((shelter.currentOccupancy / shelter.totalCapacity) * 100);
              const isLimited = occupancyPct >= 80;

              return (
                <div key={shelter.id} className="nexora-card p-5 space-y-4 border dark:bg-[#1E3A5F] dark:border-[#B4B4B4] hover:border-[#12294D]/40 dark:hover:border-[#5B7BA8]/50 transition-all">
                  
                  {/* Shelter Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-data ${ isLimited ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0]' : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0]' }`}>
                          {isLimited ? 'LIMITED SPACE' : 'AVAILABLE'}
                        </span>
                        <span className="text-xs text-[#5A5C66] dark:text-[#E0E0E0] font-data">#{shelter.id}</span>
                      </div>
                      <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#D0D0D0] mt-1 line-clamp-1">
                        {shelter.name}
                      </h3>
                      <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] line-clamp-1">{shelter.address}</p>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-[#F1F8F3] dark:bg-[#0A2E22]/40 text-[#126B34] dark:text-[#E0E0E0] flex items-center justify-center flex-shrink-0">
                      <Home className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Occupancy Progress */}
                  <div className="space-y-1.5 bg-[#F1F1EF] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0]/80 dark:border-[#B4B4B4]">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold text-[#5A5C66] dark:text-[#D0D0D0]">Capacity Status</span>
                      <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">
                        {shelter.currentOccupancy} <span className="font-normal text-[#5A5C66] dark:text-[#E0E0E0]">/ {shelter.totalCapacity}</span>
                      </span>
                    </div>

                    <div className="w-full bg-[#F1F1EF] dark:bg-[#B4B4B4] h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${ occupancyPct >= 85 ? 'bg-[#A15C07]' : 'text-[#126B34]' } dark:text-[#D0D0D0] `}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-data text-[#5A5C66] dark:text-[#D0D0D0] pt-0.5">
                      <span className="font-bold text-[#126B34] dark:text-[#E0E0E0]">{freeBeds} beds available</span>
                      <span>{occupancyPct}% full</span>
                    </div>
                  </div>

                  {/* Rations / Supplies Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs font-data">
                    <div className="bg-white dark:bg-[#ECECEC] p-2 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs">
                      <Utensils className="w-3.5 h-3.5 text-[#A15C07] dark:text-[#D0D0D0] mx-auto mb-1" />
                      <span className="text-[9px] text-[#5A5C66] dark:text-[#E0E0E0] block uppercase">Food Packs</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{shelter.resources.foodPackets}</span>
                    </div>

                    <div className="bg-white dark:bg-[#ECECEC] p-2 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs">
                      <Droplets className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0] mx-auto mb-1" />
                      <span className="text-[9px] text-[#5A5C66] dark:text-[#E0E0E0] block uppercase">Water (L)</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{shelter.resources.waterLiters}</span>
                    </div>

                    <div className="bg-white dark:bg-[#ECECEC] p-2 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs">
                      <HeartPulse className="w-3.5 h-3.5 text-[#B42318] dark:text-[#C0C0C0] mx-auto mb-1" />
                      <span className="text-[9px] text-[#5A5C66] dark:text-[#E0E0E0] block uppercase">Med Kits</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{shelter.resources.medicalKits}</span>
                    </div>
                  </div>

                  {/* Expected Inflow / Arrivals */}
                  <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">
                    <span>
                      Inflow: <strong>{shelter.expectedArrivals.filter(a => !a.checkedIn).length} columns en-route</strong>
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
};
