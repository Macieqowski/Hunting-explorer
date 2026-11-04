import type { District } from './bdl';
import { groupClubs, statsBy, countByType, clubKey, fold, districtSlug, findBySlug } from './data';

const base: District = {
  objectid: 1, hd_int_num: 1, hunt_dist_nr: '1', a_year: 2026, total_area: 1000, forest_area: 400, after_exclusion_area: 950,
  county_cd: '30', county_name: 'wielkopolskie', district_name: 'poznański', inspectorate_name: 'Babki', inspectorate_adr: null,
  region_name: 'Poznań', region_adr: null, reg_mng_board_name: 'ZO PZŁ Poznań', reg_mng_board_adr: null,
  lease_holder_name: 'Koło Łowieckie 14 Leśnik Poznań', lease_holder_adr: null, lease_group_name: 'w dzierżawie',
};
const d = (o: Partial<District>): District => ({ ...base, ...o });

const sample = [
  d({ objectid: 1, hunt_dist_nr: '208' }),
  d({ objectid: 2, hunt_dist_nr: '139', lease_holder_name: 'Koło Łowieckie  14 Leśnik Poznań ', total_area: 3000 }),
  d({ objectid: 3, hunt_dist_nr: '5', lease_holder_name: 'OHZ PZŁ Czempiń', lease_group_name: 'w zarządzie PZŁ' }),
  d({ objectid: 4, hunt_dist_nr: '56', county_cd: '06', county_name: 'lubelskie', reg_mng_board_name: 'ZO PZŁ Lublin', lease_holder_name: null, lease_group_name: null }),
];

describe('data', () => {
  it('groups districts into clubs by normalised name', () => {
    const clubs = groupClubs(sample);
    expect(clubs).toHaveLength(2);
    const lesnik = clubs.find((c) => c.name.includes('Leśnik'))!;
    expect(lesnik.districts.map((x) => x.hunt_dist_nr)).toEqual(['139', '208']);
    expect(lesnik.totalArea).toBe(4000);
    expect(lesnik.type).toBe('club');
    expect(clubs.find((c) => c.name.includes('OHZ'))!.type).toBe('pzl');
  });

  it('normalises keys and folds diacritics', () => {
    expect(clubKey('Koło „Darz Bór” ')).toBe(clubKey('koło "Darz  Bór"'));
    expect(fold('Łoś Żółw')).toBe('los zolw');
  });

  it('aggregates stats', () => {
    const s = statsBy(sample, 'county_name');
    expect(s[0]).toMatchObject({ name: 'wielkopolskie', districts: 3, holders: 2, totalArea: 5000 });
    const types = countByType(sample);
    expect(types.club.districts).toBe(2);
    expect(types.unknown.districts).toBe(1);
  });

  it('builds and resolves slugs', () => {
    expect(districtSlug(sample[3])).toBe('06-56');
    expect(findBySlug(sample, '30-208')?.objectid).toBe(1);
  });
});
