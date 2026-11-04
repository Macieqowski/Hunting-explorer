import { buildQueryUrl, chunkIdRanges, esriRingsToLatLngs, ringSignedArea, labelPoint, pointInRing } from './bdl';

describe('bdl', () => {
  it('builds query urls against the district layer', () => {
    const u = new URL(buildQueryUrl({ where: '1=1', returnIdsOnly: true }));
    expect(u.pathname).toMatch(/WMS_Obwody_lowieckie\/MapServer\/6\/query$/);
    expect(u.searchParams.get('f')).toBe('json');
    expect(u.searchParams.get('where')).toBe('1=1');
  });

  it('chunks ids into contiguous ranges', () => {
    expect(chunkIdRanges([5, 1, 3, 2, 4], 2)).toEqual([[1, 2], [3, 4], [5, 5]]);
  });

  it('converts esri rings (cw outer, ccw hole) to leaflet multipolygon', () => {
    const outer = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]; // clockwise
    const hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]; // counter-clockwise
    const outer2 = [[20, 0], [20, 5], [25, 5], [25, 0], [20, 0]];
    expect(ringSignedArea(outer)).toBeLessThan(0);
    const mp = esriRingsToLatLngs([outer, hole, outer2]);
    expect(mp).toHaveLength(2);
    expect(mp[0]).toHaveLength(2); // outer + hole
    expect(mp[0][0][1]).toEqual([10, 0]); // [lat, lng] swap
    expect(mp[1]).toHaveLength(1);
  });
});

describe('labelPoint', () => {
  it('places the label inside a concave (L-shaped) polygon', () => {
    // L shape in [lat, lng]: the bbox centre (5,5) is outside the polygon.
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 10], [0, 10], [0, 0]];
    const p = labelPoint([[ring]]);
    expect(p).not.toBeNull();
    expect(pointInRing(p!, ring)).toBe(true);
  });
});
