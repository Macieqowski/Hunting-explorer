// Phone features the website cannot have, through the app's own Android plugins
// (android/app/src/main/java/org/polowanie/app): location with the screen off, vibration and
// notifications that reach a phone in the pocket, and a compass that knows its accuracy.
// On the website each function falls back to the browser's version, or reports that it has none.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isApp } from './platform';

export interface NativeFix {
  lat: number;
  lng: number;
  acc?: number;
  time: number;
}

/**
 * What the location service needs to send my position to the hunt's database itself, with the
 * screen locked (see PositionPublisher.java): the page's anonymous Firebase sign-in and the hunt.
 */
export interface NativePublish {
  dbUrl: string;
  apiKey: string;
  refreshToken: string;
  idToken?: string;
  idTokenExpiresAt?: number;
  uid: string;
  huntId: string;
  heartbeatMs: number;
  minMoveM: number;
}

interface BackgroundLocationPlugin {
  start(o: { title: string; text: string; stopLabel: string; intervalMs: number; publish?: NativePublish }): Promise<{ publishing?: boolean } | undefined>;
  stop(): Promise<void>;
  addListener(e: 'location', f: (p: NativeFix) => void): Promise<PluginListenerHandle>;
  addListener(e: 'stopped', f: () => void): Promise<PluginListenerHandle>;
  addListener(e: 'satellites', f: (s: { visible: number; used: number }) => void): Promise<PluginListenerHandle>;
  addListener(e: 'sent', f: (s: { at: number }) => void): Promise<PluginListenerHandle>;
  addListener(e: 'denied', f: () => void): Promise<PluginListenerHandle>;
}
interface AlertsPlugin {
  vibrate(o: { pattern: number[]; alarm?: boolean }): Promise<void>;
  notify(o: { title: string; text: string }): Promise<void>;
  clear(): Promise<void>;
}
interface BarsPlugin {
  set(o: { color: string; dark: boolean }): Promise<void>;
}
export interface NativeHeading {
  heading: number | null;
  accuracy: number | null;
  calibrate: boolean;
}
interface CompassPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(e: 'heading', f: (h: NativeHeading) => void): Promise<PluginListenerHandle>;
}

export interface TileDownloadUnit {
  /** Image URL (one tile or an n×n block). */
  u?: string;
  /** Or: a WMTS source (TileDownloadSource) the tiles are drawn from, and the top-left tile. */
  s?: string;
  z?: number;
  x?: number;
  y?: number;
  /** Same image from the server to use for tiles that come out blank white. */
  f?: string;
  n: number;
  /** Format the tiles are stored in. */
  m: string;
  /**
   * Tiles to cut: [column, row, file name], and 1 for a tile already saved that is fetched again
   * only if it came out black (see REPAIR_VERSION in src/offline.ts).
   */
  t: ([number, number, string] | [number, number, string, 1])[];
}
/** Ready-made tiles in PUWG 1992 (EPSG:2180). */
export interface TileDownloadSource {
  /** GetTile URL with {L}, {r}, {c}. */
  t: string;
  /** Same, from the server to use where the first has no photo. */
  f?: string;
  scales: number[];
  /** Top-left corner of the tile matrix: easting, northing. */
  e: number;
  n: number;
  size: number;
}
export interface TileDownloadStatus {
  state: 'queued' | 'running' | 'done' | 'cancelled' | 'none';
  done?: number;
  failed?: number;
  bytes?: number;
  total?: number;
  /** Waiting for signal. */
  waiting?: boolean;
  /** [unit index, tile index, bytes] of each tile written since `since`. */
  results?: [number, number, number][];
  next?: number;
  /** iPhone only: whether iOS lets the saving go on in the background (TileDownloadPlugin.swift). */
  bg?: string;
}
interface TileDownloadPlugin {
  start(o: {
    id: string;
    title: string;
    doneTitle: string;
    stopLabel: string;
    refresh: boolean;
    concurrency: number;
    wmsConcurrency: number;
    sources: Record<string, TileDownloadSource>;
    units: TileDownloadUnit[];
  }): Promise<void>;
  status(o: { id: string; since: number }): Promise<TileDownloadStatus>;
  cancel(o: { id: string }): Promise<void>;
  forget(o: { id: string }): Promise<void>;
}

const BackgroundLocation = registerPlugin<BackgroundLocationPlugin>('BackgroundLocation');
const Alerts = registerPlugin<AlertsPlugin>('Alerts');
const Bars = registerPlugin<BarsPlugin>('Bars');
const Compass = registerPlugin<CompassPlugin>('Compass');
const TileDownload = registerPlugin<TileDownloadPlugin>('TileDownload');

// ---------------------------------------------------------------- saving offline maps

/**
 * App only (version with the TileDownload plugin): saving offline maps runs in a foreground
 * service, so it goes on with the screen off. See TileDownloadService.java.
 */
export const nativeTileDownload = (): TileDownloadPlugin | null =>
  isApp() && Capacitor.isPluginAvailable('TileDownload') ? TileDownload : null;

// ---------------------------------------------------------------- location with the screen off

/** Whether location keeps coming with the screen off (the app's BackgroundLocation plugin, Android and iPhone). */
export const hasBackgroundLocation = (): boolean => isApp() && Capacitor.isPluginAvailable('BackgroundLocation');

