import { readFileSync } from 'node:fs';
import { encodeSnapshot, FIELDS, isValidSnapshot, metaOf } from '../scripts/snapshot-districts.mjs';
import { DISTRICT_FIELDS, setTransport, networkTransport, type District } from './bdl';
import { decodeSnapshot, isNewerList, loadDistrictList, SNAPSHOT_FORMAT } from './districtData';

function district(id: number, over: Partial<District> = {}): District {
  const d = Object.fromEntries(DISTRICT_FIELDS.map((f) => [f, null])) as unknown as District;
  return {
    ...d,
    objectid: id,
    hunt_dist_nr: String(id % 300),
    a_year: 2026,
    total_area: 5000 + id / 100,
    county_name: 'mazowieckie',
    lease_holder_name: `Koło Łowieckie nr ${id % 7}`,
    lease_group_name: 'w dzierżawie',
    ...over,
  };
}

describe('district list snapshot', () => {
  it('uses the same fields as the app', () => {
    expect(FIELDS).toEqual(DISTRICT_FIELDS);
  });

  it('decodes what the script encodes, nulls and shared strings included', () => {
    const ds = [district(3), district(1, { lease_holder_name: null, forest_area: 0 }), district(2, { inspectorate_name: 'Celestynów' })];
    const snap = encodeSnapshot(ds as unknown as Record<string, unknown>[], '2026-11-10');
    expect(snap.strings.filter((s) => s === 'mazowieckie')).toHaveLength(1);
    const { districts, meta } = decodeSnapshot(snap);
    expect(districts).toEqual([...ds].sort((a, b) => a.objectid - b.objectid));
    expect(meta).toEqual({ format: SNAPSHOT_FORMAT, version: snap.version, date: '2026-11-10', count: 3 });
  });

  it('gives the same version for the same data in any order', () => {
    const a = encodeSnapshot([district(1), district(2)] as unknown as Record<string, unknown>[], '2026-11-10');
    const b = encodeSnapshot([district(2), district(1)] as unknown as Record<string, unknown>[], '2026-11-17');
    const c = encodeSnapshot([district(1), district(2, { lease_holder_name: 'KŁ Darz Bór' })] as unknown as Record<string, unknown>[], '2026-11-10');
    expect(a.version).toBe(b.version);
    expect(c.version).not.toBe(a.version);
  });

  it('reads files whose columns are in another order or lack a field', () => {
    const snap = encodeSnapshot([district(1)] as unknown as Record<string, unknown>[], '2026-11-10');
    const order = [...snap.fields.keys()].reverse().filter((i) => snap.fields[i] !== 'region_adr');
    const moved = {
      ...snap,
      fields: order.map((i) => snap.fields[i]),
      text: order.map((i, j) => (snap.text.includes(i) ? j : -1)).filter((j) => j >= 0),
      rows: snap.rows.map((r) => order.map((i) => r[i])),
    };
    const [d] = decodeSnapshot(moved).districts;
    expect(d).toEqual({ ...district(1), region_adr: null });
  });

  it('refuses unknown formats and cut-off files', () => {
    const snap = encodeSnapshot([district(1), district(2)] as unknown as Record<string, unknown>[], '2026-11-10');
    expect(() => decodeSnapshot({ ...snap, format: 2 })).toThrow();
    expect(() => decodeSnapshot({ ...snap, rows: snap.rows.slice(1) })).toThrow();
    expect(() => decodeSnapshot(null)).toThrow();
  });

  it('the file in the repository is complete and matches its meta file', () => {
    const raw = JSON.parse(readFileSync('public/data/districts.json', 'utf8'));
    const meta = JSON.parse(readFileSync('public/data/districts-meta.json', 'utf8'));
    expect(isValidSnapshot(raw)).toBe(true);
    expect(metaOf(raw)).toEqual(meta);
    const { districts } = decodeSnapshot(raw);
    expect(districts.length).toBeGreaterThan(4000);
    expect(districts.filter((d) => d.lease_holder_name).length).toBeGreaterThan(3000);
  });
});

describe('isNewerList', () => {
  const m = (version: string, date: string, format = SNAPSHOT_FORMAT) => ({ format, version, date, count: 1 });
  it('takes a different list from the same day or later', () => {
    expect(isNewerList(m('b', '2026-11-17'), m('a', '2026-11-10'))).toBe(true);
    expect(isNewerList(m('b', '2026-11-10'), m('a', '2026-11-10'))).toBe(true);
    expect(isNewerList(m('a', '2026-11-17'), null)).toBe(true);
  });
  it('ignores the same list, older lists and unknown formats', () => {
    expect(isNewerList(m('a', '2026-11-17'), m('a', '2026-11-10'))).toBe(false);
    expect(isNewerList(m('b', '2026-11-03'), m('a', '2026-11-10'))).toBe(false);
    expect(isNewerList(m('b', '2026-11-17', 2), m('a', '2026-11-10'))).toBe(false);
    expect(isNewerList(null, m('a', '2026-11-10'))).toBe(false);
  });
});

describe('loadDistrictList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setTransport(networkTransport);
  });

  it('starts from the built-in file', async () => {
    const snap = encodeSnapshot([district(1), district(2)] as unknown as Record<string, unknown>[], '2026-11-10');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(snap)));
    vi.stubGlobal('fetch', fetchMock);
    const list = await loadDistrictList();
    expect(fetchMock).toHaveBeenCalledWith('./data/districts.json', expect.anything());
    expect(list.districts.map((d) => d.objectid)).toEqual([1, 2]);
    expect(list.meta?.version).toBe(snap.version);
  });

  it('falls back to BDL when the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    setTransport(async (url) =>
      url.includes('returnIdsOnly') ? { objectIds: [7] } : { features: [{ attributes: { ...district(7), hunt_dist_nr: ' 12 ' } }] },
    );
    const list = await loadDistrictList();
    expect(list.meta).toBeNull();
    expect(list.districts).toEqual([district(7, { hunt_dist_nr: '12' })]);
  });
});
