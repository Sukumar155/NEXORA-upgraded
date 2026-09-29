import React from 'react';
import { Droplets, CloudRain, Wind, Gauge, Thermometer, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { useLiveSensors } from '../../hooks/useLiveSensors';
import type { LiveSensorMetric } from '../../types/sensor';

const METRIC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  water: Droplets,
  rain: CloudRain,
  wind: Wind,
  humidity: Gauge,
  temp: Thermometer
};

const METRIC_TINT: Record<string, string> = {
  water: 'text-[#1A3A6B] dark:text-[#D0D0D0]',
  rain: 'text-[#2C5C93] dark:text-[#D0D0D0]',
  wind: 'text-[#5A5C66] dark:text-[#D0D0D0]',
  humidity: 'text-[#1A3A6B] dark:text-[#D0D0D0]',
  temp: 'text-[#A15C07] dark:text-[#D0D0D0]'
};

const TrendIcon = ({ trend }: { trend: LiveSensorMetric['trend'] }) => {
  if (trend === 'up') return <TrendingUp className="w-3 h-3" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
};

interface LiveSensorStripProps {
  /**
   * `full` is the Sensors page treatment (bars, danger state, per-metric tiles).
   * `compact` is the single-row Citizen Portal treatment.
   */
  variant?: 'full' | 'compact';
  className?: string;
  title?: string;
  subtitle?: string;
}

export const LiveSensorStrip: React.FC<LiveSensorStripProps> = ({
  variant = 'compact',
  className = '',
  title = 'Live Sensor Readings',
  subtitle
}) => {
  // Mounted here, so the 5s feed runs wherever this strip is shown.
  useLiveSensors();

  const metrics = useNexoraStore(s => s.liveSensorMetrics);
  const isOffline = useNexoraStore(s => s.isOffline);
  const mapDataStatus = useNexoraStore(s => s.mapDataStatus);
  const isSensorStreaming = useNexoraStore(s => s.isSensorStreaming);

  const paused = isOffline || mapDataStatus === 'OFFLINE' || !isSensorStreaming;

  return (
    <div
      data-testid="live-sensor-strip"
      data-variant={variant}
      className={`bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#EDEDEA] dark:border-[#B4B4B4]">
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <span
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-data flex-shrink-0 ${
            paused
              ? 'bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#6B6D77] dark:text-[#D0D0D0] border border-[#DEDEDA] dark:border-[#B4B4B4]'
              : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#CFE6D8] dark:border-[#14532D]'
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {!paused && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#126B34] opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                paused ? 'bg-[#6B6D77] dark:text-[#D0D0D0]' : 'bg-[#126B34]'
              }`}
            />
          </span>
          {paused ? 'Paused' : 'Live Â· 5s'}
        </span>
      </div>

      {/* The 5 readings */}
      <div
        className={
          variant === 'compact'
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-[#EDEDEA] dark:divide-[#B4B4B4]'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-[#EDEDEA] dark:bg-[#B4B4B4]'
        }
      >
        {metrics.map(m => {
          const Icon = METRIC_ICON[m.id] ?? Gauge;
          const tint = METRIC_TINT[m.id] ?? 'text-[#1A3A6B] dark:text-[#D0D0D0]';

          // A reading is "critical" once it crosses its danger threshold.
          // The warning band is the last 12% of the climb from the metric's
          // floor up to that threshold â€” expressed relative to the range
          // because a flat multiple of dangerAt would sit below the floor for
          // tightly-bounded metrics like river stage (min 48.9, danger 49.68).
          const isCritical = m.value >= m.dangerAt;
          const warnAt = m.dangerAt - (m.dangerAt - m.min) * 0.12;
          const isWarning = !isCritical && m.value >= warnAt;

          // Position within [min, max] for the bar fill.
          const pct = Math.min(100, Math.max(0, ((m.value - m.min) / (m.max - m.min)) * 100));

          return (
            <div
              key={m.id}
              className={`px-4 py-3 ${
                variant === 'compact' ? '' : 'bg-white dark:bg-[#212121]'
              } ${variant === 'full' ? 'space-y-2.5' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] font-data truncate">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${tint}`} />
                  {m.label}
                </span>

                {variant === 'full' && (
                  <span
                    className={`text-[9px] font-bold font-data px-1.5 py-0.5 rounded flex-shrink-0 ${
                      isCritical
                        ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/50 text-[#B42318] dark:text-[#C0C0C0]'
                        : isWarning
                        ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/50 text-[#A15C07] dark:text-[#D0D0D0]'
                        : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/50 text-[#126B34] dark:text-[#E0E0E0]'
                    }`}
                  >
                    {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL'}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className={`font-data font-bold tabular-nums ${
                    variant === 'compact' ? 'text-lg' : 'text-2xl'
                  } ${
                    isCritical
                      ? 'text-[#B42318] dark:text-[#C0C0C0]'
                      : 'text-[#12294D] dark:text-[#FFFFFF]'
                  }`}
                >
                  {m.value.toFixed(m.precision)}
                </span>
                <span className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] font-data">{m.unit}</span>

                <span
                  className={`ml-auto flex items-center gap-0.5 text-[10px] font-data font-bold ${
                    m.trend === 'up'
                      ? 'text-[#B42318] dark:text-[#C0C0C0]'
                      : m.trend === 'down'
                      ? 'text-[#126B34] dark:text-[#E0E0E0]'
                      : 'text-[#A1A3AC]'
                  }`}
                  title={`${m.delta > 0 ? '+' : ''}${m.delta.toFixed(m.precision)} ${m.unit} since last reading`}
                >
                  <TrendIcon trend={m.trend} />
                  {m.trend !== 'flat' && Math.abs(m.delta).toFixed(m.precision)}
                </span>
              </div>

              {variant === 'full' && (
                <>
                  <div className="w-full bg-[#F1F1EF] dark:bg-[#2F2F2F] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isCritical ? 'bg-[#B42318]' : isWarning ? 'bg-[#A15C07]' : 'bg-[#1A3A6B] dark:bg-[#93C5FD]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">
                    <span>
                      {m.min}
                      {m.unit} â€“ {m.max}
                      {m.unit}
                    </span>
                    <span className="font-bold text-[#B42318] dark:text-[#C0C0C0]">
                      Danger {m.dangerAt}
                      {m.unit}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
