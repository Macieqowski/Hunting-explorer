// Website: saving the aerial photo for offline use from Geoportal's ready-made WMTS tiles
// (PUWG 1992), redrawn into the web map's tiles in the browser (see puwg92.ts). The app does the
// same natively (TileDownloadService.java); this is for the website and iPhones.

import { fetchTile } from './cachedLayer';
import { fillWhite, groundPixel, level, PIXEL, render, sourcePixels, tileRange, whiteShare, type SourceTile } from './puwg92';
import { limiter } from './offlineJob';
import type { WmsDef } from './tiles';

/**
 * Requests to the WMTS at once. Measured Nov 2026: 16 → 25, 24 → 39, 32 → 50, 48 → 51 images/s
 * (answers then slow down), so 32. Geoportal speaks HTTP/2, so the browser's limit of six
 * connections per server does not apply.
 */
export const WMTS_CONCURRENCY = 32;
const slot = limiter(WMTS_CONCURRENCY);

type Wmts = NonNullable<WmsDef['wmts']>;

/** Decoded source tiles shared by neighbouring tiles: a 512 px tile serves up to ~8 web tiles. */
const CACHE_MAX = 48;
const cache = new Map<string, Promise<SourceTile>>();

function remember(key: string, load: () => Promise<SourceTile>): Promise<SourceTile> {
  const hit = cache.get(key);
  if (hit) {
    // Most recently used last.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const p = load();
  cache.set(key, p);
  p.catch(() => cache.get(key) === p && cache.delete(key));
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return p;
}

const url = (template: string, l: number, r: number, c: number) =>
  template.replace('{L}', String(l)).replace('{r}', String(r)).replace('{c}', String(c));

/** RGBA pixels of a source tile; null where the server has no photo (an empty answer). Throws when fetching fails. */
async function pixels(u: string, size: number): Promise<SourceTile> {
  const blob = await slot(() => fetchTile(u, 4));
  if (!blob.size) return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    if (bmp.width !== size || bmp.height !== size) return null;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, size, size).data;
  } finally {
    bmp.close?.();
  }
}

/** A source tile, its gaps in the high-resolution photo filled from the standard one. */
function source(w: Wmts, fallback: boolean, l: number, r: number, c: number): Promise<SourceTile> {
  return remember(`${l}/${r}/${c}`, async () => {
    const main = await pixels(url(w.template('HighResolution'), l, r, c), w.size);
    if (!fallback || (main && whiteShare(main) < 0.3)) return main;
    const other = await pixels(url(w.template('StandardResolution'), l, r, c), w.size).catch(() => undefined);
    if (other === undefined) return main;
    if (!main) return other;
    if (other) fillWhite(main, other);
    return main;
  });
}

/** Web-map tile (z, x, y) of a layer with `wmts`, drawn from the PUWG 1992 tiles, as an image. */
export async function wmtsTile(def: WmsDef, z: number, x: number, y: number): Promise<Blob> {
  const w = def.wmts;
  if (!w) throw new Error('no wmts');
  const l = level(w.scales, groundPixel(z, y));
  const f = sourcePixels(z, x, y, w.scales[l] * PIXEL, w.e, w.n);
  const [c0, r0, c1, r1] = tileRange(f, w.size);
  if (c1 - c0 > 3 || r1 - r0 > 3) throw new Error('level table');
  const rows = await Promise.all(
    Array.from({ length: r1 - r0 + 1 }, (_, r) => Promise.all(Array.from({ length: c1 - c0 + 1 }, (_, c) => source(w, !!def.blankFallback, l, r0 + r, c0 + c)))),
  );
  const rgba = render(f, rows, c0, r0, w.size);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.putImageData(new ImageData(rgba, 256, 256), 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), def.format, 0.9));
}
