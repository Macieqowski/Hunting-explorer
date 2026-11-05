// Reporting game during a hunt: pick the animal and how many, then point the phone
// where it went. A full-screen sheet built outside the page's re-rendering, because
// the compass updates many times a second.

import { SPECIES, HERDS, compassPoint, declination, headingFromOrientation, normDeg, type Species, type Herd, type HeadingSource } from './hunt';
import { speciesIcon } from './huntIcons';

export interface ReportText {
  title: string; // "What did you see?"
  count: string; // "How many"
  species: Record<Species, string>;
  herd: (h: Herd) => string;
  where: (sp: string) => string; // "Boar, which way?"
  point: string; // "Point the phone where the game went"
  went: string; // "It went there"
  noCompass: string;
  calibrate: string;
  useButtons: string;
  useCompass: string;
  cancel: string;
  back: string;
  saving: string;
}

export interface ReportResult {
  species: Species;
  count: Herd;
  heading: number; // true north
  src: HeadingSource;
}

type OrientationEventIOS = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type PermissionAPI = { requestPermission?: () => Promise<string> };

let sheet: HTMLElement | null = null;
let stopCompass: () => void = () => {};

export const reportOpen = () => !!sheet;

/** Ask for motion sensors on iPhones; must run inside the tap that opens the sheet. */
function askPermission(): Promise<boolean> {
  const api = (window.DeviceOrientationEvent as unknown as PermissionAPI | undefined)?.requestPermission;
  if (!api) return Promise.resolve(true);
  // Only a clear "denied" means no compass; anything else ("granted", or "prompt" in some
  // Chrome versions) is worth listening to, and the sheet falls back to buttons if nothing arrives.
  return api().then(
    (r) => r !== 'denied',
    () => true,
  );
}

/**
 * Listen to the compass. cb gets a smoothed heading from magnetic north and whether the
 * sensor asks for calibration. Returns a stop function.
 */
function listenCompass(cb: (deg: number, needsCalibration: boolean) => void): () => void {
  let x = 0;
  let y = 0;
  let have = false;
  const feed = (deg: number, cal: boolean) => {
    const r = (deg * Math.PI) / 180;
    // Exponential smoothing on the unit circle, so 359° and 1° average to 0°, not 180°.
    x = have ? x * 0.7 + Math.sin(r) * 0.3 : Math.sin(r);
    y = have ? y * 0.7 + Math.cos(r) * 0.3 : Math.cos(r);
    have = true;
    cb(normDeg((Math.atan2(x, y) * 180) / Math.PI), cal);
  };
  let absSeen = false;
  const onAbs = (e: DeviceOrientationEvent) => {
    absSeen = true;
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    // Chrome reports alpha counter-clockwise from north.
    const h = headingFromOrientation(e.alpha, e.beta, e.gamma);
    if (h != null) feed(h, false);
  };
  const onIOS = (e: Event) => {
    const o = e as OrientationEventIOS;
    if (typeof o.webkitCompassHeading === 'number' && o.webkitCompassHeading >= 0)
      feed(o.webkitCompassHeading, o.webkitCompassAccuracy == null || o.webkitCompassAccuracy < 0 || o.webkitCompassAccuracy > 25);
    else if (o.absolute && !absSeen && o.alpha != null && o.beta != null && o.gamma != null) {
      const h = headingFromOrientation(o.alpha, o.beta, o.gamma);
      if (h != null) feed(h, false);
    }
  };
  // Android Chrome sends 'deviceorientationabsolute'; iPhones send 'deviceorientation' with
  // webkitCompassHeading; Firefox sends 'deviceorientation' with absolute = true. Listen to both.
  window.addEventListener('deviceorientationabsolute', onAbs as EventListener);
  window.addEventListener('deviceorientation', onIOS);
  return () => {
    window.removeEventListener('deviceorientationabsolute', onAbs as EventListener);
    window.removeEventListener('deviceorientation', onIOS);
  };
}

const ARROWS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const GLYPH: Record<string, string> = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };

/**
 * Open the report sheet. `lng` gives the longitude for the declination correction.
 * onSave resolves when stored; the sheet closes then, or shows the error and stays.
 */
