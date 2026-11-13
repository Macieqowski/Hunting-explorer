import { describe, expect, it } from 'vitest';
import { fillWhite, groundPixel, level, ORIGIN, PIXEL, project, render, sourcePixels, tileRange, whiteShare } from './puwg92';
import { GEOPORTAL_ORTHO_WMTS } from './tiles';

const SCALES = GEOPORTAL_ORTHO_WMTS.scales;

describe('PUWG 1992 (same checks as Puwg92Test.java)', () => {
  it('projects like proj4 across Poland', () => {
    // proj4: +proj=tmerc +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80
    const cases: [number, number, number, number][] = [
      [52.2318, 21.006, 636952.481, 486978.944],
      [54.5, 14.2, 189356.402, 747945.613],
      [49.1, 24.1, 872097.678, 149472.961],
      [54.83, 18.3, 455046.776, 774275.244],
      [50.0, 19.0, 500000.0, 236968.449],
    ];
    for (const [lat, lon, e, n] of cases) {
      const [pe, pn] = project(lat, lon);
      expect(Math.abs(pe - e)).toBeLessThan(0.01);
      expect(Math.abs(pn - n)).toBeLessThan(0.01);
    }
  });

  it('picks the coarsest level fine enough', () => {
    expect(level(SCALES, groundPixel(16, 21647))).toBe(12);
    expect(level(SCALES, groundPixel(17, 43295))).toBe(13);
    expect(level(SCALES, groundPixel(18, 86590))).toBe(14);
    expect(level(SCALES, groundPixel(19, 173180))).toBe(15);
    expect(level(SCALES, 0.01)).toBe(16);
  });

  it('maps tile pixels onto the grid', () => {
    const z = 17;
    const x = Math.floor(((21.006 + 180) / 360) * 2 ** z);
    const r = (52.2318 * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
    const px = SCALES[13] * PIXEL;
    const f = sourcePixels(z, x, y, px, 100000, 850000);
    const size = (2 * ORIGIN) / 2 ** z;
    const half = size / 512;
    const mx = -ORIGIN + (x + 0.5) * size + half;
    const my = ORIGIN - (y + 0.5) * size - half;
    const [e, n] = project((Math.atan(Math.sinh((my / ORIGIN) * Math.PI)) * 180) / Math.PI, (mx / ORIGIN) * 180);
    expect(Math.abs(f.fx[128 * 256 + 128] - ((e - 100000) / px - 0.5))).toBeLessThan(0.05);
    expect(Math.abs(f.fy[128 * 256 + 128] - ((850000 - n) / px - 0.5))).toBeLessThan(0.05);
    const [c0, r0, c1, r1] = tileRange(f, 512);
    expect(c1 - c0).toBeLessThanOrEqual(1);
    expect(r1 - r0).toBeLessThanOrEqual(1);
  });

  it('renders and fills gaps', () => {
    const grey = new Uint8ClampedArray(512 * 512 * 4).fill(128);
    const f = sourcePixels(17, 72000, 43000, SCALES[13] * PIXEL, 100000, 850000);
    const [c0, r0, c1, r1] = tileRange(f, 512);
    const rows = r1 - r0 + 1;
    const cols = c1 - c0 + 1;
    const all = Array.from({ length: rows }, () => Array.from({ length: cols }, () => grey));
    const out = render(f, all, c0, r0, 512);
    for (let k = 0; k < out.length; k += 4) expect([out[k], out[k + 1], out[k + 2], out[k + 3]]).toEqual([128, 128, 128, 255]);
    const none = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    expect(whiteShare(render(f, none, c0, r0, 512))).toBe(1);

    const px = new Uint8ClampedArray([255, 255, 255, 255, 16, 32, 48, 255, 250, 250, 250, 255]);
    fillWhite(px, new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255]));
    expect([...px]).toEqual([1, 1, 1, 255, 16, 32, 48, 255, 3, 3, 3, 255]);
  });
});
