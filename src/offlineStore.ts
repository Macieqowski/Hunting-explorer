// IndexedDB storage for offline maps: tiles, saved areas and cached BDL answers.
//
// tiles:    url -> { b: Blob, t: stored at, r: number of saved areas using it }
//           Tiles with r = 0 are "viewed" tiles, dropped oldest first beyond VIEWED_CAP.
//           In the app, tiles of saved areas are files (see tileFiles.ts) and the record has
//           { f: file name } instead of b, so Android cannot clear them with the WebView's data.
// areas:    saved areas (see SavedArea)
// areaKeys: area id -> urls of the tiles it holds
// bdl:      BDL query url -> JSON answer

import type { DistrictWithGeometry } from './bdl';
import type { Box, Detail } from './tiles';
import { isApp } from './platform';
import { deleteTileFiles, readTileFile, writeTileFile } from './tileFiles';

export interface SavedArea {
  id: string;
  name: string;
  kind: 'district' | 'club' | 'view' | 'hunt';
  /** BDL object ids of the districts in the area (empty for a plain map view). */
  ids: number[];
  boxes: Box[];
  detail: Detail;
  status: 'downloading' | 'paused' | 'done';
  total: number;
  done: number;
  failed: number;
  bytes: number;
  created: number;
  updated: number;
  districts: DistrictWithGeometry[];
  /** Repairs done on the area's saved tiles (REPAIR_VERSION in offline.ts); missing on older saves. */
  repaired?: number;
}

interface TileRec {
  b?: Blob;
  /** App: the tile's file in the app's storage. */
  f?: string;
  t: number;
  r: number;
}

/** Saved-area tiles go to files in the app. */
const useFiles = () => isApp();

const DB_NAME = 'hunting-offline';
/** Viewed (not saved) tiles kept, about 150 MB. */
export const VIEWED_CAP = 6000;

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const d = req.result;
        if (e.oldVersion < 1) {
          d.createObjectStore('tiles').createIndex('t', 't');
          d.createObjectStore('areas', { keyPath: 'id' });
          d.createObjectStore('areaKeys');
          d.createObjectStore('bdl');
        }
        // Version 2: tiles by [uses, time], so the viewed tiles (uses 0) are found oldest first
        // without reading every record. A saved area of 35 000 tiles made the old full scan hold
        // the tile store for many seconds on a slow phone, and the map waited for it.
        if (e.oldVersion < 2) req.transaction!.objectStore('tiles').createIndex('rt', ['r', 't']);
      };
      // Another tab still has version 1 open: it is asked to let go (see onversionchange below).
      req.onblocked = () => {};
      req.onsuccess = () => {
        const d = req.result;
        // A newer version opened elsewhere (another tab after an update): close so it can upgrade.
        d.onversionchange = () => {
          d.close();
          dbp = null;
        };
        resolve(d);
      };
      req.onerror = () => reject(req.error);
    });
    dbp.catch(() => (dbp = null));
  }
  return dbp;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

async function store(name: string, mode: IDBTransactionMode = 'readonly') {
  const tx = (await db()).transaction(name, mode);
  return { s: tx.objectStore(name), tx };
}

// ---------------------------------------------------------------- tiles

export async function getTile(url: string): Promise<{ blob: Blob; t: number } | null> {
  try {
    const { s } = await store('tiles');
    const r = (await done(s.get(url))) as TileRec | undefined;
    if (!r) return null;
    if (r.b) return { blob: r.b, t: r.t };
    if (r.f) return { blob: await readTileFile(r.f), t: r.t };
    return null;
  } catch {
    return null;
  }
}

export async function hasTile(url: string): Promise<boolean> {
  const { s } = await store('tiles');
  return (await done(s.getKey(url))) !== undefined;
}

let viewedPuts = 0;

/** Keeps a tile the user looked at. */
export async function putViewedTile(url: string, blob: Blob): Promise<void> {
  try {
    const old = await getRec(url);
    // A saved tile kept as a file: refresh the file.
    const rec: TileRec = old?.f ? { f: await writeTileFile(url, blob), t: Date.now(), r: old.r } : { b: blob, t: Date.now(), r: old?.r ?? 0 };
    const { s, tx } = await store('tiles', 'readwrite');
    s.put(rec, url);
    await txDone(tx);
    if (++viewedPuts % 300 === 0) void evictViewed();
  } catch {
    /* storage full or unavailable: viewing still works */
  }
}

/** Stores a tile for a saved area. `addRef` is false when the area already held it (update). */
export async function putAreaTile(url: string, blob: Blob, addRef: boolean): Promise<void> {
  // The file is written before the record that points at it.
  const f = useFiles() ? await writeTileFile(url, blob) : undefined;
  const { s, tx } = await store('tiles', 'readwrite');
  const old = (await done(s.get(url))) as TileRec | undefined;
  const r = (old?.r ?? 0) + (addRef ? 1 : 0);
  s.put((f ? { f, t: Date.now(), r } : { b: blob, t: Date.now(), r }) satisfies TileRec, url);
  await txDone(tx);
}

/**
 * App: records tiles the native downloader already wrote as files (see TileDownloadService).
 * `held` are the tiles the area already had, which get no extra reference. One transaction.
 */
export async function recordAreaFiles(entries: { url: string; f: string }[], held: Set<string>): Promise<void> {
  if (!entries.length) return;
  const { s, tx } = await store('tiles', 'readwrite');
  const now = Date.now();
  for (const { url, f } of entries) {
    const req = s.get(url);
    req.onsuccess = () => {
      const old = req.result as TileRec | undefined;
      const r = (old?.r ?? 0) + (held.has(url) ? 0 : 1);
      s.put({ f, t: now, r } satisfies TileRec, url);
    };
  }
  await txDone(tx);
}

