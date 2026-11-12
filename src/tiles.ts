// Map tile math and the WMS layers the app can keep for offline use.
//
// Only layers whose terms allow it are cached: Geoportal (GUGiK, free Polish public data)
// and the State Forests BDL overlays. OpenStreetMap, OpenTopoMap and Esri forbid offline
// use and prefetching, so they stay online-only (see map.ts).

import {
  BDL_WMS_DISTRICTS,
  BDL_WMS_ENTRY_BANS,
  BDL_WMS_FIRE,
  BDL_WMS_FORESTS,
} from './bdl';

// Orthophoto: the HighResolution service answers reliably but has white gaps where no
// high-resolution photo exists; StandardResolution covers everything but often answers 404
// (a load balancer that wants its cookie). So HighResolution first, Standard for white tiles.
export const GEOPORTAL_ORTHO_HR = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution';
export const GEOPORTAL_ORTHO_STD = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution';
export const GEOPORTAL_TOPO = 'https://mapy.geoportal.gov.pl/wss/service/img/guest/TOPO/MapServer/WMSServer';

/**
 * Deepest zoom of both maps. Each layer also has the deepest zoom its server draws (OSM 19,
 * OpenTopoMap 17, Geoportal ortho 19…); past that Leaflet scales up the deepest tiles instead
 * of showing nothing. Every layer must reach MAX_ZOOM: a layer whose maxZoom is lower goes
 * blank at the deepest zoom, since the map's own limit comes from the deepest layer.
 */
export const MAX_ZOOM = 20;

/** Leaflet zoom options for a layer whose server draws tiles up to `native`. */
export const zoomUpTo = (native: number) => ({ maxNativeZoom: Math.min(native, MAX_ZOOM), maxZoom: MAX_ZOOM });

export interface WmsDef {
  id: string;
  url: string;
  layers: string;
  format: 'image/png' | 'image/jpeg';
  transparent: boolean;
  /** Highest zoom the server draws in useful detail; Leaflet scales tiles beyond it. */
  maxNative: number;
  /** Tiles may be kept on the device (viewed tiles and saved areas). */
  cache: boolean;
  /** Average tile size in KB, for download estimates. */
  avgKB: number;
  /** Server to ask instead when a tile comes back blank white (same parameters). */
  blankFallback?: string;
  /** Saving asks for n×n tiles in one image and cuts it up: the server takes about as long
   *  to draw a 1024 px image as a 256 px one, so this is several times faster. */
  meta?: number;
}

export const WMS = {
  ortho: { id: 'ortho', url: GEOPORTAL_ORTHO_HR, layers: 'Raster', format: 'image/jpeg', transparent: false, maxNative: 19, cache: true, avgKB: 22, blankFallback: GEOPORTAL_ORTHO_STD, meta: 4 },
  geotopo: { id: 'geotopo', url: GEOPORTAL_TOPO, layers: 'Raster', format: 'image/jpeg', transparent: false, maxNative: 17, cache: true, avgKB: 28, meta: 4 },
  districts: { id: 'districts', url: BDL_WMS_DISTRICTS, layers: '0', format: 'image/png', transparent: true, maxNative: 18, cache: true, avgKB: 6, meta: 4 },
  compartments: { id: 'compartments', url: BDL_WMS_FORESTS, layers: '3,2', format: 'image/png', transparent: true, maxNative: 18, cache: true, avgKB: 10, meta: 4 },
  forests: { id: 'forests', url: BDL_WMS_FORESTS, layers: '5', format: 'image/png', transparent: true, maxNative: 18, cache: true, avgKB: 4 },
  bans: { id: 'bans', url: BDL_WMS_ENTRY_BANS, layers: '3', format: 'image/png', transparent: true, maxNative: 18, cache: true, avgKB: 3 },
  // Fire danger changes daily, so it is never kept.
  fire: { id: 'fire', url: BDL_WMS_FIRE, layers: '0', format: 'image/png', transparent: true, maxNative: 18, cache: false, avgKB: 3 },
} satisfies Record<string, WmsDef>;

