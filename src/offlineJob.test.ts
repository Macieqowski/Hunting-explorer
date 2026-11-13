import { describe, expect, it } from 'vitest';
import { nativeSources, nativeUnit } from './offlineJob';
import { tileFileName } from './tileFiles';
import { estimate, WMS, wmsBlockUrl, wmsTileUrl } from './tiles';

const unit = (def: (typeof WMS)[keyof typeof WMS], tiles: [number, number][]) => ({
  def,
  z: 17,
  x: 72000,
  y: 43000,
  n: 4,
  tiles: tiles.map(([dx, dy]) => ({ url: wmsTileUrl(def, 17, 72000 + dx, 43000 + dy), x: 72000 + dx, y: 43000 + dy })),
});

describe('app downloader jobs', () => {
  it('draws the photo from WMTS: tile position and the same file names the map reads', () => {
    const u = nativeUnit(unit(WMS.ortho, [[0, 0], [3, 2]]));
    expect(u).toMatchObject({ s: 'ortho', z: 17, x: 72000, y: 43000, n: 4, m: 'image/jpeg' });
    expect(u.u).toBeUndefined();
    expect(u.t).toEqual([
      [0, 0, tileFileName(wmsTileUrl(WMS.ortho, 17, 72000, 43000), 'image/jpeg')],
      [3, 2, tileFileName(wmsTileUrl(WMS.ortho, 17, 72003, 43002), 'image/jpeg')],
    ]);
  });

  it('fetches other layers from WMS: a block, or the tile alone when only one is missing', () => {
    const block = nativeUnit(unit(WMS.geotopo, [[0, 0], [1, 1]]));
    expect(block.u).toBe(wmsBlockUrl(WMS.geotopo, 17, 72000, 43000, 4));
    expect(block.f).toBeUndefined();
    const one = nativeUnit(unit(WMS.districts, [[2, 1]]));
    expect(one).toMatchObject({ u: wmsTileUrl(WMS.districts, 17, 72002, 43001), n: 1 });
    expect(one.t).toEqual([[0, 0, tileFileName(one.u!, 'image/png')]]);
  });

  it('passes the WMTS grid once, with the standard-resolution fallback', () => {
    const src = nativeSources([unit(WMS.ortho, [[0, 0]]), unit(WMS.ortho, [[1, 1]]), unit(WMS.geotopo, [[0, 0]])]);
    expect(Object.keys(src)).toEqual(['ortho']);
    expect(src.ortho.t).toContain('/ORTO/WMTS/HighResolution?');
    expect(src.ortho.f).toContain('/ORTO/WMTS/StandardResolution?');
    expect(src.ortho.t).toContain('TILEMATRIX=EPSG:2180:{L}&TILEROW={r}&TILECOL={c}');
    expect(src.ortho.scales).toHaveLength(17);
    expect([src.ortho.e, src.ortho.n, src.ortho.size]).toEqual([100000, 850000, 512]);
  });

  it('estimates a shorter time when the photo comes from WMTS', () => {
    const area = { boxes: [[52.2, 20.9, 52.3, 21.1]] as [number, number, number, number][] };
    const web = estimate(area, 18);
    const app = estimate(area, 18, true);
    expect(app.tiles).toBe(web.tiles);
    expect(app.minutes).toBeLessThan(web.minutes / 2);
  });
});
