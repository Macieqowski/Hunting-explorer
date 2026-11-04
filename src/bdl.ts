/**
 * Client for the State Forests "Bank Danych o Lasach" (BDL) hunting-district service.
 *
 * Source: https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie
 * Boundaries come from voivodeship marshal offices, holder data from PZŁ / PGL LP,
 * refreshed yearly with the annual hunting plans.
 *
 * The ArcGIS REST endpoint supports JSONP (`callback=`), which we use so the app works
 * from any origin without relying on CORS headers.
 */

export const BDL_REST =
  'https://mapserver.bdl.lasy.gov.pl/arcgis/rest/services/WMS_Obwody_lowieckie/MapServer';
export const DISTRICT_LAYER = `${BDL_REST}/6`;
export const BDL_WMS_DISTRICTS =
  'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_Obwody_lowieckie/MapServer/WMSServer';
export const BDL_WMS_FORESTS =
  'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL/mapserver/WMSServer';
export const BDL_WMS_ENTRY_BANS =
  'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_zakazy_wstepu_do_lasu/MapServer/WMSServer';
export const BDL_WMS_FIRE =
  'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_zagrozenie_pozarowe_w_lasach/MapServer/WMSServer';

/** Attributes of one hunting district (obwód łowiecki) as published by BDL. */
export interface District {
  objectid: number;
  hd_int_num: number | null;
  /** District number, unique within a voivodeship. */
  hunt_dist_nr: string | null;
  /** Hunting year the record refers to. */
  a_year: number | null;
  total_area: number | null;
  forest_area: number | null;
  after_exclusion_area: number | null;
  county_cd: string | null;
  /** Despite the name this is the voivodeship (województwo). */
  county_name: string | null;
  /** Despite the name this is the powiat. */
  district_name: string | null;
  /** Forest district (nadleśnictwo). */
  inspectorate_name: string | null;
  inspectorate_adr: string | null;
  /** Regional Directorate of State Forests (RDLP). */
  region_name: string | null;
  region_adr: string | null;
  /** PZŁ regional board (Zarząd Okręgowy PZŁ). */
  reg_mng_board_name: string | null;
  reg_mng_board_adr: string | null;
  /** Leaseholder – usually a hunting club (koło łowieckie). */
  lease_holder_name: string | null;
  lease_holder_adr: string | null;
  /** 'w dzierżawie' | 'w zarządzie PZŁ' | 'w zarządzie PGL LP' | 'w zarządzie innym' | null */
  lease_group_name: string | null;
}

export const DISTRICT_FIELDS: (keyof District)[] = [
  'objectid',
  'hd_int_num',
  'hunt_dist_nr',
  'a_year',
  'total_area',
  'forest_area',
  'after_exclusion_area',
  'county_cd',
  'county_name',
  'district_name',
  'inspectorate_name',
  'inspectorate_adr',
  'region_name',
  'region_adr',
  'reg_mng_board_name',
  'reg_mng_board_adr',
  'lease_holder_name',
  'lease_holder_adr',
  'lease_group_name',
];

export type LatLngRing = [number, number][];
/** Multipolygon in Leaflet order: polygons → rings (first is outer) → [lat, lng]. */
export type LatLngMultiPolygon = LatLngRing[][];

export interface DistrictWithGeometry {
  attributes: District;
  geometry: LatLngMultiPolygon;
}

interface EsriFeature {
  attributes: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
}

interface EsriQueryResponse {
  features?: EsriFeature[];
  objectIds?: number[];
  count?: number;
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string; details?: string[] };
}

let jsonpCounter = 0;

/** Loads a URL via JSONP. Exposed for tests through `setTransport`. */
function jsonp<T>(url: string, timeoutMs = 45000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__bdl_cb_${Date.now().toString(36)}_${jsonpCounter++}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      clearTimeout(timer);
      delete w[name];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Przekroczono czas oczekiwania na odpowiedź serwera BDL'));
    }, timeoutMs);
    w[name] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Nie udało się połączyć z serwerem BDL'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    document.head.appendChild(script);
  });
}

