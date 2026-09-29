import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white border border-[#E4E4E0] rounded-xl p-5 shadow-sm space-y-4 dark:bg-[#2F2F2F] dark:border-[#3D3D3D]">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 rounded w-28"></div>
        <div className="skeleton h-5 rounded-full w-20"></div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-5 rounded w-3/4"></div>
        <div className="skeleton h-4 rounded w-1/2"></div>
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-6 rounded-full w-16"></div>
        <div className="skeleton h-6 rounded-full w-20"></div>
        <div className="skeleton h-6 rounded-full w-14"></div>
      </div>
      <div className="pt-2 flex items-center justify-between border-t border-[#E4E4E0] dark:border-[#3D3D3D]">
        <div className="skeleton h-3 rounded w-24"></div>
        <div className="skeleton h-8 rounded-xl w-32"></div>
      </div>
    </div>
  );
};
