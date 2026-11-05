// Exterior ballistics for the Balistyka section: a small point-mass solver using the
// standard G1/G7 drag functions, plus the Polish legal energy floors per species.
// Everything is in SI units (m, m/s, kg, J); drop and drift are returned in cm.

/** Standard drag coefficient tables (Mach, Cd) of the G1 and G7 reference projectiles (BRL data). */
const TABLES = {
  G1: [0,0.2629,0.05,0.2558,0.1,0.2487,0.15,0.2413,0.2,0.2344,0.25,0.2278,0.3,0.2214,0.35,0.2155,0.4,0.2104,0.45,0.2061,0.5,0.2032,0.55,0.202,0.6,0.2034,0.7,0.2165,0.725,0.223,0.75,0.2313,0.775,0.2417,0.8,0.2546,0.825,0.2706,0.85,0.2901,0.875,0.3136,0.9,0.3415,0.925,0.3734,0.95,0.4084,0.975,0.4448,1,0.4805,1.025,0.5136,1.05,0.5427,1.075,0.5677,1.1,0.5883,1.125,0.6053,1.15,0.6191,1.2,0.6393,1.25,0.6518,1.3,0.6589,1.35,0.6621,1.4,0.6625,1.45,0.6607,1.5,0.6573,1.55,0.6528,1.6,0.6474,1.65,0.6413,1.7,0.6347,1.75,0.628,1.8,0.621,1.85,0.6141,1.9,0.6072,1.95,0.6003,2,0.5934,2.05,0.5867,2.1,0.5804,2.15,0.5743,2.2,0.5685,2.25,0.563,2.3,0.5577,2.35,0.5527,2.4,0.5481,2.45,0.5438,2.5,0.5397,2.6,0.5325,2.7,0.5264,2.8,0.5211,2.9,0.5168,3,0.5133,3.1,0.5105,3.2,0.5084,3.3,0.5067,3.4,0.5054,3.5,0.504,3.6,0.503,3.7,0.5022,3.8,0.5016,3.9,0.501,4,0.5006,4.2,0.4998,4.4,0.4995,4.6,0.4992,4.8,0.499,5,0.4988],
  G7: [0,0.1198,0.05,0.1197,0.1,0.1196,0.15,0.1194,0.2,0.1193,0.25,0.1194,0.3,0.1194,0.35,0.1194,0.4,0.1193,0.45,0.1193,0.5,0.1194,0.55,0.1193,0.6,0.1194,0.65,0.1197,0.7,0.1202,0.725,0.1207,0.75,0.1215,0.775,0.1226,0.8,0.1242,0.825,0.1266,0.85,0.1306,0.875,0.1368,0.9,0.1464,0.925,0.166,0.95,0.2054,0.975,0.2993,1,0.3803,1.025,0.4015,1.05,0.4043,1.075,0.4034,1.1,0.4014,1.125,0.3987,1.15,0.3955,1.2,0.3884,1.25,0.381,1.3,0.3732,1.35,0.3657,1.4,0.358,1.5,0.344,1.55,0.3376,1.6,0.3315,1.65,0.326,1.7,0.3209,1.75,0.316,1.8,0.3117,1.85,0.3078,1.9,0.3042,1.95,0.301,2,0.298,2.05,0.2951,2.1,0.2922,2.15,0.2892,2.2,0.2864,2.25,0.2835,2.3,0.2807,2.35,0.2779,2.4,0.2752,2.45,0.2725,2.5,0.2697,2.55,0.267,2.6,0.2643,2.65,0.2615,2.7,0.2588,2.75,0.2561,2.8,0.2533,2.85,0.2506,2.9,0.2479,2.95,0.2451,3,0.2424,3.1,0.2368,3.2,0.2313,3.3,0.2258,3.4,0.2205,3.5,0.2154,3.6,0.2106,3.7,0.206,3.8,0.2017,3.9,0.1975,4,0.1935,4.2,0.1861,4.4,0.1793,4.6,0.173,4.8,0.1672,5,0.1618],
} as const;

