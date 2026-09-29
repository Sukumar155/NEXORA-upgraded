/**
 * weatherService.ts — live weather from Open-Meteo.
 *
 * Open-Meteo is used because it needs no API key and no signup, which keeps
 * the "no credentials required" property the rest of the app already has
 * (same reason the NEXORA chat relays through the local backend). It is CORS
 * enabled, so the browser can call it directly.
 *
 * Units are requested to match the rest of the app and the flood model:
 * °C, km/h, mm, hPa. No unit conversion happens anywhere downstream.
 *
 * Docs: https://open-meteo.com/en/docs
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export type WeatherStatus = 'IDLE' | 'LOADING' | 'LIVE' | 'STALE' | 'ERROR';

export interface WeatherCurrent {
  /** °C */
  temperatureC: number;
  /** °C — heat-index adjusted. */
  apparentTemperatureC: number;
  /** % */
  humidityPct: number;
  /** hPa */
  pressureHpa: number;
  /** km/h */
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustKmh: number;
  /** mm in the last interval */
  precipitationMm: number;
  /** % */
  cloudCoverPct: number;
  /** WMO 4677 weather code. */
  weatherCode: number;
  isDay: boolean;
  observedAt: string;
}

export interface WeatherHourlyPoint {
  time: string;
  temperatureC: number;
  precipitationMm: number;
  /** % */
  precipitationProbabilityPct: number;
  windSpeedKmh: number;
  humidityPct: number;
  weatherCode: number;
}

export interface WeatherDailyPoint {
  date: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationSumMm: number;
  precipitationProbabilityMaxPct: number;
  windMaxKmh: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherSnapshot {
  current: WeatherCurrent;
  hourly: WeatherHourlyPoint[];
  daily: WeatherDailyPoint[];
  /** "live" = Open-Meteo, "simulated" = app telemetry fallback. */
  source: 'live' | 'simulated';
  /** Epoch ms the fetch completed. */
  fetchedAt: number;
  lat: number;
  lng: number;
  /** Resolved place name from the reverse geocoder, when available. */
  placeName?: string;
}

/* ── WMO 4677 weather-code table ─────────────────────────────────────────── */

export interface WeatherCodeInfo {
  label: string;
  /** Coarse group used for icon + colour selection. */
  group: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';
}

const WMO: Record<number, WeatherCodeInfo> = {
  0: { label: 'Clear sky', group: 'clear' },
  1: { label: 'Mainly clear', group: 'clear' },
  2: { label: 'Partly cloudy', group: 'cloudy' },
  3: { label: 'Overcast', group: 'cloudy' },
  45: { label: 'Fog', group: 'fog' },
  48: { label: 'Depositing rime fog', group: 'fog' },
  51: { label: 'Light drizzle', group: 'drizzle' },
  53: { label: 'Moderate drizzle', group: 'drizzle' },
  55: { label: 'Dense drizzle', group: 'drizzle' },
  56: { label: 'Light freezing drizzle', group: 'drizzle' },
  57: { label: 'Dense freezing drizzle', group: 'drizzle' },
  61: { label: 'Slight rain', group: 'rain' },
  63: { label: 'Moderate rain', group: 'rain' },
  65: { label: 'Heavy rain', group: 'rain' },
  66: { label: 'Light freezing rain', group: 'rain' },
  67: { label: 'Heavy freezing rain', group: 'rain' },
  71: { label: 'Slight snowfall', group: 'snow' },
  73: { label: 'Moderate snowfall', group: 'snow' },
  75: { label: 'Heavy snowfall', group: 'snow' },
  77: { label: 'Snow grains', group: 'snow' },
  80: { label: 'Slight rain showers', group: 'rain' },
  81: { label: 'Moderate rain showers', group: 'rain' },
  82: { label: 'Violent rain showers', group: 'rain' },
  85: { label: 'Slight snow showers', group: 'snow' },
  86: { label: 'Heavy snow showers', group: 'snow' },
  95: { label: 'Thunderstorm', group: 'thunder' },
  96: { label: 'Thunderstorm with slight hail', group: 'thunder' },
  99: { label: 'Thunderstorm with heavy hail', group: 'thunder' }
};

export function describeWeatherCode(code: number): WeatherCodeInfo {
  return WMO[code] ?? { label: 'Unknown', group: 'cloudy' };
}

/** 16-point compass label for a bearing in degrees. */
export function windCompass(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/* ── Fetching ────────────────────────────────────────────────────────────── */

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current?: Record<string, number | string>;
  hourly?: Record<string, (number | string)[]>;
  daily?: Record<string, (number | string)[]>;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function pickHourlyIndex(times: string[], count: number): number {
  if (!times.length) return -1;
  const now = Date.now();
  // First hour at or after now — Open-Meteo returns a dense past+future array.
  let idx = times.findIndex((t) => new Date(t).getTime() >= now - 30 * 60 * 1000);
  if (idx === -1) idx = 0;
  return Math.max(0, Math.min(idx, Math.max(0, times.length - count)));
}

export class WeatherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherError';
  }
}

/**
 * Fetch current conditions plus a 24-hour and 7-day forecast.
 * `signal` lets the caller cancel when the district changes mid-flight.
 */