/**
 * Deepest zoom the orthophoto is saved at. Geoportal's photo has real detail down to zoom 19,
 * but every zoom takes about four times the tiles of the one before (zoom 19 would be about
 * 1 GB per district), so saving stops at 18 and the map scales the deepest saved tiles beyond.
 */
export type Detail = 16 | 17 | 18;
export const DETAILS: readonly Detail[] = [16, 17, 18];
export const isDetail = (v: unknown): v is Detail => DETAILS.includes(v as Detail);

/** Tiles a save fetches per second, for time estimates (25 to 10 measured, with blocks). */
export const SAVE_TILES_PER_S = 15;

/** What "Save for offline" downloads: layer and zoom range. Only the photo goes deeper than 16. */
export function savePlan(detail: Detail): { def: WmsDef; minZ: number; maxZ: number }[] {
  return [
    { def: WMS.ortho, minZ: 8, maxZ: detail },
    { def: WMS.geotopo, minZ: 8, maxZ: 16 },
    { def: WMS.districts, minZ: 10, maxZ: 16 },
    { def: WMS.compartments, minZ: 12, maxZ: 16 },
  ];
}

const ORIGIN = 20037508.342789244;

/** EPSG:3857 bounding box of a slippy-map tile: [minX, minY, maxX, maxY] in metres. */
export function tileBBox(z: number, x: number, y: number): [number, number, number, number] {
  const size = (2 * ORIGIN) / 2 ** z;
  const minX = -ORIGIN + x * size;
  const maxY = ORIGIN - y * size;
  return [minX, maxY - size, minX + size, maxY];
}

/** GetMap URL of one 256 px tile; also the key it is stored under. */
export function wmsTileUrl(def: WmsDef, z: number, x: number, y: number): string {
  const bbox = tileBBox(z, x, y).map((v) => v.toFixed(2)).join(',');
  return (
    `${def.url}?service=WMS&request=GetMap&version=1.3.0&layers=${encodeURIComponent(def.layers)}&styles=` +
    `&format=${encodeURIComponent(def.format)}&transparent=${def.transparent}&width=256&height=256&crs=EPSG:3857&bbox=${bbox}`
  );
}

/** GetMap URL of an n×n block of tiles whose top-left tile is (x, y), as one image. */
export function wmsBlockUrl(def: WmsDef, z: number, x: number, y: number, n: number): string {
  const [minX, , , maxY] = tileBBox(z, x, y);
  const [, minY, maxX] = tileBBox(z, x + n - 1, y + n - 1);
  const px = 256 * n;
  return wmsTileUrl(def, z, x, y)
    .replace(/width=256&height=256/, `width=${px}&height=${px}`)
    .replace(/bbox=[^&]*$/, `bbox=${[minX, minY, maxX, maxY].map((v) => v.toFixed(2)).join(',')}`);
}

export function lngToX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
export function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** [south, west, north, east] in degrees. */
export type Box = [number, number, number, number];

/** Tile ranges covering a box at one zoom: [x0, x1, y0, y1], inclusive. */
export function tileRange(b: Box, z: number): [number, number, number, number] {
  const max = 2 ** z - 1;
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  return [clamp(lngToX(b[1], z)), clamp(lngToX(b[3], z)), clamp(latToY(b[2], z)), clamp(latToY(b[0], z))];
}

