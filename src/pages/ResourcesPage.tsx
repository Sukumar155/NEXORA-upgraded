import React, { useState } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { Navigation, Send, CheckCircle2, Truck, Anchor, Users, Droplets, HeartPulse, Activity, Waves, X } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { EmergencyResourceItem } from '../types/resource';
import { getTranslation } from '../i18n/translations';

export const ResourcesPage: React.FC = () => {
  const {
    resources,
    dispatchLogs,
    sosReports,
    dispatchResource,
    setCurrentView,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  const [selectedResource, setSelectedResource] = useState<EmergencyResourceItem | null>(null);
  const [dispatchQty, setDispatchQty] = useState(1);
  // Empty by default: destinations are derived from live SOS reports and
  // shelters, so there is no hard-coded zone to go stale or mismatch the list.
  const [destination, setDestination] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  const openMissions = sosReports.filter((r) => r.status === 'PENDING' || r.status === 'TRIAGED');
  const { shelters } = useNexoraStore();

  const openDispatch = (res: EmergencyResourceItem) => {
    setSelectedResource(res);
    setDispatchQty(1);
    setDestination('');
  };

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResource || !destination) return;

    dispatchResource(selectedResource.id, dispatchQty, destination);
    setSelectedResource(null);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AMBULANCE': return <Truck className="w-5 h-5 text-[#B42318] dark:text-[#FFFFFF]" />;
      case 'RESCUE_BOAT': return <Anchor className="w-5 h-5 text-[#12294D] dark:text-[#FFFFFF]" />;
      case 'NDRF_TEAM':
      case 'SDRF_TEAM': return <Users className="w-5 h-5 text-[#126B34] dark:text-[#D0D0D0]" />;
      case 'MEDICAL_KIT': return <HeartPulse className="w-5 h-5 text-[#B42318] dark:text-[#FFFFFF]" />;
      case 'WATER_PACK': return <Droplets className="w-5 h-5 text-[#12294D] dark:text-[#FFFFFF]" />;
      case 'HIGH_FLOW_PUMP': return <Waves className="w-5 h-5 text-[#2C5C93] dark:text-[#E0E0E0]" />;
      default: return <Activity className="w-5 h-5 text-[#1A3A6B] dark:text-[#D0D0D0]" />;
    }
  };

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#212121] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#EFEFEC] dark:bg-[#2F2F2F] text-[#12294D] dark:text-[#D0D0D0] flex items-center justify-center shadow-xs border border-[#DCDCD8] dark:border-[#B4B4B4] flex-shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  {t('resources_subtitle', 'SEOC Logistics & Field Assets â€¢ Resource Allocation Hub')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFEFEC] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] border border-[#DCDCD8] dark:border-[#B4B4B4]">
                  Resource Allocation Hub
                </span>
              </div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-0.5">
                {t('resources_title', 'Emergency Resource Prioritization & Fleet')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('DISASTER_MAP')}
              className="px-4 py-2 rounded-xl bg-[#12294D] hover:bg-[#0F2140] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {t('resources_locate_btn', 'Locate Fleet on GIS Map')}
            </button>
          </div>
        </div>

        {/* TOAST CONFIRMATION */}
        {successToast && (
          <div className="bg-[#F1F8F3] dark:bg-[#0A2E22]/40 border border-[#CFE6D8] dark:border-[#14532D]/60 p-4 rounded-xl flex items-center gap-2 text-xs font-bold text-[#126B34] dark:text-[#D0D0D0] animate-fade-in shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-[#126B34] dark:text-[#D0D0D0] flex-shrink-0" />
            <span>Emergency resource successfully dispatched and logged to Incident Command dispatch manifest!</span>
          </div>
        )}

        {/* RESOURCE INVENTORY GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {resources.map((res) => {
            const isLow = res.availableQuantity <= 2;
            const isDepleted = res.availableQuantity === 0;

            return (
              <div
                key={res.id}
                className={`p-5 rounded-xl bg-white dark:bg-[#212121] border space-y-4 shadow-xs transition-all ${ isDepleted ? 'border-[#F3CFC9] bg-[#FCF1F0]/30 dark:bg-[#3F1414]/20 dark:bg-[#7F1D1D]/40' : isLow ? 'border-[#F7E9D6] bg-[#FBF7EC]/30 dark:bg-[#3A2A0A]/40 dark:bg-[#78350F]/40' : 'border-[#E4E4E0] dark:border-[#B4B4B4] hover:border-[#DCDCD8] dark:hover:border-[#5B7BA8]/40' }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F8F8F7] dark:bg-[#2F2F2F] border border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(res.category)}
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-data ${ res.status === 'OPTIMAL' ? 'bg-[#F1F8F3] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#D0D0D0] border border-[#CFE6D8] dark:border-[#14532D]/60' : 'bg-[#FBF7EC] dark:bg-[#3A2A0A]/60 text-[#8A4D06] dark:text-[#D0D0D0] border border-[#F7E9D6] dark:border-[#78350F]/60' }`}>
                        {res.status}
                      </span>
                      <h3 className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF] mt-1 leading-snug">
                        {res.name}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Stock & Availability Gauge */}
                <div className="bg-[#F8F8F7] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] space-y-2 font-data">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[#5A5C66] dark:text-[#D0D0D0] font-sans font-medium">{t('resources_avail_units', 'Available Units')}</span>
                    <div>
                      <span className="text-2xl font-bold text-[#14151A] dark:text-[#FFFFFF]">{res.availableQuantity}</span>
                      <span className="text-xs text-[#5A5C66] dark:text-[#E0E0E0] font-sans ml-1">/ {res.totalQuantity} {res.unit}</span>
                    </div>
                  </div>

                  <div className="w-full bg-[#E4E4E0] dark:bg-[#B4B4B4] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDepleted ? 'bg-[#B42318]' : isLow ? 'bg-[#8A4D06]' : 'bg-[#12294D]'
                      }`}
                      style={{ width: `${(res.availableQuantity / res.totalQuantity) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">
                    <span>Deployed: {res.deployedQuantity}</span>
                    <span>Reserve: {res.maintenanceQuantity}</span>
                  </div>
                </div>

                {/* Staging Base & Officer */}
                <div className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] space-y-1 pt-1">
                  <div>Base: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{res.locationHub}</strong></div>
                  <div>Officer: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{res.contactPerson}</strong></div>
                </div>

                {/* Dispatch Button */}
                <button
                  disabled={res.availableQuantity === 0}
                  onClick={() => openDispatch(res)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    res.availableQuantity > 0
                      ? 'btn-primary-gradient text-white shadow-xs'
                      : 'bg-[#F1F1EF] dark:bg-[#B4B4B4] text-[#6B6D77] dark:text-[#E0E0E0] cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('resources_dispatch_btn', 'Allocate & Dispatch')}</span>
                </button>

              </div>
            );
          })}
        </div>

        {/* DISPATCH MANIFEST LOGS */}
        <div className="p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
            <div>
              <h2 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
                {t('resources_manifest_title', 'Active Field Dispatch Manifest')}
              </h2>
              <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                {t('resources_manifest_desc', 'Audit trail of all emergency units currently deployed in the field')}
              </p>
            </div>
            <span className="text-xs font-data font-bold text-[#5A5C66] dark:text-[#D0D0D0]">
              {dispatchLogs.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F8F7] dark:bg-[#171717] text-[#5A5C66] dark:text-[#D0D0D0] font-bold uppercase text-[10px] tracking-wider border-y border-[#E4E4E0] dark:border-[#B4B4B4]">
                <tr>
                  <th className="py-2.5 px-3">Dispatch ID</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Resource Asset</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Destination Mission</th>
                  <th className="py-2.5 px-3">Assigned By</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E0] dark:divide-[#B4B4B4]">
                {dispatchLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F8F7]/80 dark:hover:bg-[#1C1D22]/60 transition-colors">
                    <td className="py-3 px-3 font-data font-bold text-[#12294D] dark:text-[#D0D0D0]">{log.id}</td>
                    <td className="py-3 px-3 font-data text-[#5A5C66] dark:text-[#D0D0D0]">{log.timestamp}</td>
                    <td className="py-3 px-3 font-semibold text-[#14151A] dark:text-[#FFFFFF]">{log.resourceName}</td>
                    <td className="py-3 px-3 font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">{log.quantity}</td>
                    <td className="py-3 px-3 text-[#5A5C66] dark:text-[#D0D0D0]">{log.dispatchedTo}</td>
                    <td className="py-3 px-3 text-[#5A5C66] dark:text-[#D0D0D0]">{log.assignedBy}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-data font-bold text-[10px] ${ log.status === 'TRANSIT' ? 'bg-[#FBF7EC] dark:bg-[#3A2A0A]/60 text-[#8A4D06] dark:text-[#D0D0D0] border border-[#F7E9D6] dark:border-[#78350F]/60' : 'bg-[#F1F8F3] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#D0D0D0] border border-[#CFE6D8] dark:border-[#14532D]/60' }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DISPATCH ALLOCATION MODAL */}
        {selectedResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14151A]/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white dark:bg-[#212121] rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-[#E4E4E0] dark:border-[#B4B4B4]">
              <div className="bg-[#EFEFEC] dark:bg-[#2F2F2F] text-[#14151A] dark:text-[#FFFFFF] px-5 py-4 flex items-center justify-between border-b border-[#DCDCD8] dark:border-[#B4B4B4]">
                <div>
                  <h3 className="font-heading font-bold text-base leading-tight">Dispatch Emergency Asset</h3>
                  <p className="text-xs text-[#12294D] dark:text-[#D0D0D0] font-semibold">{selectedResource.name}</p>
                </div>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="p-1 rounded-lg hover:bg-[#F1F1EF] dark:hover:bg-[#2E3038] text-[#5A5C66] dark:text-[#D0D0D0] hover:text-[#14151A] dark:hover:text-[#F1F1EF] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmDispatch} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                    Select Mission Destination / SOS Report
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
                  >
                    <option value="">Select a mission destinationâ€¦</option>

                    {openMissions.length > 0 && (
                      <optgroup label="Active SOS Missions">
                        {openMissions.map((r) => (
                          <option key={r.id} value={`${r.locationName} (${r.id})`}>
                            {r.id}: {r.locationName} ({r.peopleCount} trapped)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="Relief Camps">
                      {shelters.map((s) => {
                        const free = s.totalCapacity - s.currentOccupancy;
                        return (
                          <option key={s.id} value={s.name}>
                            {s.name} â€” {free > 0 ? `${free} beds free` : 'FULL'}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                    Quantity to Allocate (Max: {selectedResource.availableQuantity} {selectedResource.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedResource.availableQuantity}
                    value={dispatchQty}
                    onChange={(e) => setDispatchQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] font-data font-bold focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
                  />
                </div>

                <div className="bg-[#EFEFEC] dark:bg-[#171717] border border-[#DCDCD8] dark:border-[#B4B4B4] p-3 rounded-xl text-xs text-[#12294D] dark:text-[#D0D0D0]">
                  Unit will be assigned to incident response queue with priority dispatch route avoiding flooded roads.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4]">
                  <button
                    type="button"
                    onClick={() => setSelectedResource(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0] hover:bg-[#F1F1EF] dark:hover:bg-[#2E3038] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!destination}
                    className="px-5 py-2 rounded-xl text-xs font-bold btn-primary-gradient text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Dispatch</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