async function getRec(url: string): Promise<TileRec | undefined> {
  const { s } = await store('tiles');
  return (await done(s.get(url))) as TileRec | undefined;
}

/** Marks an already stored tile as used by one more area; false if it is not stored. */
export async function refTile(url: string): Promise<boolean> {
  const old = await getRec(url);
  if (!old) return false;
  // A viewed tile becomes a saved one: in the app it moves to a file.
  const f = useFiles() && old.b && !old.f ? await writeTileFile(url, old.b) : undefined;
  const { s, tx } = await store('tiles', 'readwrite');
  const cur = (await done(s.get(url))) as TileRec | undefined;
  if (!cur) {
    tx.abort();
    return false;
  }
  s.put(f ? { f, t: cur.t, r: cur.r + 1 } : { ...cur, r: cur.r + 1 }, url);
  await txDone(tx);
  return true;
}

/** Viewed (not saved) tiles, oldest first, in the [uses, time] index. */
const VIEWED = () => IDBKeyRange.bound([-Infinity, -Infinity], [0, Infinity]);

/** Drops the oldest viewed tiles beyond the cap. Saved-area tiles are never dropped here. */
export async function evictViewed(cap = VIEWED_CAP): Promise<number> {
  const { s, tx } = await store('tiles', 'readwrite');
  const idx = s.index('rt');
  const count = await done(idx.count(VIEWED()));
  const extra = count - cap;
  if (extra <= 0) {
    await txDone(tx);
    return 0;
  }
  const gone: { key: IDBValidKey; f?: string }[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = idx.openCursor(VIEWED());
    req.onsuccess = () => {
      const c = req.result;
      if (!c || gone.length >= extra) return resolve();
      const v = c.value as TileRec;
      gone.push({ key: c.primaryKey, f: v.f });
      c.delete();
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  // Files of tiles no saved area uses any more go with their records, unless the same tile
  // was stored again meanwhile (same URL, same file name).
  const files: string[] = [];
  for (const g of gone) if (g.f && !(await getRec(String(g.key)).catch(() => undefined))) files.push(g.f);
  await deleteTileFiles(files);
  return gone.length;
}

/**
 * Drops viewed (not saved) tiles whose key starts with `prefix`: a cache only, fetched again with
 * signal. For tiles that may have been kept wrong (black photo, Nov 2026).
 */
export async function dropViewed(prefix: string): Promise<number> {
  const { s, tx } = await store('tiles', 'readwrite');
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
  const files: string[] = [];
  let n = 0;
  await new Promise<void>((resolve, reject) => {
    const req = s.openCursor(range);
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve();
      const v = c.value as TileRec;
      if (v.r <= 0) {
        if (v.f) files.push(v.f);
        c.delete();
        n++;
      }
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  await deleteTileFiles(files);
  return n;
}

/** Share of near-black pixels in a tile, sampled on a 32×32 grid (0 if it cannot be read). */
export async function blackShare(blob: Blob): Promise<number> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(bmp, 0, 0, 32, 32);
    bmp.close?.();
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let black = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] <= BLACK && d[i + 1] <= BLACK && d[i + 2] <= BLACK) black++;
    return black / (d.length / 4);
  } catch {
    return 0;
  }
}
/** Darkest a channel may be to count as black; same as TileDownloadService.looksBlack. */
const BLACK = 6;

// ---------------------------------------------------------------- areas

export async function listAreas(): Promise<SavedArea[]> {
  try {
    const { s } = await store('areas');
    const all = (await done(s.getAll())) as SavedArea[];
    return all.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

export async function putArea(a: SavedArea): Promise<void> {
  const { s, tx } = await store('areas', 'readwrite');
  s.put(a);
  await txDone(tx);
}

export async function getAreaKeys(id: string): Promise<string[]> {
  const { s } = await store('areaKeys');
  return ((await done(s.get(id))) as string[] | undefined) ?? [];
}

export async function putAreaKeys(id: string, keys: string[]): Promise<void> {
  const { s, tx } = await store('areaKeys', 'readwrite');
  s.put(keys, id);
  await txDone(tx);
}

/** Removes an area. Its tiles stay as viewed tiles until evicted, unless another area uses them. */
export async function deleteArea(id: string): Promise<void> {
  const keys = await getAreaKeys(id);
  const d = await db();
  const tx = d.transaction(['tiles', 'areas', 'areaKeys'], 'readwrite');
  const tiles = tx.objectStore('tiles');
  const now = Date.now();
  for (const k of keys) {
    const req = tiles.get(k);
    req.onsuccess = () => {
      const r = req.result as TileRec | undefined;
      if (r) tiles.put({ ...r, r: Math.max(0, r.r - 1), t: now }, k);
    };
  }
  tx.objectStore('areas').delete(id);
  tx.objectStore('areaKeys').delete(id);
  await txDone(tx);
  void evictViewed();
}

// ---------------------------------------------------------------- BDL answers

export async function getBdl(url: string): Promise<unknown | undefined> {
  try {
    const { s } = await store('bdl');
    return await done(s.get(url));
  } catch {
    return undefined;
  }
}

export async function putBdl(url: string, data: unknown): Promise<void> {
  try {
    const { s, tx } = await store('bdl', 'readwrite');
    s.put(data, url);
    await txDone(tx);
  } catch {
    /* ignore */
  }
}
