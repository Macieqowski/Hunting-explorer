// Offline maps: saving areas for use without signal, keeping BDL answers, and network status.

import {
  fetchDistrictsByIds,
  fetchOutlinesInBounds,
  networkTransport,
  pointInRing,
  setOfflineDistricts,
  setTransport,
  type DistrictWithGeometry,
} from './bdl';
import { fetchLayerBlock, fetchLayerTile } from './cachedLayer';
import { tt } from './i18n';
import { nativeTileDownload } from './native';
import { limiter, nativeSources, nativeUnit, type Unit } from './offlineJob';
import { WMTS_CONCURRENCY, wmtsTile } from './wmtsSave';
import {
  deleteArea,
  getAreaKeys,
  getBdl,
  hasTile,
  listAreas,
  putArea,
  putAreaKeys,
  putAreaTile,
  putBdl,
  recordAreaFiles,
  refTile,
  type SavedArea,
} from './offlineStore';
import { tileFileName } from './tileFiles';
import { estimate, boxKm2, boxOf, padBox, savePlan, tileLister, wmsTileUrl, type Box, type Detail, type TileArea } from './tiles';

export type { SavedArea } from './offlineStore';

/** Largest map view that can be saved at once, in km² (a large club is about 300). */
export const MAX_VIEW_KM2 = 400;
/** Images a WMS server draws at once for a save: more only queue on the server. */
const CONCURRENCY = 6;
/**
 * Requests the app's downloader (TileDownloadService.java) makes at once: WMTS tiles come from
 * a cache and get faster with more (see WMTS_CONCURRENCY); WMS servers draw each image and do not
 * (Nov 2026: 6 → 24 at once stayed at 10-16 tiles/s).
 */
const NATIVE_CONCURRENCY = WMTS_CONCURRENCY;
const NATIVE_WMS_CONCURRENCY = 6;

