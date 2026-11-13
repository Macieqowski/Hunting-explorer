// A Leaflet WMS tile layer that keeps tiles on the device and shows them without signal.
//
// For each tile something shows straight away when the device has it: the kept tile, or a
// kept tile from a few zooms up, cropped and scaled (zooming in past a saved area's detail).
// With signal, a missing or month-old tile is then fetched (with retries, Geoportal sometimes
// answers 404 for a moment), swapped in and kept. Without signal the kept copy is used however
// old, and a lower-zoom kept tile is scaled up from as far as eight zooms up.

import L from 'leaflet';
import { getTile, putViewedTile } from './offlineStore';
import { wmsBlockUrl, wmsTileUrl, zoomUpTo, type WmsDef } from './tiles';
import { wmtsTile } from './wmtsSave';

const FRESH_MS = 30 * 24 * 3600 * 1000;
/**
 * How many zooms up a kept tile may be scaled to stand in while the sharp tile loads. A saved
 * area's zoom 16 photo then still covers zoom 19 (8×, the map's deepest zoom shows zoom 19
 * tiles) at once instead of a blank map while Geoportal takes seconds per tile.
 */
const PREVIEW_LEVELS = 4;
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
export async function fetchTile(url: string, tries = 4, signal?: AbortSignal): Promise<Blob> {
  let last: unknown = new Error('aborted');
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(400 * 3 ** (i - 1));
    if (signal?.aborted) break;
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) return await res.blob();
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
      if (signal?.aborted || !navigator.onLine) break;
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
export async function fetchLayerTile(def: WmsDef, url: string, signal?: AbortSignal): Promise<Blob> {
  const blob = await fetchTile(url, 4, signal);
  if (!def.blankFallback || (await whiteShare(blob)) < 0.4) return blob;
  try {
    return await fetchTile(url.replace(def.url, def.blankFallback), 3, signal);
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

/** A stored tile from at most `levels` zooms up, cropped and scaled to stand in for (z, x, y). */
async function ancestorCanvas(def: WmsDef, z: number, x: number, y: number, levels: number): Promise<HTMLCanvasElement | null> {
  for (let k = 1; k <= levels && z - k >= 0; k++) {
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

/** A tile element; `complete` tells Leaflet it has a picture (see the constructor). */
type TileEl = HTMLElement & { complete?: boolean };

export class CachedWmsLayer extends L.TileLayer {
  private def: WmsDef;
  /** Loads in progress, per tile element, so a tile no longer needed stops downloading. */
  private loads = new WeakMap<HTMLElement, AbortController>();

  constructor(def: WmsDef, options: L.TileLayerOptions = {}) {
    super('', { ...zoomUpTo(def.maxNative), ...options });
    this.def = def;
    // Tiles scrolled or zoomed out of view stop loading: the browser asks a server only a few
    // tiles at a time, so they would hold up the tiles in view.
    this.on('tileunload tileabort', (e) => this.loads.get((e as L.TileEvent).tile)?.abort());
  }

  getTileUrl(coords: L.Coords): string {
    return wmsTileUrl(this.def, coords.z, coords.x, coords.y);
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    // Leaflet positions and sizes whatever element we return; a canvas may replace the image.
    const wrap: TileEl = document.createElement('div');
    wrap.appendChild(img);
    img.style.width = img.style.height = '100%';
    img.style.display = 'block';
    const ctrl = new AbortController();
    this.loads.set(wrap, ctrl);
    // On a zoom change Leaflet drops the old zoom's tiles whose element is not `complete` (meant
    // for <img>). Ours are <div>s, so without this flag it dropped even finished tiles and the
    // map went blank until the new zoom's tiles came, instead of showing the old ones scaled.
    const finish: L.DoneCallback = (err, el) => {
      if (!err) wrap.complete = true;
      done(err, el);
    };
    void this.load(coords, img, wrap, finish, ctrl.signal);
    return wrap;
  }

  private async load(coords: L.Coords, img: HTMLImageElement, wrap: HTMLElement, done: L.DoneCallback, signal: AbortSignal) {
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
      signal.addEventListener('abort', () => {
        img.onload = img.onerror = null;
        img.src = L.Util.emptyImageUrl;
      });
      img.src = url;
    };
    const showAncestor = async (levels: number) => {
      const c = await ancestorCanvas(def, z, x, y, levels);
      if (!c) return false;
      c.style.width = c.style.height = '100%';
      c.style.display = 'block';
      img.replaceWith(c);
      done(undefined, wrap);
      return true;
    };
    /** Puts a tile from the server in place of what the tile shows now. */
    const swapIn = (b: Blob) => {
      const src = URL.createObjectURL(b);
      const next = document.createElement('img');
      next.alt = '';
      next.setAttribute('role', 'presentation');
      next.style.cssText = 'width:100%;height:100%;display:block';
      next.onload = () => {
        URL.revokeObjectURL(src);
        if (!signal.aborted) wrap.replaceChildren(next);
      };
      next.onerror = () => URL.revokeObjectURL(src);
      next.src = src;
    };

    if (!def.cache || noCors.has(hostOf(url))) return showDirect();

    const stored = await getTile(url);
    const online = navigator.onLine;
    // Something shows at once when the device has it: the kept tile, or a kept tile from a few
    // zooms up scaled to fit (a saved area seen closer than it was saved).
    let shown = false;
    if (stored) {
      showBlob(stored.blob);
      shown = true;
    } else shown = await showAncestor(online ? PREVIEW_LEVELS : 8);
    if (!online || (stored && Date.now() - stored.t < FRESH_MS)) {
      if (!shown) done(new Error('offline'), wrap);
      return;
    }
    if (signal.aborted) return;
    // With signal, a missing or month-old tile comes from the server and replaces the stand-in.
    try {
      // Layers with WMTS (photo, topographic map) come from its ready-made tiles: a fraction of
      // a second instead of seconds, and the same picture a saved area has. WMS if that fails.
      const blob = def.wmts
        ? await wmtsTile(def, z, x, y).catch((e) => {
            if (signal.aborted) throw e;
            return fetchLayerTile(def, url, signal);
          })
        : await fetchLayerTile(def, url, signal);
      void putViewedTile(url, blob);
      if (signal.aborted) return;
      if (shown) swapIn(blob);
      else showBlob(blob);
    } catch (e) {
      if (shown || signal.aborted) return;
      if (await showAncestor(8)) return;
      // A network-level failure while online usually means no CORS headers: show the tile
      // the plain way, uncached, and stop trying fetch for this server.
      if (navigator.onLine) showDirect(e instanceof TypeError);
      else done(new Error('offline'), wrap);
    }
  }
}

export const cachedWms = (def: WmsDef, options: L.TileLayerOptions = {}) => new CachedWmsLayer(def, options);
