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
