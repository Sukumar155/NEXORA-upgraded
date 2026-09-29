import React from 'react';
import { Cpu, AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useFloodRisk, FLOOD_RISK_LABELS } from '../../hooks/useFloodRisk';
import type { FloodRiskClass } from '../../services/floodRiskModel';

const CLASS_STYLE: Record<FloodRiskClass, { text: string; bg: string; border: string; bar: string; chip: string }> = {
  LOW: {
    text: 'text-[#126B34] dark:text-[#E0E0E0]',
    bg: 'bg-[#F1F8F3] dark:bg-[#0A2E22]/40',
    border: 'border-[#E4F3E9] dark:border-[#14532D]',
    bar: 'bg-[#126B34]',
    chip: 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0]'
  },
  MODERATE: {
    text: 'text-[#A15C07] dark:text-[#D0D0D0]',
    bg: 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/40',
    border: 'border-[#EFE3C4] dark:border-[#78350F]',
    bar: 'bg-[#A15C07]',
    chip: 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0]'
  },
  HIGH: {
    text: 'text-[#B42318] dark:text-[#C0C0C0]',
    bg: 'bg-[#FCF1F0] dark:bg-[#3F1414]/40',
    border: 'border-[#FBE9E7] dark:border-[#7F1D1D]',
    bar: 'bg-[#B42318]',
    chip: 'bg-[#FCF1F0] dark:bg-[#3F1414]/60 text-[#B42318] dark:text-[#C0C0C0]'
  }
};

interface FloodRiskCardProps {
  className?: string;
  /** Show the full per-class probability breakdown. */
  showProbabilities?: boolean;
}

/**
 * Live flood-risk readout from the trained XGBoost classifier.
 *
 * Everything shown here is computed by the model at runtime â€” the class, the
 * softmax probabilities, and the out-of-domain warnings. Nothing is hard-coded.
 */
export const FloodRiskCard: React.FC<FloodRiskCardProps> = ({
  className = '',
  showProbabilities = true
}) => {
  const { state, error, prediction, features } = useFloodRisk();

  if (state === 'loading' || state === 'idle') {
    return (
      <div className={`nexora-card p-6 flex items-center gap-3 ${className}`}>
        <Loader2 className="w-5 h-5 text-[#1A3A6B] dark:text-[#D0D0D0] animate-spin" />
        <div>
          <p className="text-sm font-bold text-[#12294D] dark:text-[#FFFFFF]">Loading flood-risk model</p>
          <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0]">Fetching 2 MB XGBoost ensemble (600 trees)â€¦</p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !prediction || !features) {
    return (
      <div className={`nexora-card p-6 border-[#FBE9E7] dark:border-[#7F1D1D] bg-[#FCF1F0] dark:bg-[#3F1414]/40 ${className}`}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[#B42318] dark:text-[#C0C0C0] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#9A1C13] dark:text-[#C0C0C0]">Flood-risk model unavailable</p>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
              {error ?? 'The model could not be scored.'} Other risk surfaces on this page remain available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const style = CLASS_STYLE[prediction.risk];
  const pct = Math.round(prediction.confidence * 100);

  return (
    <div
      data-testid="flood-risk-card"
      data-risk={prediction.risk}
      className={`nexora-card p-6 space-y-4 ${style.bg} ${style.border} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Cpu className={`w-5 h-5 flex-shrink-0 ${style.text}`} />
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
              Flood Inundation Risk
            </span>
            <span className="block text-[10px] text-[#6B6D77] dark:text-[#D0D0D0] font-data">
              XGBoost â€¢ 600 trees â€¢ 3 classes
            </span>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-data flex-shrink-0 ${style.chip}`}>
          LIVE MODEL
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className={`font-data text-5xl font-black tracking-tight ${style.text}`}>
          {pct}%
        </span>
        <span className={`text-sm font-bold uppercase ${style.text}`}>
          {prediction.risk} RISK
        </span>
      </div>

      <div className="w-full bg-[#F1F1EF] dark:bg-[#171717] h-2.5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${pct}%` }} />
      </div>

      {showProbabilities && (
        <div className="space-y-1.5">
          {FLOOD_RISK_LABELS.map((label) => {
            const p = prediction.probabilities[label];
            const isWinner = label === prediction.risk;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold font-data w-16 flex-shrink-0 ${isWinner ? style.text : 'text-[#6B6D77] dark:text-[#D0D0D0]'}`}>
                  {label}
                </span>
                <div className="flex-1 h-1.5 bg-[#F1F1EF] dark:bg-[#171717] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isWinner ? style.bar : 'bg-[#A1A3AC] dark:bg-[#B4B4B4]'}`}
                    style={{ width: `${p * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-data font-bold text-[#5A5C66] dark:text-[#D0D0D0] w-11 text-right flex-shrink-0 tabular-nums">
                  {(p * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Honest reporting: the model cannot extrapolate past its training range. */}
      {prediction.outOfDomain && (
        <div className="flex items-start gap-2 pt-1">
          <Info className="w-3.5 h-3.5 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-[#7A3E0B] dark:text-[#D0D0D0] leading-snug">
            <strong>Outside training domain:</strong>{' '}
            {prediction.warnings.slice(0, 2).join(' ')}
            {prediction.warnings.length > 2 && ` (+${prediction.warnings.length - 2} more)`}
          </div>
        </div>
      )}

      {!prediction.outOfDomain && (
        <div className="flex items-center gap-1.5 text-[11px] text-[#126B34] dark:text-[#E0E0E0]">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>All 11 inputs are within the model's trained range.</span>
        </div>
      )}

      {/* The exact vector that produced this score. */}
      <details className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">
        <summary className="cursor-pointer font-bold hover:underline">Model input vector (11 features)</summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-data">
          {Object.entries(features).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <dt className="truncate">{k}</dt>
              <dd className="font-bold text-[#14151A] dark:text-[#FFFFFF] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
};
