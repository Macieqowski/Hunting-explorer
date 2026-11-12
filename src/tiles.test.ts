import { boxKm2, estimate, tileLister, latToY, lngToX, MAX_ZOOM, padBox, savePlan, tileBBox, tilesForBoxes, wmsBlockUrl, wmsTileUrl, WMS, zoomUpTo, type Box } from './tiles';

describe('layer zoom', () => {
  it('lets every layer reach the deepest map zoom, scaling up past what its server draws', () => {
    // A layer whose maxZoom is below the map's goes blank at the deepest zoom.
    for (const native of [17, 19, ...Object.values(WMS).map((d) => d.maxNative)]) {
      const z = zoomUpTo(native);
      expect(z.maxZoom).toBe(MAX_ZOOM);
      expect(z.maxNativeZoom).toBe(native);
    }
    expect(zoomUpTo(22).maxNativeZoom).toBe(MAX_ZOOM);
  });
});

describe('tile math', () => {
  it('finds the slippy tile of a point (Warsaw, z12)', () => {
    expect(lngToX(21.0122, 12)).toBe(2287);
    expect(latToY(52.2297, 12)).toBe(1348);
  });

  it('gives the EPSG:3857 box of a tile', () => {
    const [minX, minY, maxX, maxY] = tileBBox(1, 1, 0);
    expect(minX).toBeCloseTo(0);
    expect(maxX).toBeCloseTo(20037508.34, 1);
    expect(minY).toBeCloseTo(0);
    expect(maxY).toBeCloseTo(20037508.34, 1);
  });

  it('builds a stable GetMap url used as the storage key', () => {
    const u = wmsTileUrl(WMS.ortho, 12, 2287, 1330);
    expect(u).toContain('request=GetMap');
    expect(u).toContain('crs=EPSG:3857');
    expect(u).toContain('layers=Raster');
    expect(u).toContain('format=image%2Fjpeg');
    expect(wmsTileUrl(WMS.ortho, 12, 2287, 1330)).toBe(u);
    expect(wmsTileUrl(WMS.compartments, 12, 2287, 1330)).toContain('layers=3%2C2');
  });

  it('lists each tile once even when boxes overlap', () => {
    const a: Box = [52.2, 21.0, 52.25, 21.05];
    const b: Box = [52.22, 21.02, 52.27, 21.07];
    const one = tilesForBoxes([a], 14, 14).length;
    const both = tilesForBoxes([a, b], 14, 14);
    expect(new Set(both.map((t) => t.join('/'))).size).toBe(both.length);
    expect(both.length).toBeGreaterThan(one);
    expect(both.length).toBeLessThan(one * 2);
  });

  it('estimates a typical district (60 km²) at tens of megabytes', () => {
    // About 7.7 x 7.7 km at 52°N.
    const box = padBox([52.0, 21.0, 52.07, 21.112], 0.08);
    expect(boxKm2([52.0, 21.0, 52.07, 21.112])).toBeGreaterThan(55);
    const std = estimate({ boxes: [box] }, 16);
    const fine = estimate({ boxes: [box] }, 17);
    expect(std.mb).toBeGreaterThan(15);
    expect(std.mb).toBeLessThan(120);
    expect(fine.mb).toBeGreaterThan(std.mb * 1.5);
  });

  it('keeps only tiles near a district shape, not its whole box', () => {
    // An L-shaped district: two arms of a 10 x 10 km box, the far corner empty.
    const L: [number, number][] = [
      [52.0, 21.0], [52.09, 21.0], [52.09, 21.03], [52.03, 21.03], [52.03, 21.146], [52.0, 21.146], [52.0, 21.0],
    ];
    const box: Box = [52.0, 21.0, 52.09, 21.146];
    const all = tileLister({ boxes: [box] })(16, 16);
    const near = tileLister({ boxes: [box], shapes: [[[L]]] })(16, 16);
    expect(near.length).toBeLessThan(all.length * 0.7);
    // A tile in the middle of an arm stays.
    expect(near.some(([, x, y]) => x === lngToX(21.015, 16) && y === latToY(52.06, 16))).toBe(true);
    // A tile deep in the empty corner goes.
    expect(near.some(([, x, y]) => x === lngToX(21.12, 16) && y === latToY(52.08, 16))).toBe(false);
  });

  it('only saves layers whose terms allow it', () => {
    for (const p of savePlan(17)) expect(p.def.cache).toBe(true);
    expect(WMS.fire.cache).toBe(false);
  });
});

describe('wmsBlockUrl', () => {
  it('asks for n×n tiles in one image covering exactly their boxes', () => {
    const u = new URL(wmsBlockUrl(WMS.ortho, 16, 36844, 21256, 4));
    expect(u.searchParams.get('width')).toBe('1024');
    expect(u.searchParams.get('height')).toBe('1024');
    const bbox = u.searchParams.get('bbox')!.split(',').map(Number);
    const tl = tileBBox(16, 36844, 21256);
    const br = tileBBox(16, 36847, 21259);
    expect(bbox).toEqual([tl[0], br[1], br[2], tl[3]].map((v) => +v.toFixed(2)));
  });
  it('keeps the other parameters of the single-tile URL', () => {
    const one = wmsTileUrl(WMS.ortho, 12, 10, 20).replace(/&width.*$/, '');
    expect(wmsBlockUrl(WMS.ortho, 12, 10, 20, 4).startsWith(one)).toBe(true);
  });
});
