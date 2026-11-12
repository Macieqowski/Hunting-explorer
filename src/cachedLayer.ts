// A Leaflet WMS tile layer that keeps tiles on the device and shows them without signal.
//
// For each tile: a stored copy younger than FRESH_MS is shown straight away; otherwise the
// tile is fetched (with retries, Geoportal sometimes answers 404 for a moment), shown and
// stored. Without signal the stored copy is used however old, and when the tile is missing
// a lower-zoom stored tile is scaled up, so zooming in past a saved area's detail still
// shows something.

import L from 'leaflet';
import { getTile, putViewedTile } from './offlineStore';
import { wmsBlockUrl, wmsTileUrl, type WmsDef } from './tiles';

const FRESH_MS = 30 * 24 * 3600 * 1000;
/** Hosts that answered without CORS headers: tiles are shown directly and not stored. */
const noCors = new Set<string>();

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches a tile as a blob, retrying short server hiccups. Throws TypeError on network/CORS failure. */
export async function fetchTile(url: string, tries = 4): Promise<Blob> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(400 * 3 ** (i - 1));
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) return await res.blob();
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
      if (!navigator.onLine) break;
    }
  }
  throw last;
}

/** Share of near-white pixels in an image or a square part of one (sampled). */
async function whiteShare(src: Blob | ImageBitmap, sx = 0, sy = 0, size = 0): Promise<number> {
  try {
    const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    if (size) ctx.drawImage(bmp, sx, sy, size, size, 0, 0, 32, 32);
    else ctx.drawImage(bmp, 0, 0, 32, 32);
    if (src instanceof Blob) bmp.close?.();
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] >= 248 && d[i + 1] >= 248 && d[i + 2] >= 248) white++;
    return white / (d.length / 4);
  } catch {
    return 0;
  }
}

/** Fetches the tile for a layer, trying the fallback server when the answer is blank white. */
export async function fetchLayerTile(def: WmsDef, url: string): Promise<Blob> {
  const blob = await fetchTile(url);
  if (!def.blankFallback || (await whiteShare(blob)) < 0.4) return blob;
  try {
    return await fetchTile(url.replace(def.url, def.blankFallback), 3);
  } catch {
    return blob;
  }
}

function cut(bmp: ImageBitmap, col: number, row: number, mime: string): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no canvas'));
  ctx.drawImage(bmp, col * 256, row * 256, 256, 256, 0, 0, 256, 256);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, 0.9),
  );
}

/**
 * Fetches an n×n block of tiles (top-left x, y) as one image and cuts it into tiles.
 * Returns blobs for the wanted [x, y] tiles, keyed by tile URL. Tiles that come out blank
 * white are taken from the fallback server's block instead.
 */
export async function fetchLayerBlock(def: WmsDef, z: number, x: number, y: number, n: number, wanted: [number, number][]): Promise<Map<string, Blob>> {
  const block = await fetchTile(wmsBlockUrl(def, z, x, y, n), 3);
  const bmp = await createImageBitmap(block);
  let fallback: ImageBitmap | null | undefined;
  const out = new Map<string, Blob>();
  try {
    for (const [tx, ty] of wanted) {
      const col = tx - x, row = ty - y;
      let src = bmp;
      if (def.blankFallback && (await whiteShare(bmp, col * 256, row * 256, 256)) >= 0.4) {
        if (fallback === undefined)
          fallback = await fetchTile(wmsBlockUrl({ ...def, url: def.blankFallback }, z, x, y, n), 3)
            .then((b) => createImageBitmap(b))
            .catch(() => null);
        if (fallback) src = fallback;
      }
      out.set(wmsTileUrl(def, z, tx, ty), await cut(src, col, row, def.format));
    }
  } finally {
    bmp.close?.();
    fallback?.close?.();
  }
  return out;
}

/** A lower-zoom stored tile, cropped and scaled to stand in for (z, x, y). */
async function ancestorCanvas(def: WmsDef, z: number, x: number, y: number): Promise<HTMLCanvasElement | null> {
  for (let k = 1; k <= 8 && z - k >= 0; k++) {
    const hit = await getTile(wmsTileUrl(def, z - k, x >> k, y >> k));
    if (!hit) continue;
    try {
      const bmp = await createImageBitmap(hit.blob);
      const size = 256 / 2 ** k;
      const sx = (x - ((x >> k) << k)) * size;
      const sy = (y - ((y >> k) << k)) * size;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bmp, sx, sy, size, size, 0, 0, 256, 256);
      bmp.close?.();
      return c;
    } catch {
      return null;
    }
  }
  return null;
}

export class CachedWmsLayer extends L.TileLayer {
  private def: WmsDef;

  constructor(def: WmsDef, options: L.TileLayerOptions = {}) {
    super('', { maxNativeZoom: def.maxNative, maxZoom: 20, ...options });
    this.def = def;
  }

  getTileUrl(coords: L.Coords): string {
    return wmsTileUrl(this.def, coords.z, coords.x, coords.y);
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    // Leaflet positions and sizes whatever element we return; a canvas may replace the image.
    const wrap = document.createElement('div');
    wrap.appendChild(img);
    img.style.width = img.style.height = '100%';
    img.style.display = 'block';
    void this.load(coords, img, wrap, done);
    return wrap;
  }

  private async load(coords: L.Coords, img: HTMLImageElement, wrap: HTMLElement, done: L.DoneCallback) {
    const { z, x, y } = coords;
    const def = this.def;
    const url = wmsTileUrl(def, z, x, y);
    const showBlob = (b: Blob) => {
      const src = URL.createObjectURL(b);
      img.onload = () => {
        URL.revokeObjectURL(src);
        done(undefined, wrap);
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        done(new Error('bad tile'), wrap);
      };
      img.src = src;
    };
    const showDirect = (corsSuspected = false) => {
      img.onload = () => {
        if (corsSuspected) noCors.add(hostOf(url));
        done(undefined, wrap);
      };
      img.onerror = () => done(new Error('tile failed'), wrap);
      img.src = url;
    };
    const showAncestor = async () => {
      const c = await ancestorCanvas(def, z, x, y);
      if (!c) return false;
      c.style.width = c.style.height = '100%';
      c.style.display = 'block';
      img.replaceWith(c);
      done(undefined, wrap);
      return true;
    };

    if (!def.cache || noCors.has(hostOf(url))) return showDirect();

    const stored = await getTile(url);
    const online = navigator.onLine;
    if (stored && (!online || Date.now() - stored.t < FRESH_MS)) return showBlob(stored.blob);
    if (!online) {
      if (!(await showAncestor())) done(new Error('offline'), wrap);
      return;
    }
    try {
      const blob = await fetchLayerTile(def, url);
      showBlob(blob);
      void putViewedTile(url, blob);
    } catch (e) {
      if (stored) return showBlob(stored.blob);
      if (await showAncestor()) return;
      // A network-level failure while online usually means no CORS headers: show the tile
      // the plain way, uncached, and stop trying fetch for this server.
      if (navigator.onLine) showDirect(e instanceof TypeError);
      else done(new Error('offline'), wrap);
    }
  }
}

export const cachedWms = (def: WmsDef, options: L.TileLayerOptions = {}) => new CachedWmsLayer(def, options);
