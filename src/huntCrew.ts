// Group hunt crew planning: beater routes and route guidance, meeting points, hunters'
// stands per drive, leader messages, phone numbers and carcass transport. Pure logic
// shared by the UI and the Firebase adapter; no DOM, no Firebase.

import { bearing, distanceM, decodeArea, encodeArea, type Drive, type Role } from './hunt';
import { gameByKey, type Shot, type ShotSpot } from './pokot';

export interface Pt {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------- points and routes

export const CREW_LIMITS = { routePoints: 30, seat: 20, message: 200, transportName: 40 } as const;

/** One point as "lat,lng" (6 decimals), the form the rules check. */
export const encodePt = (p: Pt) => encodeArea([[p.lat, p.lng]]);
export function decodePt(s: unknown): Pt | null {
  const [p] = decodeArea(s);
  return p ? { lat: p[0], lng: p[1] } : null;
}

/** A beater's route: first point = start, last = end, the ones between are waypoints. */
export type Route = Pt[];
export const encodeRoute = (r: Route) => encodeArea(r.slice(0, CREW_LIMITS.routePoints).map((p) => [p.lat, p.lng]));
export const decodeRoute = (s: unknown): Route => decodeArea(s).map(([lat, lng]) => ({ lat, lng }));

/** Routes of one drive by participant uid. Routes with fewer than 2 points are dropped. */
export function parseRoutes(v: unknown): Map<string, Route> {
  const out = new Map<string, Route>();
  if (!v || typeof v !== 'object') return out;
  for (const [uid, raw] of Object.entries(v as Record<string, unknown>)) {
    const r = decodeRoute(raw);
    if (r.length >= 2) out.set(uid, r);
  }
  return out;
}

/** All drives' routes: driveId → uid → route. */
export function parseAllRoutes(v: unknown): Map<string, Map<string, Route>> {
  const out = new Map<string, Map<string, Route>>();
  if (!v || typeof v !== 'object') return out;
  for (const [d, raw] of Object.entries(v as Record<string, unknown>)) {
    const m = parseRoutes(raw);
    if (m.size) out.set(d, m);
  }
  return out;
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

/**
 * Spread `n` beaters evenly along a start line (a1–a2) and an end line (b1–b2): each gets a
 * straight route from its slot on the start line to the matching slot on the end line. If the
 * end line was drawn the other way round, it is flipped so the routes do not cross.
 */
export function spreadRoutes(a1: Pt, a2: Pt, b1: Pt, b2: Pt, n: number): Route[] {
  if (n <= 0) return [];
  const crossed = distanceM(a1, b1) + distanceM(a2, b2) > distanceM(a1, b2) + distanceM(a2, b1);
  const [e1, e2] = crossed ? [b2, b1] : [b1, b2];
  const round = (p: Pt): Pt => ({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return [round(lerp(a1, a2, t)), round(lerp(e1, e2, t))];
  });
}

export const routeLength = (r: Route) => r.slice(1).reduce((s, p, i) => s + distanceM(r[i], p), 0);

// ---------------------------------------------------------------- route guidance

/** Off the route by more than this: warn (GPS in a forest is 5–20 m off, so not less). */
export const OFF_ROUTE_M = 50;
/** Within this of the end of the route, i.e. close to the hunters' line: safety warning. */
export const NEAR_END_M = 100;
/** Within this of the end: arrived. */
export const ARRIVED_M = 30;
/** Further than this from the start before the drive: lead to the start first. */
const AT_START_M = 40;

export type GuideState = 'toStart' | 'onRoute' | 'off' | 'nearEnd' | 'arrived';

export interface Guidance {
  state: GuideState;
  /** Where the arrow points. */
  target: Pt;
  /** Straight-line distance and bearing (true north) to the target. */
  distM: number;
  bearing: number;
  /** Distance to the route line, and which side of it I am on (looking along the route). */
  offM: number;
  side: 'left' | 'right' | null;
  /** Distance left along the route to its end. */
  toEndM: number;
}

/** Local flat coordinates in metres around `o` (x east, y north). */
function toXY(o: Pt, p: Pt): [number, number] {
  const k = 111_320;
  return [(p.lng - o.lng) * k * Math.cos((o.lat * Math.PI) / 180), (p.lat - o.lat) * k];
}

/**
 * Where to go next on `route` from `me`. `started` = the drive is running (before it, the
 * arrow leads to the start). The arrow points to the next waypoint while on the route, and
 * back to the nearest point of the route when more than OFF_ROUTE_M away from it.
 */
export function guide(route: Route, me: Pt, started: boolean): Guidance {
  const end = route[route.length - 1];
  const mk = (state: GuideState, target: Pt, offM: number, side: Guidance['side'], toEndM: number): Guidance => ({
    state,
    target,
    distM: distanceM(me, target),
    bearing: bearing(me, target),
    offM,
    side,
    toEndM,
  });
  // Nearest point on the route.
  let best = { d: Infinity, seg: 0, t: 0, cross: 0 };
  for (let i = 0; i + 1 < route.length; i++) {
    const [ax, ay] = toXY(me, route[i]);
    const [bx, by] = toXY(me, route[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(px, py);
    // Cross product of the segment direction and the vector to me (me is the origin).
    if (d < best.d) best = { d, seg: i, t, cross: dx * -ay - dy * -ax };
  }
  const near = lerp(route[best.seg], route[best.seg + 1], best.t);
  const toEndM = distanceM(near, route[best.seg + 1]) + routeLength(route.slice(best.seg + 1));
  // Beyond either end of the route "left" or "right" means nothing.
  const pastEnd = (best.seg === 0 && best.t <= 0) || (best.seg === route.length - 2 && best.t >= 1);
  const side: Guidance['side'] = best.d < 5 || pastEnd ? null : best.cross > 0 ? 'left' : 'right';
  const dEnd = distanceM(me, end);
  if (!started && distanceM(me, route[0]) > AT_START_M && best.seg === 0 && best.t < 0.05) return mk('toStart', route[0], best.d, side, routeLength(route));
  if (dEnd <= ARRIVED_M) return mk('arrived', end, best.d, side, 0);
  if (best.d > OFF_ROUTE_M) return mk('off', near, best.d, side, toEndM);
  // On the route: aim at the next waypoint, or the end.
  const next = best.t >= 0.999 && best.seg + 2 < route.length ? route[best.seg + 2] : route[best.seg + 1];
  return mk(Math.min(dEnd, toEndM) <= NEAR_END_M ? 'nearEnd' : 'onRoute', next, best.d, side, toEndM);
}

/** Vibration patterns, told apart without looking at the phone. */
export const BUZZ = {
  off: [150, 100, 150],
  nearEnd: [300, 150, 300, 150, 300],
  arrived: [800],
  message: [200, 100, 200, 100, 200],
  carcass: [500, 200, 500],
} as const;

/** Repeat the off-route buzz at most this often while still off. */
export const OFF_REPEAT_MS = 30_000;

/** Which buzz (if any) a new guidance state deserves, given the previous one and when "off" last buzzed. */
export function buzzFor(prev: GuideState | null, cur: GuideState, lastOffBuzz: number, now: number): keyof typeof BUZZ | null {
  if (cur === 'off') return prev !== 'off' || now - lastOffBuzz >= OFF_REPEAT_MS ? 'off' : null;
  if (cur === 'nearEnd' && prev !== 'nearEnd' && prev !== 'arrived') return 'nearEnd';
  if (cur === 'arrived' && prev !== 'arrived') return 'arrived';
  return null;
}

/** The arrow's rotation on screen: the target's bearing relative to where the phone points (true north). */
export const arrowAngle = (targetBearing: number, phoneHeading: number | null) => (phoneHeading == null ? targetBearing : (((targetBearing - phoneHeading) % 360) + 360) % 360);

// ---------------------------------------------------------------- stands (seats) per drive

/** driveId → uid → stand name or number written on the lottery card. */
export function parseSeats(v: unknown): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  if (!v || typeof v !== 'object') return out;
  for (const [d, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const m = new Map<string, string>();
    for (const [uid, s] of Object.entries(raw as Record<string, unknown>)) if (typeof s === 'string' && s.trim()) m.set(uid, s);
    if (m.size) out.set(d, m);
  }
  return out;
}

export const cleanSeat = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, CREW_LIMITS.seat);

/** The stand a seat refers to: same name, ignoring case, spaces and a "nr"/"#" prefix. */
export function standForSeat<S extends { name: string }>(seat: string, stands: S[]): S | null {
  const norm = (s: string) => s.toLowerCase().replace(/^(nr\.?|#)\s*/, '').replace(/\s+/g, '');
  const k = norm(seat);
  return k ? stands.find((s) => norm(s.name) === k) ?? null : null;
}

/**
 * The drive people are planning for now: the running one, else the next planned (by the
 * given order), else the last one that took place.
 */
export function focusDrive<D extends Pick<Drive, 'startedAt' | 'endedAt'>>(sorted: D[]): D | null {
  return (
    sorted.find((d) => d.startedAt != null && d.endedAt == null) ??
    sorted.find((d) => d.startedAt == null) ??
    [...sorted].filter((d) => d.endedAt != null).sort((a, b) => b.endedAt! - a.endedAt!)[0] ??
    null
  );
}

// ---------------------------------------------------------------- phones

/** Phone numbers: optional "+", 9–15 digits; spaces and dashes are dropped. */
export function cleanPhone(s: string): string | null {
  const t = s.replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{9,15}$/.test(t) ? t : null;
}

/** "+48600100200" → "+48 600 100 200", "600100200" → "600 100 200". */
export function fmtPhone(p: string): string {
  const m = /^(\+\d{2})?(\d+)$/.exec(p);
  if (!m) return p;
  const groups = m[2].match(/.{1,3}/g)!.join(' ');
  return m[1] ? `${m[1]} ${groups}` : groups;
}

export function parsePhones(v: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!v || typeof v !== 'object') return out;
  for (const [uid, p] of Object.entries(v as Record<string, unknown>)) if (typeof p === 'string' && cleanPhone(p)) out.set(uid, p);
  return out;
}

// ---------------------------------------------------------------- transport

export type CarcassKind = 'boar' | 'deer';
export const CARCASS_KINDS: CarcassKind[] = ['boar', 'deer'];

/** Who collects a carcass: boar, or red game (zwierzyna płowa: red and fallow deer, mouflon, roe deer). */
export function carcassKind(game: string | null): CarcassKind | null {
  if (!game) return null;
  if (game.startsWith('boar_')) return 'boar';
  if (/^(red|fallow|roe|mouflon)_/.test(game)) return 'deer';
  return null;
}

/** A transport person: a participant (uid), or someone outside the app (name and phone). */
export type Carrier = { uid: string } | { name: string; phone: string };

export type Transport = Partial<Record<CarcassKind, Carrier>>;

export function parseTransport(v: unknown): Transport {
  const out: Transport = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of CARCASS_KINDS) {
    const o = (v as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
    if (!o || typeof o !== 'object') continue;
    if (typeof o.uid === 'string' && o.uid) out[k] = { uid: o.uid };
    else if (typeof o.name === 'string' && typeof o.phone === 'string' && cleanPhone(o.phone)) out[k] = { name: o.name, phone: o.phone };
  }
  return out;
}

/** Which carcasses `uid` collects. */
export const myCarcassKinds = (t: Transport, uid: string): CarcassKind[] => CARCASS_KINDS.filter((k) => (t[k] as { uid?: string } | undefined)?.uid === uid);

// ---------------------------------------------------------------- carcasses

/** Where a carcass lies (moved by the shooter or leader) and who took it. */
export interface CarcassMark {
  lat: number | null;
  lng: number | null;
  pickedBy: string | null;
  pickedAt: number | null;
}

export function parseCarcassMarks(v: unknown): Map<string, CarcassMark> {
  const out = new Map<string, CarcassMark>();
  if (!v || typeof v !== 'object') return out;
  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : null);
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const lat = num(o.lat);
    const lng = num(o.lng);
    out.set(id, {
      lat: lat != null && lng != null ? lat : null,
      lng: lat != null && lng != null ? lng : null,
      pickedBy: typeof o.pickedBy === 'string' ? o.pickedBy : null,
      pickedAt: num(o.pickedAt),
    });
  }
  return out;
}

export interface Carcass {
  shotId: string;
  kind: CarcassKind;
  game: string;
  shooter: string;
  driveId: string | null;
  /** Ready for pickup: its drive has ended (or, without a drive, none is running). */
  ready: boolean;
  /** Best known position: moved by hand, else where the shot was fired, else the shooter's stand. */
  at: Pt | null;
  src: 'mark' | 'shot' | 'seat' | null;
  pickedBy: string | null;
  pickedAt: number | null;
}

/**
 * Carcasses to collect: kills of boar and red game. `seatAt(uid, driveId)` gives the shooter's
 * stand position for that drive, used when the shot has no position.
 */
export function carcasses(
  shots: Shot[],
  spots: Map<string, ShotSpot>,
  marks: Map<string, CarcassMark>,
  drives: Pick<Drive, 'id' | 'startedAt' | 'endedAt'>[],
  seatAt: (uid: string, driveId: string | null) => Pt | null = () => null,
): Carcass[] {
  const running = drives.some((d) => d.startedAt != null && d.endedAt == null);
  const out: Carcass[] = [];
  for (const s of shots) {
    if (s.outcome !== 'kill') continue;
    const kind = carcassKind(s.game);
    if (!kind || !gameByKey(s.game)) continue;
    const d = s.driveId ? drives.find((x) => x.id === s.driveId) : undefined;
    const ready = d ? d.endedAt != null : !running;
    const m = marks.get(s.id);
    const spot = spots.get(s.id);
    let at: Pt | null = null;
    let src: Carcass['src'] = null;
    if (m && m.lat != null && m.lng != null) [at, src] = [{ lat: m.lat, lng: m.lng }, 'mark'];
    else if (spot) [at, src] = [{ lat: spot.lat, lng: spot.lng }, 'shot'];
    else {
      const seat = seatAt(s.uid, s.driveId);
      if (seat) [at, src] = [seat, 'seat'];
    }
    out.push({ shotId: s.id, kind, game: s.game!, shooter: s.uid, driveId: s.driveId, ready, at, src, pickedBy: m?.pickedBy ?? null, pickedAt: m?.pickedAt ?? null });
  }
  return out;
}

/**
 * Visiting order: greedy nearest-next from `from` (good enough for a handful of carcasses).
 * Carcasses without a position go last, in their original order.
 */
export function pickupOrder<C extends { at: Pt | null }>(list: C[], from: Pt | null): C[] {
  const known = list.filter((c) => c.at);
  const unknown = list.filter((c) => !c.at);
  if (!from) return [...known, ...unknown];
  const out: C[] = [];
  let cur = from;
  while (known.length) {
    let bi = 0;
    for (let i = 1; i < known.length; i++) if (distanceM(cur, known[i].at!) < distanceM(cur, known[bi].at!)) bi = i;
    const [c] = known.splice(bi, 1);
    out.push(c);
    cur = c.at!;
  }
  return [...out, ...unknown];
}

export const mapsLink = (p: Pt) => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** `sms:` link that works on Android and iPhone. */
export const smsLink = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

// ---------------------------------------------------------------- messages

export type MsgTo = 'all' | 'hunter' | 'beater' | 'transport' | `u:${string}`;

export interface Message {
  id: string;
  text: string;
  to: MsgTo;
  ts: number;
}

export function parseMessages(v: unknown): Message[] {
  if (!v || typeof v !== 'object') return [];
  const out: Message[] = [];
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.text !== 'string' || typeof o.to !== 'string' || typeof o.ts !== 'number') continue;
    if (!/^(all|hunter|beater|transport|u:.+)$/.test(o.to)) continue;
    out.push({ id, text: o.text, to: o.to as MsgTo, ts: o.ts });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/** msgId → uid → when they acknowledged it. */
export function parseAcks(v: unknown): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  if (!v || typeof v !== 'object') return out;
  for (const [m, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const acks = new Map<string, number>();
    for (const [uid, ts] of Object.entries(raw as Record<string, unknown>)) if (typeof ts === 'number') acks.set(uid, ts);
    out.set(m, acks);
  }
  return out;
}

export const cleanMessage = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, CREW_LIMITS.message);

/** Whether a message is meant for this participant. The leader sends, so never receives. */
export function msgFor(m: Pick<Message, 'to'>, me: { uid: string; role: Role }, t: Transport): boolean {
  if (me.role === 'leader') return false;
  if (m.to === 'all') return true;
  if (m.to === 'hunter' || m.to === 'beater') return me.role === m.to;
  if (m.to === 'transport') return myCarcassKinds(t, me.uid).length > 0;
  return m.to === `u:${me.uid}`;
}

/** Recipients of a message among the confirmed participants. */
export function recipients<P extends { uid: string; role: Role; status: string }>(m: Pick<Message, 'to'>, ps: P[], t: Transport): P[] {
  return ps.filter((p) => p.status === 'confirmed' && msgFor(m, p, t));
}

/** Unacknowledged messages for me that are recent enough to still show as a pop-up. */
export const POPUP_MS = 60 * 60e3;

/** Ready-made messages for the leader, one tap each. */
export const PRESETS = {
  pl: ['Naganka rusza.', 'STOP! Wstrzymać nagankę.', 'Koniec miotu. Rozładować broń.', 'Zbiórka w punkcie zbiórki.', 'Wróć na swoją trasę.', 'Zachować ciszę na stanowiskach.'],
  en: ['Beaters, move off.', 'STOP! Beaters, halt.', 'End of the drive. Unload your guns.', 'Gather at the meeting point.', 'Get back on your route.', 'Keep quiet on your stands.'],
} as const;

// ---------------------------------------------------------------- route plans for an unknown headcount
//
// The leader plans a drive before knowing how many beaters come: a start line and an end
// line (the app spreads any number of routes between them) and/or hand-made variants for
// chosen headcounts. Before the drive the leader's app counts the beaters who are there,
// picks the routes and gives each beater one. The result goes to routes/ (per beater), so
// the beaters' guidance is the same as with routes drawn per person.

export const PLAN_LIMITS = { maxBeaters: 20, variants: 8 } as const;
/** A beater counts as present with a location this fresh (or after tapping "I'm here"). */
export const PRESENT_MS = 5 * 60e3;
/** During a drive: no location for this long = a gap on the beater's route. */
export const GAP_MS = 10 * 60e3;

/** When there are fewer beaters than routes, which routes stay empty. */
export type GapMode = 'middle' | 'flanks';

export interface RoutePlan {
  /** Start line (2 points) then end line (2 points), or null. */
  lines: [Pt, Pt, Pt, Pt] | null;
  gaps: GapMode;
  /** Hand-made routes by headcount; route 0 starts at the first point of the start line. */
  variants: Map<number, Route[]>;
  /** The headcount the leader last planned for: shown first, until the beaters are here. */
  n?: number;
}

const okCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= PLAN_LIMITS.maxBeaters;

export const emptyPlan = (): RoutePlan => ({ lines: null, gaps: 'middle', variants: new Map() });
export const planUsable = (p: RoutePlan | null | undefined) => !!p && (!!p.lines || [...p.variants.values()].some((v) => v.length));

export function parseRoutePlan(v: unknown): RoutePlan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const ln = decodeRoute(o.lines);
  const variants = new Map<number, Route[]>();
  if (o.v && typeof o.v === 'object') {
    for (const [k, raw] of Object.entries(o.v as Record<string, unknown>)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || n > PLAN_LIMITS.maxBeaters || !raw || typeof raw !== 'object') continue;
      // Arrays come back as arrays or as objects with numeric keys (gaps).
      const rs: Route[] = [];
      for (let i = 0; i < n; i++) rs.push(decodeRoute((raw as Record<string, unknown>)[i]));
      while (rs.length && rs[rs.length - 1].length < 2) rs.pop();
      if (rs.some((r) => r.length >= 2)) variants.set(n, rs);
    }
  }
  const plan: RoutePlan = { lines: ln.length === 4 ? (ln as [Pt, Pt, Pt, Pt]) : null, gaps: o.gaps === 'flanks' ? 'flanks' : 'middle', variants };
  if (okCount(o.n)) plan.n = o.n;
  return planUsable(plan) ? plan : null;
}

