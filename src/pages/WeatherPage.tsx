import React from 'react';
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  Droplets,
  Wind,
  Gauge,
  Thermometer,
  Sunrise,
  Sunset,
  RefreshCw,
  CloudOff,
  AlertTriangle,
  Umbrella,
  Eye,
  Wind as WindIcon
} from 'lucide-react';
import { TopBar } from '../components/dashboard/TopBar';
import { useNexoraStore } from '../store/useNexoraStore';
import {
  describeWeatherCode,
  windCompass,
  type WeatherCodeInfo
} from '../services/weatherService';

const GROUP_ICON: Record<WeatherCodeInfo['group'], React.ComponentType<{ className?: string }>> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning
};

const GROUP_TINT: Record<WeatherCodeInfo['group'], string> = {
  clear: 'text-[#A15C07] dark:text-[#D0D0D0]',
  cloudy: 'text-[#5A5C66] dark:text-[#D0D0D0]',
  fog: 'text-[#5A5C66] dark:text-[#D0D0D0]',
  drizzle: 'text-[#2C5C93] dark:text-[#D0D0D0]',
  rain: 'text-[#1A3A6B] dark:text-[#D0D0D0]',
  snow: 'text-[#2C5C93] dark:text-[#D0D0D0]',
  thunder: 'text-[#A15C07] dark:text-[#D0D0D0]'
};