export async function fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m'
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'relative_humidity_2m'
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'sunrise',
      'sunset'
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh'
  });

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${params.toString()}`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new WeatherError('Network unreachable — could not reach the weather service.');
  }

  if (!res.ok) {
    throw new WeatherError(`Weather service returned HTTP ${res.status}.`);
  }

  let data: OpenMeteoResponse;
  try {
    data = (await res.json()) as OpenMeteoResponse;
  } catch {
    throw new WeatherError('Weather service returned a malformed response.');
  }

  if (!data.current || data.current.temperature_2m === undefined) {
    throw new WeatherError('Weather service response was missing current conditions.');
  }

  const c = data.current;

  const hourly: WeatherHourlyPoint[] = [];
  const h = data.hourly;
  if (h?.time) {
    const start = pickHourlyIndex(h.time as string[], 24);
    for (let i = start; i < (h.time as string[]).length && hourly.length < 24; i++) {
      hourly.push({
        time: (h.time as string[])[i],
        temperatureC: num(h.temperature_2m?.[i]),
        precipitationMm: num(h.precipitation?.[i]),
        precipitationProbabilityPct: num(h.precipitation_probability?.[i]),
        windSpeedKmh: num(h.wind_speed_10m?.[i]),
        humidityPct: num(h.relative_humidity_2m?.[i]),
        weatherCode: num(h.weather_code?.[i])
      });
    }
  }

  const daily: WeatherDailyPoint[] = [];
  const d = data.daily;
  if (d?.time) {
    for (let i = 0; i < (d.time as string[]).length; i++) {
      daily.push({
        date: (d.time as string[])[i],
        weatherCode: num(d.weather_code?.[i]),
        tempMaxC: num(d.temperature_2m_max?.[i]),
        tempMinC: num(d.temperature_2m_min?.[i]),
        precipitationSumMm: num(d.precipitation_sum?.[i]),
        precipitationProbabilityMaxPct: num(d.precipitation_probability_max?.[i]),
        windMaxKmh: num(d.wind_speed_10m_max?.[i]),
        sunrise: String(d.sunrise?.[i] ?? ''),
        sunset: String(d.sunset?.[i] ?? '')
      });
    }
  }

  return {
    current: {
      temperatureC: num(c.temperature_2m),
      apparentTemperatureC: num(c.apparent_temperature, num(c.temperature_2m)),
      humidityPct: num(c.relative_humidity_2m),
      pressureHpa: num(c.pressure_msl),
      windSpeedKmh: num(c.wind_speed_10m),
      windDirectionDeg: num(c.wind_direction_10m),
      windGustKmh: num(c.wind_gusts_10m, num(c.wind_speed_10m)),
      precipitationMm: num(c.precipitation),
      cloudCoverPct: num(c.cloud_cover),
      weatherCode: num(c.weather_code),
      isDay: num(c.is_day, 1) === 1,
      observedAt: String(c.time ?? new Date().toISOString())
    },
    hourly,
    daily,
    source: 'live',
    fetchedAt: Date.now(),
    lat: data.latitude,
    lng: data.longitude
  };
}

/**
 * Build a snapshot from the app's own simulated telemetry.
 *
 * Used when Open-Meteo is unreachable so the Weather page still renders
 * something coherent. Clearly labelled `source: 'simulated'` in the UI — never
 * presented as an observation.
 */
export function simulatedWeather(
  lat: number,
  lng: number,
  input: {
    temperatureC: number;
    humidityPct: number;
    pressureHpa: number;
    windSpeedKmh: number;
    rainfallMmPerHour: number;
    cloudCoverPct: number;
  }
): WeatherSnapshot {
  // Map rainfall intensity onto a sensible WMO code so the UI is consistent.
  const rain = input.rainfallMmPerHour;
  const code =
    rain >= 10 ? 65 : rain >= 4 ? 63 : rain >= 1 ? 61 : rain > 0 ? 51 : input.cloudCoverPct >= 60 ? 3 : 2;

  const now = new Date();
  const hourly: WeatherHourlyPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 3600_000);
    // Gentle diurnal temperature curve.
    const hourFactor = Math.sin(((t.getHours() - 9) / 24) * Math.PI * 2);
    hourly.push({
      time: t.toISOString().slice(0, 16),
      temperatureC: Number((input.temperatureC + hourFactor * 3.2).toFixed(1)),
      precipitationMm: Number((rain / 4).toFixed(2)),
      precipitationProbabilityPct: Math.min(100, Math.round(rain * 6)),
      windSpeedKmh: Number((input.windSpeedKmh + Math.sin(i / 3) * 4).toFixed(1)),
      humidityPct: Math.min(100, Math.round(input.humidityPct + Math.sin(i / 4) * 6)),
      weatherCode: code
    });
  }

  const daily: WeatherDailyPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(now.getTime() + i * 86400_000);
    daily.push({
      date: t.toISOString().slice(0, 10),
      weatherCode: code,
      tempMaxC: Number((input.temperatureC + 3.5).toFixed(1)),
      tempMinC: Number((input.temperatureC - 2.5).toFixed(1)),
      precipitationSumMm: Number((rain * 6).toFixed(1)),
      precipitationProbabilityMaxPct: Math.min(100, Math.round(rain * 6)),
      windMaxKmh: Number((input.windSpeedKmh * 1.4).toFixed(1)),
      sunrise: '05:40',
      sunset: '18:20'
    });
  }

  return {
    current: {
      temperatureC: input.temperatureC,
      apparentTemperatureC: Number((input.temperatureC + 2.4).toFixed(1)),
      humidityPct: Math.round(input.humidityPct),
      pressureHpa: input.pressureHpa,
      windSpeedKmh: input.windSpeedKmh,
      windDirectionDeg: 218,
      windGustKmh: Number((input.windSpeedKmh * 1.6).toFixed(1)),
      precipitationMm: rain,
      cloudCoverPct: Math.round(input.cloudCoverPct),
      weatherCode: code,
      isDay: true,
      observedAt: now.toISOString()
    },
    hourly,
    daily,
    source: 'simulated',
    fetchedAt: Date.now(),
    lat,
    lng
  };
}