export type DragModel = keyof typeof TABLES;

function cd(model: DragModel, mach: number): number {
  const t = TABLES[model];
  const n = t.length / 2;
  if (mach <= t[0]) return t[1];
  if (mach >= t[(n - 1) * 2]) return t[(n - 1) * 2 + 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid * 2] > mach) hi = mid;
    else lo = mid;
  }
  const m0 = t[lo * 2];
  const m1 = t[hi * 2];
  return t[lo * 2 + 1] + ((t[hi * 2 + 1] - t[lo * 2 + 1]) * (mach - m0)) / (m1 - m0);
}

const G = 9.80665;
/** 1 lb/in² in kg/m² — published ballistic coefficients are in lb/in². */
const LB_IN2 = 703.0696;
/** Milliradians in one minute of angle. */
export const MRAD_PER_MOA = (Math.PI / 180 / 60) * 1000;

export interface Shot {
  /** Muzzle velocity, m/s. */
  v0: number;
  /** Bullet mass, g. */
  mass: number;
  /** Ballistic coefficient, lb/in², for `model`. */
  bc: number;
  model: DragModel;
  /** Distance at which the line of sight crosses the trajectory, m. */
  zero: number;
  /** Height of the sight's optical axis above the bore axis, cm. */
  sightHeight: number;
  /** Air temperature, °C. */
  temp?: number;
  /** Air pressure at the shooting place (station pressure), hPa. */
  pressure?: number;
  /** Full-value crosswind, m/s. */
  wind?: number;
}

export interface Point {
  /** Distance, m. */
  x: number;
  /** Velocity, m/s. */
  v: number;
  /** Kinetic energy, J. */
  e: number;
  /** Bullet path relative to the line of sight, cm (negative = below). */
  drop: number;
  /** Crosswind drift, cm. */
  drift: number;
  /** Time of flight, s. */
  t: number;
}

export const energy = (massG: number, v: number) => 0.5 * (massG / 1000) * v * v;

/** Air density (dry air) from temperature in °C and pressure in hPa. */
export const airDensity = (temp = 15, pressure = 1013.25) => (pressure * 100) / (287.058 * (temp + 273.15));

/** Integrates a flight at bore angle `angle` (rad), sampling at each distance in `at` (ascending, m). */
function fly(s: Shot, angle: number, at: number[]): Point[] {
  const rho = airDensity(s.temp, s.pressure);
  const sound = 331.3 * Math.sqrt(1 + (s.temp ?? 15) / 273.15);
  const k = (rho * Math.PI) / (8 * s.bc * LB_IN2);
  const h = s.sightHeight / 100;
  const wind = s.wind ?? 0;
  const accel = (vx: number, vy: number): [number, number] => {
    const v = Math.hypot(vx, vy);
    const a = k * cd(s.model, v / sound) * v;
    return [-a * vx, -a * vy - G];
  };
  let x = 0;
  let y = 0;
  let vx = s.v0 * Math.cos(angle);
  let vy = s.v0 * Math.sin(angle);
  let t = 0;
  const vx0 = vx;
  const out: Point[] = [];
  const sample = (px: number, py: number, pvx: number, pvy: number, pt: number) => {
    const v = Math.hypot(pvx, pvy);
    out.push({ x: px, v, e: energy(s.mass, v), drop: (py - h) * 100, drift: wind * (pt - px / vx0) * 100, t: pt });
  };
  let i = 0;
  while (i < at.length && at[i] <= 0) sample(at[i++], 0, vx, vy, 0);
  const dt = 0.0002;
  while (i < at.length && t < 10) {
    // Midpoint (RK2) step.
    const [ax1, ay1] = accel(vx, vy);
    const mvx = vx + ax1 * dt * 0.5;
    const mvy = vy + ay1 * dt * 0.5;
    const [ax2, ay2] = accel(mvx, mvy);
    const nx = x + mvx * dt;
    const ny = y + mvy * dt;
    const nvx = vx + ax2 * dt;
    const nvy = vy + ay2 * dt;
    while (i < at.length && at[i] <= nx) {
      const f = (at[i] - x) / (nx - x);
      sample(at[i], y + (ny - y) * f, vx + (nvx - vx) * f, vy + (nvy - vy) * f, t + dt * f);
      i++;
    }
    x = nx;
    y = ny;
    vx = nvx;
    vy = nvy;
    t += dt;
    if (vx <= 0) break;
  }
  return out;
}