export function openReport(text: ReportText, lng: () => number | null, onSave: (r: ReportResult) => Promise<void>) {
  if (sheet) return;
  const perm = askPermission();
  let count: Herd = HERDS[0];
  let species: Species | null = null;
  let heading: number | null = null;
  let manual = false;

  sheet = document.createElement('div');
  sheet.className = 'hs-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', text.title);
  document.body.append(sheet);
  const el = sheet;

  const close = () => {
    stopCompass();
    stopCompass = () => {};
    el.remove();
    if (sheet === el) sheet = null;
  };

  const stepAnimal = () => {
    stopCompass();
    el.innerHTML = `<div class="hs-top"><strong>${text.title}</strong><button type="button" class="hs-x" data-s="cancel" aria-label="${text.cancel}">✕</button></div>
      <div class="hs-count" role="radiogroup" aria-label="${text.count}"><span>${text.count}</span>${HERDS.map(
        (h) => `<button type="button" role="radio" aria-checked="${h === count}" data-s="count" data-v="${h}">${text.herd(h)}</button>`,
      ).join('')}</div>
      <div class="hs-grid">${SPECIES.map((sp) => `<button type="button" class="hs-sp" data-s="species" data-v="${sp}">${speciesIcon(sp, 56)}<span>${text.species[sp]}</span></button>`).join('')}</div>`;
  };

  const stepDirection = () => {
    const name = `${text.species[species!]} ${text.herd(count)}`;
    el.innerHTML = `<div class="hs-top"><button type="button" class="hs-x" data-s="back" aria-label="${text.back}">←</button><strong>${text.where(name)}</strong><button type="button" class="hs-x" data-s="cancel" aria-label="${text.cancel}">✕</button></div>
      <div class="hs-compass" ${manual ? 'hidden' : ''}>
        <p class="hs-hint">${text.point}</p>
        <div class="hs-dial"><svg viewBox="-100 -100 200 200" aria-hidden="true">
          <g class="hs-rose"><circle r="92" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="2"/>
          ${ARROWS.map((p, i) => `<text transform="rotate(${i * 45}) translate(0 -72) rotate(${-i * 45})" text-anchor="middle" dominant-baseline="middle" class="${p === 'N' ? 'hs-n' : ''}">${p}</text>`).join('')}</g>
          <path d="M0 -60 L16 10 L0 0 L-16 10 Z" fill="#c2410c"/></svg></div>
        <div class="hs-read" aria-live="polite">…</div>
        <p class="hs-cal" hidden>${text.calibrate}</p>
        <button type="button" class="btn hs-go" data-s="went" disabled>${text.went}</button>
        <button type="button" class="btn ghost small" data-s="manual">${text.useButtons}</button>
      </div>
      <div class="hs-manual" ${manual ? '' : 'hidden'}>
        <p class="hs-hint hs-nocompass" hidden>${text.noCompass}</p>
        <div class="hs-dirs">${['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE']
          .map((p) => (p ? `<button type="button" data-s="dir" data-v="${ARROWS.indexOf(p) * 45}">${GLYPH[p]}<small>${p}</small></button>` : '<span></span>'))
          .join('')}</div>
        <button type="button" class="btn ghost small" data-s="compass">${text.useCompass}</button>
      </div>
      <p class="hs-err" role="alert" hidden></p>`;
    const rose = el.querySelector<SVGGElement>('.hs-rose')!;
    const read = el.querySelector<HTMLElement>('.hs-read')!;
    const labels = [...rose.querySelectorAll('text')];
    const go = el.querySelector<HTMLButtonElement>('[data-s="went"]')!;
    const cal = el.querySelector<HTMLElement>('.hs-cal')!;
    heading = null;
    stopCompass();
    let got = false;
    perm.then((ok) => {
      if (sheet !== el || !el.querySelector('.hs-dial')) return;
      if (!ok) return showManual(true);
      const stop = listenCompass((mag, needsCal) => {
        got = true;
        const decl = declination(lng() ?? 19);
        heading = normDeg(mag + decl);
        rose.setAttribute('transform', `rotate(${-heading})`);
        // Keep the letters upright while the dial turns.
        labels.forEach((t, i) => t.setAttribute('transform', `rotate(${i * 45}) translate(0 -72) rotate(${heading! - i * 45})`));
        read.textContent = `${compassPoint(heading)} · ${Math.round(heading)}°`;
        go.disabled = false;
        cal.hidden = !needsCal;
      });
      stopCompass = stop;
      // No reading at all (desktop, or a phone without a magnetometer): offer the buttons.
      setTimeout(() => {
        if (!got && sheet === el && !manual) showManual(true);
      }, 2500);
    });
  };

  const showManual = (noCompass: boolean) => {
    manual = true;
    el.querySelector<HTMLElement>('.hs-compass')!.hidden = true;
    el.querySelector<HTMLElement>('.hs-manual')!.hidden = false;
    el.querySelector<HTMLElement>('.hs-nocompass')!.hidden = !noCompass;
  };

  const save = (deg: number, src: HeadingSource) => {
    const err = el.querySelector<HTMLElement>('.hs-err');
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
    if (err) {
      err.hidden = false;
      err.className = 'hs-err hs-saving';
      err.textContent = text.saving;
    }
    stopCompass();
    onSave({ species: species!, count, heading: normDeg(deg), src }).then(close, (e: Error) => {
      if (sheet !== el) return;
      el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false));
      if (err) {
        err.className = 'hs-err';
        err.textContent = e.message;
      }
    });
  };

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-s]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    switch (b.dataset.s) {
      case 'cancel':
        return close();
      case 'count':
        count = b.dataset.v as Herd;
        el.querySelectorAll('[data-s="count"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        return;
      case 'species':
        species = b.dataset.v as Species;
        return stepDirection();
      case 'back':
        return stepAnimal();
      case 'manual':
        return showManual(false);
      case 'compass':
        manual = false;
        return stepDirection();
      case 'went':
        if (heading != null) save(heading, 'compass');
        return;
      case 'dir':
        return save(Number(b.dataset.v), 'buttons');
    }
  });
  stepAnimal();
}

export function closeReport() {
  stopCompass();
  sheet?.remove();
  sheet = null;
}
