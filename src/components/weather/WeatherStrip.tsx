import React from 'react';
import {
  CloudOff,
  Droplets,
  Wind,
  Gauge,
  Umbrella,
  RefreshCw,
  Sun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning
} from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { describeWeatherCode, windCompass, type WeatherCodeInfo } from '../../services/weatherService';

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

const relativeAge = (ts: number) => {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : `${mins} min ago`;
};

interface WeatherStripProps {
  className?: string;
}

/**
 * Compact live-weather readout for the Citizen Portal.
 *
 * Shows the four things a citizen checks before deciding to evacuate: how hot
 * it is, whether it is raining, how windy, and how humid. Deliberately does not
 * try to duplicate the full Weather page.
 */
export const WeatherStrip: React.FC<WeatherStripProps> = ({ className = '' }) => {
  const weather = useNexoraStore((s) => s.weather);
  const status = useNexoraStore((s) => s.weatherStatus);
  const isOffline = useNexoraStore((s) => s.isOffline);
  const mapDataStatus = useNexoraStore((s) => s.mapDataStatus);
  const refreshWeather = useNexoraStore((s) => s.refreshWeather);

  const offline = isOffline || mapDataStatus === 'OFFLINE';

  if (!weather) {
    return (
      <div
        data-testid="weather-strip"
        className={`bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl shadow-xs px-4 py-3 flex items-center gap-3 ${className}`}
      >
        <CloudOff className="w-4 h-4 text-[#6B6D77] dark:text-[#D0D0D0] flex-shrink-0" />
        <span className="text-xs text-[#6B6D77] dark:text-[#D0D0D0]">
          {status === 'ERROR' ? 'Live weather unavailable' : 'Loading live weatherâ€¦'}
        </span>
      </div>
    );
  }

  const c = weather.current;
  const info = describeWeatherCode(c.weatherCode);
  const Icon = GROUP_ICON[info.group];
  const tint = GROUP_TINT[info.group];
  const stale = offline || status === 'STALE' || status === 'ERROR';

  return (
    <div
      data-testid="weather-strip"
      className={`bg-white dark:bg-[#212121] border border-[#DEDEDA] dark:border-[#B4B4B4] rounded-xl shadow-xs ${className}`}
    >
      <div className="flex items-center gap-4 px-4 py-3 flex-wrap">
        {/* Temperature + condition */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Icon className={`w-8 h-8 flex-shrink-0 ${tint}`} />
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-data text-2xl font-black tracking-tight text-[#12294D] dark:text-[#FFFFFF]">
                {Math.round(c.temperatureC)}
              </span>
              <span className="text-sm font-bold text-[#6B6D77] dark:text-[#D0D0D0]">Â°C</span>
            </div>
            <span className={`block text-[10px] font-bold ${tint}`}>{info.label}</span>
          </div>
        </div>

        <span className="hidden sm:block w-px self-stretch bg-[#EDEDEA] dark:bg-[#B4B4B4]" />

        {/* Four headline parameters */}
        <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
          {[
            { icon: Droplets, label: 'Humidity', value: `${Math.round(c.humidityPct)}%` },
            { icon: Wind, label: 'Wind', value: `${Math.round(c.windSpeedKmh)} km/h ${windCompass(c.windDirectionDeg)}` },
            { icon: Gauge, label: 'Pressure', value: `${c.pressureHpa.toFixed(0)} hPa` },
            { icon: Umbrella, label: 'Rain', value: `${c.precipitationMm.toFixed(1)} mm` }
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <m.icon className="w-3.5 h-3.5 text-[#1A3A6B] dark:text-[#D0D0D0] flex-shrink-0" />
              <div className="leading-none">
                <span className="block text-[9px] uppercase font-bold text-[#6B6D77] dark:text-[#D0D0D0] font-data">
                  {m.label}
                </span>
                <span className="block font-data text-xs font-bold text-[#14151A] dark:text-[#FFFFFF] tabular-nums mt-0.5">
                  {m.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Freshness + manual refresh */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold font-data ${
              stale
                ? 'bg-[#FAF0D8] dark:bg-[#3A2A0A]/60 text-[#A15C07] dark:text-[#D0D0D0]'
                : 'bg-[#E4F3E9] dark:bg-[#0A2E22]/60 text-[#126B34] dark:text-[#E0E0E0]'
            }`}
            title={stale ? 'Not a current observation' : 'Live observation from Open-Meteo'}
          >
            <span className="relative flex h-1.5 w-1.5">
              {!stale && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#126B34] opacity-75" />}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${stale ? 'bg-[#A15C07]' : 'bg-[#126B34]'}`} />
            </span>
            {stale ? 'STALE' : 'LIVE'}
          </span>
          <span className="text-[10px] font-data text-[#6B6D77] dark:text-[#D0D0D0] hidden md:inline">
            {relativeAge(weather.fetchedAt)}
          </span>
          <button
            onClick={() => void refreshWeather(true)}
            disabled={offline}
            title={offline ? 'Unavailable while offline' : 'Refresh weather'}
            aria-label="Refresh weather"
            className="p-1.5 rounded-md text-[#6B6D77] dark:text-[#D0D0D0] hover:bg-[#F1F1EF] dark:hover:bg-[#1C1D22] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'LOADING' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
