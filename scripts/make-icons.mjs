/**
 * Draws every icon of the app from the brand mark (branding/mark.svg: a map pin with a spruce):
 * the website icons in public/, the Android launcher icons and the launch screens.
 *
 * Usage: node scripts/make-icons.mjs
 * Needs the `playwright` package with its Chromium (it is not a dependency of the app; the
 * images are committed, so this only runs when the mark changes).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const GREEN = '#1e5a3a';
const PIN = 'M16 2c6.1 0 11 4.7 11 10.6 0 7.4-8.3 15.1-11 17.4-2.7-2.3-11-10-11-17.4C5 6.7 9.9 2 16 2Z';
const TREE = 'M16 6l-5 7h2.6l-3.6 5h5v3h2v-3h5l-3.6-5H21z';

/** The mark for app icons (white pin, green tree), `h` px tall, centred in a w × hh canvas. */
function art(w, hh, h, { bg = GREEN, shape = 'square' } = {}) {
  const k = h / 28; // the pin is 28 units tall in the 32-unit drawing
  const back =
    bg === null ? '' : shape === 'circle' ? `<circle cx="${w / 2}" cy="${hh / 2}" r="${Math.min(w, hh) / 2}" fill="${bg}"/>` : `<rect width="${w}" height="${hh}" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">${back}<g transform="translate(${w / 2} ${hh / 2}) scale(${k}) translate(-16 -16)"><path fill="#ffffff" d="${PIN}"/><path fill="${GREEN}" d="${TREE}"/></g></svg>`;
}

const res = 'android/app/src/main/res/';
const jobs = [
  // Website and "add to home screen". The 512 px one is also the maskable icon: the mark stays inside its safe circle.
  ['public/icon-192.png', art(192, 192, 192 * 0.56)],
  ['public/icon-512.png', art(512, 512, 512 * 0.56)],
  ['public/apple-touch-icon.png', art(180, 180, 180 * 0.58)],
];
// Android launcher: legacy square and round icons, and the foreground of the adaptive icon
// (108 dp canvas; the mark stays inside the 66 dp circle every launcher shows).
for (const [d, s] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  jobs.push([`${res}mipmap-${d}/ic_launcher.png`, art(48 * s, 48 * s, 48 * s * 0.58)]);
  jobs.push([`${res}mipmap-${d}/ic_launcher_round.png`, art(48 * s, 48 * s, 48 * s * 0.56, { shape: 'circle' })]);
  jobs.push([`${res}mipmap-${d}/ic_launcher_foreground.png`, art(108 * s, 108 * s, 46 * s, { bg: null })]);
}
// Launch screen on Android 9–11 (Android 12+ draws its own from the icon, see values/styles.xml).
const splash = { '': [480, 320], '-land-mdpi': [480, 320], '-land-hdpi': [800, 480], '-land-xhdpi': [1280, 720], '-land-xxhdpi': [1600, 960], '-land-xxxhdpi': [1920, 1280], '-port-mdpi': [320, 480], '-port-hdpi': [480, 800], '-port-xhdpi': [720, 1280], '-port-xxhdpi': [960, 1600], '-port-xxxhdpi': [1280, 1920] };
for (const [dir, [w, h]] of Object.entries(splash)) jobs.push([`${res}drawable${dir}/splash.png`, art(w, h, Math.min(w, h) * 0.3)]);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, svg] of jobs) {
  const [, w, h] = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  await page.setViewportSize({ width: Math.round(+w), height: Math.round(+h) });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  mkdirSync(dirname(root + file), { recursive: true });
  await page.screenshot({ path: root + file, omitBackground: true });
  console.log(file, `${w}×${h}`);
}
await browser.close();
