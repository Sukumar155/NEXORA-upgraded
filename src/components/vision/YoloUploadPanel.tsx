/**
 * YoloUploadPanel â€” drag an image in, run real YOLO inference, see boxes.
 *
 * This was copy-pasted into two pages (DDMOAuthorityPage and Dashboard) with
 * their own private copies of the same types and colour helpers. It is now a
 * single shared component so the two surfaces cannot drift apart.
 *
 * Backend: POST /api/yolo/detect -> server/yolo_detect.py -> Ultralytics.
 * See server/YOLO_SETUP.md for weights and tuning.
 *
 * `compact` shrinks the drop zone and type so the panel fits a narrow column
 * (citizen portal) instead of spanning a full page width.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Cpu, Droplets, Eye, Flame, Loader2,
  ScanSearch, Upload, X,
} from 'lucide-react';

export interface YoloDetection {
  model: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-100
}

export interface YoloResult {
  ok: boolean;
  disaster_type: 'FIRE_SMOKE' | 'FLOOD' | 'DETECTED' | 'CLEAR';
  detections: YoloDetection[];
  count: number;
  image_preview: string;
  /** Inference tuning the server actually used. */
  settings?: { conf: number; imgsz: number; iou: number; tta: boolean };
  error?: string;
}

const disasterColour = (type: string) => {
  if (type === 'FIRE_SMOKE') return { stroke: '#B42318', bg: '#FCF1F0', text: '#8A1A12' };
  if (type === 'FLOOD') return { stroke: '#1A3A6B', bg: '#EEF2F8', text: '#12294D' };
  return { stroke: '#5A5C66', bg: '#F1F1EF', text: '#14151A' };
};

const detectionColour = (det: YoloDetection) => {
  const l = det.label.toLowerCase();
  if (det.model === 'fire_smoke' || l.includes('fire') || l.includes('smoke') || l.includes('flame')) {
    return disasterColour('FIRE_SMOKE');
  }
  if (det.model === 'flood' || l.includes('flood') || l.includes('water')) {
    return disasterColour('FLOOD');
  }
  return disasterColour('DETECTED');
};

interface Props {
  /** Tighter layout for a narrow column. */
  compact?: boolean;
  className?: string;
}

