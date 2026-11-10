// The list of hunting districts and clubs, built into the website and the app
// (public/data/districts.json, made by scripts/snapshot-districts.mjs) instead of being
// downloaded from BDL on every start. The app checks www.polowanie.org for a newer list
// and keeps it on the phone. Boundaries are still loaded from BDL for the map view.

import { DISTRICT_FIELDS, fetchAllDistricts, type District } from './bdl';
import { getBdl, putBdl } from './offlineStore';
import { isApp, PUBLIC_URL } from './platform';

export const SNAPSHOT_FORMAT = 1;

export interface SnapshotMeta {
  format: number;
  /** Hash of the content: the same list has the same version. */
  version: string;
  /** Day the list was taken from BDL (YYYY-MM-DD). */
  date: string;
  count: number;
}

interface Snapshot extends SnapshotMeta {
  fields: string[];
  /** Columns that hold indexes into `strings`. */
  text: number[];
  strings: string[];
  rows: (number | null)[][];
}

export interface DistrictList {
  districts: District[];
  /** null when the list came straight from BDL. */
  meta: SnapshotMeta | null;
  /** Where it came from: built into the app/site, downloaded later, or BDL itself. */
  source: 'built-in' | 'update' | 'bdl';
}

/** Turns the compact file back into districts. Throws on anything unexpected. */
export function decodeSnapshot(raw: unknown): DistrictList {
  const s = raw as Snapshot;
  if (!s || s.format !== SNAPSHOT_FORMAT || !Array.isArray(s.rows) || !Array.isArray(s.strings) || !Array.isArray(s.fields))
    throw new Error('Nieznany format danych obwodów');
  if (s.rows.length !== s.count) throw new Error('Niepełne dane obwodów');
  const col = new Map(s.fields.map((f, i) => [f, i]));
  const text = new Set(s.text);
  const districts = s.rows.map((row) => {
    const d: Record<string, unknown> = {};
    for (const f of DISTRICT_FIELDS) {
      const i = col.get(f);
      const v = i === undefined ? null : row[i];
      d[f] = v == null ? null : text.has(i!) ? s.strings[v] ?? null : v;
    }
    return d as unknown as District;
  });
  return { districts, meta: { format: s.format, version: s.version, date: s.date, count: s.count }, source: 'built-in' };
}

/** Whether `remote` should replace `local`: a different list taken on the same day or later. */
export function isNewerList(remote: SnapshotMeta | null | undefined, local: SnapshotMeta | null): boolean {
  if (!remote || remote.format !== SNAPSHOT_FORMAT || !remote.version || !remote.date) return false;
  if (!local) return true;
  return remote.version !== local.version && remote.date >= local.date;
}

const STORED_KEY = 'snapshot:districts';
const CHECKED_KEY = 'districtsChecked';
const CHECK_EVERY_MS = 6 * 3600_000;
const REMOTE = `${PUBLIC_URL}data/`;

async function getJson(url: string, timeoutMs = 30_000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function storedList(): Promise<DistrictList | null> {
  if (!isApp()) return null;
  try {
    const raw = await getBdl(STORED_KEY);
    return raw ? { ...decodeSnapshot(raw), source: 'update' } : null;
  } catch {
    return null;
  }
}

/**
 * The district list to start with: the built-in file, or a newer one the app downloaded
 * earlier. Only if neither can be read does it fall back to BDL (with progress).
 */
export async function loadDistrictList(onProgress?: (loaded: number, total: number) => void): Promise<DistrictList> {
  let built: DistrictList | null = null;
  try {
    built = decodeSnapshot(await getJson('./data/districts.json'));
  } catch {
    /* a build without the file (or a broken one): try the others */
  }
  const stored = await storedList();
  if (stored && isNewerList(stored.meta, built?.meta ?? null)) return stored;
  if (built) return built;
  return { districts: await fetchAllDistricts(onProgress), meta: null, source: 'bdl' };
}

/**
 * App only: asks www.polowanie.org whether there is a newer list (a 70-byte file, at most every
 * 6 hours unless `force`), downloads and keeps it. Returns the new list, or null when there is
 * nothing new. Throws when the check itself fails.
 */
export async function checkDistrictUpdate(current: SnapshotMeta | null, force = false): Promise<DistrictList | null> {
  if (!isApp()) return null;
  if (!force) {
    try {
      const last = Number(localStorage.getItem(CHECKED_KEY) ?? 0);
      if (Date.now() - last < CHECK_EVERY_MS) return null;
    } catch {
      /* no storage: check */
    }
  }
  const remote = (await getJson(`${REMOTE}districts-meta.json`)) as SnapshotMeta;
  try {
    localStorage.setItem(CHECKED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  if (!isNewerList(remote, current)) return null;
  const raw = await getJson(`${REMOTE}districts.json`, 120_000);
  const list: DistrictList = { ...decodeSnapshot(raw), source: 'update' };
  if (list.meta!.version !== remote.version || list.districts.length < 1000) throw new Error('Niespójne dane obwodów');
  await putBdl(STORED_KEY, raw);
  return list;
}
