import React from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { BarChart3, TrendingUp, Droplets, CloudRain } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

export const AnalyticsPage: React.FC = () => {
  const {
    dangerMarkMeters,
    riverLevelMeters,
    rainfallMmPerHour,
    hydrographTrends,
    currentLanguage
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  /* â”€â”€ Hydrograph geometry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   * Derived entirely from `hydrographTrends`, which the sensor tick keeps
   * current. Scale is recomputed per render so the curve, the danger line and
   * the axis labels all stay consistent as the water level moves.          */

  const W = 600;
  const H = 200;
  const PAD = { t: 14, r: 10, b: 16, l: 10 };

  const samples = hydrographTrends.length
    ? hydrographTrends
    : [{ timeLabel: '--:--', waterLevelM: riverLevelMeters, dangerMarkM: dangerMarkMeters, rainfallMm: rainfallMmPerHour, riskScore: 0 }];

  // Y-domain: cover the observed data and the danger mark, with headroom.
  const levels = samples.map(s => s.waterLevelM);
  const dataMin = Math.min(...levels);
  const dataMax = Math.max(...levels);
  const spanRaw = Math.max(0.25, Math.max(dataMax, dangerMarkMeters) - Math.min(dataMin, dangerMarkMeters));
  const yMin = dataMin - spanRaw * 0.12;
  const yMax = Math.max(dataMax, dangerMarkMeters) + spanRaw * 0.12;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const toY = (m: number) => PAD.t + ((yMax - m) / (yMax - yMin)) * plotH;
  const toX = (i: number) => PAD.l + (samples.length === 1 ? plotW : (i / (samples.length - 1)) * plotW);

  /** Compact age label for a sample N steps back from the newest. */
  const relativeAge = (stepsBack: number) => {
    const mins = stepsBack * 30;
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    return `${hours}h`;
  };

  const points = samples.map((s, i) => ({
    x: toX(i),
    y: toY(s.waterLevelM),
    val: `${s.waterLevelM.toFixed(2)}m`,
    // Relative age, not clock time: a rolling 24 h window always straddles
    // midnight, so two samples can share the same HH:MM and read as duplicates.
    time: i === samples.length - 1 ? 'now' : `-${relativeAge(samples.length - 1 - i)}`,
    isLatest: i === samples.length - 1
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const firstX = points[0]?.x ?? PAD.l;
  const lastX = points[points.length - 1]?.x ?? W - PAD.r;
  const latestY = points[points.length - 1]?.y ?? PAD.t;
  const dangerY = toY(dangerMarkMeters);

  // Thin the labelled points down to ~6 so text never overlaps.
  const labelStride = Math.max(1, Math.floor(samples.length / 6));
  const labelPoints = points
    .map((p, i) => ({ ...p, i }))
    .filter((p, idx) => idx % labelStride === 0 || idx === points.length - 1);

  // Rate of rise from the real series: last point vs. the one ~1 h ago.
  const twoHoursBack = samples[Math.max(0, samples.length - 3)];
  const rateOfRise = ((riverLevelMeters - twoHoursBack.waterLevelM) * 100) / 1;

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#212121] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#EFEFEC] dark:bg-[#2F2F2F] text-[#12294D] dark:text-[#D0D0D0] border border-[#DCDCD8] dark:border-[#B4B4B4] flex items-center justify-center shadow-xs flex-shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  {t('analytics_subtitle', 'Hydrological Trends & ICS Performance â€¢ 24-Hour Telemetry')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFEFEC] dark:bg-[#171717] text-[#12294D] dark:text-[#D0D0D0] border border-[#DCDCD8] dark:border-[#B4B4B4]">
                  24-Hour Telemetry
                </span>
              </div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-0.5">
                {t('analytics_title', 'Disaster Analytics & River Hydrograph')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-data">
            <div className="bg-[#F8F8F7] dark:bg-[#171717] border border-[#E4E4E0] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#5A5C66] dark:text-[#D0D0D0] block text-[10px] uppercase font-bold">{t('water_level', 'Current Gauge')}</span>
              <span className="font-bold text-[#12294D] dark:text-[#D0D0D0]">{riverLevelMeters} m</span>
            </div>
            <div className="bg-[#FCF1F0] dark:bg-[#3F1414]/40 border border-[#F3CFC9] dark:border-[#7F1D1D]/60 px-3 py-1.5 rounded-xl">
              <span className="text-[#B42318] dark:text-[#C0C0C0] block text-[10px] uppercase font-bold">{t('danger_mark', 'Danger Mark')}</span>
              <span className="font-bold text-[#B42318] dark:text-[#C0C0C0]">{dangerMarkMeters} m</span>
            </div>
          </div>
        </div>

        {/* 24-HOUR HYDROGRAPH CHART (SVG) â€” driven by the live sensor feed */}
        <div className="p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
            <div>
              <h2 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-2">
                <Droplets className="w-5 h-5 text-[#14151A] dark:text-[#D0D0D0]" />
                {t('analytics_hydrograph_title', 'Cooum River Stage Hydrograph â€” Last 24 Hours')}
                <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold font-data bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#CFE6D8] dark:border-[#14532D]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#126B34] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#126B34]" />
                  </span>
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
                {t('analytics_hydrograph_desc', 'Water level height in metres MSL at the Chepauk gauge vs. Danger Mark â€” updates with sensor telemetry')}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-data">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#1A3A6B] dark:bg-[#93C5FD]"></span>
                <span className="text-[#5A5C66] dark:text-[#D0D0D0]">River Stage (m)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#B42318] dark:text-[#C0C0C0]">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-[#B42318] dark:border-[#7F1D1D]"></span>
                <span>Danger Mark ({dangerMarkMeters.toFixed(2)}m)</span>
              </div>
            </div>
          </div>

          {/* SVG Chart â€” every coordinate below is computed from `hydrographTrends` */}
          <div className="w-full h-64 sm:h-72 bg-[#F8F8F7] dark:bg-[#171717] rounded-xl p-4 border border-[#E4E4E0] dark:border-[#B4B4B4] relative">
            <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">

              {/* Vertical gridlines every 6 hours */}
              {[0, 1, 2, 3, 4].map(i => (
                <line
                  key={`v${i}`}
                  x1={PAD.l + (i * (W - PAD.l - PAD.r)) / 4}
                  y1={PAD.t}
                  x2={PAD.l + (i * (W - PAD.l - PAD.r)) / 4}
                  y2={H - PAD.b}
                  stroke="currentColor"
                  className="text-[#E4E4E0] dark:text-[#D0D0D0]"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              ))}

              {/* Danger Mark â€” y derived from the live dangerMarkMeters */}
              <line
                x1={PAD.l}
                y1={dangerY}
                x2={W - PAD.r}
                y2={dangerY}
                stroke="#B42318"
                strokeWidth="1.5"
                strokeDasharray="6,4"
              />
              <text x={PAD.l + 2} y={dangerY - 5} fill="#B42318" fontSize="10" fontWeight="bold" fontFamily="monospace">
                DANGER MARK: {dangerMarkMeters.toFixed(2)}m
              </text>

              {/* Shaded band between the observed stage and the danger mark */}
              <rect
                x={PAD.l}
                y={dangerY}
                width={W - PAD.l - PAD.r}
                height={Math.max(0, Math.min(dangerY, latestY) - dangerY)}
                fill="#B42318"
                opacity="0.07"
              />

              {/* River hydrograph */}
              <path d={linePath} fill="none" stroke="#1A3A6B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Gradient area fill under the curve */}
              <path d={`${linePath} L ${lastX} ${H - PAD.b} L ${firstX} ${H - PAD.b} Z`} fill="url(#waterGradMidnight)" opacity="0.22" />

              <defs>
                <linearGradient id="waterGradMidnight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1A3A6B" />
                  <stop offset="55%" stopColor="#7E9AC4" />
                  <stop offset="100%" stopColor="#EEF2F8" />
                </linearGradient>
              </defs>

              {/* Y-axis labels (min / max of the visible window) */}
              <text x={PAD.l + 2} y={H - PAD.b - 2} fill="currentColor" className="text-[#5A5C66] dark:text-[#D0D0D0]" fontSize="9" fontFamily="monospace">
                {yMin.toFixed(2)}m
              </text>
              <text x={PAD.l + 2} y={PAD.t + 8} fill="currentColor" className="text-[#5A5C66] dark:text-[#D0D0D0]" fontSize="9" fontFamily="monospace">
                {yMax.toFixed(2)}m
              </text>

              {/* Sampled points â€” thinned to 6 so labels never collide */}
              {labelPoints.map(pt => (
                <g key={pt.i}>
                  <circle cx={pt.x} cy={pt.y} r={pt.isLatest ? 5 : 3.5} fill="#1A3A6B" stroke="#1A3A6B" strokeWidth="2" />
                  <text x={pt.x - 14} y={pt.y - 10} fill="currentColor" className="text-[#14151A] dark:text-[#FFFFFF]" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {pt.val}
                  </text>
                  <text x={pt.x - 10} y={H - PAD.b + 12} fill="currentColor" className="text-[#5A5C66] dark:text-[#D0D0D0]" fontSize="9" fontFamily="monospace">
                    {pt.time}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-[#5A5C66] dark:text-[#D0D0D0] pt-1">
            <span className="flex items-center gap-1.5">
              <TrendingUp className={`w-4 h-4 ${rateOfRise >= 0 ? 'text-[#B42318]' : 'text-[#126B34] dark:text-[#E0E0E0]'}`} />
              {t('analytics_rate_of_rise', 'Hydro Rate of Rise')}:{' '}
              <strong className="text-[#14151A] dark:text-[#FFFFFF]">
                {rateOfRise >= 0 ? '+' : ''}{rateOfRise.toFixed(1)} cm / hour
              </strong>
              <span className="text-[#6B6D77] dark:text-[#E0E0E0]">
                (live gauge vs. 1 h ago)
              </span>
            </span>
            <span className="font-data text-[#5A5C66] dark:text-[#D0D0D0]">
              Source: NEXORA Cooum gauge telemetry Â· {hydrographTrends.length} samples
            </span>
          </div>
        </div>

        {/* 2-COLUMN OPERATIONAL PERFORMANCE MATRICES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Incident Resolution Funnel */}
          <div className="lg:col-span-6 p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
                  {t('analytics_funnel_title', 'Emergency Response Triage Funnel')}
                </h3>
                <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">{t('analytics_funnel_desc', 'Citizen SOS to on-scene rescue turnaround')}</p>
              </div>
              <span className="font-data text-xs font-bold text-[#126B34] dark:text-[#D0D0D0] bg-[#F1F8F3] dark:bg-[#0A2E22]/60 border border-[#CFE6D8] dark:border-[#14532D]/60 px-2.5 py-1 rounded-lg">
                Avg ETA: 12.8m
              </span>
            </div>

            <div className="space-y-3 font-data text-xs">
              
              {/* Step 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#14151A] dark:text-[#FFFFFF]">
                  <span>1. SOS Inflow (USSD, App, Calls)</span>
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">124 Reports</span>
                </div>
                <div className="w-full bg-[#E4E4E0] dark:bg-[#B4B4B4] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#5A5C66] dark:bg-[#A3A3A3] h-full rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#14151A] dark:text-[#FFFFFF]">
                  <span>2. Automated XGBoost AI Triage Verified</span>
                  <span className="font-bold text-[#12294D] dark:text-[#D0D0D0]">118 (95%)</span>
                </div>
                <div className="w-full bg-[#E4E4E0] dark:bg-[#B4B4B4] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#12294D] dark:bg-[#93C5FD] h-full rounded-full" style={{ width: '95%' }} />
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#14151A] dark:text-[#FFFFFF]">
                  <span>3. Rescue Teams Dispatched & En-Route</span>
                  <span className="font-bold text-[#8A4D06] dark:text-[#D0D0D0]">94 (76%)</span>
                </div>
                <div className="w-full bg-[#E4E4E0] dark:bg-[#B4B4B4] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#8A4D06] dark:bg-[#FBBF24] h-full rounded-full" style={{ width: '76%' }} />
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#14151A] dark:text-[#FFFFFF]">
                  <span>4. Successfully Evacuated to Safe Camps</span>
                  <span className="font-bold text-[#126B34] dark:text-[#D0D0D0]">89 (72%)</span>
                </div>
                <div className="w-full bg-[#E4E4E0] dark:bg-[#B4B4B4] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#126B34] dark:bg-[#34D399] h-full rounded-full" style={{ width: '72%' }} />
                </div>
              </div>

            </div>

            <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] grid grid-cols-2 gap-3 text-center text-xs">
              <div className="bg-[#F8F8F7] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] uppercase block font-bold">AI Triage Latency</span>
                <span className="text-base font-bold text-[#14151A] dark:text-[#FFFFFF] font-data">4.2 mins</span>
              </div>
              <div className="bg-[#F8F8F7] dark:bg-[#171717] p-2.5 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4]">
                <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] uppercase block font-bold">Rescue Completion</span>
                <span className="text-base font-bold text-[#126B34] dark:text-[#D0D0D0] font-data">94.7%</span>
              </div>
            </div>
          </div>

          {/* Precipitation & Catchment Rainfall */}
          <div className="lg:col-span-6 p-6 bg-white dark:bg-[#212121] rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#14151A] dark:text-[#FFFFFF]">
                  {t('analytics_catchment_title', 'Catchment Precipitation Profile')}
                </h3>
                <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0]">{t('analytics_catchment_desc', 'Gauge accumulation over regional sub-basins')}</p>
              </div>
              <CloudRain className="w-5 h-5 text-[#12294D] dark:text-[#D0D0D0]" />
            </div>

            <div className="space-y-3 font-data text-xs">
              
              <div className="bg-[#F8F8F7] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF] block font-sans">Kamrup Metro Urban Area</span>
                  <span className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">Pandu & Bharalumukh Basin</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-base text-[#12294D] dark:text-[#D0D0D0]">{rainfallMmPerHour} mm/h</span>
                  <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] block">Sustained Cloudburst</span>
                </div>
              </div>

              <div className="bg-[#F8F8F7] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF] block font-sans">Upper Meghalaya Foothills Runoff</span>
                  <span className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">Deepor Inflow Source</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-base text-[#12294D] dark:text-[#D0D0D0]">84 mm/h</span>
                  <span className="text-[10px] text-[#B42318] dark:text-[#C0C0C0] block font-semibold">Heavy Hill Runoff</span>
                </div>
              </div>

              <div className="bg-[#F8F8F7] dark:bg-[#171717] p-3 rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#14151A] dark:text-[#FFFFFF] block font-sans">Northern Brahmaputra Plains</span>
                  <span className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">Amingaon Channel</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-base text-[#12294D] dark:text-[#D0D0D0]">52 mm/h</span>
                  <span className="text-[10px] text-[#8A4D06] dark:text-[#D0D0D0] block font-semibold">Moderate Inflow</span>
                </div>
              </div>

            </div>

            <div className="bg-[#EFEFEC] dark:bg-[#171717] border border-[#DCDCD8] dark:border-[#B4B4B4] p-3 rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF]">
              <strong className="text-[#14151A] dark:text-[#D0D0D0]">Hydrological Insight:</strong> Peak discharge from hill runoff is expected to collide with the Brahmaputra tidal crest between 18:00 and 21:00, necessitating pre-positioning of IRB boats at Pandu.
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};
