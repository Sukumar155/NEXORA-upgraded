import React from 'react';

interface LiveIndicatorProps {
  label?: string;
  className?: string;
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  label = 'LIVE SEOC FEED',
  className = ''
}) => {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#126B34]/10 border border-[#126B34]/30 text-[#126B34] text-[11px] font-bold uppercase tracking-wider ${className} dark:text-[#D0D0D0] `}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#126B34] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#126B34]"></span>
      </span>
      <span>{label}</span>
    </span>
  );
};
