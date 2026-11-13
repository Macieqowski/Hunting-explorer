import { describe, expect, it } from 'vitest';
import { limiter, nativeSources, nativeUnit } from './offlineJob';
import { tileFileName } from './tileFiles';
import { estimate, SAVE_WMTS_TILES_PER_S, WMS, wmsBlockUrl, wmsTileUrl } from './tiles';

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

  it('counts the photo at the WMTS speed in time estimates', () => {
    const area = { boxes: [[52.2, 20.9, 52.3, 21.1]] as [number, number, number, number][] };
    const e = estimate(area, 18);
    const photo = e.tiles - estimate(area, 16).tiles; // the extra zoom 17-18 tiles are all photo
    expect(estimate(area, 18).minutes - estimate(area, 16).minutes).toBeCloseTo(photo / SAVE_WMTS_TILES_PER_S / 60, 5);
  });

  it('limits how many run at once', async () => {
    const run = limiter(2);
    let now = 0;
    let most = 0;
    const job = () =>
      run(async () => {
        most = Math.max(most, ++now);
        await new Promise((r) => setTimeout(r, 5));
        now--;
      });
    await Promise.all(Array.from({ length: 7 }, job));
    expect(most).toBe(2);
  });
});
