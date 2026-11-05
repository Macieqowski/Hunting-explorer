// Wind on the map: forecast for a grid of points (Open-Meteo, the same keyless source as
// the Weather tab), the scent cone and which edges of a drive are downwind. No DOM or
// Leaflet here; see windLayer.ts for drawing.

import { FORECAST_URL } from './weather';
import { offsetPoint, bearing } from './hunt';

export interface WindHour {
  time: number; // unix ms, start of the hour
  wind: number; // km/h at 10 m
  dir: number; // degrees the wind blows FROM
  gust: number; // km/h
}

export interface WindPoint {
  lat: number;
  lng: number;
  hours: WindHour[];
}

/** Below this the wind is "calm": scent spreads all round instead of in one direction. */
export const CALM_KMH = 3;
/** How far the scent cone reaches, in metres. */
export const SCENT_M = 400;

export const normDeg = (d: number) => ((d % 360) + 360) % 360;
/** Smallest angle between two bearings, 0–180. */
export const angleDiff = (a: number, b: number) => {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return d > 180 ? 360 - d : d;
};
/** Where the wind (and the scent) goes, given where it comes from. */
export const windTo = (from: number) => normDeg(from + 180);

// ---------------------------------------------------------------- forecast

export function windUrl(points: { lat: number; lng: number }[]): string {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat.toFixed(3)).join(','),
    longitude: points.map((x) => x.lng.toFixed(3)).join(','),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '1',
    forecast_days: '7',
  });
  return `${FORECAST_URL}?${p}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** One point answers with an object, several with an array, in request order. */
export function parseWind(j: any, points: { lat: number; lng: number }[]): WindPoint[] {
  const list: any[] = Array.isArray(j) ? j : [j];
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return list.map((o, k) => {
    const h = o?.hourly ?? {};
    const times: unknown[] = Array.isArray(h.time) ? h.time : [];
    const hours: WindHour[] = [];
    times.forEach((t, i) => {
      const wind = n(h.wind_speed_10m?.[i]);
      const dir = n(h.wind_direction_10m?.[i]);
      if (typeof t !== 'number' || wind == null || dir == null) return;
      hours.push({ time: t * 1000, wind, dir, gust: n(h.wind_gusts_10m?.[i]) ?? wind });
    });
    return { lat: points[k]?.lat ?? o.latitude, lng: points[k]?.lng ?? o.longitude, hours };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchWind(points: { lat: number; lng: number }[]): Promise<WindPoint[]> {
  const res = await fetch(windUrl(points));
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  return parseWind(await res.json(), points);
}

/** The forecast hour that contains `t` (clamped to the forecast), or null with no data. */
export function windAt(hours: WindHour[], t: number): WindHour | null {
  if (!hours.length) return null;
  let i = 0;
  while (i + 1 < hours.length && hours[i + 1].time <= t) i++;
  return hours[i];
}

/** Round to a cell of `step` degrees, so small pans reuse the same forecast. */
export function cellKey(lat: number, lng: number, step = 0.05): string {
  const r = (v: number) => (Math.round(v / step) * step).toFixed(3);
  return `${r(lat)},${r(lng)}`;
}

/** Centres of an n×n grid over the box, for the arrows layer. */
export function gridPoints(b: { south: number; west: number; north: number; east: number }, n = 5): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  const dLat = (b.north - b.south) / n;
  const dLng = (b.east - b.west) / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) out.push({ lat: +(b.south + dLat * (i + 0.5)).toFixed(3), lng: +(b.west + dLng * (j + 0.5)).toFixed(3) });
  return out;
}

/** Colour for a wind speed: calm grey, then green, yellow, orange, red by Beaufort-ish steps. */
export function speedColor(kmh: number): string {
  if (kmh < CALM_KMH) return '#9ca3af';
  if (kmh < 12) return '#16a34a';
  if (kmh < 20) return '#65a30d';
  if (kmh < 29) return '#ca8a04';
  if (kmh < 39) return '#ea580c';
  return '#dc2626';
}

// ---------------------------------------------------------------- scent cone

/**
 * Half-angle of the scent cone: about 20° in a steady wind, wider when gusts are much
 * stronger than the mean wind (the wind swings), at most 45°.
 */
export function coneHalfAngle(wind: number, gust: number): number {
  const spread = Math.max(0, gust - wind);
  return Math.min(45, 20 + spread);
}

/**
 * Where scent from `o` drifts: a wedge downwind, or a circle of half the reach when
 * it is calm. Returned as polygon corners.
 */
export function scentCone(o: { lat: number; lng: number }, w: Pick<WindHour, 'wind' | 'dir' | 'gust'>, reach = SCENT_M): { lat: number; lng: number }[] {
  if (w.wind < CALM_KMH) {
    const pts: { lat: number; lng: number }[] = [];
    for (let a = 0; a < 360; a += 15) pts.push(offsetPoint(o, a, reach / 2));
    return pts;
  }
  const to = windTo(w.dir);
  const half = coneHalfAngle(w.wind, w.gust);
  const pts = [o];
  const steps = 8;
  for (let i = 0; i <= steps; i++) pts.push(offsetPoint(o, to - half + (2 * half * i) / steps, reach));
  return pts;
}

// ---------------------------------------------------------------- drive edges

export type EdgeSide = 'downwind' | 'upwind' | 'side';

export interface Edge {
  a: [number, number];
  b: [number, number];
  /** Bearing pointing out of the drive, square to the edge. */
  out: number;
  side: EdgeSide;
}

/** Edges within this angle of straight downwind / upwind count as that side. */
export const EDGE_DEG = 60;

/**
 * Classify each edge of a drive by the wind. On the downwind edge the wind blows from
 * the drive to the line of stands, so game driven out does not smell the hunters; on
 * the upwind edge the hunters' scent blows into the drive.
 */
export function driveEdges(area: [number, number][], from: number): Edge[] {
  if (area.length < 3) return [];
  // Shoelace on a local east/north plane: positive = counter-clockwise.
  const lat0 = area[0][0];
  const k = Math.cos((lat0 * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < area.length; i++) {
    const [y1, x1] = area[i];
    const [y2, x2] = area[(i + 1) % area.length];
    s += x1 * k * y2 - x2 * k * y1;
  }
  const ccw = s > 0;
  const to = windTo(from);
  return area.map((a, i) => {
    const b = area[(i + 1) % area.length];
    const along = bearing({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    // Walking counter-clockwise the inside is on the left, so outside is on the right (+90°).
    const out = normDeg(along + (ccw ? 90 : -90));
    const side: EdgeSide = angleDiff(out, to) <= EDGE_DEG ? 'downwind' : angleDiff(out, from) <= EDGE_DEG ? 'upwind' : 'side';
    return { a, b, out, side };
  });
}
