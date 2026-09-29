import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';

interface OfflineBannerProps {
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ className = '' }) => {
  const { isOffline, lastSyncTime, queuedSyncCount, syncQueuedUpdates } = useNexoraStore();

  if (!isOffline && queuedSyncCount === 0) return null;

  return (
    <div
      className={`bg-[#A15C07] text-white px-4 py-2 flex items-center justify-between shadow-sm transition-all ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5 text-xs md:text-sm font-medium">
        {isOffline ? (
          <>
            <WifiOff className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />
            <span>
              <strong className="font-bold tracking-wide">OFFLINE</strong> — Last sync at{' '}
              <span className="font-data font-semibold">{lastSyncTime}</span> (Local Mesh Active)
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-[#D9A03A] flex-shrink-0" />
            <span>Connection restored. Ready to reconcile pending transactions.</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {queuedSyncCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-white font-data text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#FAF0D8] animate-ping dark:bg-[#3A2A0A]"></span>
            {queuedSyncCount} {queuedSyncCount === 1 ? 'update' : 'updates'} queued
          </span>
        )}

        <button
          onClick={syncQueuedUpdates}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white text-[#A15C07] text-xs font-bold hover:bg-[#FAF0D8] active:scale-95 transition-all shadow-sm cursor-pointer dark:text-[#E0E0E0] dark:bg-[#2F2F2F]"
          title="Force synchronization with SEOC gateway"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Now</span>
        </button>
      </div>
    </div>
  );
};
