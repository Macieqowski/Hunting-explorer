// Group hunt (polowanie zbiorowe): types and pure logic shared by the UI and the
// backend adapter. No Firebase imports here so it stays unit-testable.

export type Role = 'leader' | 'hunter' | 'beater';
export type HuntStatus = 'open' | 'closed' | 'live' | 'ended';
export type ParticipantStatus = 'registered' | 'confirmed';

export const ROLES: Role[] = ['leader', 'hunter', 'beater'];
export const HUNT_STATUSES: HuntStatus[] = ['open', 'closed', 'live', 'ended'];

/** The hunting district (obwód) a hunt takes place in, as picked from the BDL list. */
export interface HuntDistrict {
  id: number; // BDL objectid
  slug: string; // app route slug, see districtSlug()
  label: string; // e.g. "Obwód nr 123 · KŁ Darz Bór (mazowieckie)"
}

/** Fields the leader fills in. Dates and times are local wall-clock strings. */
export interface HuntInput {
  name: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  place: string; // meeting point (zbiórka), free text
  notes: string;
  district: HuntDistrict | null;
}

export interface Hunt extends HuntInput {
  id: string;
  leaderUid: string;
  leaderName: string;
  status: HuntStatus;
  createdAt: number;
  /** Set when the leader ends the hunt; positions and tracks are deleted RETENTION_MS later. */
  endedAt: number | null;
}

/** Last known position of one participant. */
export interface Position {
  uid: string;
  lat: number;
  lng: number;
  acc: number | null; // metres
  ts: number; // server time, ms
  role: Role;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  ts: number;
}

export interface Participant {
  uid: string;
  name: string;
  role: Role;
  status: ParticipantStatus;
  joinedAt: number;
}

export const LIMITS = { name: 40, huntName: 80, place: 200, notes: 1000, districtLabel: 200 } as const;

/** Trim and collapse whitespace; the result is what gets stored. */
export const cleanText = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanNotes = (s: string) => s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, LIMITS.notes);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type HuntError = 'name' | 'date' | 'start' | 'end';

/** Returns the fields that are invalid (empty list = OK). */
export function validateHunt(i: HuntInput): HuntError[] {
  const errs: HuntError[] = [];
  if (!cleanText(i.name, LIMITS.huntName)) errs.push('name');
  if (!DATE_RE.test(i.date) || isNaN(Date.parse(i.date))) errs.push('date');
  if (!TIME_RE.test(i.start)) errs.push('start');
  if (!TIME_RE.test(i.end)) errs.push('end');
  return errs;
}

export const validPersonName = (n: string) => cleanText(n, LIMITS.name).length >= 2;

/** Start and end as epoch ms in the browser's time zone. An end before the start means the hunt runs past midnight. */
export function huntWindow(h: Pick<HuntInput, 'date' | 'start' | 'end'>): { start: number; end: number } {
  const [y, m, d] = h.date.split('-').map(Number);
  const at = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm).getTime();
  };
  const start = at(h.start);
  let end = at(h.end);
  if (end <= start) end += 24 * 3600 * 1000;
  return { start, end };
}

/** Upcoming and running hunts first (soonest first), then past ones (most recent first). */
export function sortHunts<T extends Hunt>(hunts: T[], now = Date.now()): T[] {
  const key = (h: T) => huntWindow(h);
  const isPast = (h: T) => h.status === 'ended' || key(h).end < now;
  return [...hunts].sort((a, b) => {
    const pa = isPast(a);
    const pb = isPast(b);
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? key(b).start - key(a).start : key(a).start - key(b).start;
  });
}

const ROLE_ORDER: Record<Role, number> = { leader: 0, hunter: 1, beater: 2 };

/** Leader first, then hunters, then beaters; each group alphabetically (Polish collation). */
export function sortParticipants(ps: Participant[]): Participant[] {
  return [...ps].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, 'pl'));
}

export function countRoles(ps: Participant[]): Record<Role, number> {
  const c: Record<Role, number> = { leader: 0, hunter: 0, beater: 0 };
  for (const p of ps) c[p.role]++;
  return c;
}

/** Whether a newcomer can sign up right now. */
export const registrationOpen = (h: Hunt) => h.status === 'open';

/** Statuses the leader can move the hunt to from the current one. */
export function nextStatuses(s: HuntStatus): HuntStatus[] {
  switch (s) {
    case 'open':
      return ['closed', 'live'];
    case 'closed':
      return ['open', 'live'];
    case 'live':
      return ['ended'];
    case 'ended':
      return ['live'];
  }
}