/** Every tile (z/x/y) covering the boxes between two zooms, without duplicates. */
export function tilesForBoxes(boxes: Box[], minZ: number, maxZ: number): [number, number, number][] {
  const seen = new Set<string>();
  const out: [number, number, number][] = [];
  for (let z = minZ; z <= maxZ; z++)
    for (const b of boxes) {
      const [x0, x1, y0, y1] = tileRange(b, z);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const k = `${z}/${x}/${y}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push([z, x, y]);
        }
    }
  return out;
}

/** Pads a box by a fraction of its size on each side. */
export function padBox(b: Box, frac: number): Box {
  const dLat = (b[2] - b[0]) * frac;
  const dLng = (b[3] - b[1]) * frac;
  return [b[0] - dLat, b[1] - dLng, b[2] + dLat, b[3] + dLng];
}

/** Bounding box of a multipolygon in [lat, lng] order. */
export function boxOf(mp: [number, number][][][]): Box | null {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const poly of mp)
    for (const ring of poly)
      for (const [la, ln] of ring) {
        s = Math.min(s, la); n = Math.max(n, la);
        w = Math.min(w, ln); e = Math.max(e, ln);
      }
  return isFinite(s) ? [s, w, n, e] : null;
}

/** What to save: boxes, and optionally the district shapes inside them to stay close to. */
export interface TileArea {
  boxes: Box[];
  /** Multipolygons in [lat, lng] order. When given, only tiles near them are kept. */
  shapes?: [number, number][][][][];
}

/** Distance kept around district shapes, in metres. */
export const SHAPE_BUFFER_M = 300;
const M_PER_DEG = 111320;

function tileCenter(z: number, x: number, y: number): [number, number] {
  const n = 2 ** z;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return [lat, lng];
}

/** Lists tiles of an area per zoom, remembering each zoom's result. */
export function tileLister(area: TileArea, bufferM = SHAPE_BUFFER_M) {
  const memo = new Map<number, [number, number, number][]>();
  const shapes = area.shapes?.filter((s) => s.length) ?? [];
  const refLat = area.boxes.length ? (area.boxes[0][0] + area.boxes[0][2]) / 2 : 52;
  const kx = Math.cos((refLat * Math.PI) / 180) * M_PER_DEG;
  // Rings in local metres, each with its bounding box.
  const rings = shapes.flatMap((mp) =>
    mp.flatMap((poly) =>
      poly.map((ring) => {
        const pts = ring.map(([la, ln]) => [ln * kx, la * M_PER_DEG] as [number, number]);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pts) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        return { pts, box: [x0, y0, x1, y1] };
      }),
    ),
  );
  // Outer rings only for "inside" tests; holes (excluded land) are still worth showing.
  const outers = shapes.flatMap((mp) => mp.map((poly) => poly[0].map(([la, ln]) => [ln * kx, la * M_PER_DEG] as [number, number])));

  const near = (px: number, py: number, reach: number): boolean => {
    for (const o of outers) {
      let inside = false;
      for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
        const [xi, yi] = o[i], [xj, yj] = o[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    const r2 = reach * reach;
    for (const r of rings) {
      const [x0, y0, x1, y1] = r.box;
      if (px < x0 - reach || px > x1 + reach || py < y0 - reach || py > y1 + reach) continue;
      const p = r.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, ay] = p[i], [bx, by] = p[i + 1];
        const dx = bx - ax, dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
        const ex = ax + t * dx - px, ey = ay + t * dy - py;
        if (ex * ex + ey * ey <= r2) return true;
      }
    }
    return false;
  };

  const atZoom = (z: number) => {
    let hit = memo.get(z);
    if (hit) return hit;
    hit = tilesForBoxes(area.boxes, z, z);
    if (rings.length) {
      hit = hit.filter(([, x, y]) => {
        const [lat, lng] = tileCenter(z, x, y);
        const sizeM = (40075016 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
        return near(lng * kx, lat * M_PER_DEG, sizeM * 0.7072 + bufferM);
      });
    }
    memo.set(z, hit);
    return hit;
  };
  return (minZ: number, maxZ: number) => {
    const out: [number, number, number][] = [];
    for (let z = minZ; z <= maxZ; z++) out.push(...atZoom(z));
    return out;
  };
}

/** Number of tiles, approximate megabytes and download minutes for saving an area. */
export function estimate(area: TileArea | ReturnType<typeof tileLister>, detail: Detail): { tiles: number; mb: number; minutes: number } {
  const list = typeof area === 'function' ? area : tileLister(area);
  let tiles = 0;
  let kb = 0;
  for (const p of savePlan(detail)) {
    const n = list(p.minZ, p.maxZ).length;
    tiles += n;
    kb += n * p.def.avgKB;
  }
  return { tiles, mb: kb / 1024, minutes: tiles / SAVE_TILES_PER_S / 60 };
}

/** Area of a box in km² (good enough for size limits). */
export function boxKm2(b: Box): number {
  const kx = Math.cos((((b[0] + b[2]) / 2) * Math.PI) / 180);
  return (b[2] - b[0]) * 111.32 * (b[3] - b[1]) * 111.32 * kx;
}