export function parseRoutePlans(v: unknown): Map<string, RoutePlan> {
  const out = new Map<string, RoutePlan>();
  if (!v || typeof v !== 'object') return out;
  for (const [d, raw] of Object.entries(v as Record<string, unknown>)) {
    const p = parseRoutePlan(raw);
    if (p) out.set(d, p);
  }
  return out;
}

/** What goes to the database (null = no plan). */
export function encodeRoutePlan(p: RoutePlan): Record<string, unknown> | null {
  if (!planUsable(p)) return null;
  const v: Record<string, Record<string, string>> = {};
  for (const [n, rs] of [...p.variants].slice(0, PLAN_LIMITS.variants)) {
    const o: Record<string, string> = {};
    rs.slice(0, n).forEach((r, i) => {
      if (r.length >= 2) o[i] = encodeRoute(r);
    });
    if (Object.keys(o).length) v[n] = o;
  }
  return { lines: p.lines ? encodeRoute(p.lines) : null, gaps: p.gaps, v: Object.keys(v).length ? v : null, n: okCount(p.n) ? p.n : null };
}

/** How many routes to show for a plan before the beaters are here: the planned count, else the first variant, else `fallback`. */
export const plannedCount = (p: RoutePlan, fallback: number): number =>
  Math.min(PLAN_LIMITS.maxBeaters, Math.max(1, (okCount(p.n) ? p.n : 0) || [...p.variants.keys()].sort((a, b) => a - b)[0] || fallback));

