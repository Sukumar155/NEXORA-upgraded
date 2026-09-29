import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  subtext?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No active SOS reports",
  subtext = "The situation is calm. Stay ready."
}) => {
  return (
    <div className="bg-white border border-[#E4E4E0] rounded-xl p-8 text-center flex flex-col items-center justify-center my-6 shadow-sm dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
      <div className="w-14 h-14 rounded-full bg-[#126B34]/10 border border-[#126B34]/20 flex items-center justify-center text-[#126B34] mb-3 dark:text-[#D0D0D0]">
        <ShieldCheck className="w-8 h-8" strokeWidth={1.75} />
      </div>
      <h3 className="font-heading text-lg font-semibold text-[#14151A] mb-1 dark:text-[#FFFFFF]">{title}</h3>
      <p className="text-sm text-[#6B6D77] max-w-sm dark:text-[#D0D0D0]">{subtext}</p>
    </div>
  );
};
