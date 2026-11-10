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

const BackgroundLocation = registerPlugin<BackgroundLocationPlugin>('BackgroundLocation');
const Alerts = registerPlugin<AlertsPlugin>('Alerts');
const Compass = registerPlugin<CompassPlugin>('Compass');

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
  console.info(`[polowanie] plugins ${['Printer', 'BackgroundLocation', 'Alerts', 'Compass'].filter((p) => Capacitor.isPluginAvailable(p)).join(',')}`);
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