/** The routes for `n` beaters from the lines alone (null without lines). */
export const routesFromLines = (p: RoutePlan, n: number): Route[] | null => (p.lines && n > 0 ? spreadRoutes(...p.lines, n) : null);

export interface RouteSet {
  /** The routes walked; index = route number - 1. Empty routes are not walked. */
  routes: Route[];
  /** Where they come from: the hand-made variant for exactly n, the lines, or the nearest variant. */
  source: 'variant' | 'lines' | 'nearest';
  /** The headcount of the variant used (= routes.length). */
  base: number;
  /** One route index per beater: repeated = two beaters on it, missing = left empty. */
  slots: number[];
}

/**
 * Which routes `n` beaters walk. A hand-made variant for exactly n wins, then routes spread
 * from the lines, then the nearest variant: the biggest one not above n (extra beaters pair
 * up on its longest routes), else the smallest one (some routes stay empty, chosen by gaps).
 */
export function routeSet(p: RoutePlan | null | undefined, n: number): RouteSet | null {
  if (!p || n <= 0) return null;
  const all = (rs: Route[]) => rs.map((_, i) => i).filter((i) => rs[i].length >= 2);
  const exact = p.variants.get(n);
  if (exact && all(exact).length) {
    const slots = all(exact);
    return { routes: exact, source: 'variant', base: exact.length, slots: fillSlots(exact, slots, n, p.gaps) };
  }
  const fromLines = routesFromLines(p, n);
  if (fromLines) return { routes: fromLines, source: 'lines', base: n, slots: fromLines.map((_, i) => i) };
  const ks = [...p.variants.keys()].filter((k) => all(p.variants.get(k)!).length).sort((a, b) => a - b);
  if (!ks.length) return null;
  const k = [...ks].reverse().find((x) => x <= n) ?? ks[0];
  const rs = p.variants.get(k)!;
  return { routes: rs, source: 'nearest', base: rs.length, slots: fillSlots(rs, all(rs), n, p.gaps) };
}