/** Bore angle (rad) that puts the bullet on the line of sight at the zero distance. */
export function zeroAngle(s: Shot): number {
  let angle = 0;
  for (let n = 0; n < 8; n++) {
    const [p] = fly(s, angle, [s.zero]);
    if (!p) break;
    const err = -p.drop / 100;
    angle += Math.atan2(err, s.zero);
    if (Math.abs(err) < 1e-5) break;
  }
  return angle;
}

/** Trajectory sampled at the given distances (m), with the rifle zeroed at `s.zero`. */
export function trajectory(s: Shot, at: number[]): Point[] {
  return fly(s, zeroAngle(s), at);
}

export const range = (to: number, step: number) => Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => i * step);

/** Angle to hold or dial, in mrad, to correct a path offset at distance x (positive = dial up). */
export const correctionMrad = (p: Point) => (p.x > 0 ? (-p.drop / 100 / p.x) * 1000 : 0);

/** Longest distance (m, to the nearest step) at which energy is still at least `floor` J; 0 if not even at the muzzle. */
export function reachWithEnergy(points: Point[], floor: number): number {
  let best = 0;
  for (const p of points) {
    if (p.e >= floor) best = p.x;
    else break;
  }
  return best;
}

// ---------------------------------------------------------------- legal floors

/**
 * Minimum bullet energy 100 m from the muzzle, § 3 ust. 2–3 of the regulation on detailed
 * hunting conditions (Rozporządzenie Ministra Środowiska z 23 marca 2005 r.), as amended by
 * Dz.U. 2022 poz. 2323. Full metal jacket bullets are not allowed for big game.
 */
export interface Floor {
  id: string;
  name: { pl: string; en: string };
  e100: number;
  bigGame: boolean;
}

export const FLOORS: Floor[] = [
  { id: 'moose', name: { pl: 'Łoś', en: 'Moose' }, e100: 2500, bigGame: true },
  { id: 'deer', name: { pl: 'Jeleń, daniel, muflon, dzik', en: 'Red deer, fallow deer, mouflon, wild boar' }, e100: 2000, bigGame: true },
  { id: 'roe', name: { pl: 'Sarna, warchlak', en: 'Roe deer, young wild boar' }, e100: 1000, bigGame: true },
  { id: 'small', name: { pl: 'Lis i inna zwierzyna drobna', en: 'Fox and other small game' }, e100: 400, bigGame: false },
];

export const LEGAL_SOURCE = 'https://api.sejm.gov.pl/eli/acts/DU/2022/2323/text.html';

/** Margin above the floor below which a load is shown as borderline (barrel length and lot variation). */
export const BORDERLINE = 0.1;

export type Verdict = 'ok' | 'borderline' | 'below';

export function verdict(e100: number, floor: Floor): Verdict {
  if (e100 < floor.e100) return 'below';
  if (e100 < floor.e100 * (1 + BORDERLINE)) return 'borderline';
  return 'ok';
}

/**
 * Zero distance that puts the bullet \`height\` cm above the line of sight at \`at\` m —
 * e.g. the common "GEE" sight-in, 4 cm high at 100 m. Returns null when no zero within
 * 0–600 m can reach that height.
 */
export function zeroForHeight(s: Omit<Shot, 'zero'>, at = 100, height = 4): number | null {
  const pathAt = (zero: number) => trajectory({ ...s, zero }, [at])[0]?.drop ?? -Infinity;
  let lo = at;
  let hi = 600;
  if (pathAt(hi) < height) return null;
  if (pathAt(lo) > height) return null;
  for (let n = 0; n < 30; n++) {
    const mid = (lo + hi) / 2;
    if (pathAt(mid) < height) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
