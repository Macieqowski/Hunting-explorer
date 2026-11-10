// Weather data from Open-Meteo (free, keyless, CORS-enabled) plus the hunter-oriented
// conclusions drawn from it. No DOM here; see weatherUi.ts for rendering.

import type { IconName } from './icons';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface Place {
  id: string;
  name: string;
  /** Region / country line shown under the name. */
  detail?: string;
  lat: number;
  lng: number;
}

export interface Current {
  time: number; // unix ms
  temp: number;
  feels: number;
  humidity: number;
  precip: number;
  code: number;
  cloud: number;
  pressure: number;
  wind: number; // km/h
  windDir: number; // degrees the wind blows FROM
  gust: number;
  isDay: boolean;
}

export interface Hour {
  time: number;
  temp: number;
  dew: number;
  precipProb: number | null;
  precip: number;
  snow: number; // cm
  code: number;
  cloud: number;
  visibility: number | null; // m
  wind: number;
  windDir: number;
  gust: number;
  pressure: number;
}

export interface Day {
  time: number; // local midnight, unix ms
  code: number;
  tmax: number;
  tmin: number;
  precip: number;
  precipProb: number | null;
  snow: number;
  windMax: number;
  gustMax: number;
  windDir: number;
}

export interface Forecast {
  timezone: string;
  utcOffset: number; // seconds
  current: Current;
  hours: Hour[]; // from 24 h ago to the end of the forecast
  days: Day[]; // from yesterday on
}

const CURRENT = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day';
const HOURLY = 'temperature_2m,dew_point_2m,precipitation_probability,precipitation,snowfall,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant';