let areas: SavedArea[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const onOfflineChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
export const savedAreas = () => areas;

// ---------------------------------------------------------------- network status

export const isOnline = () => navigator.onLine;

// ---------------------------------------------------------------- BDL answers

// Answers for a viewport or a clicked point are unique and not worth keeping; everything
// else (the district list, districts by id) is kept and served when the server is out of reach.
const keepAnswer = (url: string) => !/esriGeometryEnvelope|esriGeometryPoint/.test(url);

async function cachingTransport(url: string): Promise<unknown> {
  const keep = keepAnswer(url);
  if (navigator.onLine) {
    try {
      const data = await networkTransport(url);
      if (keep && data && !(data as { error?: unknown }).error) void putBdl(url, data);
      return data;
    } catch (e) {
      const c = keep ? await getBdl(url) : undefined;
      if (c !== undefined) return c;
      throw e;
    }
  }
  const c = keep ? await getBdl(url) : undefined;
  if (c !== undefined) return c;
  throw new Error(document.documentElement.lang === 'en' ? 'No connection and no saved data' : 'Brak połączenia i zapisanych danych');
}

function savedDistricts(): DistrictWithGeometry[] {
  const seen = new Set<number>();
  const out: DistrictWithGeometry[] = [];
  for (const a of areas)
    for (const d of a.districts)
      if (!seen.has(d.attributes.objectid)) {
        seen.add(d.attributes.objectid);
        out.push(d);
      }
  return out;
}

function containsPoint(d: DistrictWithGeometry, lat: number, lng: number) {
  return d.geometry.some((poly) => pointInRing([lat, lng], poly[0]) && !poly.slice(1).some((h) => pointInRing([lat, lng], h)));
}

// ---------------------------------------------------------------- start

let started = false;

/** Call once at startup. */
export async function initOffline(): Promise<void> {
  if (started) return;
  started = true;
  setTransport(cachingTransport);
  setOfflineDistricts({
    atPoint(lat, lng) {
      const all = savedDistricts();
      if (!all.length) return null;
      return all.filter((d) => containsPoint(d, lat, lng));
    },
    inBounds(s, w, n, e) {
      const all = savedDistricts();
      if (!all.length) return null;
      return all
        .filter((d) => {
          const b = boxOf(d.geometry);
          return b && b[0] <= n && b[2] >= s && b[1] <= e && b[3] >= w;
        })
        .map((d) => ({
          objectid: d.attributes.objectid,
          number: d.attributes.hunt_dist_nr,
          holder: d.attributes.lease_holder_name,
          geometry: d.geometry,
        }));
    },
  });
  areas = await listAreas();
  emit();
  for (const a of areas) if (a.status === 'downloading') queue(a.id, false);
  window.addEventListener('online', () => {
    for (const a of areas) if (a.status !== 'done' && !jobs.has(a.id)) queue(a.id, false);
    emit();
  });
  window.addEventListener('offline', emit);
}

// ---------------------------------------------------------------- planning a save

export interface AreaTarget {
  kind: SavedArea['kind'];
  name: string;
  ids: number[];
  /** For a plain map view. */
  box?: Box;
}

export interface Draft extends AreaTarget {
  districts: DistrictWithGeometry[];
  boxes: Box[];
}

/** Loads district shapes and works out the boxes to save. Needs signal. */
export async function prepareDraft(target: AreaTarget): Promise<Draft> {
  let ids = target.ids;
  if (target.box && !ids.length) {
    const [s, w, n, e] = target.box;
    // Districts in view are a bonus; the base maps can be saved without them.
    const outlines = await fetchOutlinesInBounds(s, w, n, e, 0.001, 1).catch(() => []);
    ids = outlines.map((o) => o.objectid).slice(0, 40);
  }
  // One request per district, the same ones the district page and hunt map make, so
  // those answers are kept for offline use too.
  const districts: DistrictWithGeometry[] = [];
  for (const id of ids) {
    const got = fetchDistrictsByIds([id], 0.00005);
    districts.push(...(await (target.box ? got.catch(() => []) : got)));
  }
  if (target.kind === 'club' && ids.length > 1) await fetchDistrictsByIds(ids).catch(() => []);
  const boxes: Box[] = target.box
    ? [target.box]
    : (districts.map((d) => boxOf(d.geometry)).filter(Boolean) as Box[]).map((b) => padBox(b, 0.08));
  return { ...target, ids, districts, boxes };
}

export const draftKm2 = (d: Draft) => d.boxes.reduce((s, b) => s + boxKm2(b), 0);

/** The tiles to save: near the districts' shapes, or the whole box for a plain map view. */
export function tileAreaOf(a: { boxes: Box[]; districts: DistrictWithGeometry[]; kind: SavedArea['kind'] }): TileArea {
  return a.kind === 'view' ? { boxes: a.boxes } : { boxes: a.boxes, shapes: a.districts.map((d) => d.geometry) };
}

const listers = new WeakMap<object, ReturnType<typeof tileLister>>();
/** Size of a draft at a level of detail (cached per draft). */
export function draftEstimate(d: Draft, detail: Detail) {
  let list = listers.get(d);
  if (!list) listers.set(d, (list = tileLister(tileAreaOf(d))));
  return estimate(list, detail);
}

// ---------------------------------------------------------------- downloading

interface Job {
  cancelled: boolean;
}

const jobs = new Map<string, Job>();
let running: Promise<void> = Promise.resolve();

export const isRunning = (id: string) => jobs.has(id);

export async function saveDraft(d: Draft, detail: Detail): Promise<SavedArea> {
  void requestPersistence();
  const a: SavedArea = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: d.name,
    kind: d.kind,
    ids: d.ids,
    boxes: d.boxes,
    detail,
    status: 'downloading',
    total: 0,
    done: 0,
    failed: 0,
    bytes: 0,
    created: Date.now(),
    updated: Date.now(),
    districts: d.districts,
  };
  await putArea(a);
  areas = [a, ...areas];
  emit();
  queue(a.id, false);
  return a;
}

/** Downloads the area again: fresh tiles and district data. */
export async function updateArea(id: string): Promise<void> {
  const a = areas.find((x) => x.id === id);
  if (!a || jobs.has(id)) return;
  if (a.ids.length) {
    try {
      const fresh: DistrictWithGeometry[] = [];
      for (const i of a.ids) fresh.push(...(await fetchDistrictsByIds([i], 0.00005)));
      if (fresh.length) a.districts = fresh;
    } catch {
      /* keep the old shapes */
    }
  }
  await setArea({ ...a, status: 'downloading', done: 0, failed: 0, bytes: 0, updated: Date.now() });
  queue(id, true);
}

