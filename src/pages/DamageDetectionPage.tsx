import React, { useState } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { Camera, Eye, MapPin, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Layers, Upload, Cpu, Zap, Crosshair } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';

export const DamageDetectionPage: React.FC = () => {
  const {
    damageScans,
    pinDamageToMap,
    setCurrentView
  } = useNexoraStore();

  const scan = damageScans[0];
  const [showBoxes, setShowBoxes] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pinnedSuccess, setPinnedSuccess] = useState(false);

  const filteredDetections = scan?.detectedObjects.filter(
    d => d.confidencePct >= confidenceThreshold
  ) || [];

  const handleSimulateAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1200);
  };

  const handlePinToMap = () => {
    if (!scan) return;
    pinDamageToMap(scan.id);
    setPinnedSuccess(true);
    setTimeout(() => {
      setPinnedSuccess(false);
      setCurrentView('DISASTER_MAP');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* PAGE HEADER */}
        <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#1A3A6B] text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] font-data">
                  Computer Vision Drone Survey â€¢ YOLOv8 + OpenCV
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2F8] dark:bg-[#1F2937]/60 text-[#12294D] dark:text-[#D0D0D0] border border-[#C3D0E4] dark:border-[#374151]">
                  SIH Autonomous AI Concept
                </span>
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#12294D] dark:text-[#FFFFFF] mt-0.5">
                Drone & CCTV Damage Detection Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-[#1A3A6B] hover:bg-[#142C52] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Cpu className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Running YOLO Inference...' : 'Re-Run YOLOv8 Model'}</span>
            </button>
            <button
              onClick={handlePinToMap}
              className="px-4 py-2 rounded-xl bg-[#12294D] dark:bg-[#2F2F2F] hover:bg-[#0F2140] dark:hover:bg-[#2E3038] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border border-transparent dark:border-[#B4B4B4] cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-[#2C5C93] dark:text-[#D0D0D0]" />
              <span>Pin to GIS Threat Map</span>
            </button>
          </div>
        </div>

        {/* PIN CONFIRMATION TOAST */}
        {pinnedSuccess && (
          <div className="bg-[#F1F8F3] dark:bg-[#0A2E22]/40 border border-[#E4F3E9] dark:border-[#14532D] p-4 rounded-xl flex items-center gap-2 text-xs font-bold text-[#126B34] dark:text-[#E0E0E0] animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-[#126B34] dark:text-[#D0D0D0] flex-shrink-0" />
            <span>Drone detected road obstruction pinned to GIS Map! Recalculating safe evacuation paths...</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: DRONE AERIAL INSPECTION VIEWPORT WITH YOLO BOUNDING BOXES */}
          <div className="lg:col-span-8 nexora-card p-4 space-y-3 dark:bg-[#212121] dark:border-[#B4B4B4]">
            
            {/* Viewport Control Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#E4E4E0] dark:border-[#B4B4B4] text-xs">
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold text-[#14151A] dark:text-[#FFFFFF] flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                  Aerial Drone Reconnaissance Feed
                </span>
                <span className="font-data text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">
                  Altitude: 48m â€¢ Res: 4K 60fps â€¢ Lat: 26.175Â°N, 91.731Â°E
                </span>
              </div>

              {/* Bounding Box Visibility Toggle */}
              <div className="flex items-center gap-3 font-data">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBoxes}
                    onChange={(e) => setShowBoxes(e.target.checked)}
                    className="rounded accent-purple-700"
                  />
                  <span className="text-[#5A5C66] dark:text-[#FFFFFF] font-semibold text-[11px]">Show YOLO Bounding Boxes</span>
                </label>

                <div className="flex items-center gap-1.5 pl-2 border-l border-[#DEDEDA] dark:border-[#B4B4B4]">
                  <span className="text-[#6B6D77] dark:text-[#D0D0D0] text-[10px]">Min Conf:</span>
                  <span className="font-bold text-[#12294D] dark:text-[#D0D0D0]">{confidenceThreshold}%</span>
                </div>
              </div>
            </div>

            {/* Drone Image Canvas Area with SVG Overlays */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#14151A] shadow-inner group">
              <img
                src={scan?.imageUrl || '/drone_flood_survey.jpg'}
                alt="Drone Survey Reconnaissance"
                className="w-full h-full object-cover select-none"
              />

              {/* Real-time YOLO Bounding Boxes Overlay */}
              {showBoxes && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {filteredDetections.map((det) => {
                    const [ymin, xmin, ymax, xmax] = det.bbox;
                    const isSelected = selectedDetectionId === det.id;
                    const strokeColor = det.category === 'FLOODED_ROAD' ? '#B42318' : det.category === 'SUBMERGED_VEHICLE' ? '#A15C07' : det.category === 'TRAPPED_CITIZENS' ? '#1A3A6B' : '#5A5C66';

                    return (
                      <g key={det.id} className="cursor-pointer pointer-events-auto" onClick={() => setSelectedDetectionId(det.id)}>
                        <rect
                          x={xmin}
                          y={ymin}
                          width={xmax - xmin}
                          height={ymax - ymin}
                          fill={isSelected ? `${strokeColor}33` : 'transparent'}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? "1" : "0.6"}
                          strokeDasharray={isSelected ? "2, 1" : "none"}
                          className="transition-all"
                        />
                        {/* Label Badge on top of bounding box */}
                        <rect
                          x={xmin}
                          y={Math.max(0, ymin - 4.5)}
                          width={Math.min(100 - xmin, (det.label.length * 1.5) + 12)}
                          height="4.2"
                          fill={strokeColor}
                          rx="0.6"
                        />
                        <text
                          x={xmin + 1}
                          y={Math.max(3, ymin - 1.2)}
                          fill="#FFFFFF"
                          fontSize="2.4"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {det.label} ({det.confidencePct}%)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Watermark / HUD Overlay */}
              <div className="absolute top-3 right-3 bg-[#14151A]/90 px-2.5 py-1 rounded-lg text-white font-mono text-[10px] border border-[#35363F]/80">
                <span>YOLOv8x-Seg â€¢ 42ms FPS: 24</span>
              </div>

              <div className="absolute bottom-3 left-3 bg-[#14151A]/90 px-3 py-1.5 rounded-lg text-white font-mono text-[11px] border border-[#35363F]/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FCF1F0] animate-pulse dark:bg-[#3F1414]"></span>
                <span>REC â€¢ Bharalumukh Causeway Link</span>
              </div>

            </div>

            {/* Inference Model Bar */}
            <div className="bg-[#F1F1EF] dark:bg-[#2F2F2F] p-3 rounded-xl border border-[#DEDEDA] dark:border-[#B4B4B4] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#A15C07] dark:text-[#E0E0E0]" />
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF]">
                  AI Vision Pipeline: TensorRT Optimized YOLOv8 Custom Disaster Weights
                </span>
              </div>
              <div className="flex items-center gap-3 font-data text-[11px] text-[#5A5C66] dark:text-[#D0D0D0]">
                <span>Detections: <strong className="text-[#14151A] dark:text-[#FFFFFF]">{filteredDetections.length} objects</strong></span>
                <span>Precision: <strong className="text-[#126B34] dark:text-[#D0D0D0]">94.8%</strong></span>
              </div>
            </div>

          </div>

          {/* RIGHT: DETECTION CLASSIFICATION BREAKDOWN */}
          <div className="lg:col-span-4 space-y-4">
            
            <div className="nexora-card p-5 space-y-4 dark:bg-[#212121] dark:border-[#B4B4B4]">
              <div className="flex items-center justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-3">
                <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                  Identified Disaster Artifacts ({filteredDetections.length})
                </h3>
                <span className="text-[10px] font-bold font-data bg-[#EEF2F8] dark:bg-[#1F2937]/60 text-[#0F2140] dark:text-[#D0D0D0] border border-transparent dark:border-[#374151] px-2 py-0.5 rounded">
                  Damage: SEVERE
                </span>
              </div>

              <div className="space-y-3">
                {scan?.detectedObjects.map((det) => {
                  const isSelected = selectedDetectionId === det.id;
                  const colorBadge = det.category === 'FLOODED_ROAD' 
                    ? 'bg-[#FBE9E7] dark:bg-[#3F1414]/60 text-[#8A1A12] dark:text-[#C0C0C0]' 
                    : det.category === 'SUBMERGED_VEHICLE' 
                    ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0]' 
                    : det.category === 'TRAPPED_CITIZENS' 
                    ? 'bg-[#EEF2F8] dark:bg-[#2F2F2F] text-[#12294D] dark:text-[#D0D0D0]' 
                    : 'bg-[#EEF2F8] dark:bg-[#1F2937]/60 text-[#12294D] dark:text-[#D0D0D0]';

                  return (
                    <div
                      key={det.id}
                      onClick={() => setSelectedDetectionId(det.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${ isSelected ? 'bg-[#1A3A6B] dark:bg-[#60A5FA] text-white shadow-sm' : 'border-[#DEDEDA] dark:border-[#B4B4B4] bg-white dark:bg-[#2F2F2F] hover:bg-[#F1F1EF] dark:hover:bg-[#2E3038]' }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-data ${colorBadge}`}>
                            {det.category.replace('_', ' ')}
                          </span>
                          <h4 className={`font-heading font-bold text-xs mt-1 ${isSelected ? 'text-white' : 'text-[#14151A] dark:text-[#FFFFFF]'}`}>
                            {det.label}
                          </h4>
                        </div>
                        <span className={`font-data text-xs font-bold ${isSelected ? 'text-white' : 'text-[#12294D] dark:text-[#D0D0D0]'}`}>
                          {det.confidencePct}%
                        </span>
                      </div>

                      <p className="text-[11px] text-[#5A5C66] dark:text-[#E0E0E0] mt-1.5 leading-relaxed">
                        {det.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] space-y-2">
                <button
                  onClick={handlePinToMap}
                  className="w-full py-2.5 rounded-xl bg-[#1A3A6B] hover:bg-[#142C52] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Pin Roadblock & Trigger Evac Reroute</span>
                </button>

                <button
                  onClick={() => setCurrentView('EMERGENCY_RESOURCES')}
                  className="w-full py-2 rounded-xl bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF] font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-transparent dark:border-[#B4B4B4] cursor-pointer"
                >
                  <span>Dispatch Boat / Rescue Unit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Drone Mission Stats */}
            <div className="bg-[#EFEFEC] dark:bg-[#2F2F2F] border border-[#DCDCD8] dark:border-[#B4B4B4] p-4 rounded-xl text-xs space-y-2 text-[#12294D] dark:text-[#FFFFFF]">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#126B34] dark:text-[#D0D0D0]" />
                <span className="text-[#14151A] dark:text-[#FFFFFF]">SIH Workflow Integration:</span>
              </div>
              <p className="text-[11px] text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed">
                When the drone detects a flooded roadway or blocked culvert, the operator clicks "Pin to GIS Map". NEXORA instantly marks the road as impassable and recalculates citizen evacuation routes to avoid that choke point.
              </p>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
};