const WeatherGlyph = ({ code, className }: { code: number; className?: string }) => {
  const info = describeWeatherCode(code);
  const Icon = GROUP_ICON[info.group];
  return <Icon className={className} />;
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  const today = new Date();
  const diff = Math.round((d.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
};

function relativeAge(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

export const WeatherPage: React.FC = () => {
  const weather = useNexoraStore((s) => s.weather);
  const status = useNexoraStore((s) => s.weatherStatus);
  const error = useNexoraStore((s) => s.weatherError);
  const district = useNexoraStore((s) => s.district);
  const isOffline = useNexoraStore((s) => s.isOffline);
  const mapDataStatus = useNexoraStore((s) => s.mapDataStatus);
  const refreshWeather = useNexoraStore((s) => s.refreshWeather);

  const offline = isOffline || mapDataStatus === 'OFFLINE';

  const header = (
    <div className="bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-lg bg-[#1A3A6B] text-white flex items-center justify-center flex-shrink-0">
          <CloudSun className="w-6 h-6 text-[#2C5C93] dark:text-[#E0E0E0]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6D77] dark:text-[#D0D0D0] font-data">
              Live Weather â€¢ {district}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-data ${
                status === 'LIVE'
                  ? 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0] border border-[#CFE6D8] dark:border-[#14532D]'
                  : status === 'STALE'
                  ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0] border border-[#EFE3C4] dark:border-[#78350F]'
                  : status === 'ERROR'
                  ? 'bg-[#FCF1F0] dark:bg-[#3F1414]/60 text-[#B42318] dark:text-[#C0C0C0] border border-[#FBE9E7] dark:border-[#7F1D1D]'
                  : 'bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#6B6D77] dark:text-[#D0D0D0] border border-[#DEDEDA] dark:border-[#B4B4B4]'
              }`}
            >
              {status === 'LIVE' ? 'LIVE' : status === 'STALE' ? 'STALE' : status === 'ERROR' ? 'FALLBACK' : 'LOADING'}
            </span>
            {weather?.source === 'simulated' && status !== 'ERROR' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-data bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#6B6D77] dark:text-[#D0D0D0] border border-[#DEDEDA] dark:border-[#B4B4B4]">
                SIMULATED
              </span>
            )}
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#12294D] dark:text-[#D0D0D0] mt-0.5">
            Weather Conditions &amp; Forecast
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {weather && (
          <span className="text-[11px] font-data text-[#6B6D77] dark:text-[#D0D0D0]">
            Updated {relativeAge(weather.fetchedAt)}
          </span>
        )}
        <button
          onClick={() => void refreshWeather(true)}
          disabled={offline}
          title={offline ? 'Unavailable while the network is offline' : 'Refresh now'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#2F2F2F] dark:hover:bg-[#2E3038] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'LOADING' ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );

  if (!weather) {
    return (
      <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col">
        <TopBar />
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
          {header}
          <div className="nexora-card p-10 flex flex-col items-center justify-center text-center space-y-2">
            <CloudOff className="w-8 h-8 text-[#6B6D77] dark:text-[#D0D0D0]" />
            <p className="text-sm font-bold text-[#12294D] dark:text-[#FFFFFF]">
              {status === 'ERROR' ? 'Weather unavailable' : 'Loading live weatherâ€¦'}
            </p>
            <p className="text-xs text-[#6B6D77] dark:text-[#D0D0D0] max-w-md">
              {status === 'ERROR' ? error : 'Contacting the Open-Meteo service for the selected district.'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const c = weather.current;
  const info = describeWeatherCode(c.weatherCode);
  const tint = GROUP_TINT[info.group];
  const Icon = GROUP_ICON[info.group];

  return (
    <div className="min-h-screen text-[#14151A] dark:text-[#FFFFFF] flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {header}

        {/* Offline / fallback notice â€” never present stale data as live */}
        {offline && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 border border-[#EFE3C4] dark:border-[#78350F]">
            <CloudOff className="w-4 h-4 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A3E0B] dark:text-[#D0D0D0] leading-snug">
              <strong>Network is offline.</strong> This is the last reading received
              {weather.fetchedAt ? ` (${relativeAge(weather.fetchedAt)})` : ''}. Live weather resumes
              automatically when the network returns.
            </p>
          </div>
        )}

        {!offline && status === 'ERROR' && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FCF1F0] dark:bg-[#3F1414]/40 border border-[#FBE9E7] dark:border-[#7F1D1D]">
            <AlertTriangle className="w-4 h-4 text-[#B42318] dark:text-[#C0C0C0] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A1C13] dark:text-[#C0C0C0] leading-snug">
              <strong>Live weather unavailable</strong> â€” {error} The values below are derived from the
              app's own simulated telemetry, not an observation.
            </p>
          </div>
        )}

        {/* CURRENT CONDITIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 nexora-card p-6 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A5C66] dark:text-[#D0D0D0] font-data">
              Current Conditions
            </span>

            <div className="flex items-center gap-5 mt-4">
              <Icon className={`w-16 h-16 flex-shrink-0 ${tint}`} />
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-data text-6xl font-black tracking-tight text-[#12294D] dark:text-[#FFFFFF]">
                    {Math.round(c.temperatureC)}
                  </span>
                  <span className="text-2xl font-bold text-[#6B6D77] dark:text-[#D0D0D0]">Â°C</span>
                </div>
                <p className={`text-sm font-bold ${tint}`}>{info.label}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#DEDEDA] dark:border-[#B4B4B4] text-xs">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Feels like</span>
              <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">
                {Math.round(c.apparentTemperatureC)}Â°C
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Observed</span>
              <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">{timeLabel(c.observedAt)}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-[#6B6D77] dark:text-[#D0D0D0]">Coordinates</span>
              <span className="font-data font-bold text-[#14151A] dark:text-[#FFFFFF]">
                {weather.lat.toFixed(2)}, {weather.lng.toFixed(2)}
              </span>
            </div>
          </div>

          {/* MEASURED PARAMETERS */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
            {[
              { icon: Droplets, label: 'Humidity', value: `${Math.round(c.humidityPct)}%` },
              { icon: Gauge, label: 'Pressure', value: `${c.pressureHpa.toFixed(1)} hPa` },
              { icon: WindIcon, label: 'Wind', value: `${c.windSpeedKmh.toFixed(1)} km/h` },
              { icon: Wind, label: 'Direction', value: `${windCompass(c.windDirectionDeg)} ${Math.round(c.windDirectionDeg)}Â°` },
              { icon: Umbrella, label: 'Precipitation', value: `${c.precipitationMm.toFixed(1)} mm` },
              { icon: Eye, label: 'Cloud cover', value: `${Math.round(c.cloudCoverPct)}%` },
              { icon: Wind, label: 'Gusts', value: `${c.windGustKmh.toFixed(0)} km/h` },
              { icon: Thermometer, label: 'Dew point feel', value: `${Math.round(c.apparentTemperatureC - (100 - c.humidityPct) / 5)}Â°C` },
              { icon: Sun, label: 'Daylight', value: c.isDay ? 'Day' : 'Night' }
            ].map((m) => (
              <div key={m.label} className="nexora-card p-3.5 space-y-1.5">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] font-data">
                  <m.icon className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
                  {m.label}
                </span>
                <span className="block font-data text-lg font-bold text-[#12294D] dark:text-[#FFFFFF] tabular-nums">
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-HOUR FORECAST */}
        {weather.hourly.length > 0 && (
          <div className="nexora-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">Next 24 Hours</h2>
              <span className="text-[10px] font-data font-bold text-[#6B6D77] dark:text-[#D0D0D0] uppercase tracking-wider">
                Hourly
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {weather.hourly.map((h, i) => {
                const pop = h.precipitationProbabilityPct;
                return (
                  <div
                    key={h.time}
                    className={`flex-shrink-0 w-[74px] rounded-xl border p-2.5 text-center space-y-1.5 ${
                      i === 0
                        ? 'border-[#1A3A6B] dark:border-[#93C5FD] bg-[#EEF2F8] dark:bg-[#171717]'
                        : 'border-[#DEDEDA] dark:border-[#B4B4B4] bg-[#F8F8F7] dark:bg-[#171717]'
                    }`}
                  >
                    <span className="block text-[10px] font-data font-bold text-[#6B6D77] dark:text-[#D0D0D0]">
                      {i === 0 ? 'Now' : timeLabel(h.time)}
                    </span>
                    <WeatherGlyph
                      code={h.weatherCode}
                      className={`w-5 h-5 mx-auto ${GROUP_TINT[describeWeatherCode(h.weatherCode).group]}`}
                    />
                    <span className="block font-data text-sm font-bold text-[#12294D] dark:text-[#FFFFFF] tabular-nums">
                      {Math.round(h.temperatureC)}Â°
                    </span>
                    <span
                      className={`block text-[10px] font-data font-bold ${
                        pop >= 60 ? 'text-[#1A3A6B] dark:text-[#D0D0D0]' : 'text-[#A1A3AC]'
                      }`}
                    >
                      {pop}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7-DAY FORECAST */}
        {weather.daily.length > 0 && (
          <div className="nexora-card p-5 space-y-3">
            <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">7-Day Outlook</h2>

            <div className="space-y-1.5">
              {weather.daily.map((d) => {
                const di = describeWeatherCode(d.weatherCode);
                return (
                  <div
                    key={d.date}
                    className="grid grid-cols-[80px_28px_1fr_56px_76px] items-center gap-3 px-3 py-2.5 rounded-xl border border-[#DEDEDA] dark:border-[#B4B4B4] bg-[#F8F8F7] dark:bg-[#171717]"
                  >
                    <span className="text-xs font-bold text-[#14151A] dark:text-[#FFFFFF]">{dayLabel(d.date)}</span>
                    <WeatherGlyph code={d.weatherCode} className={`w-4 h-4 ${GROUP_TINT[di.group]}`} />
                    <span className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0] truncate">{di.label}</span>
                    <span className="text-[11px] font-data font-bold text-[#1A3A6B] dark:text-[#D0D0D0] text-right">
                      {d.precipitationProbabilityMaxPct}%
                    </span>
                    <span className="text-xs font-data font-bold text-[#14151A] dark:text-[#FFFFFF] text-right tabular-nums">
                      {Math.round(d.tempMinC)}Â° / {Math.round(d.tempMaxC)}Â°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUN TIMES + ATTRIBUTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {weather.daily[0] && (
            <div className="nexora-card p-5 space-y-3">
              <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">Sun Times</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FAF0D8] dark:bg-[#3A2A0A]/40 border border-[#EFE3C4] dark:border-[#78350F] rounded-xl p-3 flex items-center gap-2.5">
                  <Sunrise className="w-5 h-5 text-[#A15C07] dark:text-[#D0D0D0] flex-shrink-0" />
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[#7A3E0B] dark:text-[#D0D0D0]">Sunrise</span>
                    <span className="block font-data text-sm font-bold text-[#14151A] dark:text-[#FFFFFF]">
                      {timeLabel(weather.daily[0].sunrise)}
                    </span>
                  </div>
                </div>
                <div className="bg-[#EEF2F8] dark:bg-[#171717] border border-[#C3D0E4] dark:border-[#B4B4B4] rounded-xl p-3 flex items-center gap-2.5">
                  <Sunset className="w-5 h-5 text-[#1A3A6B] dark:text-[#D0D0D0] flex-shrink-0" />
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[#1A3A6B] dark:text-[#D0D0D0]">Sunset</span>
                    <span className="block font-data text-sm font-bold text-[#14151A] dark:text-[#FFFFFF]">
                      {timeLabel(weather.daily[0].sunset)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="nexora-card p-5 space-y-2">
            <h2 className="font-heading font-bold text-sm text-[#12294D] dark:text-[#FFFFFF]">Data Source</h2>
            <p className="text-xs text-[#5A5C66] dark:text-[#D0D0D0] leading-relaxed">
              Observations from <strong>Open-Meteo</strong> â€” free, key-free, and refreshed every 5 minutes
              while the network is online. No API key is stored in this project.
            </p>
            <p className="text-[11px] text-[#6B6D77] dark:text-[#D0D0D0]">
              Units: Â°C, km/h, mm, hPa. Weather icons follow the WMO 4677 code table.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
