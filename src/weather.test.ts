import { describe, it, expect } from 'vitest';
import { parseForecast, parseCoords, pressureTrend, compass, directionName, beaufort, hunterTips, hourIndex, forecastUrl } from './weather';

const T0 = Date.parse('2026-11-04T00:00:00Z') / 1000;

/** Minimal Open-Meteo-shaped response: 48 hourly slots from T0, pressure set per hour. */
function fixture(over: { pressure?: (i: number) => number; wind?: number; windDir?: number; snow?: number; visibility?: number; temp?: number } = {}) {
  const N = 48;
  const arr = <T>(f: (i: number) => T) => Array.from({ length: N }, (_, i) => f(i));
  return {
    timezone: 'Europe/Warsaw',
    utc_offset_seconds: 3600,
    current: {
      time: T0 + 24 * 3600,
      temperature_2m: over.temp ?? 5,
      relative_humidity_2m: 80,
      apparent_temperature: 2,
      precipitation: 0,
      weather_code: 3,
      cloud_cover: 90,
      pressure_msl: 1010,
      wind_speed_10m: over.wind ?? 12,
      wind_direction_10m: over.windDir ?? 270,
      wind_gusts_10m: 20,
      is_day: 1,
    },
    hourly: {
      time: arr((i) => T0 + i * 3600),
      temperature_2m: arr(() => over.temp ?? 5),
      dew_point_2m: arr(() => 2),
      precipitation_probability: arr(() => 10),
      precipitation: arr(() => 0),
      snowfall: arr((i) => (i === 20 ? (over.snow ?? 0) : 0)),
      weather_code: arr(() => 3),
      cloud_cover: arr(() => 90),
      visibility: arr(() => over.visibility ?? 20000),
      wind_speed_10m: arr(() => over.wind ?? 12),
      wind_direction_10m: arr(() => over.windDir ?? 270),
      wind_gusts_10m: arr(() => 20),
      pressure_msl: arr(over.pressure ?? (() => 1010)),
    },
    daily: {
      time: [T0, T0 + 86400],
      weather_code: [3, 3],
      temperature_2m_max: [6, 7],
      temperature_2m_min: [1, 2],
      precipitation_sum: [0, 0],
      precipitation_probability_max: [10, null],
      snowfall_sum: [0, 0],
      wind_speed_10m_max: [15, 15],
      wind_gusts_10m_max: [25, 25],
      wind_direction_10m_dominant: [270, 270],
    },
  };
}
const NOW = (T0 + 24 * 3600 + 600) * 1000; // 10 minutes past slot 24
const moonDark = { fraction: 0.05, upTonight: false };

describe('parseForecast', () => {
  it('converts unix seconds to ms and keeps nulls', () => {
    const f = parseForecast(fixture());
    expect(f.current.time).toBe((T0 + 86400) * 1000);
    expect(f.hours).toHaveLength(48);
    expect(f.days[1].precipProb).toBeNull();
    expect(f.timezone).toBe('Europe/Warsaw');
  });
  it('builds a request with the needed fields', () => {
    const u = new URL(forecastUrl(52.1, 21));
    expect(u.searchParams.get('timeformat')).toBe('unixtime');
    expect(u.searchParams.get('hourly')).toContain('pressure_msl');
  });
});

describe('derived values', () => {
  it('finds the current hour slot', () => {
    expect(hourIndex(parseForecast(fixture()).hours, NOW)).toBe(24);
  });
  it('classifies the 3-hour pressure tendency', () => {
    const falling = parseForecast(fixture({ pressure: (i) => 1020 - i }));
    expect(pressureTrend(falling.hours, NOW)).toEqual({ change: -3, trend: 'fallingFast' });
    const rising = parseForecast(fixture({ pressure: (i) => 1000 + i * 0.5 }));
    expect(pressureTrend(rising.hours, NOW).trend).toBe('rising');
    expect(pressureTrend(parseForecast(fixture()).hours, NOW).trend).toBe('steady');
  });
  it('names directions', () => {
    expect(compass(0)).toBe('N');
    expect(compass(350)).toBe('N');
    expect(compass(225)).toBe('SW');
    expect(directionName(315, 'pl')).toBe('północno-zachodni');
    expect(directionName(90, 'en')).toBe('east');
  });
  it('converts to Beaufort', () => {
    expect(beaufort(0)).toBe(0);
    expect(beaufort(15)).toBe(3);
    expect(beaufort(130)).toBe(12);
  });
  it('parses coordinates in common formats', () => {
    expect(parseCoords('52.2297, 21.0122')).toEqual({ lat: 52.2297, lng: 21.0122 });
    expect(parseCoords('52,2297 21,0122')).toEqual({ lat: 52.2297, lng: 21.0122 });
    expect(parseCoords('N52.5 E19.25')).toEqual({ lat: 52.5, lng: 19.25 });
    expect(parseCoords('52.5°N, 19.25°E')).toEqual({ lat: 52.5, lng: 19.25 });
    expect(parseCoords('Białowieża')).toBeNull();
    expect(parseCoords('95, 20')).toBeNull();
  });
});

describe('hunterTips', () => {
  const kinds = (o: Parameters<typeof fixture>[0], moon = moonDark) => hunterTips(parseForecast(fixture(o)), NOW, moon).map((t) => t.kind);
  it('says where the scent goes (opposite the wind source)', () => {
    const tips = hunterTips(parseForecast(fixture({ windDir: 270 })), NOW, moonDark);
    expect(tips[0]).toEqual({ kind: 'scent', to: 90 });
  });
  it('flags calm, falling pressure, fresh snow, fog and frost', () => {
    expect(kinds({ wind: 1 })).toContain('calm');
    expect(kinds({ pressure: (i) => 1020 - i })).toContain('pressureFalling');
    expect(kinds({ snow: 2 })).toContain('freshSnow');
    expect(kinds({ visibility: 400 })).toContain('fog');
    expect(kinds({ temp: -3 })).toContain('frost');
    expect(kinds({})).not.toContain('frost');
  });
  it('distinguishes bright and dark nights', () => {
    expect(kinds({}, { fraction: 0.9, upTonight: true })).toContain('brightMoon');
    expect(kinds({}, moonDark)).toContain('darkNight');
  });
});
