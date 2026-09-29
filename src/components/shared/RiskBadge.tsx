import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { SOSPriority } from '../../types/sos';

interface RiskBadgeProps {
  level: SOSPriority | 'EXTREME' | 'SAFE';
  className?: string;
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className = '', showIcon = true }) => {
  let bg = 'bg-[#FCF1F0]/10';
  let border = '#E0776C/30';
  let text = 'text-[#B42318]';
  let Icon = AlertOctagon;
  let label: string = level;

  switch (level) {
    case 'CRITICAL':
    case 'EXTREME':
      bg = 'bg-[#B42318]/10';
      border = 'border-[#B42318]/40';
      text = 'text-[#B42318]';
      Icon = AlertOctagon;
      label = 'CRITICAL';
      break;
    case 'HIGH':
      bg = 'bg-[#A15C07]/10';
      border = 'border-[#A15C07]/40';
      text = 'text-[#A15C07]';
      Icon = AlertTriangle;
      label = 'HIGH RISK';
      break;
    case 'MODERATE':
      bg = 'bg-[#1A3A6B]/10';
      border = 'border-[#1A3A6B]/40';
      text = 'text-[#1A3A6B]';
      Icon = Info;
      label = 'MODERATE';
      break;
    case 'LOW':
    case 'SAFE':
      bg = 'bg-[#126B34]/10';
      border = 'border-[#126B34]/40';
      text = 'text-[#126B34]';
      Icon = CheckCircle2;
      label = 'LOW / SAFE';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${bg} ${border} ${text} ${className}`}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />}
      <span>{label}</span>
    </span>
  );
};
