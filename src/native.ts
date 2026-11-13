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

interface BackgroundLocationPlugin {
  start(o: { title: string; text: string; stopLabel: string; intervalMs: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(e: 'location', f: (p: NativeFix) => void): Promise<PluginListenerHandle>;
  addListener(e: 'stopped', f: () => void): Promise<PluginListenerHandle>;
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
  /** Tiles to cut: [column, row, file name]. */
  t: [number, number, string][];
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

/** Whether location keeps coming with the screen off (only in the app). */
export const hasBackgroundLocation = (): boolean => isApp();

export interface BackgroundWatch {
  /** Stops the service and the listeners. */
  stop(): void;
  /** Only removes this watch's listeners (another watch uses the service). */
  detach(): void;
}

/**
 * App only: starts the foreground service that keeps sending positions with the screen off
 * (a notification with a Stop button is shown meanwhile). `onStopped` runs when the person taps
 * Stop there. Rejects with code 'DENIED' when location permission is refused.
 */
export async function watchBackgroundLocation(
  text: { title: string; text: string; stop: string },
  onFix: (f: NativeFix) => void,
  onStopped: () => void,
  intervalMs = 3000,
): Promise<BackgroundWatch> {
  const handles = await Promise.all([BackgroundLocation.addListener('location', onFix), BackgroundLocation.addListener('stopped', onStopped)]);
  const removeAll = () => handles.forEach((h) => void h.remove());
  try {
    await BackgroundLocation.start({ title: text.title, text: text.text, stopLabel: text.stop, intervalMs });
  } catch (e) {
    removeAll();
    throw e;
  }
  return {
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
  console.info(`[polowanie] plugins ${['Printer', 'BackgroundLocation', 'Alerts', 'Compass', 'Bars', 'TileDownload'].filter((p) => Capacitor.isPluginAvailable(p)).join(',')}`);
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
  if (!isApp()) return null;
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
