// Web-map tiles (EPSG:3857, 256 px) made from Geoportal's ready-made orthophoto tiles, which
// only exist in the Polish grid PUWG 1992 (EPSG:2180, 512 px). Geoportal serves those from a
// cache in well under a second, while drawing the same picture through WMS takes it seconds
// per image, so saving the photo for offline use is many times faster this way.
//
// The app does the same in Java (android/app/src/main/java/org/polowanie/app/Puwg92.java);
// keep the two in step.

// GRS80 ellipsoid and the PUWG 1992 transverse Mercator (EPSG:2180).
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const E4 = E2 * E2;
const E6 = E4 * E2;
const EP2 = E2 / (1 - E2);
const K0 = 0.9993;
const LON0 = (19 * Math.PI) / 180;
const FE = 500000;
const FN = -5300000;
const M1 = 1 - E2 / 4 - (3 * E4) / 64 - (5 * E6) / 256;
const M2 = (3 * E2) / 8 + (3 * E4) / 32 + (45 * E6) / 1024;
const M3 = (15 * E4) / 256 + (45 * E6) / 1024;
const M4 = (35 * E6) / 3072;

/** Web Mercator half-width in metres. */
export const ORIGIN = 20037508.342789244;
/** OGC "standardized rendering pixel size" in metres, for WMTS scale denominators. */
export const PIXEL = 0.00028;

/** Latitude and longitude (degrees, ETRS89 ≈ WGS84) to PUWG 1992 [easting, northing] in metres. */
export function project(latDeg: number, lonDeg: number): [number, number] {
  const p = (latDeg * Math.PI) / 180;
  const s = Math.sin(p);
  const c = Math.cos(p);
  const t = s / c;
  const n = A / Math.sqrt(1 - E2 * s * s);
  const tt = t * t;
  const cc = EP2 * c * c;
  const a = ((lonDeg * Math.PI) / 180 - LON0) * c;
  const a2 = a * a;
  const m = A * (M1 * p - M2 * Math.sin(2 * p) + M3 * Math.sin(4 * p) - M4 * Math.sin(6 * p));
  return [
    FE + K0 * n * (a + ((1 - tt + cc) * a * a2) / 6 + ((5 - 18 * tt + tt * tt + 72 * cc - 58 * EP2) * a * a2 * a2) / 120),
    FN +
      K0 *
        (m +
          n *
            t *
            (a2 / 2 + ((5 - tt + 9 * cc + 4 * cc * cc) * a2 * a2) / 24 + ((61 - 58 * tt + tt * tt + 600 * cc - 330 * EP2) * a2 * a2 * a2) / 720)),
  ];
}

/** Ground size of a web-map pixel at tile (z, y), in metres. */
export function groundPixel(z: number, y: number): number {
  const size = (2 * ORIGIN) / 2 ** z;
  const my = ORIGIN - (y + 0.5) * size;
  return (size / 256) * Math.cos(Math.atan(Math.sinh((my / ORIGIN) * Math.PI)));
}

/** The coarsest level whose pixels are no bigger than `ground` metres (the finest if none is). */
export function level(scales: readonly number[], ground: number): number {
  const i = scales.findIndex((s) => s * PIXEL <= ground);
  return i < 0 ? scales.length - 1 : i;
}

/**
 * For each pixel of web-map tile (z, x, y), its position in the PUWG 1992 level with pixel size
 * `px` and top-left corner (originE, originN), as pixel coordinates from that corner (pixel
 * centres at .5). Exact on a 17×17 grid, bilinear in between: the error is far below a pixel.
 */
export function sourcePixels(z: number, x: number, y: number, px: number, originE: number, originN: number): { fx: Float32Array; fy: Float32Array } {
  const g = 17;
  const step = 16;
  const size = (2 * ORIGIN) / 2 ** z;
  const mpp = size / 256;
  const gx = new Float64Array(g * g);
  const gy = new Float64Array(g * g);
  for (let j = 0; j < g; j++) {
    const my = ORIGIN - y * size - j * step * mpp;
    const lat = (Math.atan(Math.sinh((my / ORIGIN) * Math.PI)) * 180) / Math.PI;
    for (let i = 0; i < g; i++) {
      const mx = -ORIGIN + x * size + i * step * mpp;
      const [e, n] = project(lat, (mx / ORIGIN) * 180);
      gx[j * g + i] = (e - originE) / px;
      gy[j * g + i] = (originN - n) / px;
    }
  }
  const fx = new Float32Array(256 * 256);
  const fy = new Float32Array(256 * 256);
  for (let py = 0; py < 256; py++) {
    const v = (py + 0.5) / step;
    const j = Math.min(Math.floor(v), g - 2);
    const dv = v - j;
    for (let p = 0; p < 256; p++) {
      const u = (p + 0.5) / step;
      const i = Math.min(Math.floor(u), g - 2);
      const du = u - i;
      const k = j * g + i;
      const w00 = (1 - du) * (1 - dv);
      const w10 = du * (1 - dv);
      const w01 = (1 - du) * dv;
      const w11 = du * dv;
      fx[py * 256 + p] = gx[k] * w00 + gx[k + 1] * w10 + gx[k + g] * w01 + gx[k + g + 1] * w11 - 0.5;
      fy[py * 256 + p] = gy[k] * w00 + gy[k + 1] * w10 + gy[k + g] * w01 + gy[k + g + 1] * w11 - 0.5;
    }
  }
  return { fx, fy };
}