/** Parse a hunt record as stored in the database; null if it is not a valid hunt. */
export function parseHunt(id: string, v: unknown): Hunt | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  const status = HUNT_STATUSES.includes(o.status as HuntStatus) ? (o.status as HuntStatus) : null;
  if (!status || !str('name') || !str('leaderUid')) return null;
  return {
    id,
    name: str('name'),
    date: str('date'),
    start: str('start'),
    end: str('end'),
    place: str('place'),
    notes: str('notes'),
    leaderUid: str('leaderUid'),
    leaderName: str('leaderName'),
    status,
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
    endedAt: typeof o.endedAt === 'number' ? o.endedAt : null,
    district: parseDistrict(o.district),
  };
}

function parseDistrict(v: unknown): HuntDistrict | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'number' && typeof o.slug === 'string' && typeof o.label === 'string' ? { id: o.id, slug: o.slug, label: o.label } : null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export function parsePositions(v: unknown): Position[] {
  if (!v || typeof v !== 'object') return [];
  const out: Position[] = [];
  for (const [uid, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (!isNum(o.lat) || !isNum(o.lng) || !isNum(o.ts) || !ROLES.includes(o.role as Role)) continue;
    out.push({ uid, lat: o.lat, lng: o.lng, acc: isNum(o.acc) ? o.acc : null, ts: o.ts, role: o.role as Role });
  }
  return out;
}

/** Tracks per participant, each sorted by time. */
export function parseTracks(v: unknown): Map<string, TrackPoint[]> {
  const out = new Map<string, TrackPoint[]>();
  if (!v || typeof v !== 'object') return out;
  for (const [uid, pts] of Object.entries(v as Record<string, unknown>)) {
    if (!pts || typeof pts !== 'object') continue;
    const list: TrackPoint[] = [];
    for (const p of Object.values(pts as Record<string, unknown>)) {
      const o = p as Record<string, unknown> | null;
      if (o && isNum(o.lat) && isNum(o.lng) && isNum(o.ts)) list.push({ lat: o.lat, lng: o.lng, ts: o.ts });
    }
    if (list.length) out.set(uid, list.sort((a, b) => a.ts - b.ts));
  }
  return out;
}

// ---------------------------------------------------------------- location sharing

/** Positions older than this look faded on the map; older than LOST_MS they are drawn hollow. */
export const STALE_MS = 2 * 60e3;
export const LOST_MS = 10 * 60e3;
/** A new position is sent after moving this far, or after HEARTBEAT_MS without moving. */
export const MIN_MOVE_M = 20;
export const HEARTBEAT_MS = 30e3;
/** Positions and tracks are deleted this long after the hunt ends. */
export const RETENTION_MS = 7 * 24 * 3600e3;

export type Freshness = 'fresh' | 'stale' | 'lost';
export const freshness = (ts: number, now: number): Freshness => (now - ts < STALE_MS ? 'fresh' : now - ts < LOST_MS ? 'stale' : 'lost');

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a new GPS fix should be sent: always the first one, after MIN_MOVE_M of movement
 * (also adds a track point), or after HEARTBEAT_MS so others see the position is still current.
 * Fixes much less accurate than the movement threshold don't count as movement.
 */
export function sendDecision(
  last: { lat: number; lng: number; at: number } | null,
  fix: { lat: number; lng: number; acc: number | null },
  now: number,
): { send: boolean; track: boolean } {
  if (!last) return { send: true, track: true };
  const moved = distanceM(last, fix) >= Math.max(MIN_MOVE_M, Math.min(fix.acc ?? 0, 100));
  if (moved) return { send: true, track: true };
  return { send: now - last.at >= HEARTBEAT_MS, track: false };
}

/** True when the leader's app should delete the hunt's positions and tracks. */
export const shouldPurge = (h: Pick<Hunt, 'status' | 'endedAt'>, now: number) =>
  h.status === 'ended' && h.endedAt != null && now - h.endedAt >= RETENTION_MS;

export function parseParticipants(v: unknown): Participant[] {
  if (!v || typeof v !== 'object') return [];
  const out: Participant[] = [];
  for (const [uid, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.name !== 'string' || !ROLES.includes(o.role as Role)) continue;
    out.push({
      uid,
      name: o.name,
      role: o.role as Role,
      status: o.status === 'confirmed' ? 'confirmed' : 'registered',
      joinedAt: typeof o.joinedAt === 'number' ? o.joinedAt : 0,
    });
  }
  return sortParticipants(out);
}

// ---------------------------------------------------------------- export

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * GPX 1.1 file with a waypoint at each last known position and one track per participant.
 * When drives were run, each person's track is split into one track per drive, and each
 * drive's area is added as a closed track. Opens in Google Earth, Locus, mapy.cz, OsmAnd,
 * Garmin BaseCamp and most GPS apps.
 */
export function toGpx(
  huntName: string,
  tracks: Map<string, TrackPoint[]>,
  positions: Position[],
  people: Map<string, { name: string; role: Role }>,
  roleName: (r: Role) => string,
  drives: Drive[] = [],
  sightings: { s: Sighting; label: string }[] = [],
): string {
  const label = (uid: string) => {
    const p = people.get(uid);
    return p ? `${p.name} (${roleName(p.role)})` : uid;
  };
  const trk = (name: string, type: string, pts: { lat: number; lng: number; ts?: number }[]) =>
    `  <trk><name>${xml(name)}</name><type>${type}</type><trkseg>\n` +
    pts.map((p) => `    <trkpt lat="${p.lat}" lon="${p.lng}">${p.ts != null ? `<time>${iso(p.ts)}</time>` : ''}</trkpt>`).join('\n') +
    `\n  </trkseg></trk>`;
  const wpts = positions
    .filter((p) => people.has(p.uid))
    .map((p) => `  <wpt lat="${p.lat}" lon="${p.lng}"><time>${iso(p.ts)}</time><name>${xml(label(p.uid))}</name><type>${people.get(p.uid)!.role}</type></wpt>`);
  const sights = sightings.map(
    ({ s, label }) => `  <wpt lat="${s.lat}" lon="${s.lng}"><time>${iso(s.ts)}</time><name>${xml(label)}</name><type>${s.species}</type></wpt>`,
  );
  const run = drives.filter((d) => d.startedAt != null);
  const trks = [...tracks]
    .filter(([uid]) => people.has(uid))
    .flatMap(([uid, pts]) => {
      const role = people.get(uid)!.role;
      if (!run.length) return [trk(label(uid), role, pts)];
      return splitByDrive(pts, run).map((part) => trk(part.drive ? `${label(uid)} · ${part.drive.name}` : label(uid), role, part.pts));
    });
  const areas = drives.filter((d) => d.area.length >= 3).map((d) => trk(d.name, 'drive', [...d.area, d.area[0]].map(([lat, lng]) => ({ lat, lng }))));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Hunting Explorer" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${xml(huntName)}</name></metadata>`,
    ...wpts,
    ...sights,
    ...areas,
    ...trks,
    '</gpx>',
    '',
  ].join('\n');
}