/** `n` slots out of the drawn routes: pairs on the longest routes, or gaps in the middle / on the flanks. */
function fillSlots(rs: Route[], drawn: number[], n: number, gaps: GapMode): number[] {
  if (n === drawn.length) return drawn;
  if (n > drawn.length) {
    const longest = [...drawn].sort((a, b) => routeLength(rs[b]) - routeLength(rs[a]) || a - b);
    const out = [...drawn];
    for (let i = 0; out.length < n; i++) out.push(longest[i % longest.length]);
    return out.sort((a, b) => a - b);
  }
  return keepSlots(drawn, n, gaps);
}

/**
 * Keep `n` of the routes (by index, left to right). 'middle': both flanks stay covered and
 * the empty routes are spread over the middle; 'flanks': the outermost routes stay empty.
 */
export function keepSlots(drawn: number[], n: number, gaps: GapMode): number[] {
  const k = drawn.length;
  if (n >= k) return [...drawn];
  if (n <= 0) return [];
  if (gaps === 'flanks' || n === 1) {
    const from = Math.floor((k - n) / 2);
    return drawn.slice(from, from + n);
  }
  const idx = new Set<number>();
  for (let i = 0; i < n; i++) idx.add(Math.round((i * (k - 1)) / (n - 1)));
  return drawn.filter((_, i) => idx.has(i));
}

