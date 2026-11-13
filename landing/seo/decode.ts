import { DISTRICT_FIELDS, type District } from '../../src/bdl';

/**
 * Reads public/data/districts.json (the compact list made by scripts/snapshot-districts.mjs).
 * Same format as decodeSnapshot() in src/districtData.ts, which cannot be imported here
 * because it pulls in the browser storage code.
 */
export function decodeDistricts(s: { fields: string[]; text: number[]; strings: string[]; rows: (number | null)[][] }): District[] {
  const col = new Map(s.fields.map((f, i) => [f, i]));
  const text = new Set(s.text);
  return s.rows.map((row) => {
    const d: Record<string, unknown> = {};
    for (const f of DISTRICT_FIELDS) {
      const i = col.get(f);
      const v = i === undefined ? null : row[i];
      d[f] = v == null ? null : text.has(i!) ? (s.strings[v] ?? null) : v;
    }
    return d as unknown as District;
  });
}
