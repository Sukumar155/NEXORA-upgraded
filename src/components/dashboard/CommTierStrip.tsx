import React from 'react';
import { Radio, Wifi, Smartphone, Satellite, AlertCircle } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { CommTier } from '../../types/scenario';

export const CommTierStrip: React.FC = () => {
  const { commTier, setCommTier } = useNexoraStore();

  const tiers: { tier: CommTier; label: string; mode: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      tier: 'T1',
      label: 'Tier 1: Broadband / 4G/5G',
      mode: 'Full Telemetry',
      desc: 'High-speed fiber & cellular. Live GIS polygons, HD video streams & instant bi-directional WebSockets.',
      icon: Wifi
    },
    {
      tier: 'T2',
      label: 'Tier 2: 3G Low-Bandwidth',
      mode: 'Compressed Vector',
      desc: 'Degraded mobile networks. Gzip compressed JSON, deferred satellite tiles, optimized data queues.',
      icon: Smartphone
    },
    {
      tier: 'T3',
      label: 'Tier 3: 2G SMS / USSD Gateway',
      mode: 'Cellular SMS/USSD',
      desc: 'No data connectivity. Direct 160-char encrypted SMS packets & *123# GSM telemetry integration.',
      icon: Radio
    },
    {
      tier: 'T4',
      label: 'Tier 4: Ham Radio / Satellite Mesh',
      mode: 'Ad-hoc Offline Mesh',
      desc: 'Total grid severance. Local peer-to-peer store-and-forward mesh via VHF/HF Ham transceivers.',
      icon: Satellite
    }
  ];

  return (
    <div className="nexora-card p-4 bg-white shadow-xs border border-[#E4E4E0] rounded-xl mt-4 text-[#14151A] dark:text-[#FFFFFF] dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Strip Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFEFEC] text-[#12294D] border border-[#DCDCD8] flex items-center justify-center flex-shrink-0 dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#333333]">
            <Radio className="w-5 h-5 text-[#12294D] dark:text-[#FFFFFF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-sm text-[#14151A] dark:text-[#FFFFFF]">
                Communication Resilience Hierarchy
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-data bg-[#F0F7F4] text-[#2A6B4A] border border-[#CFE6D8] dark:text-[#D0D0D0] dark:border-[#14532D]">
                ACTIVE: {commTier}
              </span>
            </div>
            <p className="text-xs text-[#5A5C66] mt-0.5 dark:text-[#D0D0D0]">
              NEXORA seamlessly downgrades through 4 telemetry tiers as storm weather degrades network infrastructure.
            </p>
          </div>
        </div>

        {/* Tier Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tiers.map((t) => {
            const Icon = t.icon;
            const isActive = commTier === t.tier;
            return (
              <button
                key={t.tier}
                onClick={() => setCommTier(t.tier)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'btn-primary-gradient text-white border-[#14151A] shadow-xs'
                    : 'bg-[#F8F8F7] hover:bg-[#EFEFEC] text-[#14151A] border-[#E4E4E0]'
                } dark:text-[#FFFFFF] dark:bg-[#262626] dark:border-[#3D3D3D] `}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`font-data text-xs font-bold ${isActive ? 'text-[#DCDCD8]' : 'text-[#12294D]'} dark:text-[#FFFFFF] `}>
                    {t.tier}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#DCDCD8]' : 'text-[#5A5C66]'} dark:text-[#D0D0D0] `}/>
                </div>
                <div className="text-[11px] font-semibold truncate">{t.mode}</div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Active Tier Context Summary */}
      <div className="mt-3 pt-3 border-t border-[#E4E4E0] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] dark:border-[#3D3D3D]">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-[#12294D] dark:text-[#FFFFFF]" />
          <span>{tiers.find(t => t.tier === commTier)?.desc}</span>
        </span>
        <span className="font-data text-[11px] font-medium hidden md:inline">
          Failover latency &lt; 800ms
        </span>
      </div>
    </div>
  );
};