export interface AssignBeater {
  uid: string;
  name: string;
  pos: Pt | null;
  dog: boolean;
}

/**
 * Give each beater one slot of `slots` (route indexes, one per beater). Pinned beaters keep
 * their route; beaters with dogs get the routes closest to the middle; the rest are matched
 * so the total walk to the starts is smallest. Beaters without a location are put in name
 * order, left to right, on the routes left for them.
 */
export function assignRoutes(beaters: AssignBeater[], set: RouteSet, pins: Map<string, number> = new Map()): Map<string, number> {
  const out = new Map<string, number>();
  const free = [...set.slots];
  const take = (s: number) => {
    const i = free.indexOf(s);
    if (i >= 0) free.splice(i, 1);
  };
  const rest: AssignBeater[] = [];
  for (const b of beaters) {
    const s = pins.get(b.uid);
    if (s != null && s >= 0 && s < set.routes.length && set.routes[s].length >= 2) {
      out.set(b.uid, s);
      take(s);
    } else rest.push(b);
  }
  // More beaters than slots (pins on a route twice): the extras pair up on the longest routes.
  const drawn = set.routes.map((_, i) => i).filter((i) => set.routes[i].length >= 2);
  const longest = [...drawn].sort((a, b) => routeLength(set.routes[b]) - routeLength(set.routes[a]) || a - b);
  for (let i = 0; free.length < rest.length && longest.length; i++) free.push(longest[i % longest.length]);
  free.sort((a, b) => a - b);
  if (free.length > rest.length) free.splice(0, free.length, ...keepSlots(free, rest.length, 'middle'));
  const c = (set.routes.length - 1) / 2;
  const central = [...free].map((s, i) => ({ s, i })).sort((a, b) => Math.abs(a.s - c) - Math.abs(b.s - c) || a.i - b.i);
  const dogs = rest.filter((b) => b.dog);
  const others = rest.filter((b) => !b.dog);
  const dogSlots = central.slice(0, dogs.length).map((x) => x.s);
  const otherSlots = [...free];
  for (const s of dogSlots) otherSlots.splice(otherSlots.indexOf(s), 1);
  const match = (bs: AssignBeater[], ss: number[]) => {
    if (!bs.length) return;
    const starts = ss.map((s) => set.routes[s][0]);
    const cost = bs.map((b) => starts.map((st) => (b.pos ? distanceM(b.pos, st) : 0)));
    const pick = hungarian(cost);
    const noPos: { b: AssignBeater; s: number }[] = [];
    bs.forEach((b, i) => {
      if (b.pos) out.set(b.uid, ss[pick[i]]);
      else noPos.push({ b, s: ss[pick[i]] });
    });
    const sortedSlots = noPos.map((x) => x.s).sort((a, b) => a - b);
    noPos
      .map((x) => x.b)
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      .forEach((b, i) => out.set(b.uid, sortedSlots[i]));
  };
  match(dogs, dogSlots);
  match(others, otherSlots);
  return out;
}