export const YoloUploadPanel: React.FC<Props> = ({ compact = false, className = '' }) => {
  const [dragOver, setDragOver] = useState(false);
  const [modelType, setModelType] = useState<'auto' | 'fire_smoke' | 'flood'>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<YoloResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = (f: File) => {
    setFile(f); setResult(null); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadFile(f);
  }, []);

  const clear = () => {
    setFile(null); setPreview(null); setResult(null); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const detect = async () => {
    if (!file) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('model_type', modelType);
      const res = await fetch('/api/yolo/detect', { method: 'POST', body: form });
      const data: YoloResult = await res.json().catch(() => ({}) as YoloResult);
      if (!res.ok || !data.ok) throw new Error(data.error || 'Detection failed');
      setResult(data);
    } catch (err) {
      setError((err as Error)?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const col = result ? disasterColour(result.disaster_type) : null;

  return (
    <div
      data-testid="yolo-panel"
      className={`bg-white dark:bg-[#1E3A5F] border border-[#E4E4E0] dark:border-[#B4B4B4] rounded-xl shadow-xs overflow-hidden ${className}`}
    >
      {/* Panel Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E0] dark:border-[#B4B4B4] ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#1A3A6B] flex items-center justify-center flex-shrink-0">
            <ScanSearch className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data truncate">
              YOLO Vision â€¢ Local CPU
            </p>
            <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] truncate">
              Disaster Image Detection
            </h2>
          </div>
        </div>

        {/* Model type selector */}
        <div className="flex items-center gap-1.5">
          {(['auto', 'fire_smoke', 'flood'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModelType(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                modelType === m
                  ? 'bg-[#1A3A6B] text-white shadow-xs'
                  : 'bg-[#F1F1EF] dark:bg-[#ECECEC] text-[#5A5C66] dark:text-[#D0D0D0] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038]'
              }`}
            >
              {m === 'auto' ? 'Auto (Both)' : m === 'fire_smoke' ? 'ðŸ”¥ Fire / Smoke' : 'ðŸŒŠ Flood'}
            </button>
          ))}
        </div>
      </div>

      <div className={`space-y-4 ${compact ? 'p-3' : 'p-4'}`}>
        {/* â”€â”€ Drop Zone (no file selected) â”€â”€ */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              compact ? 'p-6' : 'p-10'
            } ${
              dragOver
                ? 'border-[#1A3A6B] bg-[#EEF2F8] dark:bg-[#ECECEC]/40'
                : 'border-[#E4E4E0] dark:border-[#B4B4B4] hover:border-[#1A3A6B]/50 hover:bg-[#F8F8F7] dark:hover:bg-[#14151A]'
            }`}
          >
            <div className={`rounded-xl bg-[#EEF2F8] dark:bg-[#ECECEC] flex items-center justify-center ${compact ? 'w-9 h-9' : 'w-12 h-12'}`}>
              <Upload className={`text-[#1A3A6B] dark:text-[#D0D0D0] ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
            </div>
            <div className="text-center">
              <p className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">
                Drop an image here or click to browse
              </p>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] mt-1">
                JPG Â· PNG Â· BMP Â· WEBP â€” up to 20 MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
            />
          </div>
        ) : (
          /* â”€â”€ Image + results view â”€â”€ */
          <div className="space-y-3">
            {/* Preview canvas with bounding boxes */}
            <div
              className="relative w-full rounded-xl overflow-hidden bg-[#14151A]"
              style={{ aspectRatio: compact ? '4/3' : '16/9' }}
            >
              <img
                src={result?.image_preview ?? preview ?? ''}
                alt="Uploaded image"
                className="w-full h-full object-contain select-none"
              />

              {/* YOLO bounding box SVG overlay */}
              {result && result.detections.length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {result.detections.map((det, i) => {
                    const [ymin, xmin, ymax, xmax] = det.bbox;
                    const c = detectionColour(det);
                    const labelW = Math.min(100 - xmin, det.label.length * 1.65 + 14);
                    return (
                      <g key={i}>
                        <rect
                          x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin}
                          fill={`${c.stroke}25`} stroke={c.stroke} strokeWidth="0.7"
                        />
                        <rect x={xmin} y={Math.max(0, ymin - 5)} width={labelW} height="4.5" fill={c.stroke} rx="0.6" />
                        <text
                          x={xmin + 1} y={Math.max(3.5, ymin - 1.2)}
                          fill="#fff" fontSize="2.6" fontWeight="bold" fontFamily="sans-serif"
                        >
                          {det.label} {det.confidence}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Inference loading overlay */}
              {loading && (
                <div className="absolute inset-0 bg-[#14151A]/70 flex flex-col items-center justify-center gap-2 px-3 text-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-white text-xs font-bold font-data">
                    Running YOLO on local CPUâ€¦
                  </span>
                </div>
              )}

              <button
                onClick={clear}
                aria-label="Clear image"
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#14151A]/80 text-white flex items-center justify-center hover:bg-[#B42318] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Result summary banner */}
            {result && col && (
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-bold"
                style={{ backgroundColor: col.bg, borderColor: `${col.stroke}40`, color: col.text }}
              >
                {result.disaster_type === 'FIRE_SMOKE' && <Flame className="w-4 h-4 flex-shrink-0" style={{ color: col.stroke }} />}
                {result.disaster_type === 'FLOOD' && <Droplets className="w-4 h-4 flex-shrink-0" style={{ color: col.stroke }} />}
                {result.disaster_type === 'CLEAR' && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#126B34] dark:text-[#D0D0D0]" />}
                {result.disaster_type === 'DETECTED' && <Eye className="w-4 h-4 flex-shrink-0" style={{ color: col.stroke }} />}
                <span className="min-w-0">
                  {result.disaster_type === 'CLEAR'
                    ? 'No disaster detected â€” area appears clear'
                    : `${result.disaster_type.replace('_', ' ')} detected â€” ${result.count} object${result.count !== 1 ? 's' : ''} found`}
                </span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-[#B42318]/30 bg-[#FCF1F0] text-[#8A1A12] text-xs font-bold dark:text-[#F0A0A0] dark:bg-[#3F1414]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
                <span className="min-w-0">{error}</span>
              </div>
            )}

            {/* Detection list */}
            {result && result.detections.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0]">
                  Detections ({result.count})
                  {result.settings && (
                    <span className="ml-1.5 normal-case tracking-normal font-data text-[#5A5C66] dark:text-[#D0D0D0]">
                      (conf {result.settings.conf} Â· {result.settings.imgsz}px{result.settings.tta ? ' Â· TTA' : ''})
                    </span>
                  )}
                </p>
                {result.detections.map((det, i) => {
                  const c = detectionColour(det);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F1F1EF] dark:bg-[#ECECEC] border border-[#E4E4E0] dark:border-[#B4B4B4]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.stroke }} />
                        <span className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF] truncate">{det.label}</span>
                        <span className="text-[10px] text-[#5A5C66] dark:text-[#D0D0D0] font-data capitalize flex-shrink-0">
                          {det.model.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-data text-[#12294D] dark:text-[#D0D0D0] flex-shrink-0">
                        {det.confidence}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={detect}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#1A3A6B] hover:bg-[#142C52] disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Detectingâ€¦</span></>
                  : <><Cpu className="w-3.5 h-3.5" /><span>Run YOLO Detection</span></>}
              </button>
              <button
                onClick={clear}
                className="px-4 py-2.5 rounded-xl bg-[#F1F1EF] dark:bg-[#ECECEC] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#5A5C66] dark:text-[#D0D0D0] text-xs font-bold border border-[#E4E4E0] dark:border-[#B4B4B4] transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