type Transport = (url: string) => Promise<unknown>;
let transport: Transport = (url) => jsonp(url);

/** Replace the network transport (used by tests / offline demo). */
export function setTransport(t: Transport): void {
  transport = t;
}

export function buildQueryUrl(params: Record<string, string | number | boolean>): string {
  const qs = new URLSearchParams();
  qs.set('f', 'json');
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${DISTRICT_LAYER}/query?${qs.toString()}`;
}

async function query(params: Record<string, string | number | boolean>): Promise<EsriQueryResponse> {
  const res = (await transport(buildQueryUrl(params))) as EsriQueryResponse;
  if (res && res.error) {
    throw new Error(`BDL: ${res.error.message}${res.error.details?.length ? ' – ' + res.error.details.join(' ') : ''}`);
  }
  return res;
}

function toDistrict(attrs: Record<string, unknown>): District {
  const d: Record<string, unknown> = {};
  for (const f of DISTRICT_FIELDS) {
    const v = attrs[f];
    d[f] = typeof v === 'string' ? v.trim() || null : v ?? null;
  }
  return d as unknown as District;
}

/** Splits a sorted id list into contiguous [min, max] chunks of at most `size` ids. */
export function chunkIdRanges(ids: number[], size: number): [number, number][] {
  const sorted = [...ids].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const part = sorted.slice(i, i + size);
    out.push([part[0], part[part.length - 1]]);
  }
  return out;
}

/**
 * Loads the attributes (no geometry) of every hunting district in Poland.
 * The server caps a response at 1000 records, so we fetch all object ids first and
 * then page through id ranges in parallel.
 */
export async function fetchAllDistricts(onProgress?: (loaded: number, total: number) => void): Promise<District[]> {
  const idsRes = await query({ where: '1=1', returnIdsOnly: true });
  const ids = idsRes.objectIds ?? [];
  if (!ids.length) return [];
  const ranges = chunkIdRanges(ids, 1000);
  let loaded = 0;
  const parts = await Promise.all(
    ranges.map(async ([lo, hi]) => {
      const res = await query({
        where: `objectid >= ${lo} AND objectid <= ${hi}`,
        outFields: DISTRICT_FIELDS.join(','),
        returnGeometry: false,
      });
      const ds = (res.features ?? []).map((f) => toDistrict(f.attributes));
      loaded += ds.length;
      onProgress?.(loaded, ids.length);
      return ds;
    }),
  );
  return parts.flat();
}

/** Signed area (shoelace) of a ring of [x, y]; negative = clockwise. */
export function ringSignedArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function pointInRing(pt: number[], ring: number[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Converts Esri polygon rings (outer rings clockwise, holes counter-clockwise, [x=lng, y=lat])
 * into a Leaflet multipolygon ([lat, lng]).
 */
export function esriRingsToLatLngs(rings: number[][][]): LatLngMultiPolygon {
  const outers: number[][][] = [];
  const holes: number[][][] = [];
  for (const r of rings) {
    if (r.length < 3) continue;
    (ringSignedArea(r) <= 0 ? outers : holes).push(r);
  }
  // Data that does not follow the winding convention: treat everything as outer rings.
  if (!outers.length) {
    outers.push(...holes);
    holes.length = 0;
  }
  const polys: number[][][][] = outers.map((o) => [o]);
  for (const h of holes) {
    const owner = polys.find((p) => pointInRing(h[0], p[0]));
    (owner ?? polys[0]).push(h);
  }
  return polys.map((p) => p.map((ring) => ring.map(([x, y]) => [y, x] as [number, number])));
}

function toDistrictWithGeometry(f: EsriFeature): DistrictWithGeometry {
  return {
    attributes: toDistrict(f.attributes),
    geometry: esriRingsToLatLngs(f.geometry?.rings ?? []),
  };
}

const GEOMETRY_PARAMS = { returnGeometry: true, outSR: 4326 };

/** Districts intersecting a point (normally exactly one). */
export async function fetchDistrictsAtPoint(lat: number, lng: number): Promise<DistrictWithGeometry[]> {
  const res = await query({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
    outFields: DISTRICT_FIELDS.join(','),
    maxAllowableOffset: 0.00005,
    ...GEOMETRY_PARAMS,
  });
  return (res.features ?? []).map(toDistrictWithGeometry);
}

/** Geometry + attributes for the given object ids (in chunks to keep URLs short). */
export async function fetchDistrictsByIds(ids: number[], simplify = 0.0001): Promise<DistrictWithGeometry[]> {
  const out: DistrictWithGeometry[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const res = await query({
      objectIds: ids.slice(i, i + 40).join(','),
      outFields: DISTRICT_FIELDS.join(','),
      maxAllowableOffset: simplify,
      ...GEOMETRY_PARAMS,
    });
    out.push(...(res.features ?? []).map(toDistrictWithGeometry));
  }
  return out;
}

export interface DistrictOutline {
  objectid: number;
  number: string | null;
  holder: string | null;
  geometry: LatLngMultiPolygon;
}

/**
 * Simplified outlines of all districts intersecting a lat/lng box, for drawing borders and labels.
 * Pages through results (server cap is 1000 per request) by object id.
 */
export async function fetchOutlinesInBounds(
  south: number,
  west: number,
  north: number,
  east: number,
  simplify: number,
  maxPages = 4,
): Promise<DistrictOutline[]> {
  const out: DistrictOutline[] = [];
  let last = -1;
  for (let page = 0; page < maxPages; page++) {
    const res = await query({
      where: `objectid > ${last}`,
      geometry: `${west},${south},${east},${north}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,hunt_dist_nr,lease_holder_name',
      orderByFields: 'objectid ASC',
      maxAllowableOffset: simplify,
      returnGeometry: true,
      outSR: 4326,
    });
    const feats = res.features ?? [];
    for (const f of feats) {
      const a = f.attributes as { objectid: number; hunt_dist_nr: string | null; lease_holder_name: string | null };
      out.push({
        objectid: a.objectid,
        number: a.hunt_dist_nr?.trim() || null,
        holder: a.lease_holder_name?.trim() || null,
        geometry: esriRingsToLatLngs(f.geometry?.rings ?? []),
      });
      last = Math.max(last, a.objectid);
    }
    if (!res.exceededTransferLimit || !feats.length) break;
  }
  return out;
}

