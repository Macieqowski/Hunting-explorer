import { boxKm2, estimate, tileLister, latToY, lngToX, padBox, savePlan, tileBBox, tilesForBoxes, wmsTileUrl, WMS, type Box } from './tiles';

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
