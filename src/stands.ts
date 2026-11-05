// High seats (zwyżki and ambony) of a group hunt: reading them from a Google Earth /
// My Maps KMZ or KML file, and the stored form. The leader loads the club's file into
// a hunt; the points go to that hunt's private branch of the database, never into the
// public app bundle. No DOM or Firebase here, so it runs in unit tests.

/** zwyżka = open seat on a ladder, ambona = closed hut on legs. */
export type StandKind = 'zwyzka' | 'ambona';

export interface Stand {
  name: string;
  kind: StandKind;
  /** Marked as fallen or damaged in its name ("Powalona zwyżka 11A"). */
  broken: boolean;
  lat: number;
  lng: number;
}

export const STAND_LIMITS = { stands: 300, name: 40 } as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** Kind and state from the placemark's name, with its folder's name as a fallback hint. */
export function classifyStand(name: string, folder = ''): { kind: StandKind; broken: boolean } {
  const n = name.toLowerCase();
  const f = folder.toLowerCase();
  const kind: StandKind = /ambon/.test(n) ? 'ambona' : /zwy[żz]k/.test(n) ? 'zwyzka' : /ambon/.test(f) ? 'ambona' : 'zwyzka';
  const broken = /powalon|przewr[óo]con|zniszczon|uszkodzon|rozebran|spalon/.test(n);
  return { kind, broken };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function xmlText(s: string): string {
  const cdata = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENTITIES[e] ?? m),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first <tag>…</tag> directly in `s` (namespace prefixes allowed). */
const tagText = (s: string, tag: string) => {
  const m = s.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i'));
  return m ? m[1] : null;
};

/**
 * Point placemarks of a KML document. Lines and areas are skipped. Names are
 * shortened to STAND_LIMITS.name; placemarks without a name get "Zwyżka 1", "Zwyżka 2"…
 */
export function parseKml(kml: string): Stand[] {
  const out: Stand[] = [];
  const folders: string[] = [];
  // Walk folder openings, folder closings and whole placemarks in document order.
  const re = /<(?:\w+:)?Folder\b[^>]*>|<\/(?:\w+:)?Folder>|<(?:\w+:)?Placemark\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Placemark>/gi;
  let m: RegExpExecArray | null;
  let unnamed = 0;
  while ((m = re.exec(kml))) {
    const tok = m[0];
    if (/^<\//.test(tok)) {
      folders.pop();
      continue;
    }
    if (m[1] === undefined) {
      // A folder: its name is the first <name> before anything nested.
      const rest = kml.slice(re.lastIndex);
      const stop = rest.search(/<(?:\w+:)?(?:Placemark|Folder)\b/i);
      const head = stop < 0 ? rest : rest.slice(0, stop);
      folders.push(xmlText(tagText(head, 'name') ?? ''));
      continue;
    }
    const body = m[1];
    const point = tagText(body, 'Point');
    if (point == null) continue;
    const coords = (tagText(point, 'coordinates') ?? '').trim().split(/\s+/)[0]?.split(',').map(Number) ?? [];
    const [lng, lat] = coords;
    if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const folder = folders[folders.length - 1] ?? '';
    let name = xmlText(tagText(body, 'name') ?? '');
    const { kind, broken } = classifyStand(name, folder);
    if (!name) name = `${kind === 'ambona' ? 'Ambona' : 'Zwyżka'} ${++unnamed}`;
    out.push({ name: name.slice(0, STAND_LIMITS.name), kind, broken, lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  }
  return out;
}

// ---------------------------------------------------------------- KMZ (a zip with doc.kml inside)

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The KML text inside a KMZ archive: doc.kml, or else the first .kml file. */
export async function kmlFromKmz(buf: ArrayBuffer): Promise<string> {
  const b = new Uint8Array(buf);
  const v = new DataView(buf);
  // End of central directory: the last PK\5\6 within the final 64 KB.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('not a zip');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries: { name: string; method: number; size: number; offset: number }[] = [];
  for (let i = 0; i < count && v.getUint32(p, true) === 0x02014b50; i++) {
    const nameLen = v.getUint16(p + 28, true);
    entries.push({
      method: v.getUint16(p + 10, true),
      size: v.getUint32(p + 20, true),
      offset: v.getUint32(p + 42, true),
      name: new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen)),
    });
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  const kmls = entries.filter((e) => /\.kml$/i.test(e.name));
  const e = kmls.find((x) => /(^|\/)doc\.kml$/i.test(x.name)) ?? kmls[0];
  if (!e) throw new Error('no kml in kmz');
  const lh = e.offset;
  if (v.getUint32(lh, true) !== 0x04034b50) throw new Error('bad zip entry');
  const start = lh + 30 + v.getUint16(lh + 26, true) + v.getUint16(lh + 28, true);
  const raw = b.subarray(start, start + e.size);
  const data = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
  if (!data) throw new Error('unsupported zip compression');
  return new TextDecoder().decode(data);
}

/** Stands from a .kmz or .kml file's bytes (zip files start with "PK"). */
export async function standsFromFile(buf: ArrayBuffer): Promise<Stand[]> {
  const b = new Uint8Array(buf);
  const kml = b[0] === 0x50 && b[1] === 0x4b ? await kmlFromKmz(buf) : new TextDecoder().decode(b);
  return parseKml(kml);
}

// ---------------------------------------------------------------- storage

/** Database form: stands/$hunt/$i = { n, k, lat, lng, b? }. */
export function encodeStands(ss: Stand[]): Record<string, { n: string; k: StandKind; lat: number; lng: number; b?: true }> {
  return Object.fromEntries(
    ss.slice(0, STAND_LIMITS.stands).map((s, i) => [
      `s${String(i).padStart(3, '0')}`,
      { n: s.name.slice(0, STAND_LIMITS.name) || '?', k: s.kind, lat: +s.lat.toFixed(6), lng: +s.lng.toFixed(6), ...(s.broken ? { b: true as const } : {}) },
    ]),
  );
}

export function parseStands(v: unknown): Stand[] {
  if (!v || typeof v !== 'object') return [];
  const out: Stand[] = [];
  for (const [, raw] of Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.n !== 'string' || (o.k !== 'zwyzka' && o.k !== 'ambona') || !isNum(o.lat) || !isNum(o.lng)) continue;
    out.push({ name: o.n, kind: o.k, broken: o.b === true, lat: o.lat, lng: o.lng });
  }
  return out;
}

/** Natural order for a list: "2" before "10", "9" before "9A", names after numbers. */
export const sortStands = <T extends Pick<Stand, 'name'>>(ss: T[]): T[] =>
  [...ss].sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }));

/** "54.0123, 18.5843" (as Google Maps copies it), also with spaces, semicolons or decimal commas and spaces. */
export function parseLatLng(s: string): { lat: number; lng: number } | null {
  const t = s.trim();
  const m = t.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/) ?? t.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1].replace(',', '.');
  const lng = +m[2].replace(',', '.');
  if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

export const fmtLatLng = (s: Pick<Stand, 'lat' | 'lng'>) => `${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}`;

/** A name for a new seat: one more than the highest number in use ("24" → "25"). */
export function nextStandName(ss: Pick<Stand, 'name'>[]): string {
  let max = 0;
  for (const s of ss) {
    const m = s.name.match(/^(\d+)/);
    if (m) max = Math.max(max, +m[1]);
  }
  return String(max + 1);
}
