import React, { useState } from 'react';
import { X, Camera, MapPin, Users, AlertTriangle, CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { getTranslation } from '../../i18n/translations';

export const IncidentReportModal: React.FC = () => {
  const { isIncidentModalOpen, toggleIncidentModal, submitCitizenIncident, currentLanguage } = useNexoraStore();
  const t = (k: Parameters<typeof getTranslation>[1], f?: string) => getTranslation(currentLanguage, k, f);

  const [category, setCategory] = useState<'Flood' | 'Road Blockage' | 'Building Damage' | 'Fallen Tree' | 'Medical'>('Flood');
  const [locationName, setLocationName] = useState('Bharalumukh Sluice Gate West, Guwahati');
  const [peopleCount, setPeopleCount] = useState(3);
  const [description, setDescription] = useState('Floodwater reaching ground floor windows. Senior citizen needs oxygen support.');
  const [phone, setPhone] = useState('+91 98640 12345');
  const [submitted, setSubmitted] = useState(false);

  if (!isIncidentModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCitizenIncident({
      title: `${category} Emergency Reported`,
      description,
      locationName,
      lat: 26.173 + (Math.random() * 0.008 - 0.004),
      lng: 91.715 + (Math.random() * 0.008 - 0.004),
      peopleCount,
      category,
      reporterPhone: phone
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      toggleIncidentModal(false);
    }, 1800);
  };

  const categories: { id: typeof category; label: string; icon: string }[] = [
    { id: 'Flood', label: 'Flood Inundation', icon: 'ðŸŒŠ' },
    { id: 'Road Blockage', label: 'Blocked Road', icon: 'ðŸš§' },
    { id: 'Building Damage', label: 'Structural Damage', icon: 'ðŸšï¸' },
    { id: 'Fallen Tree', label: 'Fallen Tree/Poles', icon: 'ðŸŒ²' },
    { id: 'Medical', label: 'Medical Emergency', icon: 'ðŸš‘' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17181C]/60 backdrop-blur-xs animate-fade-in font-body">
      <div className="bg-white dark:bg-[#212121] rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-[#E4E4E0] dark:border-[#B4B4B4] text-[#14151A] dark:text-[#FFFFFF]">
        
        {/* Modal Header */}
        <div className="bg-[#EFEFEC] dark:bg-[#2F2F2F] px-6 py-4 border-b border-[#DCDCD8] dark:border-[#B4B4B4] flex items-center justify-between text-[#14151A] dark:text-[#FFFFFF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FCF1F0] dark:bg-[#3F1414]/50 border border-[#F3CFC9] dark:border-[#7F1D1D]/60 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#B42318] dark:text-[#C0C0C0]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight text-[#14151A] dark:text-[#FFFFFF]">{t('report_modal_title', 'Report Disaster Incident')}</h2>
              <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">Live Sync with SEOC Incident Command System</p>
            </div>
          </div>
          <button
            onClick={() => toggleIncidentModal(false)}
            className="p-1 rounded-lg hover:bg-[#F1F1EF] dark:hover:bg-[#2E3038] text-[#5A5C66] dark:text-[#D0D0D0] hover:text-[#14151A] dark:hover:text-[#F1F1EF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#F0F7F4] dark:bg-[#0A2E22]/40 text-[#2A6B4A] dark:text-[#D0D0D0] border border-[#CFE6D8] dark:border-[#14532D]/60 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10 nx-pop" />
            </div>
            <h3 className="text-lg font-bold text-[#14151A] dark:text-[#FFFFFF]">Incident Dispatched & Verified!</h3>
            <p className="text-sm text-[#5A5C66] dark:text-[#D0D0D0] max-w-sm mx-auto">
              Your report has been geotagged, assigned an AI triage score of <strong className="text-[#2A6B4A] dark:text-[#D0D0D0]">84/100</strong>, and pinned to the live rescue grid for immediate response.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0F7F4] dark:bg-[#0A2E22]/40 border border-[#CFE6D8] dark:border-[#14532D]/60 text-xs font-semibold text-[#2A6B4A] dark:text-[#D0D0D0]">
              <ShieldCheck className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
              <span>Broadcast to NDRF & SDRF Units</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] mb-2">
                {t('report_category', 'Incident Category')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      category === c.id
                        ? 'btn-primary-gradient text-white border-[#14151A] shadow-2xs'
                        : 'border-[#E4E4E0] dark:border-[#B4B4B4] bg-[#F8F8F7] dark:bg-[#171717] text-[#14151A] dark:text-[#FFFFFF] hover:bg-[#EFEFEC] dark:hover:bg-[#1C1D22]'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span className="truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Attachment simulation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] mb-1.5">
                Attach Photo / Drone Footage (Optional)
              </label>
              <div className="border-2 border-dashed border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-3 text-center bg-[#F8F8F7] dark:bg-[#171717] hover:bg-[#EFEFEC] dark:hover:bg-[#1C1D22] hover:border-[#DCDCD8] dark:hover:border-[#5B7BA8]/40 transition-all cursor-pointer">
                <div className="flex items-center justify-center gap-2 text-[#5A5C66] dark:text-[#D0D0D0] text-xs">
                  <Camera className="w-4 h-4 text-[#12294D] dark:text-[#D0D0D0]" />
                  <span>Click to capture or upload disaster image</span>
                </div>
                <div className="text-[10px] text-[#5A5C66] dark:text-[#E0E0E0] mt-1">Supports GPS Geotagged JPEG, PNG (Auto YOLO-analyzed)</div>
              </div>
            </div>

            {/* Location & Trapped Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                  {t('report_location', 'Incident Location')}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#B42318] dark:text-[#C0C0C0] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] focus:bg-white dark:focus:bg-[#17181C] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
                    placeholder="Area, Street, Landmark"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                  {t('report_people_trapped', 'People Trapped / At Risk')}
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-[#12294D] dark:text-[#D0D0D0] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                    className="w-full pl-9 pr-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] focus:bg-white dark:focus:bg-[#17181C] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                {t('report_desc', 'Emergency Situation Description')}
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] focus:bg-white dark:focus:bg-[#17181C] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
                placeholder="Detail the urgent needs (elderly, infants, medicines, water level rising...)"
              />
            </div>

            {/* Reporter Contact */}
            <div>
              <label className="block text-xs font-bold text-[#14151A] dark:text-[#D0D0D0] mb-1">
                {t('report_phone', 'Reporter Phone Number')}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] focus:bg-white dark:focus:bg-[#17181C] focus:outline-none focus:ring-2 focus:ring-[#12294D]/20"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E4E4E0] dark:border-[#B4B4B4]">
              <button
                type="button"
                onClick={() => toggleIncidentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A5C66] dark:text-[#D0D0D0] hover:bg-[#F1F1EF] dark:hover:bg-[#2E3038] transition-colors cursor-pointer"
              >
                {t('report_cancel_btn', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B42318] hover:bg-[#A93A32] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('report_submit_btn', 'Submit Incident to Rescue Grid')}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
