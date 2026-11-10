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
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('tiles').createIndex('t', 't');
        d.createObjectStore('areas', { keyPath: 'id' });
        d.createObjectStore('areaKeys');
        d.createObjectStore('bdl');
      };
      req.onsuccess = () => resolve(req.result);
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

/** Drops the oldest viewed tiles beyond the cap. Saved-area tiles are never dropped here. */
export async function evictViewed(cap = VIEWED_CAP): Promise<number> {
  const { s, tx } = await store('tiles', 'readwrite');
  const viewed: { key: IDBValidKey; f?: string }[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = s.index('t').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve();
      const v = c.value as TileRec;
      if (v.r <= 0) viewed.push({ key: c.primaryKey, f: v.f });
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  const extra = viewed.length - cap;
  const gone: { key: IDBValidKey; f?: string }[] = [];
  for (let i = 0; i < extra; i++) {
    s.delete(viewed[i].key);
    if (viewed[i].f) gone.push(viewed[i]);
  }
  await txDone(tx);
  // Files of tiles no saved area uses any more go with their records, unless the same tile
  // was stored again meanwhile (same URL, same file name).
  const files: string[] = [];
  for (const g of gone) if (!(await getRec(String(g.key)).catch(() => undefined))) files.push(g.f!);
  await deleteTileFiles(files);
  return Math.max(0, extra);
}

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
