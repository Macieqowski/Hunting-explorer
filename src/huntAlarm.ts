// Accident alarm on a group hunt ("Alarm: wypadek"). Pure logic; the database side is in
// huntFirebase.ts and database.rules.json, the screens in huntUi.ts and aidUi.ts.
//
// The flow (Maciej's decision, 16.11.2026): anyone confirmed raises an alarm, after confirming it
// on their own phone. It goes to the leader's devices and the deputies first (alarms/$h/$uid).
// Only when one of them approves it does it reach every participant (alerts/$h/$uid). Nothing
// is forwarded on its own when nobody approves. An alarm raised by a leader device or a deputy
// is approved at once.

import { distanceM } from './hunt';

export const ALARM_NOTE_MAX = 120;

export interface Alarm {
  /** The reporter (one alarm per person at a time: the record is keyed by the reporter's uid). */
  uid: string;
  lat: number;
  lng: number;
  acc: number | null;
  note: string;
  ts: number;
  approvedBy: string | null;
  approvedAt: number | null;
  rejectedBy: string | null;
  rejectedAt: number | null;
}

/** An approved alarm, seen by everyone in the hunt. */
export interface Alert {
  uid: string;
  lat: number;
  lng: number;
  acc: number | null;
  note: string;
  ts: number;
  /** Who approved it, and when. */
  by: string;
  at: number;
  closedAt: number | null;
}

export type AlarmState = 'pending' | 'approved' | 'rejected';

export const alarmState = (a: Pick<Alarm, 'approvedAt' | 'rejectedAt'>): AlarmState =>
  a.rejectedAt != null ? 'rejected' : a.approvedAt != null ? 'approved' : 'pending';

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const okLat = (v: number | null): v is number => v != null && v >= -90 && v <= 90;
const okLng = (v: number | null): v is number => v != null && v >= -180 && v <= 180;

export function parseAlarm(uid: string, raw: unknown): Alarm | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lat = num(o.lat);
  const lng = num(o.lng);
  const ts = num(o.ts);
  if (!okLat(lat) || !okLng(lng) || ts == null) return null;
  const approvedBy = str(o.approvedBy);
  const rejectedBy = str(o.rejectedBy);
  return {
    uid,
    lat,
    lng,
    acc: num(o.acc),
    note: str(o.note) ?? '',
    ts,
    approvedBy,
    approvedAt: approvedBy ? num(o.approvedAt) : null,
    rejectedBy,
    rejectedAt: rejectedBy ? num(o.rejectedAt) : null,
  };
}

/** Newest first. */
export function parseAlarms(v: unknown): Alarm[] {
  if (!v || typeof v !== 'object') return [];
  const out: Alarm[] = [];
  for (const [uid, raw] of Object.entries(v as Record<string, unknown>)) {
    const a = parseAlarm(uid, raw);
    if (a) out.push(a);
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/** Newest first. */
export function parseAlerts(v: unknown): Alert[] {
  if (!v || typeof v !== 'object') return [];
  const out: Alert[] = [];
  for (const [uid, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const lat = num(o.lat);
    const lng = num(o.lng);
    const ts = num(o.ts);
    const at = num(o.at);
    const by = str(o.by);
    if (!okLat(lat) || !okLng(lng) || ts == null || at == null || !by) continue;
    out.push({ uid, lat, lng, acc: num(o.acc), note: str(o.note) ?? '', ts, by, at, closedAt: num(o.closedAt) });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export const cleanAlarmNote = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, ALARM_NOTE_MAX);

/** The record a reporter writes (ts is set by the server). */
export function alarmRecord(fix: { lat: number; lng: number; acc: number | null }, note: string): Record<string, unknown> {
  const rec: Record<string, unknown> = { lat: +fix.lat.toFixed(6), lng: +fix.lng.toFixed(6) };
  if (fix.acc != null && isFinite(fix.acc)) rec.acc = Math.min(100000, Math.max(0, Math.round(fix.acc)));
  const n = cleanAlarmNote(note);
  if (n) rec.note = n;
  return rec;
}

/** The approved copy for everyone, made from the reporter's alarm. */
export function alertRecord(a: Alarm): Record<string, unknown> {
  const rec: Record<string, unknown> = { uid: a.uid, lat: a.lat, lng: a.lng, ts: a.ts };
  if (a.acc != null) rec.acc = a.acc;
  if (a.note) rec.note = a.note;
  return rec;
}

// ---------------------------------------------------------------- first-aid kits

/** 'a' = first-aid kit (apteczka), 't' = tourniquet (opaska uciskowa), 'at' = both. */
export type Kit = 'a' | 't' | 'at';

export function parseKits(v: unknown): Map<string, Kit> {
  const out = new Map<string, Kit>();
  if (!v || typeof v !== 'object') return out;
  for (const [uid, k] of Object.entries(v as Record<string, unknown>)) if (k === 'a' || k === 't' || k === 'at') out.set(uid, k);
  return out;
}

export const kitOf = (aid: boolean, tq: boolean): Kit | null => (aid && tq ? 'at' : aid ? 'a' : tq ? 't' : null);
export const hasAid = (k: Kit | undefined) => k === 'a' || k === 'at';
export const hasTq = (k: Kit | undefined) => k === 't' || k === 'at';

/**
 * People with a kit or a tourniquet, nearest to `at` first (those without a known position last,
 * tourniquet carriers before kit-only ones at equal distance).
 */
export function kitCarriers<P extends { uid: string }>(
  kits: Map<string, Kit>,
  people: P[],
  pos: Map<string, { lat: number; lng: number }>,
  at: { lat: number; lng: number } | null,
): { person: P; kit: Kit; dist: number | null }[] {
  const out: { person: P; kit: Kit; dist: number | null }[] = [];
  for (const p of people) {
    const k = kits.get(p.uid);
    if (!k) continue;
    const where = pos.get(p.uid);
    out.push({ person: p, kit: k, dist: at && where ? distanceM(at, where) : null });
  }
  return out.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity) || Number(hasTq(b.kit)) - Number(hasTq(a.kit)));
}

/** Ready-made messages for the leader after an approved alarm (sent to everyone, one tap each). */
export const ALARM_PRESETS = [
  'WYPADEK! Przerwa w polowaniu. Rozładować broń i zostać na miejscu.',
  'Kto ma apteczkę lub opaskę uciskową: do rannego (pozycja na mapie).',
  'Potrzebna jedna osoba przy drodze: poprowadzi karetkę do rannego.',
  'Koniec alarmu. Czekać na polecenia prowadzącego.',
] as const;

/** The buzz of an alarm: long and hard to miss, unlike the message and guidance patterns (BUZZ). */
export const ALARM_BUZZ = [1000, 300, 1000, 300, 1000, 300, 1000] as const;

/** One alarm or alert as it was raised: a new alarm by the same person gets a new key. */
export const alarmKey = (a: Pick<Alarm, 'uid' | 'ts'>) => `${a.uid}:${a.ts}`;

/** Open approved alerts, newest first. */
export const openAlerts = (as: Alert[]) => as.filter((a) => a.closedAt == null);

/**
 * Pops up on its own (sheet over the screen) only while this fresh: an alarm left open for hours
 * stays on the hunt page, but does not jump at someone who opens the app the next morning.
 */
export const ALARM_POPUP_MS = 60 * 60e3;

/** Alarms a leader device or deputy still has to decide on, newest first (not their own). */
export const pendingAlarms = (as: Alarm[], me: string) => as.filter((a) => a.uid !== me && alarmState(a) === 'pending');
