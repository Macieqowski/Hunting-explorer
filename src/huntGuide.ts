// Route guidance ("Prowadzenie"): a big arrow to the next point of my route (or to a
// carcass), the distance, how far off the route I am, and vibrations that can be told
// apart with the phone in a pocket. Keeps its own GPS watch and compass listener while
// active; the card is updated in place, without re-rendering the page.

import { declination, distanceM, bearing, compassPoint } from './hunt';
import { guide, buzzFor, arrowAngle, BUZZ, type Guidance, type GuideState, type Pt, type Route } from './huntCrew';
import { askPermission, listenCompass } from './huntSighting';

export type GuideTarget =
  | { kind: 'route'; route: Route; started: boolean; title: string }
  | { kind: 'point'; at: Pt; title: string };

export interface GuideText {
  toStart: string; // "Go to the start of your route"
  onRoute: (toEnd: string) => string; // "On your route · 640 m to the end"
  off: (m: string, side: 'left' | 'right' | null) => string; // "70 m right of your route, go back"
  nearEnd: (m: string) => string; // "Careful: hunters' line in 80 m"
  arrived: string; // "End of your route"
  pointArrived: string; // "You are there"
  noFix: string; // "Waiting for GPS…"
  noCompass: string; // "No compass: the arrow is relative to north (up = N)"
  compassOn: string; // "Turn on the compass"
  calibrate: string;
  off_: string; // "Turn off"
  north: string; // "N"
}

const ARRIVED_POINT_M = 25;

let target: GuideTarget | null = null;
let text: GuideText | null = null;
let fix: Pt | null = null;
let fixAcc: number | null = null;
let heading: number | null = null; // magnetic, smoothed
let calib = false;
let watchId: number | null = null;
let stopCompass: (() => void) | null = null;
let last: Guidance | null = null;
let lastState: GuideState | null = null;
let lastOffBuzz = 0;
let onUpdate: (g: Guidance | null, me: Pt | null) => void = () => {};