/** Source tiles a sourcePixels() result needs: [col0, row0, col1, row1], inclusive. */
export function tileRange(f: { fx: Float32Array; fy: Float32Array }, tileSize: number): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < f.fx.length; k++) {
    if (f.fx[k] < minX) minX = f.fx[k];
    if (f.fx[k] > maxX) maxX = f.fx[k];
    if (f.fy[k] < minY) minY = f.fy[k];
    if (f.fy[k] > maxY) maxY = f.fy[k];
  }
  return [
    Math.floor(Math.floor(minX) / tileSize),
    Math.floor(Math.floor(minY) / tileSize),
    Math.floor((Math.floor(maxX) + 1) / tileSize),
    Math.floor((Math.floor(maxY) + 1) / tileSize),
  ];
}

/** RGBA pixels of a source tile, or null where there is none (drawn white). */
export type SourceTile = Uint8ClampedArray | null;

/**
 * Draws the tile as RGBA: bilinear samples of the source tiles. `tiles[r][c]` holds source tile
 * (col0 + c, row0 + r).
 */
export function render(f: { fx: Float32Array; fy: Float32Array }, tiles: SourceTile[][], col0: number, row0: number, tileSize: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 256 * 4);
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  const x0 = col0 * tileSize;
  const y0 = row0 * tileSize;
  // A source pixel as 0xRRGGBB (white outside the sources), without allocating per pixel.
  const pixel = (x: number, y: number): number => {
    const c = Math.floor(x / tileSize);
    const r = Math.floor(y / tileSize);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return 0xffffff;
    const t = tiles[r][c];
    if (!t) return 0xffffff;
    const o = ((y - r * tileSize) * tileSize + (x - c * tileSize)) * 4;
    return (t[o] << 16) | (t[o + 1] << 8) | t[o + 2];
  };
  for (let k = 0; k < 256 * 256; k++) {
    const sx = f.fx[k] - x0;
    const sy = f.fy[k] - y0;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const dx = sx - ix;
    const dy = sy - iy;
    const p00 = pixel(ix, iy);
    const p10 = pixel(ix + 1, iy);
    const p01 = pixel(ix, iy + 1);
    const p11 = pixel(ix + 1, iy + 1);
    const w00 = (1 - dx) * (1 - dy);
    const w10 = dx * (1 - dy);
    const w01 = (1 - dx) * dy;
    const w11 = dx * dy;
    for (let sh = 16, ch = 0; ch < 3; sh -= 8, ch++)
      out[k * 4 + ch] = Math.round(
        ((p00 >> sh) & 0xff) * w00 + ((p10 >> sh) & 0xff) * w10 + ((p01 >> sh) & 0xff) * w01 + ((p11 >> sh) & 0xff) * w11,
      );
    out[k * 4 + 3] = 255;
  }
  return out;
}

/** Share of near-white pixels (all channels ≥ 248) in RGBA pixels, sampled. */
export function whiteShare(px: Uint8ClampedArray): number {
  let white = 0;
  let n = 0;
  for (let k = 0; k < px.length / 4; k += 61) {
    n++;
    if (px[k * 4] >= 248 && px[k * 4 + 1] >= 248 && px[k * 4 + 2] >= 248) white++;
  }
  return n ? white / n : 1;
}

/** Puts `fill`'s pixels where `px` is blank white (gaps in the high-resolution photo). */
export function fillWhite(px: Uint8ClampedArray, fill: Uint8ClampedArray): void {
  for (let k = 0; k < px.length && k < fill.length; k += 4)
    if (px[k] >= 250 && px[k + 1] >= 250 && px[k + 2] >= 250) {
      px[k] = fill[k];
      px[k + 1] = fill[k + 1];
      px[k + 2] = fill[k + 2];
    }
}
