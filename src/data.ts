import type { District } from './bdl';

export type HolderType = 'club' | 'pzl' | 'pgl' | 'other' | 'unknown';

export function holderType(leaseGroup: string | null): HolderType {
  switch ((leaseGroup ?? '').trim().toLowerCase()) {
    case 'w dzierżawie':
      return 'club';
    case 'w zarządzie pzł':
      return 'pzl';
    case 'w zarządzie pgl lp':
      return 'pgl';
    case 'w zarządzie innym':
      return 'other';
    default:
      return 'unknown';
  }
}

/** A leaseholder (usually a hunting club) aggregated over all districts it holds. */
export interface Club {
  key: string;
  name: string;
  type: HolderType;
  districts: District[];
  totalArea: number;
  forestArea: number;
  voivodeships: string[];
  pzlBoards: string[];
  forestDistricts: string[];
  powiats: string[];
}

/** Normalises a holder name for grouping: collapses whitespace and quotes, case-insensitive. */
export function clubKey(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[„”“"']/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*"\s*/g, '"')
    .trim()
    .toLocaleLowerCase('pl');
}

/** Lower-case, diacritics-free text used for search matching. */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Whether a district matches every search word: its exact number, or text in holder, forest district, powiat, voivodeship or PZŁ board. */
export function districtMatches(d: District, terms: string[]): boolean {
  return terms.every(
    (tm) =>
      d.hunt_dist_nr === tm ||
      fold([d.lease_holder_name, d.inspectorate_name, d.district_name, d.county_name, d.reg_mng_board_name].join(' ')).includes(tm),
  );
}

/** Splits a search into folded words. */
export const searchTerms = (q: string) => fold(q.trim()).split(/\s+/).filter(Boolean);

const uniqSorted = (xs: (string | null)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'pl'));

export function groupClubs(districts: District[]): Club[] {
  const map = new Map<string, District[]>();
  for (const d of districts) {
    if (!d.lease_holder_name) continue;
    const k = clubKey(d.lease_holder_name);
    const arr = map.get(k);
    if (arr) arr.push(d);
    else map.set(k, [d]);
  }
  const clubs: Club[] = [];
  for (const [key, ds] of map) {
    // Use the most common spelling as the display name.
    const counts = new Map<string, number>();
    for (const d of ds) counts.set(d.lease_holder_name!, (counts.get(d.lease_holder_name!) ?? 0) + 1);
    const name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    ds.sort((a, b) => Number(a.hunt_dist_nr) - Number(b.hunt_dist_nr));
    clubs.push({
      key,
      name,
      type: holderType(ds[0].lease_group_name),
      districts: ds,
      totalArea: ds.reduce((s, d) => s + (d.total_area ?? 0), 0),
      forestArea: ds.reduce((s, d) => s + (d.forest_area ?? 0), 0),
      voivodeships: uniqSorted(ds.map((d) => d.county_name)),
      pzlBoards: uniqSorted(ds.map((d) => d.reg_mng_board_name)),
      forestDistricts: uniqSorted(ds.map((d) => d.inspectorate_name)),
      powiats: uniqSorted(ds.map((d) => d.district_name)),
    });
  }
  return clubs.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export interface GroupStat {
  name: string;
  districts: number;
  holders: number;
  totalArea: number;
  forestArea: number;
}

/** Aggregates districts by an attribute (e.g. voivodeship or PZŁ board). */
export function statsBy(districts: District[], field: keyof District): GroupStat[] {
  const map = new Map<string, { ds: number; holders: Set<string>; area: number; forest: number }>();
  for (const d of districts) {
    const k = (d[field] as string | null) ?? '—';
    let s = map.get(k);
    if (!s) map.set(k, (s = { ds: 0, holders: new Set(), area: 0, forest: 0 }));
    s.ds++;
    if (d.lease_holder_name) s.holders.add(clubKey(d.lease_holder_name));
    s.area += d.total_area ?? 0;
    s.forest += d.forest_area ?? 0;
  }
  return [...map.entries()]
    .map(([name, s]) => ({ name, districts: s.ds, holders: s.holders.size, totalArea: s.area, forestArea: s.forest }))
    .sort((a, b) => b.totalArea - a.totalArea);
}

export function countByType(districts: District[]): Record<HolderType, { districts: number; area: number }> {
  const out = {
    club: { districts: 0, area: 0 },
    pzl: { districts: 0, area: 0 },
    pgl: { districts: 0, area: 0 },
    other: { districts: 0, area: 0 },
    unknown: { districts: 0, area: 0 },
  };
  for (const d of districts) {
    const t = out[holderType(d.lease_group_name)];
    t.districts++;
    t.area += d.total_area ?? 0;
  }
  return out;
}

/** Stable id used in links: "<voivodeship code>-<district number>". */
export function districtSlug(d: Pick<District, 'county_cd' | 'hunt_dist_nr' | 'objectid'>): string {
  return d.county_cd && d.hunt_dist_nr ? `${d.county_cd}-${d.hunt_dist_nr}` : `id${d.objectid}`;
}

export function findBySlug(districts: District[], slug: string): District | undefined {
  return districts.find((d) => districtSlug(d) === slug);
}
