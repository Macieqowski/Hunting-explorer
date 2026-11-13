/**
 * Draws the picture shown when a link to the site is shared (Open Graph, 1200 × 630):
 * landing/public/og.png. Same colours, fonts and brand mark as the welcome page.
 *
 * Usage: node scripts/make-og.mjs
 * Needs the `playwright` package with its Chromium, like scripts/make-icons.mjs; the image is
 * committed, so this only runs when the design changes.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Inline, because a page made with setContent() may not load local files.
const font = (p) => `data:font/woff2;base64,${readFileSync(root + 'node_modules/' + p).toString('base64')}`;
const PIN = 'M16 2c6.1 0 11 4.7 11 10.6 0 7.4-8.3 15.1-11 17.4-2.7-2.3-11-10-11-17.4C5 6.7 9.9 2 16 2Z';
const TREE = 'M16 6l-5 7h2.6l-3.6 5h5v3h2v-3h5l-3.6-5H21z';

const html = `<!doctype html><html><head><style>
@font-face { font-family: B; font-weight: 700; src: url(${font('@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-700-normal.woff2')}); }
@font-face { font-family: B2; font-weight: 700; src: url(${font('@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-ext-700-normal.woff2')}); }
@font-face { font-family: I; font-weight: 400 700; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}); }
@font-face { font-family: I2; font-weight: 400 700; src: url(${font('@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2')}); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #f3f2ec; font-family: I, I2; color: #1b211c; display: flex; overflow: hidden; }
.l { flex: 1; padding: 72px 0 64px 80px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 16px; font: 700 44px B, B2; }
h1 { font: 700 72px/1.02 B, B2; letter-spacing: 0.005em; max-width: 640px; }
p { font-size: 28px; line-height: 1.4; color: #454c45; max-width: 620px; }
.url { font: 600 26px I, I2; color: #1e5a3a; }
.r { width: 430px; position: relative; background: #e9e6d8; }
.r svg { position: absolute; inset: 0; }
</style></head><body>
<div class="l">
  <div class="brand"><svg width="56" height="56" viewBox="0 0 32 32"><path fill="#1e5a3a" d="${PIN}"/><path fill="#fff" d="${TREE}"/></svg>Polowanie</div>
  <div><h1>Obwody łowieckie, polowania zbiorowe i wiedza łowiecka</h1></div>
  <p>Mapa obwodów także offline, okresy polowań, atlas zwierzyny, egzamin na myśliwego.</p>
  <div class="url">www.polowanie.org</div>
</div>
<div class="r"><svg viewBox="0 0 430 630" preserveAspectRatio="xMidYMid slice">
  <rect width="430" height="630" fill="#e9e6d8"/>
  <path d="M-20 90C60 50 190 70 270 110s180 50 180 140v400H-20Z" fill="#c6dab4"/>
  <path d="M-10 420C90 390 160 440 250 410S360 380 450 395" fill="none" stroke="#a9cde0" stroke-width="9" stroke-linecap="round"/>
  <path d="M60 150 370 128 392 360 80 384Z" fill="rgba(194,65,12,0.12)" stroke="#c2410c" stroke-width="3.5" stroke-dasharray="11 7" stroke-linejoin="round"/>
  <path d="M84 364 384 340" stroke="#1b211c" stroke-width="2"/>
  <g fill="#fff" stroke="#1b211c" stroke-width="2"><circle cx="100" cy="363" r="12"/><circle cx="160" cy="358" r="12"/><circle cx="220" cy="353" r="12"/><circle cx="280" cy="348" r="12"/><circle cx="376" cy="341" r="12"/></g>
  <circle cx="328" cy="344" r="16" fill="#2563eb" stroke="#fff" stroke-width="3.5"/>
  <g fill="#c2410c" stroke="#fff" stroke-width="2"><path d="M88 180h20l-10 18ZM150 174h20l-10 18ZM212 176h20l-10 18ZM274 168h20l-10 18ZM336 170h20l-10 18Z"/></g>
</svg></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: root + 'landing/public/og.png' });
await browser.close();
console.log('landing/public/og.png');
