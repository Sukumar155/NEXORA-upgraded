import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Users, ArrowUpRight, ShieldAlert, ListOrdered } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { RiskBadge } from '../shared/RiskBadge';
import { PriorityRing } from '../shared/PriorityRing';
import { AssistanceNeed } from '../../types/sos';
import { fetchServerSOS, subscribeServerSOS } from '../../services/sosApi';

interface SOSQueueProps {
  /**
   * 'vertical'  â€” stacked cards for a narrow sidebar (Dashboard).
   * 'horizontal' â€” a scrolling row of cards beneath a full-width map
   *               (Disaster Map), where a tall sidebar squeezes the map.
   */
  layout?: 'vertical' | 'horizontal';
}

export const SOSQueue: React.FC<SOSQueueProps> = ({ layout = 'vertical' }) => {
  const isHorizontal = layout === 'horizontal';
  const { sosReports, selectedSOSId, openDetailDrawer, openResponsePlan, sosServerStatus } = useNexoraStore();
  const [filterNeed, setFilterNeed] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const stripRef = React.useRef<HTMLDivElement | null>(null);
  // Horizontal mode shows three cards across the full width so each one is
  // large and readable, rather than a dense scrolling row of small cards.
  const itemsPerPage = 3; // Strict finite pagination

  // Live bridge to the SOS backend (server/sos-server.mjs):
  // catch up with anything already stored, then stream new beacons via SSE.
  useEffect(() => {
    let disposed = false;
    const { setSosServerStatus, ingestServerSOS } = useNexoraStore.getState();

    setSosServerStatus('CONNECTING');
    fetchServerSOS().then((result) => {
      if (disposed) return;
      // Only claim LIVE when the fetch actually succeeded. Previously a failed
      // fetch returned [] and this painted "Server: Live" regardless.
      if (result.ok) {
        if (result.reports.length) ingestServerSOS(result.reports);
        setSosServerStatus('LIVE');
      } else {
        setSosServerStatus('OFFLINE');
      }
    });

    const unsubscribe = subscribeServerSOS({
      onReport: (report) => {
        if (disposed) return;
        ingestServerSOS([report]);
      },
      onStatus: (status) => {
        if (disposed) return;
        setSosServerStatus(status);
      },
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  // Sort by AI Priority Score descending
  const sortedReports = [...sosReports].sort((a, b) => b.priorityScore - a.priorityScore);

  const filteredReports = sortedReports.filter((report) => {
    if (report.status === 'FALSE_ALARM') return false;
    if (filterNeed === 'ALL') return true;
    if (filterNeed === 'CRITICAL') return report.priorityLevel === 'CRITICAL';
    return report.needs.includes(filterNeed as AssistanceNeed);
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Paging a horizontal strip should always land the operator on the first
  // card of the page, not wherever they happened to have scrolled to.
  const goToPage = (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    setCurrentPage(clamped);
    stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <div
      data-testid="sos-queue"
      data-layout={layout}
      className={`nexora-card flex flex-col shadow-xs overflow-hidden bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl text-[#14151A] dark:text-[#FFFFFF] ${
        isHorizontal ? 'w-full' : 'h-[560px] lg:h-[620px]'
      }`}
    >
      
      {/* QUEUE HEADER */}
      <div className="p-4 border-b border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between gap-3 bg-white dark:bg-[#1E3A5F]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#B42318] dark:text-[#FFFFFF]" />
              Priority SOS Triage
            </h3>
            <span className="font-data text-xs px-2 py-0.5 rounded-full bg-[#F1F1EF] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] font-semibold border border-[#E4E4E0] dark:border-[#B4B4B4]">
              {filteredReports.length} Ranked
            </span>
            {/* SOS backend bridge status */}
            <span
              title="One-tap SOS beacons from citizens are received live from the backend bridge (server/sos-server.mjs)"
              className={`font-data text-xs px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${ sosServerStatus === 'LIVE' ? 'bg-[#F1F8F3] dark:bg-[#0A2E22]/50 text-[#126B34] dark:text-[#E0E0E0] border-[#E4F3E9] dark:border-[#14532D]/60' : sosServerStatus === 'CONNECTING' ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 text-[#8A4D06] dark:text-[#D0D0D0] border-[#EFE3C4] dark:border-[#78350F]/50' : 'bg-[#F1F1EF] dark:bg-[#171717] text-[#5A5C66] dark:text-[#E0E0E0] border-[#E4E4E0] dark:border-[#B4B4B4]' }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${ sosServerStatus === 'LIVE' ? 'bg-[#126B34] animate-pulse' : sosServerStatus === 'CONNECTING' ? 'bg-[#D9A03A] animate-pulse' : 'bg-[#35363F]' }`}
              />
              Server {sosServerStatus === 'LIVE' ? 'Live' : sosServerStatus === 'CONNECTING' ? 'Connectingâ€¦' : 'Offline'}
            </span>
          </div>
          <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5 flex items-center gap-1">
            <ListOrdered className="w-3 h-3 text-[#1A3A6B] dark:text-[#E0E0E0]" />
            Ranked by AI Priority Index with vulnerability weights
          </p>
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <select
            value={filterNeed}
            onChange={(e) => {
              setFilterNeed(e.target.value);
              setCurrentPage(1);
              stripRef.current?.scrollTo({ left: 0 });
            }}
            className="text-xs font-semibold py-1.5 px-2.5 bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-lg text-[#14151A] dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/40 cursor-pointer"
          >
            <option value="ALL">All Reports</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="Elderly">Elderly Need</option>
            <option value="Medical">Medical Urgent</option>
            <option value="Child">Infants / Children</option>
          </select>
        </div>
      </div>

      {/* QUEUE CARDS â€” three across in horizontal mode, a stack when vertical */}
      <div
        ref={stripRef}
        className={
          isHorizontal
            ? 'flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-start overflow-y-auto'
            : 'flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-[#E4E4E0] dark:divide-[#B4B4B4]'
        }
      >
        {paginatedReports.length === 0 ? (
          <div className="py-12 text-center w-full col-span-full">
            <p className="text-sm font-semibold text-[#5A5C66] dark:text-[#D0D0D0]">No matching SOS calls in this filter</p>
          </div>
        ) : (
          paginatedReports.map((report) => {
            const isSelected = selectedSOSId === report.id;
            return (
              <div
                key={report.id}
                onClick={() => openDetailDrawer(report.id)}
                className="cursor-pointer group transition-all"
              >
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#1A3A6B] bg-[#F1F1EF]/50 dark:bg-[#ECECEC] shadow-xs ring-2 ring-[#1A3A6B]/20'
                      : 'border-[#E4E4E0] dark:border-[#B4B4B4] bg-white dark:bg-[#1E3A5F] hover:border-[#1A3A6B]/50 hover:shadow-2xs hover:dark:bg-[#B4B4B4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-data text-xs font-bold text-[#1A3A6B] dark:text-[#E0E0E0]">{report.id}</span>
                        <RiskBadge level={report.priorityLevel} showIcon={false} />
                        {report.isPriorityOverridden && (
                          <span className="text-[10px] font-semibold text-[#A15C07] dark:text-[#D0D0D0] bg-[#FAF0D8] dark:bg-[#ECECEC] px-1.5 py-0.5 rounded border border-[#EFE3C4] dark:border-[#B4B4B4]">
                            Officer Override
                          </span>
                        )}
                      </div>

                      <div className="font-heading font-semibold text-sm text-[#14151A] dark:text-[#FFFFFF] truncate group-hover:text-[#1A3A6B] transition-colors">
                        {report.locationName}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
                        <span className="flex items-center gap-1 font-data font-medium text-[#14151A] dark:text-[#FFFFFF]">
                          <Users className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                          {report.peopleCount} trapped
                        </span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-[#5A5C66] dark:text-[#D0D0D0]" />
                          {formatRelativeTime(report.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* AI Score Circular Progress */}
                    <div className="flex-shrink-0" title={`AI Priority Score: ${report.priorityScore}/100`}>
                      <PriorityRing score={report.priorityScore} size={48} strokeWidth={4} />
                    </div>
                  </div>

                  {/* AI Explanation Snippet â€” three-across cards have room for
                      the full rationale, so it is not clamped here. */}
                  <div className="mt-2.5 text-xs text-[#14151A] dark:text-[#FFFFFF] bg-[#F8F8F7] dark:bg-[#171717] p-2 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] leading-snug">
                    <span className="font-bold text-[#14151A] dark:text-[#D0D0D0] mr-1">AI Rationale:</span>
                    {report.aiExplanation}
                  </div>

                  {/* Assistance Chips */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4]">
                    <div className="flex flex-wrap gap-1">
                      {report.needs.slice(0, 3).map((need) => (
                        <span
                          key={need}
                          className="px-2 py-0.5 rounded-md bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] text-[10px] font-semibold text-[#14151A] dark:text-[#FFFFFF]"
                        >
                          {need}
                        </span>
                      ))}
                      {report.needs.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] font-semibold">
                          +{report.needs.length - 3}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openResponsePlan(report.id);
                      }}
                      className="text-xs font-bold text-[#1A3A6B] dark:text-[#D0D0D0] hover:underline flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                    >
                      <span>Plan</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FINITE PAGINATION CONTROLS (Anti-infinite scroll rule) */}
      <div className="p-3 bg-[#F8F8F7] dark:bg-[#171717] border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
        <span className="font-data font-medium">
          Page {currentPage} of {totalPages}
          {isHorizontal && (
            <span className="hidden sm:inline text-[#5A5C66] dark:text-[#E0E0E0]">
              {' '}Â· {itemsPerPage} per page
            </span>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] bg-white dark:bg-[#ECECEC] hover:bg-[#F1F1EF] hover:dark:bg-[#B4B4B4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4 text-[#14151A] dark:text-[#FFFFFF]" />
          </button>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-[#E4E4E0] dark:border-[#B4B4B4] bg-white dark:bg-[#ECECEC] hover:bg-[#F1F1EF] hover:dark:bg-[#B4B4B4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4 text-[#14151A] dark:text-[#FFFFFF]" />
          </button>
        </div>
      </div>

    </div>
  );
};
