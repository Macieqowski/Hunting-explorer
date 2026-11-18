// The phone's position for everything on screen: "Gdzie jestem?", weather for here, stands,
// sightings, drives, beater guidance. Hunt sharing with the screen off uses the app's location
// service instead (native.ts), and falls back to watchLocation() here.
//
// In the app this is the Gps plugin (GpsPlugin.java: Android's LocationManager, without Google Play
// services; GpsPlugin.swift on iPhone). The WebView's navigator.geolocation gave up after the page's timeout (15-20 s), and on a
// phone without Google services (no network location, no assisted GPS) a cold GPS start takes 40-90 s,
// so no position ever came. Here nothing has a time limit: listening goes on until a position is good
// enough or the person cancels, and is never restarted, because each restart loses the satellite search.
// One native feed is shared by every caller. On the website: watchPosition with no timeout.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isApp } from './platform';

export interface GeoFix {
  lat: number;
  lng: number;
  /** Accuracy radius in metres. */
  acc: number | null;
  /** When the position was measured (ms since 1970). */
  time: number;
  /** The phone's remembered position from earlier, not a new one. */
  cached?: boolean;
}

/** GPS satellites received now, and how many of them make up the position. App only. */
export interface Satellites {
  visible: number;
  used: number;
}

export type GeoErrorCode = 'denied' | 'off' | 'unavailable' | 'cancelled';
export class GeoError extends Error {
  constructor(readonly code: GeoErrorCode) {
    super(code);
  }
}

interface NativeLoc {
  lat: number;
  lng: number;
  acc?: number;
  time: number;
  /** Milliseconds since Android got it. */
  age: number;
}
interface GpsPlugin {
  start(o: { intervalMs: number }): Promise<{ last?: NativeLoc; enabled: boolean }>;
  lastKnown(): Promise<{ last?: NativeLoc }>;
  stop(): Promise<void>;
  addListener(e: 'fix', f: (p: NativeLoc) => void): Promise<PluginListenerHandle>;
  addListener(e: 'satellites', f: (s: Satellites) => void): Promise<PluginListenerHandle>;
}
const Gps = registerPlugin<GpsPlugin>('Gps');

/** App with the Gps plugin (older apps without it use the WebView's geolocation). */
export const hasNativeGps = (): boolean => isApp() && Capacitor.isPluginAvailable('Gps');

export interface WatchOptions {
  /** A remembered position up to this old is passed on at once, marked `cached`. Default 2 min. */
  maxAgeMs?: number;
  /** Website only: false lets the browser use Wi-Fi/network location only. Default true. */
  highAccuracy?: boolean;
  onSatellites?(s: Satellites): void;
  /** Watching has ended because of this; no more fixes come. */
  onError?(e: GeoError): void;
}

interface Sub {
  onFix(f: GeoFix): void;
  opts: WatchOptions;
}

// ---------------------------------------------------------------- the app's shared feed

const subs = new Set<Sub>();
let handles: PluginListenerHandle[] = [];
let feedGen = 0;
/** Starting or started. */
let feedOn = false;
let latest: GeoFix | null = null;
let lastSats: Satellites | null = null;

const fromNative = (p: NativeLoc, cached = false): GeoFix => ({ lat: p.lat, lng: p.lng, acc: p.acc ?? null, time: p.time, cached: cached || undefined });

function giveLast(sub: Sub, last: NativeLoc | undefined) {
  const max = sub.opts.maxAgeMs ?? 120_000;
  if (last && last.age <= max && subs.has(sub)) sub.onFix(fromNative(last, true));
}

async function startFeed() {
  const gen = ++feedGen;
  feedOn = true;
  latest = null;
  lastSats = null;
  try {
    const hs = await Promise.all([
      Gps.addListener('fix', (p) => {
        latest = fromNative(p);
        for (const s of [...subs]) s.onFix(latest);
      }),
      Gps.addListener('satellites', (s) => {
        lastSats = s;
        for (const sub of [...subs]) sub.opts.onSatellites?.(s);
      }),
    ]);
    if (gen !== feedGen) return void hs.forEach((h) => void h.remove());
    handles = hs;
    const r = await Gps.start({ intervalMs: 1000 });
    if (gen !== feedGen) return;
    // Only those who joined before the first live fix get the remembered position.
    if (!latest) for (const s of [...subs]) giveLast(s, r.last);
  } catch (e) {
    if (gen !== feedGen) return;
    const c = (e as { code?: string }).code;
    const err = new GeoError(c === 'DENIED' ? 'denied' : c === 'OFF' ? 'off' : 'unavailable');
    const all = [...subs];
    subs.clear();
    stopFeed();
    for (const s of all) s.opts.onError?.(err);
  }
}