/** File name like "2026-12-12-polowanie-na-dziki.gpx". */
export function gpxFileName(h: Pick<Hunt, 'date' | 'name'>): string {
  const slug = h.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${h.date}-${slug || 'polowanie'}.gpx`;
}

// ---------------------------------------------------------------- drives (mioty)

/** A drive's area: corners as [lat, lng], in drawing order (the polygon closes itself). */
export type Area = [number, number][];

export interface DriveInput {
  name: string;
  start: string; // HH:MM, planned
  end: string; // HH:MM, planned
  area: Area;
}

export interface Drive extends DriveInput {
  id: string;
  /** Server time when the leader started / ended it; null while planned / running. */
  startedAt: number | null;
  endedAt: number | null;
}

export type DriveState = 'planned' | 'active' | 'done';

export const DRIVE_LIMITS = { name: 40, drives: 20, corners: 50, minCorners: 3 } as const;

export const driveState = (d: Pick<Drive, 'startedAt' | 'endedAt'>): DriveState =>
  d.startedAt == null ? 'planned' : d.endedAt == null ? 'active' : 'done';

export type DriveError = 'name' | 'start' | 'end' | 'area';

export function validateDrive(d: DriveInput): DriveError[] {
  const errs: DriveError[] = [];
  if (!cleanText(d.name, DRIVE_LIMITS.name)) errs.push('name');
  if (!TIME_RE.test(d.start)) errs.push('start');
  if (!TIME_RE.test(d.end)) errs.push('end');
  if (d.area.length < DRIVE_LIMITS.minCorners || d.area.length > DRIVE_LIMITS.corners) errs.push('area');
  return errs;
}

/** Stored as "lat,lng;lat,lng;…" with 6 decimals (about 10 cm), which keeps the rules simple. */
export const encodeArea = (a: Area) => a.map(([lat, lng]) => `${+lat.toFixed(6)},${+lng.toFixed(6)}`).join(';');

export function decodeArea(s: unknown): Area {
  if (typeof s !== 'string' || !s) return [];
  const out: Area = [];
  for (const pair of s.split(';')) {
    const [lat, lng] = pair.split(',').map(Number);
    if (isNum(lat) && isNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) out.push([lat, lng]);
  }
  return out;
}

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Minutes since the hunt's start, so drives after midnight sort after the evening ones. */
const sinceStart = (t: string, huntStart: string) => (minutes(t) - minutes(huntStart) + 1440) % 1440;

/** By planned start (relative to the hunt's start), then name. */
export function sortDrives<T extends DriveInput>(ds: T[], huntStart: string): T[] {
  return [...ds].sort((a, b) => sinceStart(a.start, huntStart) - sinceStart(b.start, huntStart) || a.name.localeCompare(b.name, 'pl', { numeric: true }));
}

export const activeDrive = <T extends Pick<Drive, 'startedAt' | 'endedAt'>>(ds: T[]): T | null =>
  ds.filter((d) => driveState(d) === 'active').sort((a, b) => b.startedAt! - a.startedAt!)[0] ?? null;

/** Suggested name and times for a new drive: 15 minutes after the last one ends, 60 minutes long. */
export function nextDriveDefaults(ds: DriveInput[], hunt: Pick<HuntInput, 'start'>): { name: string; start: string; end: string } {
  const sorted = sortDrives(ds, hunt.start);
  const last = sorted[sorted.length - 1];
  const start = last ? minutes(last.end) + 15 : minutes(hunt.start);
  return { name: `Miot ${ds.length + 1}`, start: hhmm(start), end: hhmm(start + 60) };
}

export function parseDrives(v: unknown): Drive[] {
  if (!v || typeof v !== 'object') return [];
  const out: Drive[] = [];
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.name !== 'string' || typeof o.start !== 'string' || typeof o.end !== 'string') continue;
    out.push({
      id,
      name: o.name,
      start: o.start,
      end: o.end,
      area: decodeArea(o.area),
      startedAt: isNum(o.startedAt) ? o.startedAt : null,
      endedAt: isNum(o.startedAt) && isNum(o.endedAt) ? o.endedAt : null,
    });
  }
  return out;
}

/** The drive running at time ts (by the leader's start and end taps), if any. */
export function driveAt<T extends Pick<Drive, 'startedAt' | 'endedAt'>>(ds: T[], ts: number): T | null {
  let best: T | null = null;
  for (const d of ds)
    if (d.startedAt != null && d.startedAt <= ts && (d.endedAt == null || ts < d.endedAt) && (!best || d.startedAt > best.startedAt!)) best = d;
  return best;
}

/** Split a track into runs of consecutive points that fall in the same drive (null = between drives). */
export function splitByDrive<P extends { ts: number }, D extends Pick<Drive, 'startedAt' | 'endedAt'>>(pts: P[], ds: D[]): { drive: D | null; pts: P[] }[] {
  const out: { drive: D | null; pts: P[] }[] = [];
  for (const p of pts) {
    const d = driveAt(ds, p.ts);
    const cur = out[out.length - 1];
    if (cur && cur.drive === d) cur.pts.push(p);
    else out.push({ drive: d, pts: [p] });
  }
  return out;
}

// ---------------------------------------------------------------- game sightings

export type Species = 'deer' | 'boar' | 'roe' | 'predator';
export type Herd = '1-3' | '3-6' | '6+';
export type HeadingSource = 'compass' | 'buttons';

export const SPECIES: Species[] = ['deer', 'boar', 'roe', 'predator'];
export const HERDS: Herd[] = ['1-3', '3-6', '6+'];

export interface SightingInput {
  species: Species;
  count: Herd;
  lat: number;
  lng: number;
  heading: number; // degrees from true north, clockwise, 0–359
  src: HeadingSource;
  driveId: string | null;
}

export interface Sighting extends SightingInput {
  id: string;
  uid: string;
  ts: number;
}

/** Sightings stay bright this long, then fade until their drive ends (or SIGHT_LOOSE_MS without a drive). */
export const SIGHT_FRESH_MS = 5 * 60e3;
export const SIGHT_LOOSE_MS = 30 * 60e3;
/** Hunters this close to a sighting and within this angle of its direction get an alert. */
export const ALERT_M = 500;
export const ALERT_DEG = 30;

export function parseSightings(v: unknown): Sighting[] {
  if (!v || typeof v !== 'object') return [];
  const out: Sighting[] = [];
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (!SPECIES.includes(o.species as Species) || !HERDS.includes(o.count as Herd)) continue;
    if (!isNum(o.lat) || !isNum(o.lng) || !isNum(o.heading) || !isNum(o.ts) || typeof o.uid !== 'string') continue;
    out.push({
      id,
      uid: o.uid,
      species: o.species as Species,
      count: o.count as Herd,
      lat: o.lat,
      lng: o.lng,
      heading: normDeg(o.heading),
      src: o.src === 'buttons' ? 'buttons' : 'compass',
      driveId: typeof o.driveId === 'string' ? o.driveId : null,
      ts: o.ts,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export const normDeg = (d: number) => ((d % 360) + 360) % 360;
/** Smallest angle between two directions, 0–180. */
export const angleDiff = (a: number, b: number) => {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return d > 180 ? 360 - d : d;
};

const POINTS_PL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Eight-point compass name for a heading (N, NE, E…). */
export const compassPoint = (deg: number) => POINTS_PL[Math.round(normDeg(deg) / 45) % 8];

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return normDeg(Math.atan2(y, x) / rad);
}

/** Point `m` metres from p in direction `deg` (flat-earth approximation, fine for a few km). */
export function offsetPoint(p: { lat: number; lng: number }, deg: number, m: number): { lat: number; lng: number } {
  const rad = Math.PI / 180;
  const dLat = (m * Math.cos(deg * rad)) / 111_320;
  const dLng = (m * Math.sin(deg * rad)) / (111_320 * Math.cos(p.lat * rad));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

/** Whether the game is heading toward `me`: within ALERT_M of the sighting and ALERT_DEG of its direction. */
export function headingToward(s: Pick<Sighting, 'lat' | 'lng' | 'heading'>, me: { lat: number; lng: number }): boolean {
  const d = distanceM(s, me);
  if (d > ALERT_M) return false;
  if (d < 30) return true; // right next to it
  return angleDiff(bearing(s, me), s.heading) <= ALERT_DEG;
}

export type SightLook = 'bright' | 'faded' | 'old';

/** Bright for SIGHT_FRESH_MS, then faded while its drive runs (or SIGHT_LOOSE_MS when there was none), then old. */
export function sightLook(s: Pick<Sighting, 'ts' | 'driveId'>, now: number, activeDriveId: string | null): SightLook {
  const age = now - s.ts;
  if (age < SIGHT_FRESH_MS) return 'bright';
  if (s.driveId ? s.driveId === activeDriveId : age < SIGHT_LOOSE_MS) return 'faded';
  return 'old';
}

/**
 * Magnetic declination in Poland (east, degrees), about 5° in the west to 7.5° in the east in the mid-2020s.
 * Close enough for an arrow drawn as a 30° fan.
 */
export const declination = (lng: number) => Math.min(8, Math.max(4, 5 + (lng - 14) * 0.25));

/**
 * Compass heading (degrees from magnetic north) of where the phone points, from absolute
 * DeviceOrientation angles. Held upright, that is where the back camera looks; held flat,
 * where the top edge points. null when the phone points straight up or down.
 */
export function headingFromOrientation(alpha: number, beta: number, gamma: number): number | null {
  const r = Math.PI / 180;
  const [cA, sA, cB, sB, cG, sG] = [Math.cos(alpha * r), Math.sin(alpha * r), Math.cos(beta * r), Math.sin(beta * r), Math.cos(gamma * r), Math.sin(gamma * r)];
  // Device axes in earth coordinates (x east, y north, z up), W3C rotation order Z-X'-Y''.
  const back = [-(cG * sA * sB + cA * sG), -(sA * sG - cA * cG * sB), -(cB * cG)];
  const top = [-cB * sA, cA * cB, sB];
  const flatness = Math.hypot(back[0], back[1]); // 0 = lying flat, 1 = upright
  const v = flatness > 0.6 ? back : top;
  if (Math.hypot(v[0], v[1]) < 0.2) return null;
  return normDeg(Math.atan2(v[0], v[1]) / r);
}