/** Minimum-cost assignment for a square matrix: row i gets column result[i]. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (!n) return [];
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const res = new Array(n).fill(0);
  for (let j = 1; j <= n; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

/** A saved assignment: which route of how many, and whether the leader pinned it. */
export interface Assigned {
  base: number;
  slot: number;
  pin: boolean;
}

export const encodeAssigned = (a: Assigned) => `${a.base}:${a.slot}${a.pin ? '!' : ''}`;
export function decodeAssigned(s: unknown): Assigned | null {
  const m = typeof s === 'string' ? /^(\d{1,2}):(\d{1,2})(!?)$/.exec(s) : null;
  if (!m) return null;
  const base = +m[1];
  const slot = +m[2];
  return base >= 1 && base <= PLAN_LIMITS.maxBeaters && slot < base ? { base, slot, pin: m[3] === '!' } : null;
}

/** driveId → uid → assignment. */
export function parseAssignments(v: unknown): Map<string, Map<string, Assigned>> {
  const out = new Map<string, Map<string, Assigned>>();
  if (!v || typeof v !== 'object') return out;
  for (const [d, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const m = new Map<string, Assigned>();
    for (const [uid, s] of Object.entries(raw as Record<string, unknown>)) {
      const a = decodeAssigned(s);
      if (a) m.set(uid, a);
    }
    if (m.size) out.set(d, m);
  }
  return out;
}

export interface PresenceInput {
  uid: string;
  role: Role;
  status: string;
  here?: number | null;
}

/**
 * Beaters who count for the next drive: confirmed, and with a fresh location or "I'm here"
 * tapped. The leader's ticks win both ways.
 */
export function presentBeaters<P extends PresenceInput>(ps: P[], lastSeen: Map<string, number>, now: number, override: Map<string, boolean> = new Map()): P[] {
  return ps.filter((p) => {
    if (p.role !== 'beater' || p.status !== 'confirmed') return false;
    const o = override.get(p.uid);
    if (o != null) return o;
    const ts = lastSeen.get(p.uid);
    return !!p.here || (ts != null && now - ts <= PRESENT_MS);
  });
}

/** The nearest route start for a beater who came late (index), or null. */
export function nearestRoute(routes: Route[], me: Pt | null): number | null {
  let best: number | null = null;
  let bd = Infinity;
  routes.forEach((r, i) => {
    if (r.length < 2) return;
    const d = me ? Math.min(distanceM(me, r[0]), ...r.slice(1).map((p) => distanceM(me, p))) : i;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** Same people on the same routes (ignores pins). */
export function sameAssignment(a: Map<string, Assigned> | undefined, b: Map<string, number>, base: number): boolean {
  if (!a || a.size !== b.size) return false;
  for (const [uid, s] of b) {
    const x = a.get(uid);
    if (!x || x.slot !== s || x.base !== base) return false;
  }
  return true;
}
