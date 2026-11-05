// IndexedDB storage for offline maps: tiles, saved areas and cached BDL answers.
//
// tiles:    url -> { b: Blob, t: stored at, r: number of saved areas using it }
//           Tiles with r = 0 are "viewed" tiles, dropped oldest first beyond VIEWED_CAP.
// areas:    saved areas (see SavedArea)
// areaKeys: area id -> urls of the tiles it holds
// bdl:      BDL query url -> JSON answer

import type { DistrictWithGeometry } from './bdl';
import type { Box, Detail } from './tiles';

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
  b: Blob;
  t: number;
  r: number;
}

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
    return r ? { blob: r.b, t: r.t } : null;
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
    const { s, tx } = await store('tiles', 'readwrite');
    const old = (await done(s.get(url))) as TileRec | undefined;
    s.put({ b: blob, t: Date.now(), r: old?.r ?? 0 } satisfies TileRec, url);
    await txDone(tx);
    if (++viewedPuts % 300 === 0) void evictViewed();
  } catch {
    /* storage full or unavailable: viewing still works */
  }
}

/** Stores a tile for a saved area. `addRef` is false when the area already held it (update). */
export async function putAreaTile(url: string, blob: Blob, addRef: boolean): Promise<void> {
  const { s, tx } = await store('tiles', 'readwrite');
  const old = (await done(s.get(url))) as TileRec | undefined;
  s.put({ b: blob, t: Date.now(), r: (old?.r ?? 0) + (addRef ? 1 : 0) } satisfies TileRec, url);
  await txDone(tx);
}

/** Marks an already stored tile as used by one more area; false if it is not stored. */
export async function refTile(url: string): Promise<boolean> {
  const { s, tx } = await store('tiles', 'readwrite');
  const old = (await done(s.get(url))) as TileRec | undefined;
  if (!old) return false;
  s.put({ ...old, r: old.r + 1 }, url);
  await txDone(tx);
  return true;
}

/** Drops the oldest viewed tiles beyond the cap. Saved-area tiles are never dropped here. */
export async function evictViewed(cap = VIEWED_CAP): Promise<number> {
  const { s, tx } = await store('tiles', 'readwrite');
  const viewed: IDBValidKey[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = s.index('t').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve();
      if ((c.value as TileRec).r <= 0) viewed.push(c.primaryKey);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  const extra = viewed.length - cap;
  for (let i = 0; i < extra; i++) s.delete(viewed[i]);
  await txDone(tx);
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