function stopFeed() {
  feedGen++;
  feedOn = false;
  handles.forEach((h) => void h.remove());
  handles = [];
  latest = null;
  lastSats = null;
  void Gps.stop().catch(() => {});
}

function watchNative(sub: Sub): () => void {
  subs.add(sub);
  if (!feedOn) void startFeed();
  else {
    // Joining a running feed: what it already knows, without restarting anything.
    if (lastSats) sub.opts.onSatellites?.(lastSats);
    const max = sub.opts.maxAgeMs ?? 120_000;
    if (latest && Date.now() - latest.time <= max) sub.onFix(latest);
    else void Gps.lastKnown().then((r) => giveLast(sub, r.last), () => {});
  }
  return () => {
    if (!subs.delete(sub)) return;
    if (subs.size === 0) stopFeed();
  };
}

// ---------------------------------------------------------------- the website

function watchBrowser(sub: Sub): () => void {
  if (!('geolocation' in navigator)) {
    queueMicrotask(() => sub.opts.onError?.(new GeoError('unavailable')));
    return () => {};
  }
  let id: number | null = navigator.geolocation.watchPosition(
    (p) => sub.onFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: isFinite(p.coords.accuracy) ? p.coords.accuracy : null, time: p.timestamp }),
    (e) => {
      // A timeout or a moment without a position: the watch goes on.
      if (e.code !== e.PERMISSION_DENIED) return;
      stop();
      sub.opts.onError?.(new GeoError('denied'));
    },
    { enableHighAccuracy: sub.opts.highAccuracy ?? true, maximumAge: sub.opts.maxAgeMs ?? 120_000, timeout: Infinity },
  );
  const stop = () => {
    if (id != null) navigator.geolocation.clearWatch(id);
    id = null;
  };
  return stop;
}

/**
 * Every position until the returned function is called. A recent remembered position comes first
 * (`cached`), then live ones about every second.
 */
export function watchLocation(onFix: (f: GeoFix) => void, opts: WatchOptions = {}): () => void {
  const sub: Sub = { onFix, opts };
  return hasNativeGps() ? watchNative(sub) : watchBrowser(sub);
}

// ---------------------------------------------------------------- one position

export interface LocateOptions extends WatchOptions {
  /** Done once a position is at least this accurate (metres). */
  goodAcc: number;
  /**
   * Once a live position has come but none is accurate enough, the best one is taken after this
   * long (default 20 s). Before the first live position there is no limit: a cold GPS start
   * without Google services can need a minute or two.
   */
  settleMs?: number;
  /** Each position meanwhile, also rough and remembered ones (to show where the person roughly is). */
  onProgress?(f: GeoFix): void;
}

export interface Locating {
  promise: Promise<GeoFix>;
  cancel(): void;
}

/** One good position. Rejects with GeoError: denied, off, unavailable, or cancelled by cancel(). */
export function locate(opts: LocateOptions): Locating {
  let stop: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let best: GeoFix | null = null;
  let done = false;
  let finish: (f: GeoFix | GeoError) => void = () => {};
  const promise = new Promise<GeoFix>((resolve, reject) => {
    finish = (r) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      stop?.();
      stop = null;
      if (r instanceof GeoError) reject(r);
      else resolve(r);
    };
  });
  const good = (f: GeoFix) => f.acc != null && f.acc <= opts.goodAcc;
  stop = watchLocation(
    (f) => {
      opts.onProgress?.(f);
      if (good(f)) return finish(f);
      if (f.cached) return;
      if (!best || (f.acc ?? Infinity) < (best.acc ?? Infinity)) best = f;
      timer ??= setTimeout(() => best && finish(best), opts.settleMs ?? 20_000);
    },
    { ...opts, onError: (e) => finish(e) },
  );
  // Finished already by a position the feed knew.
  if (done) stop();
  return { promise, cancel: () => finish(new GeoError('cancelled')) };
}
