// Downloads the atlas photos listed in src/atlas.ts (every `file: '…'` entry) from Wikimedia
// Commons as 800 px thumbnails into public/atlas/img/, and writes their authors and licences,
// as reported by the Commons API, into src/atlasPhotos.json. Run: node scripts/atlas/fetch-photos.mjs
//
// Only free licences are accepted (public domain, CC0, CC BY, CC BY-SA); anything else stops the
// script. Commons rejects clients without a descriptive User-Agent and rate-limits bursts, so
// requests are spaced out and retried.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const UA = 'PolowanieAtlasBuilder/1.0 (https://github.com/Macieqowski/Hunting-explorer; atlas photo credits)';
const WIDTH = 800;
const ROOT = new URL('../../', import.meta.url);
const OUT_DIR = new URL('public/atlas/img/', ROOT);
const CREDITS = new URL('src/atlasPhotos.json', ROOT);
const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? \d(\.\d)?)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'json') {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    await sleep(5000 * (i + 1));
  }
  throw new Error(`gave up: ${url}`);
}

const stripHtml = (s = '') =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const src = await readFile(new URL('src/atlas.ts', ROOT), 'utf8');
const files = [...new Set([...src.matchAll(/\bfile: '((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'")))];
const old = existsSync(CREDITS) ? JSON.parse(await readFile(CREDITS, 'utf8')) : {};
await mkdir(OUT_DIR, { recursive: true });

const credits = {};
for (const file of files) {
  const name = createHash('sha1').update(file).digest('hex').slice(0, 12) + '.jpg';
  if (old[file] && existsSync(new URL(name, OUT_DIR))) {
    credits[file] = old[file];
    continue;
  }
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size' +
    `&iiurlwidth=${WIDTH}&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|Credit&titles=${encodeURIComponent('File:' + file)}`;
  const page = Object.values((await get(api)).query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`not found on Commons: ${file}`);
  const m = info.extmetadata ?? {};
  const license = stripHtml(m.LicenseShortName?.value);
  if (!ALLOWED.test(license)) throw new Error(`licence not allowed (${license}): ${file}`);
  await sleep(1500);
  const out = new URL(name, OUT_DIR);
  await writeFile(out, await get(info.thumburl, 'buffer'));
  // Commons thumbnails are high quality (~250 KB); recompress if ImageMagick is installed.
  spawnSync('convert', [fileURLToPath(out), '-strip', '-quality', '72', '-interlace', 'JPEG', fileURLToPath(out)]);
  credits[file] = {
    src: `atlas/img/${name}`,
    width: info.thumbwidth,
    height: info.thumbheight,
    author: stripHtml(m.Artist?.value) || stripHtml(m.Credit?.value) || 'unknown',
    license,
    licenseUrl: m.LicenseUrl?.value ?? '',
    page: info.descriptionurl,
  };
  console.log('ok', license, file);
  await sleep(1500);
}
await writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
console.log(`${Object.keys(credits).length} photos`);
