// The work of saving an area, as the app's own downloader (TileDownloadService.java) takes it.

import type { TileDownloadSource, TileDownloadUnit } from './native';
import { tileFileName } from './tileFiles';
import { wmsBlockUrl, type WmsDef } from './tiles';

/** Work comes in units: one tile, or for layers drawn in blocks, the tiles of one n×n block. */
export type Unit = { def: WmsDef; z: number; x: number; y: number; n: number; tiles: { url: string; x: number; y: number }[] };

/** What the app's downloader fetches for a unit: the block image, or the tile itself if only one is missing. */
export function nativeUnit(u: Unit): TileDownloadUnit {
  const m = u.def.format;
  if (u.def.wmts)
    return { s: u.def.id, z: u.z, x: u.x, y: u.y, n: u.n, m, t: u.tiles.map((t) => [t.x - u.x, t.y - u.y, tileFileName(t.url, m)] as [number, number, string]) };
  const fb = u.def.blankFallback;
  if (u.tiles.length === 1) {
    const t = u.tiles[0];
    return { u: t.url, ...(fb ? { f: t.url.replace(u.def.url, fb) } : {}), n: 1, m, t: [[0, 0, tileFileName(t.url, m)]] };
  }
  return {
    u: wmsBlockUrl(u.def, u.z, u.x, u.y, u.n),
    ...(fb ? { f: wmsBlockUrl({ ...u.def, url: fb }, u.z, u.x, u.y, u.n) } : {}),
    n: u.n,
    m,
    t: u.tiles.map((t) => [t.x - u.x, t.y - u.y, tileFileName(t.url, m)] as [number, number, string]),
  };
}

/** The WMTS sources the units use, as the app's downloader takes them. */
export function nativeSources(units: Unit[]): Record<string, TileDownloadSource> {
  const out: Record<string, TileDownloadSource> = {};
  for (const { def } of units)
    if (def.wmts && !out[def.id])
      out[def.id] = {
        t: def.wmts.template('HighResolution'),
        ...(def.blankFallback ? { f: def.wmts.template('StandardResolution') } : {}),
        scales: def.wmts.scales,
        e: def.wmts.e,
        n: def.wmts.n,
        size: def.wmts.size,
      };
  return out;
}