const fmtM = (m: number) => (m < 1000 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(1)} km`);

export const guideActive = () => !!target;
export const guideNow = () => last;

/** Set (or clear) what to guide to. Starts and stops GPS and compass as needed. */
export function setGuide(t: GuideTarget | null, txt: GuideText, cb: (g: Guidance | null, me: Pt | null) => void) {
  text = txt;
  onUpdate = cb;
  const was = target;
  target = t;
  if (!t) {
    stopAll();
    last = null;
    lastState = null;
    onUpdate(null, null);
    return;
  }
  if (!was || was.kind !== t.kind || was.title !== t.title) lastState = null;
  startGps();
  // Android gives compass events without asking; iPhones need a tap (see compassButton).
  if (!stopCompass && !needsPermission()) startCompass();
  recompute();
}

/** A fix from location sharing, so the guidance does not wait for its own. */
export function guideFix(p: Pt, acc: number | null = null) {
  if (!target) return;
  fix = p;
  fixAcc = acc;
  recompute();
}

const needsPermission = () => typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined)?.requestPermission === 'function';

/** Called from the "turn on compass" tap (iPhones ask for permission inside a tap). */
export function enableCompass() {
  askPermission().then((ok) => {
    if (ok) startCompass();
    paint();
  });
}

function startGps() {
  if (watchId != null || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      fix = { lat: p.coords.latitude, lng: p.coords.longitude };
      fixAcc = isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
      recompute();
    },
    () => paint(),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 60_000 },
  );
}

function startCompass() {
  if (stopCompass) return;
  stopCompass = listenCompass((deg, needsCal) => {
    heading = deg;
    calib = needsCal;
    turnArrow();
  });
}

function stopAll() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  stopCompass?.();
  stopCompass = null;
  heading = null;
  fix = null;
}

function recompute() {
  if (!target || !fix) {
    last = null;
    paint();
    return;
  }
  if (target.kind === 'route') last = guide(target.route, fix, target.started);
  else {
    const d = distanceM(fix, target.at);
    last = { state: d <= ARRIVED_POINT_M ? 'arrived' : 'onRoute', target: target.at, distM: d, bearing: bearing(fix, target.at), offM: 0, side: null, toEndM: d };
  }
  if (target.kind === 'route') {
    const now = Date.now();
    const b = buzzFor(lastState, last.state, lastOffBuzz, now);
    if (b) {
      navigator.vibrate?.([...BUZZ[b]]);
      if (b === 'off') lastOffBuzz = now;
    }
  } else if (last.state === 'arrived' && lastState !== 'arrived') navigator.vibrate?.([...BUZZ.arrived]);
  lastState = last.state;
  onUpdate(last, fix);
  paint();
}

/** True-north heading of the phone, or null without a compass. */
const trueHeading = () => (heading == null || !fix ? null : (heading + declination(fix.lng)) % 360);

function turnArrow() {
  const el = document.querySelector<HTMLElement>('.hg-arrow');
  if (!el || !last) return;
  el.style.setProperty('--deg', `${Math.round(arrowAngle(last.bearing, trueHeading()))}deg`);
  document.querySelector('.hg-card')?.classList.toggle('hg-nocompass', heading == null);
  const cal = document.querySelector<HTMLElement>('.hg-cal');
  if (cal) cal.hidden = !calib;
}

/** One line for the pocket screen. */
export function guideLine(): string {
  if (!target || !text) return '';
  if (!last) return text.noFix;
  return `${compassPoint(last.bearing)} ${fmtM(last.distM)} · ${stateText(last)}`;
}

function stateText(g: Guidance): string {
  const t = text!;
  if (target?.kind === 'point') return g.state === 'arrived' ? t.pointArrived : fmtM(g.distM);
  switch (g.state) {
    case 'toStart':
      return t.toStart;
    case 'onRoute':
      return t.onRoute(fmtM(g.toEndM));
    case 'off':
      return t.off(fmtM(g.offM), g.side);
    case 'nearEnd':
      return t.nearEnd(fmtM(g.toEndM));
    case 'arrived':
      return t.arrived;
  }
}

/** The card's HTML for the page render; later changes are painted in place. */
export function guideCardHtml(): string {
  if (!target || !text) return '';
  return `<div class="hg-card card" role="status" aria-live="polite">${inner()}</div>`;
}

function inner(): string {
  const t = text!;
  const g = last;
  const head = `<div class="hg-head"><strong>${esc(target!.title)}</strong><button type="button" class="btn small ghost" data-hunt="guideOff">${t.off_}</button></div>`;
  if (!g) return `${head}<p class="muted">${t.noFix}</p>`;
  const deg = Math.round(arrowAngle(g.bearing, trueHeading()));
  const warn = g.state === 'off' || g.state === 'nearEnd';
  const compass =
    heading == null
      ? `<p class="small muted hg-north">${t.noCompass}${needsPermission() ? ` <button type="button" class="btn small" data-hunt="guideCompass">${t.compassOn}</button>` : ''}</p>`
      : `<p class="small hg-cal"${calib ? '' : ' hidden'}>${t.calibrate}</p>`;
  return `${head}
    <div class="hg-body${warn ? ' hg-warn' : ''}${g.state === 'arrived' ? ' hg-done' : ''}">
      <div class="hg-dial">${heading == null ? `<span class="hg-n" aria-hidden="true">${t.north}</span>` : ''}<div class="hg-arrow" style="--deg:${deg}deg" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="96" height="96"><path d="M50 6 82 88 50 70 18 88z"/></svg></div></div>
      <div class="hg-info"><div class="hg-dist">${fmtM(g.distM)} <span class="muted">${compassPoint(g.bearing)}</span></div>
        <div class="hg-state">${esc(stateText(g))}</div>${fixAcc != null && fixAcc > 30 ? `<div class="small muted">GPS ±${Math.round(fixAcc)} m</div>` : ''}</div>
    </div>${compass}`;
}

function paint() {
  const el = document.querySelector('.hg-card');
  if (el && target && text) el.innerHTML = inner();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