function distToSegment(p: number[], a: number[], b: number[], kx: number): number {
  const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0], px = p[1] * kx, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const tt = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const x = ax + tt * dx - px, y = ay + tt * dy - py;
  return Math.sqrt(x * x + y * y);
}

/**
 * A good point to place a label inside a (multi)polygon: grid-searches the largest polygon
 * for the interior point farthest from any edge. Returns [lat, lng].
 */
export function labelPoint(mp: LatLngMultiPolygon, grid = 14): [number, number] | null {
  let best: LatLngRing[] | null = null;
  let bestArea = -1;
  for (const poly of mp) {
    const a = Math.abs(ringSignedArea(poly[0]));
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  if (!best || best[0].length < 3) return null;
  const outer = best[0];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [la, ln] of outer) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
  }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  let bestPt: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  let bestD = -1;
  for (let i = 0; i <= grid; i++) {
    for (let j = 0; j <= grid; j++) {
      const p: [number, number] = [minLat + ((maxLat - minLat) * (i + 0.5)) / (grid + 1), minLng + ((maxLng - minLng) * (j + 0.5)) / (grid + 1)];
      if (!pointInRing(p, outer) || best.slice(1).some((h) => pointInRing(p, h))) continue;
      let d = Infinity;
      for (const ring of best)
        for (let k = 0; k < ring.length - 1 && d > bestD; k++) d = Math.min(d, distToSegment(p, ring[k], ring[k + 1], kx));
      if (d > bestD) {
        bestD = d;
        bestPt = p;
      }
    }
  }
  return bestPt;
}
