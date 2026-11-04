// Sun and moon calculations (sunrise/sunset, twilight, moon phase and moonrise).
// Standard low-precision formulas from Astronomical Algorithms (as popularised by
// SunCalc); accurate to about a minute for sun times and a few minutes for the moon,
// which is plenty for planning a hunt.

const PI = Math.PI;
const rad = PI / 180;
const DAY_MS = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = rad * 23.4397;

const toJulian = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date: Date) => toJulian(date) - J2000;

const rightAscension = (l: number, b: number) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l: number, b: number) =>
  Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const altitude = (H: number, phi: number, dec: number) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw;
function refraction(h: number) {
  if (h < 0) h = 0;
  return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M: number) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  return M + C + rad * 102.9372 + PI;
}
function sunCoords(d: number) {
  const L = eclipticLongitude(solarMeanAnomaly(d));
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

const J0 = 0.0009;
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * PI));
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h: number, phi: number, d: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

export interface SunTimes {
  /** Astronomical dawn/dusk: sun 18° below the horizon. */
  astroDawn: Date | null;
  /** Nautical dawn/dusk: sun 12° below the horizon. */
  nauticalDawn: Date | null;
  /** Civil dawn/dusk: sun 6° below the horizon – the usual limit of natural light. */
  civilDawn: Date | null;
  sunrise: Date | null;
  noon: Date;
  sunset: Date | null;
  civilDusk: Date | null;
  nauticalDusk: Date | null;
  astroDusk: Date | null;
}

/** Sun times for the day containing `date` at the given place (pass a time near local noon). */
export function sunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);
  const pair = (angle: number): [Date | null, Date | null] => {
    const w = hourAngle(angle * rad, phi, dec);
    if (!isFinite(w)) return [null, null]; // polar day/night: the sun never crosses this angle
    const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
    return [fromJulian(Jnoon - (Jset - Jnoon)), fromJulian(Jset)];
  };
  const [sunrise, sunset] = pair(-0.833);
  const [civilDawn, civilDusk] = pair(-6);
  const [nauticalDawn, nauticalDusk] = pair(-12);
  const [astroDawn, astroDusk] = pair(-18);
  return { astroDawn, nauticalDawn, civilDawn, sunrise, noon: fromJulian(Jnoon), sunset, civilDusk, nauticalDusk, astroDusk };
}

/** Sun altitude in degrees. */
export function sunAltitude(date: Date, lat: number, lng: number): number {
  const lw = rad * -lng;
  const d = toDays(date);
  const c = sunCoords(d);
  return altitude(siderealTime(d, lw) - c.ra, rad * lat, c.dec) / rad;
}

// ---------------------------------------------------------------- moon

function moonCoords(d: number) {
  const L = rad * (218.316 + 13.176396 * d);
  const M = rad * (134.963 + 13.064993 * d);
  const F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M);
  const b = rad * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

/** Moon altitude in radians, corrected for refraction. */
function moonAltitude(date: Date, lat: number, lng: number) {
  const lw = rad * -lng;
  const d = toDays(date);
  const c = moonCoords(d);
  const h = altitude(siderealTime(d, lw) - c.ra, rad * lat, c.dec);
  return h + refraction(h);
}

export interface MoonIllumination {
  /** Lit fraction of the disc, 0–1. */
  fraction: number;
  /** Phase in the synodic cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
}

export function moonIllumination(date: Date): MoonIllumination {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI };
}

export interface MoonTimes {
  rise: Date | null;
  set: Date | null;
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/** Moonrise and moonset in the 24 hours starting at `start` (pass local midnight). */
export function moonTimes(start: Date, lat: number, lng: number): MoonTimes {
  const t0 = start.valueOf();
  const at = (h: number) => moonAltitude(new Date(t0 + h * 36e5), lat, lng) - 0.133 * rad;
  let h0 = at(0);
  let rise: number | null = null;
  let set: number | null = null;
  let ye = 0;
  for (let i = 1; i <= 24; i += 2) {
    const h1 = at(i);
    const h2 = at(i + 1);
    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = -b / (2 * a);
    ye = (a * xe + b) * xe + h1;
    const disc = b * b - 4 * a * h1;
    let roots = 0;
    let x1 = 0;
    let x2 = 0;
    if (disc >= 0) {
      const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
      x1 = xe - dx;
      x2 = xe + dx;
      if (Math.abs(x1) <= 1) roots++;
      if (Math.abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
    }
    if (roots === 1) {
      if (h0 < 0) rise = i + x1;
      else set = i + x1;
    } else if (roots === 2) {
      rise = i + (ye < 0 ? x2 : x1);
      set = i + (ye < 0 ? x1 : x2);
    }
    if (rise != null && set != null) break;
    h0 = h2;
  }
  const toDate = (h: number | null) => (h == null ? null : new Date(t0 + h * 36e5));
  return {
    rise: toDate(rise),
    set: toDate(set),
    alwaysUp: rise == null && set == null && ye > 0,
    alwaysDown: rise == null && set == null && ye <= 0,
  };
}

export type MoonPhaseName = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent';

/** One of eight named phases; the four principal phases get a ±1.8-day window. */
export function moonPhaseName(phase: number): MoonPhaseName {
  const p = ((phase % 1) + 1) % 1;
  const w = 0.061; // ≈1.8 days of the 29.5-day cycle
  if (p < w || p > 1 - w) return 'new';
  if (Math.abs(p - 0.25) < w) return 'firstQuarter';
  if (Math.abs(p - 0.5) < w) return 'full';
  if (Math.abs(p - 0.75) < w) return 'lastQuarter';
  if (p < 0.25) return 'waxingCrescent';
  if (p < 0.5) return 'waxingGibbous';
  if (p < 0.75) return 'waningGibbous';
  return 'waningCrescent';
}

/** Next moment after `from` when the moon reaches the given phase (0 = new, 0.5 = full). */
export function nextMoonPhase(from: Date, target: 0 | 0.5): Date {
  const rel = (t: number) => (((moonIllumination(new Date(t)).phase - target) % 1) + 1.5) % 1 - 0.5; // −0.5…0.5, 0 at target
  let t = from.valueOf();
  let prev = rel(t);
  // Step in 6-hour increments until the relative phase crosses zero upwards, then bisect.
  for (let i = 0; i < 4 * 31; i++) {
    const next = t + 6 * 36e5;
    const r = rel(next);
    if (prev < 0 && r >= 0) {
      let lo = t;
      let hi = next;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (rel(mid) < 0) lo = mid;
        else hi = mid;
      }
      return new Date(hi);
    }
    t = next;
    prev = r;
  }
  return new Date(t);
}

/** Moon altitude in degrees (refraction-corrected). */
export const moonAltitudeDeg = (date: Date, lat: number, lng: number) => moonAltitude(date, lat, lng) / rad;