export interface BackgroundWatch {
  /** The service sends my positions to the database itself (a `publish` option was given and taken). */
  publishing: boolean;
  /** Stops the service and the listeners. */
  stop(): void;
  /** Only removes this watch's listeners (another watch uses the service). */
  detach(): void;
}

/**
 * App only: starts the foreground service that keeps sending positions with the screen off
 * (a notification with a Stop button is shown meanwhile). `onStopped` runs when the person taps
 * Stop there; `onSatellites` gets the satellites GPS sees and uses (newer apps only). Rejects with
 * code 'DENIED' when location permission is refused.
 *
 * With `publish.config` the service also sends my positions to the hunt's database (so they keep
 * going with the screen locked, when this page is paused): `onSent` after each one that got there,
 * `onDenied` when the database refused it (the service has stopped then).
 */
export async function watchBackgroundLocation(
  text: { title: string; text: string; stop: string },
  onFix: (f: NativeFix) => void,
  onStopped: () => void,
  onSatellites?: (s: { visible: number; used: number }) => void,
  intervalMs = 3000,
  publish?: { config: NativePublish; onSent: (at: number) => void; onDenied: () => void },
): Promise<BackgroundWatch> {
  const handles = await Promise.all([
    BackgroundLocation.addListener('location', onFix),
    BackgroundLocation.addListener('stopped', onStopped),
    ...(onSatellites ? [BackgroundLocation.addListener('satellites', onSatellites)] : []),
    ...(publish
      ? [BackgroundLocation.addListener('sent', (s) => publish.onSent(s.at)), BackgroundLocation.addListener('denied', publish.onDenied)]
      : []),
  ]);
  const removeAll = () => handles.forEach((h) => void h.remove());
  let publishing = false;
  try {
    const r = await BackgroundLocation.start({ title: text.title, text: text.text, stopLabel: text.stop, intervalMs, publish: publish?.config });
    publishing = !!publish && !!r?.publishing;
  } catch (e) {
    removeAll();
    throw e;
  }
  return {
    publishing,
    stop() {
      removeAll();
      void BackgroundLocation.stop().catch(() => {});
    },
    detach: removeAll,
  };
}

// ---------------------------------------------------------------- vibration and alerts

/**
 * Vibrates: a duration or a pattern [on, off, on, …] in ms. `alarm` patterns (hunt alerts)
 * also buzz in silent mode in the app. The browser only vibrates after a recent tap.
 */
export function vibrate(pattern: number | readonly number[], alarm = false): void {
  const p = typeof pattern === 'number' ? [pattern] : [...pattern];
  if (isApp()) {
    void Alerts.vibrate({ pattern: p, alarm }).catch(() => navigator.vibrate?.(p));
    return;
  }
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not allowed without a tap */
  }
}

/** A barely felt tick under the finger for the big field buttons. App only: browsers buzz too long for this. */
export function tick(): void {
  if (isApp()) void Alerts.vibrate({ pattern: [12] }).catch(() => {});
}

/**
 * A hunt alert (message, drive start, game coming): buzzes with `pattern`, and in the app also
 * shows a notification while the app is not on screen, so it reaches a phone in the pocket.
 */
export function alertUser(title: string, text: string, pattern: readonly number[]): void {
  vibrate(pattern, true);
  if (isApp() && document.visibilityState === 'hidden') void Alerts.notify({ title, text }).catch(() => {});
}

if (isApp()) {
  // For the app's smoke test (android workflow), which checks that the plugins are there.
  console.info(`[polowanie] plugins ${['Printer', 'BackgroundLocation', 'Gps', 'Alerts', 'Compass', 'Bars', 'TileDownload', 'Speech', 'Voice'].filter((p) => Capacitor.isPluginAvailable(p)).join(',')}`);
  document.addEventListener('visibilitychange', () => {
    // Back on screen: the alerts are visible in the app itself.
    if (document.visibilityState === 'visible') void Alerts.clear().catch(() => {});
  });
}

// ---------------------------------------------------------------- compass

/**
 * App only: the phone's compass with accuracy. Calls `cb` with each reading; returns a stop
 * function, or null on the website or a phone without a compass sensor (then use the browser's
 * orientation events).
 */
export async function listenNativeCompass(cb: (h: NativeHeading) => void): Promise<(() => void) | null> {
  if (!isApp() || !Capacitor.isPluginAvailable('Compass')) return null;
  const handle = await Compass.addListener('heading', cb);
  try {
    await Compass.start();
  } catch {
    void handle.remove();
    return null;
  }
  return () => {
    void handle.remove();
    void Compass.stop().catch(() => {});
  };
}

// ---------------------------------------------------------------- system bars

/** Colours of the app's own top and bottom bars (--surface in src/tokens.css). */
const BAR_COLOR = { light: '#ffffff', dark: '#1a201c' } as const;

/**
 * App only: the phone's status bar and navigation bar take the colour of the app's bars, with
 * dark or light system icons to match. The look is chosen in the app, so Android cannot guess it.
 */
export function setSystemBars(theme: 'light' | 'dark'): void {
  if (!isApp() || !Capacitor.isPluginAvailable('Bars')) return;
  void Bars.set({ color: BAR_COLOR[theme], dark: theme === 'dark' }).catch(() => {});
}
