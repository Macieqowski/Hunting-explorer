// "Looking for satellites" while a position is being found: a small bar at the bottom of the screen
// with the number of satellites GPS sees and uses, and a Cancel button. Without Google services the
// first position can take one or two minutes, and without this the app looked stuck.

import { GeoError, locate, type GeoFix, type LocateOptions, type Satellites } from './geo';
import { t } from './i18n';

/** Shown only when finding the position takes longer than this, so a quick answer does not flash. */
const SHOW_AFTER_MS = 700;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let bar: HTMLElement | null = null;
let current: { cancel(): void } | null = null;

function paint(sats: Satellites | null, rough: GeoFix | null, since: number) {
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'gps-status';
    bar.setAttribute('role', 'status');
    bar.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-gps-cancel]')) current?.cancel();
    });
    document.body.appendChild(bar);
  }
  const head = rough ? t('gpsRough').replace('{m}', String(Math.round(rough.acc ?? 0))) : t('gpsSearching');
  const count = sats ? t('gpsSats').replace('{v}', String(sats.visible)).replace('{u}', String(sats.used)) : '';
  // The hint about the long first start only once it is clearly not quick.
  const hint = !rough && Date.now() - since > 8000 ? t('gpsColdHint') : '';
  bar.innerHTML = `<span class="gps-dot" aria-hidden="true"></span><div><b>${esc(head)}</b>${count ? `<br><small>${esc(count)}</small>` : ''}${
    hint ? `<br><small>${esc(hint)}</small>` : ''
  }</div><button type="button" class="btn small" data-gps-cancel>${esc(t('gpsCancel'))}</button>`;
}

function hide() {
  bar?.remove();
  bar = null;
}

/**
 * locate() with the bar. A new call cancels the one shown before (only one bar at a time).
 * Rejects with GeoError like locate().
 */
export function locateWithStatus(opts: LocateOptions): Promise<GeoFix> {
  current?.cancel();
  const since = Date.now();
  let sats: Satellites | null = null;
  let rough: GeoFix | null = null;
  let shown = false;
  const repaint = () => shown && paint(sats, rough, since);
  const job = locate({
    ...opts,
    onSatellites(s) {
      sats = s;
      opts.onSatellites?.(s);
      repaint();
    },
    onProgress(f) {
      rough = f;
      opts.onProgress?.(f);
      repaint();
    },
  });
  const me = { cancel: job.cancel };
  current = me;
  const showTimer = setTimeout(() => {
    shown = true;
    repaint();
  }, SHOW_AFTER_MS);
  // Brings up the long-start hint even when nothing else changes.
  const hintTimer = setInterval(repaint, 4000);
  const end = () => {
    clearTimeout(showTimer);
    clearInterval(hintTimer);
    if (current === me) {
      current = null;
      hide();
    }
  };
  job.promise.then(end, end);
  return job.promise;
}

/** Message for a failed position (empty when the person cancelled). */
export function geoErrorText(e: unknown, fallback = t('locateFail')): string {
  if (!(e instanceof GeoError)) return fallback;
  if (e.code === 'cancelled') return '';
  if (e.code === 'off') return t('gpsOff');
  return fallback;
}