export async function removeArea(id: string): Promise<void> {
  const j = jobs.get(id);
  if (j) j.cancelled = true;
  areas = areas.filter((a) => a.id !== id);
  emit();
  await running.catch(() => {});
  await deleteArea(id);
}

export function resumeArea(id: string) {
  if (!jobs.has(id)) queue(id, false);
}

async function setArea(a: SavedArea) {
  areas = areas.map((x) => (x.id === a.id ? a : x));
  await putArea(a);
  emit();
}

function queue(id: string, refresh: boolean) {
  const job: Job = { cancelled: false };
  jobs.set(id, job);
  emit();
  running = running.then(() => download(id, refresh, job)).catch(() => {}).finally(() => {
    if (jobs.get(id) === job) jobs.delete(id);
    emit();
  });
}

async function download(id: string, refresh: boolean, job: Job) {
  let a = areas.find((x) => x.id === id);
  if (!a || job.cancelled) return;
  const units: Unit[] = [];
  let total = 0;
  const held = new Set(await getAreaKeys(id));
  const list = tileLister(tileAreaOf(a));
  for (const p of savePlan(a.detail)) {
    const n = p.def.meta ?? 1;
    const blocks = new Map<string, Unit>();
    for (const [z, x, y] of list(p.minZ, p.maxZ)) {
      total++;
      const url = wmsTileUrl(p.def, z, x, y);
      if (!refresh && held.has(url)) continue;
      const bx = x - (x % n), by = y - (y % n);
      const k = `${z}/${bx}/${by}`;
      let u = blocks.get(k);
      if (!u) blocks.set(k, (u = { def: p.def, z, x: bx, y: by, n, tiles: [] }));
      u.tiles.push({ url, x, y });
    }
    units.push(...blocks.values());
  }
  const todoCount = units.reduce((s, u) => s + u.tiles.length, 0);
  a = { ...a, total, done: total - todoCount, failed: 0, status: 'downloading' };
  await setArea(a);

  const nt = nativeTileDownload();
  if (nt) return downloadInApp(nt, a, units, refresh, job, held);

  let lastSave = Date.now();
  let i = 0;
  const progress = { done: a.done, failed: 0, bytes: refresh ? 0 : a.bytes };
  const flush = async (final = false) => {
    if (job.cancelled) return;
    const cur = areas.find((x) => x.id === id);
    if (!cur) return;
    await putAreaKeys(id, [...held]);
    await setArea({ ...cur, ...progress, status: final ? (progress.failed || !navigator.onLine ? 'paused' : 'done') : cur.status });
  };
  const store = async (url: string, blob: Blob) => {
    await putAreaTile(url, blob, !held.has(url));
    held.add(url);
    progress.done++;
    progress.bytes += blob.size;
  };

  const worker = async () => {
    while (!job.cancelled) {
      const unit = units[i++];
      if (!unit) return;
      // A tile another area already holds only needs another reference.
      const need: Unit['tiles'] = [];
      for (const t of unit.tiles) {
        try {
          if (!refresh && !held.has(t.url) && (await hasTile(t.url)) && (await refTile(t.url))) {
            held.add(t.url);
            progress.done++;
          } else need.push(t);
        } catch {
          need.push(t);
        }
      }
      let single = need;
      // The photo: drawn from WMTS tiles (fast), each tile on its own; WMS only if that fails.
      if (unit.def.wmts && navigator.onLine) {
        single = [];
        for (const t of need) {
          if (job.cancelled) break;
          try {
            await store(t.url, await wmtsTile(unit.def, unit.z, t.x, t.y));
          } catch {
            single.push(t);
          }
        }
      } else if (need.length > 1 && navigator.onLine) {
        try {
          const got = await wms(() => fetchLayerBlock(unit.def, unit.z, unit.x, unit.y, unit.n, need.map((t) => [t.x, t.y])));
          single = [];
          for (const t of need) {
            const blob = got.get(t.url);
            if (blob) await store(t.url, blob);
            else single.push(t);
          }
        } catch {
          // The block failed: try its tiles one by one.
        }
      }
      for (const t of single) {
        if (job.cancelled) break;
        try {
          if (!navigator.onLine) throw new Error('offline');
          await store(t.url, await wms(() => fetchLayerTile(unit.def, t.url)));
        } catch {
          progress.failed++;
        }
      }
      if (Date.now() - lastSave > 1500) {
        lastSave = Date.now();
        await flush();
      }
    }
  };
  // Enough workers to keep the WMTS busy; WMS images are limited to CONCURRENCY at once.
  const wms = limiter(CONCURRENCY);
  await Promise.all(Array.from({ length: units.some((u) => u.def.wmts) ? WMTS_CONCURRENCY : CONCURRENCY }, worker));
  if (!job.cancelled) await flush(true);
}

