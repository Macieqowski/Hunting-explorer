#!/usr/bin/env node
/**
 * Saves the attributes of every hunting district (obwód łowiecki) from the State Forests' BDL
 * into public/data/districts.json, so the website and the Android app start with the club and
 * district list built in instead of downloading it from BDL on every start.
 *
 * Usage: node scripts/snapshot-districts.mjs [--out public/data] [--fallback https://www.polowanie.org/data/]
 *
 * Order of sources: BDL now → the snapshot the live website serves (--fallback) → the file
 * already in --out. The build fails only if none of them gives a plausible list.
 *
 * Writes two files:
 *   districts.json       the data (see encodeSnapshot)
 *   districts-meta.json  { format, version, date, count }, which the app checks for updates
 * `version` is a hash of the content, so an unchanged list keeps its version and apps do not
 * download it again.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const FORMAT = 1;
const LAYER = 'https://mapserver.bdl.lasy.gov.pl/arcgis/rest/services/WMS_Obwody_lowieckie/MapServer/6/query';
// Keep in sync with DISTRICT_FIELDS in src/bdl.ts.
export const FIELDS = [
  'objectid',
  'hd_int_num',
  'hunt_dist_nr',
  'a_year',
  'total_area',
  'forest_area',
  'after_exclusion_area',
  'county_cd',
  'county_name',
  'district_name',
  'inspectorate_name',
  'inspectorate_adr',
  'region_name',
  'region_adr',
  'reg_mng_board_name',
  'reg_mng_board_adr',
  'lease_holder_name',
  'lease_holder_adr',
  'lease_group_name',
];
/** Fewer districts than this means a broken answer, not a real change (Poland has ~4800). */
export const MIN_COUNT = 4000;
// BDL refuses requests without a browser-like User-Agent.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/**
 * Compact form: every string is stored once in `strings`. A row holds one value per field:
 * in the columns listed in `text` an index into `strings` (or null), elsewhere the number.
 * Rows are sorted by objectid so equal data gives an equal file.
 */
export function encodeSnapshot(districts, date) {
  const text = FIELDS.map((f, i) => (districts.some((d) => typeof d[f] === 'string') ? i : -1)).filter((i) => i >= 0);
  const strings = [];
  const index = new Map();
  const str = (s) => {
    if (s == null) return null;
    let i = index.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      index.set(s, i);
    }
    return i;
  };
  const sorted = [...districts].sort((a, b) => a.objectid - b.objectid);
  const rows = sorted.map((d) => FIELDS.map((f, i) => (text.includes(i) ? str(d[f]) : d[f] ?? null)));
  const body = { fields: FIELDS, text, strings, rows };
  const version = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { format: FORMAT, version, date, count: rows.length, source: 'Bank Danych o Lasach, mapserver.bdl.lasy.gov.pl', ...body };
}

export function metaOf(snapshot) {
  const { format, version, date, count } = snapshot;
  return { format, version, date, count };
}

/** Same clean-up as toDistrict in src/bdl.ts: trimmed strings, empty → null. */
function clean(attrs) {
  const d = {};
  for (const f of FIELDS) {
    const v = attrs[f];
    d[f] = typeof v === 'string' ? v.trim() || null : v ?? null;
  }
  return d;
}

async function getJson(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.error) throw new Error(`BDL: ${data.error.message}`);
      return data;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}

const q = (params) => `${LAYER}?${new URLSearchParams({ f: 'json', ...params })}`;

export async function fetchFromBdl() {
  const ids = (await getJson(q({ where: '1=1', returnIdsOnly: 'true' }))).objectIds ?? [];
  ids.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const part = ids.slice(i, i + 1000);
    const res = await getJson(
      q({ where: `objectid >= ${part[0]} AND objectid <= ${part[part.length - 1]}`, outFields: FIELDS.join(','), returnGeometry: 'false' }),
    );
    out.push(...(res.features ?? []).map((f) => clean(f.attributes)));
  }
  if (out.length !== ids.length) throw new Error(`BDL gave ${out.length} of ${ids.length} districts`);
  return out;
}

export function isValidSnapshot(s) {
  return (
    !!s &&
    s.format === FORMAT &&
    Array.isArray(s.rows) &&
    s.rows.length === s.count &&
    s.count >= MIN_COUNT &&
    JSON.stringify(s.fields) === JSON.stringify(FIELDS)
  );
}

function write(dir, snapshot) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'districts.json'), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(dir, 'districts-meta.json'), JSON.stringify(metaOf(snapshot)) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
  };
  const dir = opt('--out', 'public/data');
  const fallback = opt('--fallback', 'https://www.polowanie.org/data/');
  const file = path.join(dir, 'districts.json');
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

  try {
    const districts = await fetchFromBdl();
    if (districts.length < MIN_COUNT) throw new Error(`only ${districts.length} districts`);
    let snap = encodeSnapshot(districts, new Date().toISOString().slice(0, 10));
    // Unchanged data keeps the date it was first seen with.
    if (existing?.version === snap.version) snap = { ...snap, date: existing.date };
    write(dir, snap);
    console.log(`BDL: ${snap.count} districts, version ${snap.version} (${snap.date})`);
    return;
  } catch (e) {
    console.warn(`::warning::BDL unavailable (${e.message}); using the previous snapshot.`);
  }
  if (fallback) {
    try {
      const prev = await getJson(new URL('districts.json', fallback).href, 2);
      if (isValidSnapshot(prev) && (!existing || prev.date >= existing.date)) {
        write(dir, prev);
        console.log(`Website snapshot: ${prev.count} districts, version ${prev.version} (${prev.date})`);
        return;
      }
    } catch (e) {
      console.warn(`::warning::No snapshot on the website (${e.message}).`);
    }
  }
  if (isValidSnapshot(existing)) {
    write(dir, existing);
    console.log(`Kept ${file}: ${existing.count} districts, version ${existing.version} (${existing.date})`);
    return;
  }
  console.error('::error::No district data: BDL, the website and the repository all failed.');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
