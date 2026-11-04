// Group hunt (polowanie zbiorowe): types and pure logic shared by the UI and the
// backend adapter. No Firebase imports here so it stays unit-testable.

export type Role = 'leader' | 'hunter' | 'beater';
export type HuntStatus = 'open' | 'closed' | 'live' | 'ended';
export type ParticipantStatus = 'registered' | 'confirmed';

export const ROLES: Role[] = ['leader', 'hunter', 'beater'];
export const HUNT_STATUSES: HuntStatus[] = ['open', 'closed', 'live', 'ended'];

/** Fields the leader fills in. Dates and times are local wall-clock strings. */
export interface HuntInput {
  name: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  place: string; // meeting point (zbiórka), free text for now
  notes: string;
}

export interface Hunt extends HuntInput {
  id: string;
  leaderUid: string;
  leaderName: string;
  status: HuntStatus;
  createdAt: number;
}

export interface Participant {
  uid: string;
  name: string;
  role: Role;
  status: ParticipantStatus;
  joinedAt: number;
}

export const LIMITS = { name: 40, huntName: 80, place: 200, notes: 1000 } as const;

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
  };
}

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