// ---------------------------------------------------------------- downloading in the app

const T = {
  saving: { pl: 'Zapisywanie mapy', en: 'Saving map' },
  saved: { pl: 'Mapa zapisana', en: 'Map saved' },
  stop: { pl: 'Zatrzymaj', en: 'Stop' },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * App: the phone's own downloader fetches the tiles into files, in a foreground service that
 * goes on with the screen off. This page only records what it wrote, every second while it runs,
 * and catches up at once when Android lets it run again (screen back on).
 */
async function downloadInApp(nt: NonNullable<ReturnType<typeof nativeTileDownload>>, a: SavedArea, units: Unit[], refresh: boolean, job: Job, held: Set<string>) {
  const id = a.id;
  const base = { done: a.done, bytes: refresh ? 0 : a.bytes };
  const pause = async () => {
    const cur = areas.find((x) => x.id === id);
    if (cur && !job.cancelled) await setArea({ ...cur, status: 'paused' });
  };
  try {
    await nt.start({
      id,
      title: `${tt(T.saving)}: ${a.name}`,
      doneTitle: `${tt(T.saved)}: ${a.name}`,
      stopLabel: tt(T.stop),
      refresh,
      concurrency: NATIVE_CONCURRENCY,
      wmsConcurrency: NATIVE_WMS_CONCURRENCY,
      sources: nativeSources(units),
      units: units.map(nativeUnit),
    });
  } catch {
    // Android does not let a service start while the app is in the background: resume later.
    return pause();
  }
  let since = 0;
  let got = 0;
  let gotBytes = 0;
  let keysSaved = Date.now();
  for (;;) {
    if (job.cancelled) {
      await nt.cancel({ id }).catch(() => {});
      await nt.forget({ id }).catch(() => {});
      return;
    }
    const s = await nt.status({ id, since }).catch(() => ({ state: 'none' as const }));
    if (s.state === 'none') return pause();
    const entries = (s.results ?? []).map(([ui, ti, size]) => {
      const u = units[ui];
      const url = u.tiles[ti].url;
      got++;
      gotBytes += size;
      return { url, f: tileFileName(url, u.def.format) };
    });
    await recordAreaFiles(entries, held);
    for (const e of entries) held.add(e.url);
    since = s.next ?? since;
    const finished = s.state === 'done' || s.state === 'cancelled';
    const cur = areas.find((x) => x.id === id);
    if (!cur || job.cancelled) continue;
    if (finished || (entries.length && Date.now() - keysSaved > 3000)) {
      await putAreaKeys(id, [...held]);
      keysSaved = Date.now();
    }
    const done = base.done + got;
    const failed = s.failed ?? 0;
    const status = finished ? (failed || done < cur.total ? 'paused' : 'done') : 'downloading';
    await setArea({ ...cur, done, failed, bytes: base.bytes + gotBytes, status });
    if (finished) {
      await nt.forget({ id }).catch(() => {});
      return;
    }
    await sleep(1000);
  }
}

// ---------------------------------------------------------------- storage

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function storageInfo(): Promise<StorageInfo> {
  const s = navigator.storage;
  const est = s?.estimate ? await s.estimate().catch(() => null) : null;
  const persisted = s?.persisted ? await s.persisted().catch(() => null) : null;
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isInstalled(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