export function forecastUrl(lat: number, lng: number): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '1',
    forecast_days: '8',
    current: CURRENT,
    hourly: HOURLY,
    daily: DAILY,
  });
  return `${FORECAST_URL}?${p}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseForecast(j: any): Forecast {
  const c = j.current;
  const h = j.hourly;
  const d = j.daily;
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  const nn = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    timezone: j.timezone,
    utcOffset: j.utc_offset_seconds ?? 0,
    current: {
      time: c.time * 1000,
      temp: n(c.temperature_2m),
      feels: n(c.apparent_temperature),
      humidity: n(c.relative_humidity_2m),
      precip: n(c.precipitation),
      code: n(c.weather_code),
      cloud: n(c.cloud_cover),
      pressure: n(c.pressure_msl),
      wind: n(c.wind_speed_10m),
      windDir: n(c.wind_direction_10m),
      gust: n(c.wind_gusts_10m),
      isDay: c.is_day === 1,
    },
    hours: (h.time as number[]).map((t, i) => ({
      time: t * 1000,
      temp: n(h.temperature_2m[i]),
      dew: n(h.dew_point_2m[i]),
      precipProb: nn(h.precipitation_probability[i]),
      precip: n(h.precipitation[i]),
      snow: n(h.snowfall[i]),
      code: n(h.weather_code[i]),
      cloud: n(h.cloud_cover[i]),
      visibility: nn(h.visibility[i]),
      wind: n(h.wind_speed_10m[i]),
      windDir: n(h.wind_direction_10m[i]),
      gust: n(h.wind_gusts_10m[i]),
      pressure: n(h.pressure_msl[i]),
    })),
    days: (d.time as number[]).map((t, i) => ({
      time: t * 1000,
      code: n(d.weather_code[i]),
      tmax: n(d.temperature_2m_max[i]),
      tmin: n(d.temperature_2m_min[i]),
      precip: n(d.precipitation_sum[i]),
      precipProb: nn(d.precipitation_probability_max[i]),
      snow: n(d.snowfall_sum[i]),
      windMax: n(d.wind_speed_10m_max[i]),
      gustMax: n(d.wind_gusts_10m_max[i]),
      windDir: n(d.wind_direction_10m_dominant[i]),
    })),
  };
}

export async function fetchForecast(lat: number, lng: number): Promise<Forecast> {
  const res = await fetch(forecastUrl(lat, lng));
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  return parseForecast(await res.json());
}

export async function searchPlaces(q: string, lang: string): Promise<Place[]> {
  const p = new URLSearchParams({ name: q, count: '8', language: lang, format: 'json' });
  const res = await fetch(`${GEOCODE_URL}?${p}`);
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const j = await res.json();
  return ((j.results ?? []) as any[]).map((r) => ({
    id: `g${r.id}`,
    name: r.name,
    detail: [r.admin2, r.admin1, r.country_code === 'PL' ? '' : r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lng: r.longitude,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** "52.23, 21.01" / "52.23 21.01" / "N52.23 E21.01" → coordinates, or null. */
export function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = s.trim().match(/^[Nn]?\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[°]?\s*[Nn]?\s*[,;\s]\s*[Ee]?\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[°]?\s*[Ee]?$/);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lng = Number(m[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// ---------------------------------------------------------------- derived values

/** Index of the hour slot containing `now` (the last slot that starts at or before it). */
export function hourIndex(hours: Hour[], now: number): number {
  let i = 0;
  while (i + 1 < hours.length && hours[i + 1].time <= now) i++;
  return i;
}

export type Trend = 'risingFast' | 'rising' | 'steady' | 'falling' | 'fallingFast';

/** Barometric tendency over the last 3 hours, in hPa (WMO-style thresholds). */
export function pressureTrend(hours: Hour[], now: number): { change: number; trend: Trend } {
  const i = hourIndex(hours, now);
  const j = Math.max(0, i - 3);
  const change = hours[i].pressure - hours[j].pressure;
  const trend: Trend = change >= 3 ? 'risingFast' : change >= 1 ? 'rising' : change <= -3 ? 'fallingFast' : change <= -1 ? 'falling' : 'steady';
  return { change, trend };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** 16-point compass abbreviation (international letters, used in both languages). */
export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
const WIND_NAMES = {
  pl: ['północny', 'północno-wschodni', 'wschodni', 'południowo-wschodni', 'południowy', 'południowo-zachodni', 'zachodni', 'północno-zachodni'],
  en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
};
/** 8-point direction word ("north-west" / "północno-zachodni"). */
export function directionName(deg: number, lang: 'pl' | 'en'): string {
  return WIND_NAMES[lang][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Beaufort number for a wind speed in km/h. */
export function beaufort(kmh: number): number {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = limits.findIndex((l) => kmh < l);
  return i === -1 ? 12 : i;
}

export type Tip =
  | { kind: 'scent'; to: number }
  | { kind: 'calm' }
  | { kind: 'gusty'; gust: number }
  | { kind: 'pressureFalling'; change: number }
  | { kind: 'pressureRising'; change: number }
  | { kind: 'freshSnow'; cm: number }
  | { kind: 'fog'; at: number }
  | { kind: 'frost'; min: number }
  | { kind: 'rainSoon'; at: number }
  | { kind: 'brightMoon'; fraction: number }
  | { kind: 'darkNight' };

/**
 * Practical conclusions for the next ~12 hours. `moonFraction`/`moonUpTonight` come
 * from astro.ts so this stays a pure function of its inputs.
 */
export function hunterTips(f: Forecast, now: number, moon: { fraction: number; upTonight: boolean }): Tip[] {
  const tips: Tip[] = [];
  const c = f.current;
  const i = hourIndex(f.hours, now);
  const next = f.hours.slice(i, i + 12);
  const past = f.hours.slice(Math.max(0, i - 24), i + 1);

  if (c.wind < 3) tips.push({ kind: 'calm' });
  else tips.push({ kind: 'scent', to: (c.windDir + 180) % 360 });
  const gust = Math.max(c.gust, ...next.slice(0, 6).map((h) => h.gust));
  if (gust >= 40) tips.push({ kind: 'gusty', gust });

  const p = pressureTrend(f.hours, now);
  if (p.trend === 'falling' || p.trend === 'fallingFast') tips.push({ kind: 'pressureFalling', change: p.change });
  else if (p.trend === 'rising' || p.trend === 'risingFast') tips.push({ kind: 'pressureRising', change: p.change });

  const snow = past.reduce((s, h) => s + h.snow, 0);
  if (snow >= 0.5) tips.push({ kind: 'freshSnow', cm: snow });

  const fog = next.find((h) => (h.visibility != null && h.visibility < 1000) || h.code === 45 || h.code === 48);
  if (fog) tips.push({ kind: 'fog', at: fog.time });

  const rain = next.slice(1).find((h) => (h.precipProb ?? 0) >= 60 && h.precip >= 0.3);
  if (rain && c.precip < 0.1) tips.push({ kind: 'rainSoon', at: rain.time });

  const min = Math.min(...next.map((h) => h.temp));
  if (min <= 0) tips.push({ kind: 'frost', min });

  if (moon.upTonight && moon.fraction >= 0.6) tips.push({ kind: 'brightMoon', fraction: moon.fraction });
  else if (moon.fraction < 0.2 || !moon.upTonight) tips.push({ kind: 'darkNight' });

  return tips;
}

// ---------------------------------------------------------------- WMO weather codes

type Desc = { pl: string; en: string; icon: IconName; night?: IconName };
const WMO: Record<number, Desc> = {
  0: { pl: 'Bezchmurnie', en: 'Clear sky', icon: 'sun', night: 'moon' },
  1: { pl: 'Przeważnie pogodnie', en: 'Mainly clear', icon: 'sunCloud', night: 'moon' },
  2: { pl: 'Częściowe zachmurzenie', en: 'Partly cloudy', icon: 'sunCloud', night: 'moonCloud' },
  3: { pl: 'Pochmurno', en: 'Overcast', icon: 'cloud' },
  45: { pl: 'Mgła', en: 'Fog', icon: 'fog' },
  48: { pl: 'Mgła osadzająca szadź', en: 'Freezing fog', icon: 'fog' },
  51: { pl: 'Lekka mżawka', en: 'Light drizzle', icon: 'drizzle' },
  53: { pl: 'Mżawka', en: 'Drizzle', icon: 'drizzle' },
  55: { pl: 'Gęsta mżawka', en: 'Dense drizzle', icon: 'rain' },
  56: { pl: 'Marznąca mżawka', en: 'Freezing drizzle', icon: 'rain' },
  57: { pl: 'Gęsta marznąca mżawka', en: 'Dense freezing drizzle', icon: 'rain' },
  61: { pl: 'Słaby deszcz', en: 'Light rain', icon: 'drizzle' },
  63: { pl: 'Deszcz', en: 'Rain', icon: 'rain' },
  65: { pl: 'Ulewa', en: 'Heavy rain', icon: 'rain' },
  66: { pl: 'Marznący deszcz', en: 'Freezing rain', icon: 'rain' },
  67: { pl: 'Silny marznący deszcz', en: 'Heavy freezing rain', icon: 'rain' },
  71: { pl: 'Słaby śnieg', en: 'Light snow', icon: 'snow' },
  73: { pl: 'Śnieg', en: 'Snow', icon: 'snow' },
  75: { pl: 'Intensywny śnieg', en: 'Heavy snow', icon: 'snowHeavy' },
  77: { pl: 'Śnieg ziarnisty', en: 'Snow grains', icon: 'snow' },
  80: { pl: 'Przelotny deszcz', en: 'Rain showers', icon: 'drizzle' },
  81: { pl: 'Przelotne opady deszczu', en: 'Moderate showers', icon: 'rain' },
  82: { pl: 'Gwałtowne ulewy', en: 'Violent showers', icon: 'storm' },
  85: { pl: 'Przelotny śnieg', en: 'Snow showers', icon: 'snow' },
  86: { pl: 'Intensywne opady śniegu', en: 'Heavy snow showers', icon: 'snowHeavy' },
  95: { pl: 'Burza', en: 'Thunderstorm', icon: 'storm' },
  96: { pl: 'Burza z gradem', en: 'Thunderstorm with hail', icon: 'storm' },
  99: { pl: 'Silna burza z gradem', en: 'Severe thunderstorm with hail', icon: 'storm' },
};
export function weatherDesc(code: number, lang: 'pl' | 'en', night = false): { text: string; icon: IconName } {
  const d: Desc = WMO[code] ?? { pl: '—', en: '—', icon: 'cloud' };
  return { text: d[lang], icon: night && d.night ? d.night : d.icon };
}
