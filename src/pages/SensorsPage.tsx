import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { Radio, Wifi, BatteryCharging, Droplets, CloudRain, Wind, Thermometer, Gauge, CheckCircle2, AlertTriangle, RefreshCw, Play, Pause, ExternalLink } from 'lucide-react';
import { useNexoraStore } from '../store/useNexoraStore';
import { LiveSensorStrip } from '../components/shared/LiveSensorStrip';

export const SensorsPage: React.FC = () => {
  const {
    sensorStations,
    isSensorStreaming,
    toggleSensorStreaming,
    setCurrentView
  } = useNexoraStore();

  const [simPackets, setSimPackets] = useState<string[]>([
    `[08:44:12] RX (868.1MHz) STN#01 | WL:82cm | RF:46mm | TEMP:29.2C | RSSI:-78dBm | SNR:9.4dB | CRC:OK`,
    `[08:44:08] RX (868.3MHz) STN#02 | WL:142cm | RF:52mm | TEMP:28.6C | RSSI:-84dBm | SNR:7.8dB | CRC:OK`,
    `[08:43:59] RX (868.5MHz) STN#03 | WL:68cm | RF:39mm | TEMP:29.4C | RSSI:-72dBm | SNR:11.2dB | CRC:OK`,
    `[08:43:45] RX (868.1MHz) STN#04 | WL:45cm | RF:34mm | TEMP:30.1C | RSSI:-95dBm | SNR:4.8dB | CRC:OK`
  ]);

  // Periodic streaming simulation
  useEffect(() => {
    if (!isSensorStreaming) return;
    const timer = setInterval(() => {
      const randomStation = Math.floor(Math.random() * 4) + 1;
      const time = new Date().toLocaleTimeString();
      const newPacket = `[${time}] RX (868.${randomStation}MHz) STN#0${randomStation} | WL:${78 + Math.floor(Math.random() * 12)}cm | RF:${40 + Math.floor(Math.random() * 15)}mm | RSSI:-${70 + Math.floor(Math.random() * 20)}dBm | CRC:OK`;
      setSimPackets(prev => [newPacket, ...prev.slice(0, 15)]);
    }, 3500);
    return () => clearInterval(timer);
  }, [isSensorStreaming]);

  const onlineStations = sensorStations.filter(s => s.status === 'ONLINE').length;
  const warningStations = sensorStations.filter(s => s.status === 'WARNING').length;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* SENSORS HEADER & LORA GATEWAY TELEMETRY STRIP */}
        <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#12294D] dark:bg-[#2F2F2F] text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Radio className="w-6 h-6 text-[#2C5C93] dark:text-[#D0D0D0]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] font-data">
                  IoT Hardware Telemetry â€¢ LoRaWAN Mesh 868MHz
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#E4F3E9] dark:border-[#14532D] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full text-[#126B34] animate-pulse dark:text-[#D0D0D0]"></span>
                  Gateway Active
                </span>
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#12294D] dark:text-[#FFFFFF] mt-0.5">
                Live ESP32 Sensor Network Monitoring
              </h1>
            </div>
          </div>

          {/* Network Health Highlights */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-data">
            <div className="bg-[#F1F1EF] dark:bg-[#2F2F2F] border border-[#DEDEDA] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0] block text-[10px] uppercase font-bold">Network Status</span>
              <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{onlineStations} Online â€¢ {warningStations} Warning</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#2F2F2F] border border-[#DEDEDA] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0] block text-[10px] uppercase font-bold">Packet Success</span>
              <span className="font-bold text-[#126B34] dark:text-[#E0E0E0]">98.4% (SF7 BW125)</span>
            </div>
            <div className="bg-[#F1F1EF] dark:bg-[#2F2F2F] border border-[#DEDEDA] dark:border-[#B4B4B4] px-3 py-1.5 rounded-xl">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0] block text-[10px] uppercase font-bold">Base Station</span>
              <span className="font-bold text-[#12294D] dark:text-[#D0D0D0]">Guwahati DC Office Mast</span>
            </div>

            <button
              onClick={toggleSensorStreaming}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${ isSensorStreaming ? 'bg-[#126B34] text-white hover:bg-[#0E5230] dark:bg-[#34D399] dark:hover:bg-[#0E5230]' : 'bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#E4E4E0] dark:hover:bg-[#2E3038] text-[#14151A] dark:text-[#FFFFFF]' }`}
            >
              {isSensorStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSensorStreaming ? 'Streaming Live' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* 5 LIVE HEADLINE READINGS â€” shared with the Citizen Portal */}
        <LiveSensorStrip
          variant="full"
          subtitle="Basin-wide gauge aggregate â€¢ refreshes every 5 seconds"
        />

        {/* 4 LIVE SENSOR STATION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {sensorStations.map((stn) => {
            const isWarning = stn.status === 'WARNING';
            const isDanger = stn.waterLevelCm >= stn.waterLevelDangerCm;
            const waterPct = Math.min(100, Math.round((stn.waterLevelCm / stn.waterLevelDangerCm) * 100));

            return (
              <div 
                key={stn.id}
                className={`nexora-card p-5 space-y-4 transition-all dark:bg-[#212121] ${ isDanger ? 'border-[#F3CFC9] bg-[#FCF1F0]/50 dark:border-[#7F1D1D] dark:bg-[#3F1414]/50' : isWarning ? 'border-[#EFE3C4] bg-[#FAF0D8]/50 dark:border-[#78350F] dark:bg-[#3A2A0A]/50' : 'border-[#DEDEDA] dark:border-[#B4B4B4] hover:border-[#D2D3D8] dark:hover:border-[#5B7BA8]' }`}
              >
                {/* Station Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-data font-bold text-xs text-[#12294D] dark:text-[#D0D0D0] bg-[#EEF2F8] dark:bg-[#2F2F2F] px-2 py-0.5 rounded border border-transparent dark:border-[#B4B4B4]">
                        {stn.stationCode}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ stn.status === 'ONLINE' ? 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0]' : 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0]' }`}>
                        {stn.status}
                      </span>
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] mt-1.5 line-clamp-1">
                      {stn.name}
                    </h3>
                    <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] line-clamp-1">{stn.locationName}</p>
                  </div>

                  <div className="text-right font-data text-[10px] text-[#6B6D77] dark:text-[#D0D0D0]">
                    <div>Bat: <strong className="text-[#5A5C66] dark:text-[#FFFFFF]">{stn.batteryPct}%</strong></div>
                    <div>RSSI: <strong className="text-[#5A5C66] dark:text-[#FFFFFF]">{stn.loraRssiDbm} dBm</strong></div>
                  </div>
                </div>

                {/* Primary Metric: Water Level Gauge */}
                <div className="bg-white dark:bg-[#171717] p-3 rounded-xl border border-[#DEDEDA] dark:border-[#B4B4B4] shadow-xs space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-[#5A5C66] dark:text-[#D0D0D0] flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                      Water Depth
                    </span>
                    <div className="text-right">
                      <span className="font-data font-bold text-2xl text-[#12294D] dark:text-[#FFFFFF]">{stn.waterLevelCm}</span>
                      <span className="text-xs text-[#6B6D77] dark:text-[#D0D0D0] ml-1">cm</span>
                    </div>
                  </div>

                  {/* Water level bar vs danger */}
                  <div className="w-full bg-[#F1F1EF] dark:bg-[#2F2F2F] h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        waterPct >= 90 ? 'bg-[#B42318]' : waterPct >= 70 ? 'bg-[#A15C07]' : 'bg-[#1A3A6B] dark:bg-[#93C5FD]'
                      }`}
                      style={{ width: `${waterPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">
                    <span>Normal: {stn.waterLevelNormalCm}cm</span>
                    <span className="font-bold text-[#B42318] dark:text-[#C0C0C0]">Danger: {stn.waterLevelDangerCm}cm</span>
                  </div>
                </div>

                {/* Secondary Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-data">
                  <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-2">
                    <CloudRain className="w-4 h-4 text-[#2C5C93] dark:text-[#D0D0D0]" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] block">Rainfall</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{stn.rainfallMm} mm/h</span>
                    </div>
                  </div>

                  <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-2">
                    <Wind className="w-4 h-4 text-[#5A5C66] dark:text-[#D0D0D0]" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] block">Wind</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{stn.windSpeedKmh} km/h</span>
                    </div>
                  </div>

                  <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-[#A15C07] dark:text-[#D0D0D0]" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] block">Temp / Hum</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{stn.temperatureC}Â°C â€¢ {stn.humidityPct}%</span>
                    </div>
                  </div>

                  <div className="bg-[#F1F1EF] dark:bg-[#171717] p-2 rounded-lg border border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] block">Pressure</span>
                      <span className="font-bold text-[#14151A] dark:text-[#FFFFFF]">{stn.pressureHpa} hPa</span>
                    </div>
                  </div>
                </div>

                {/* Footer Status */}
                <div className="pt-2 border-t border-[#E4E4E0] dark:border-[#B4B4B4] flex items-center justify-between text-[10px] text-[#6B6D77] dark:text-[#D0D0D0]">
                  <span className="flex items-center gap-1 font-data">
                    <CheckCircle2 className="w-3 h-3 text-[#126B34] dark:text-[#D0D0D0]" />
                    {stn.lastPingTime}
                  </span>
                  <button
                    onClick={() => setCurrentView('DISASTER_MAP')}
                    className="text-[#2C5C93] dark:text-[#D0D0D0] font-bold hover:underline cursor-pointer"
                  >
                    Locate on Map â†’
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* LORA RAW PACKET STREAM & GATEWAY DIAGNOSTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Packet Terminal Log */}
          <div className="lg:col-span-8 bg-[#14151A] dark:bg-[#0F0F0F] text-[#F1F1EF] rounded-xl p-5 shadow-lg border border-[#101116] dark:border-[#B4B4B4] space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-[#101116] dark:border-[#B4B4B4] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FCF1F0] inline-block dark:bg-[#3F1414]"></div>
                <div className="w-3 h-3 rounded-full bg-[#A15C07] inline-block"></div>
                <div className="w-3 h-3 rounded-full bg-[#126B34] inline-block"></div>
                <span className="text-xs font-bold text-[#C6C7CD] dark:text-[#FFFFFF] ml-2">LoRaWAN Gateway Terminal â€¢ Packet Demodulator</span>
              </div>
              <span className="text-xs text-[#5BBF7A]">Listening on 868.1 - 868.5 MHz</span>
            </div>

            <div className="space-y-1.5 text-xs text-[#C6C7CD] overflow-y-auto max-h-56">
              {simPackets.map((pkt, idx) => (
                <div key={idx} className="flex items-start gap-2 hover:bg-[#1C1D22]/50 dark:hover:bg-[#1C1D22]/50 p-1 rounded">
                  <span className="text-[#6E93C4] select-none">&gt;</span>
                  <span className={idx === 0 ? 'text-[#7E9AC4] font-bold' : 'text-[#C6C7CD] dark:text-[#D0D0D0]'}>{pkt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hardware Specifications */}
          <div className="lg:col-span-4 nexora-card p-5 space-y-4 dark:bg-[#212121] dark:border-[#B4B4B4]">
            <h3 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-[#1A3A6B] dark:text-[#D0D0D0]" />
              Physical Sensor Architecture
            </h3>
            
            <div className="space-y-2.5 text-xs text-[#5A5C66] dark:text-[#D0D0D0]">
              <div className="flex items-start justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-1.5">
                <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Microcontroller</span>
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF] font-data">ESP32 Dual-Core 240MHz</span>
              </div>
              <div className="flex items-start justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-1.5">
                <span className="text-[#6B6D77] dark:text-[#D0D0D0]">LoRa Transceiver</span>
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF] font-data">Semtech SX1262 (+22dBm)</span>
              </div>
              <div className="flex items-start justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-1.5">
                <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Ultrasonic Level Sensor</span>
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF] font-data">JSN-SR04T Waterproof (Â±1mm)</span>
              </div>
              <div className="flex items-start justify-between border-b border-[#E4E4E0] dark:border-[#B4B4B4] pb-1.5">
                <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Rain Gauge</span>
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF] font-data">Tipping Bucket (0.2mm/pulse)</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Power Subsystem</span>
                <span className="font-semibold text-[#14151A] dark:text-[#FFFFFF] font-data">18650 Li-Ion + 10W Solar MPPT</span>
              </div>
            </div>

            <div className="bg-[#EFEFEC] dark:bg-[#2F2F2F] border border-[#DCDCD8] dark:border-[#B4B4B4] rounded-xl p-3 text-[11px] text-[#12294D] dark:text-[#D0D0D0]">
              <strong className="text-[#14151A] dark:text-[#FFFFFF]">Offline Resilience:</strong> If 4G/Cellular dies during catastrophic floods, stations fall back to ad-hoc LoRa P2P multi-hop to relay metrics directly to the DDMO emergency bunker.
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};
