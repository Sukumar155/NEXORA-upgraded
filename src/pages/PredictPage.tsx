/**
 * PredictPage â€” the YOLO vision tool on its own.
 *
 * Reachable from the top nav as "Predict". It is deliberately just the
 * detection panel: uploading an image and reading the result is a single task,
 * and it should not drag the operator through the whole citizen portal to get
 * there.
 *
 * Backend: POST /api/yolo/detect -> server/yolo_detect.py -> Ultralytics.
 * Weights and inference tuning: see server/YOLO_SETUP.md.
 */
import React from 'react';
import { Cpu, ScanSearch } from 'lucide-react';
import { TopBar } from '../components/dashboard/TopBar';
import { YoloUploadPanel } from '../components/vision/YoloUploadPanel';
import { useNexoraStore } from '../store/useNexoraStore';
import { getTranslation } from '../i18n/translations';

export const PredictPage: React.FC = () => {
  const { currentLanguage } = useNexoraStore();
  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  return (
    <div data-testid="predict-page" className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col font-body transition-colors">
      <TopBar />

      <main className="flex-1 w-full mx-auto p-4 sm:p-6 space-y-5 max-w-[1100px]">

        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1A3A6B] flex items-center justify-center flex-shrink-0 border border-[#1A3A6B]">
              <ScanSearch className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
                  {t('predict_subtitle', 'On-Device Image Classification')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2F8] dark:bg-[#171717] text-[#1A3A6B] dark:text-[#D0D0D0] border border-[#C3D0E4] dark:border-[#B4B4B4] font-data">
                  YOLOv8 / v11
                </span>
              </div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[#14151A] dark:text-[#FFFFFF] mt-0.5">
                {t('predict_title', 'Predict')}
              </h1>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] mt-1 max-w-2xl leading-relaxed">
                {t(
                  'predict_desc',
                  'Drop a photograph of a flood or fire scene. The model runs locally on this machine and returns every detection with its bounding box and confidence.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#126B34] dark:text-[#D0D0D0] bg-[#F1F8F3] dark:bg-[#0A2E22]/40 border border-[#E4F3E9] dark:border-[#14532D]/60 rounded-lg px-2.5 py-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Runs offline
            </span>
          </div>
        </div>

        {/* THE TOOL ITSELF */}
        <YoloUploadPanel />

        {/* WHAT THE VERDICT MEANS â€” the confidence shown is the model's real
            score, never rounded up, so an operator can judge how much to
            trust it before acting on it. */}
        <div className="rounded-xl border border-[#E4E4E0] dark:border-[#B4B4B4] bg-white dark:bg-[#1E3A5F] p-4 sm:p-5">
          <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">
            How to read the result
          </h2>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
            <div>
              <dt className="font-bold text-[#8A1A12] dark:text-[#F0A0A0]">FIRE_SMOKE</dt>
              <dd className="text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5 leading-relaxed">
                Fire, flame or smoke detected. Treated as an active emergency.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#12294D] dark:text-[#FFFFFF]">FLOOD</dt>
              <dd className="text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5 leading-relaxed">
                Inundation detected. Note the model also reports potholes and
                waste, which are advisories rather than disasters.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#14151A] dark:text-[#FFFFFF]">CLEAR</dt>
              <dd className="text-[#5A5C66] dark:text-[#D0D0D0] mt-0.5 leading-relaxed">
                Nothing above the confidence threshold. This is a low bar on
                purpose â€” a clear scene is not proof of safety.
              </dd>
            </div>
          </dl>
        </div>

      </main>
    </div>
  );
};
