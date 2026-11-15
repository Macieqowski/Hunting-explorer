// Sharing my location during a hunt: browser geolocation, throttling, keeping the
// screen awake. In the Android app positions come from a foreground service instead, which
// keeps working with the screen off. Knows nothing about Firebase; huntUi wires it to the backend.

import { sendDecision } from './hunt';
import { MIN_MOVE_M } from './hunt';
import { hasBackgroundLocation, watchBackgroundLocation, type BackgroundWatch, type NativePublish } from './native';
import { watchLocation, type Satellites } from './geo';

export type ShareState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable' | 'error';

export interface Fix {
  lat: number;
  lng: number;
  acc: number | null;
}

export interface SharerOptions {
  /** Send a fix; `track` = also add a track point. Rejecting with { stop: true } ends sharing. */
  publish(fix: Fix, track: boolean): Promise<void>;
  /** How long to wait before re-sending an unchanged position (depends on my role). */
  heartbeatMs(): number;
  /** Remove my position after stopping. */
  clear(): Promise<void>;
  onChange(): void;
  /** Every position, also the ones not sent (for the beater guidance with the screen off). */
  onFix?(fix: Fix): void;
  /** App only: texts of the notification shown while sharing in the background. */
  notification?(): { title: string; text: string; stop: string };
  /** App only: the person tapped Stop in that notification (sharing has stopped). */
  onStoppedOutside?(): void;
  /**
   * App only: what the location service needs to send my positions to the database itself, so
   * they keep going with the screen locked (this page is paused then). Null = the page sends them.
   */
  nativePublish?(): Promise<Omit<NativePublish, 'heartbeatMs' | 'minMoveM'> | null>;
  /** Shown when the database refused a position the service sent (the hunt ended, I was removed). */
  deniedText?(): string;
}

type WakeLock = { release(): Promise<void> };

export class Sharer {
  state: ShareState = 'off';
  lastFix: Fix | null = null;
  lastSentAt = 0;
  error = '';
  /** While starting (app only): satellites GPS sees and uses, to show it is still searching. */
  sats: Satellites | null = null;
  private stopWatch: (() => void) | null = null;
  private last: { lat: number; lng: number; at: number } | null = null;
  private wake: WakeLock | null = null;
  private native: BackgroundWatch | null = null;
  /** Changes on every start and stop, so a late answer from an earlier start is recognised. */
  private gen = 0;
  private sending = false;

  constructor(
    readonly huntId: string,
    private opts: SharerOptions,
  ) {}

  get active() {
    return this.state === 'starting' || this.state === 'on';
  }

  start() {
    if (this.active) return;
    if (!('geolocation' in navigator)) {
      this.set('unavailable');
      return;
    }
    this.set('starting');
    if (hasBackgroundLocation() && this.opts.notification) this.startBackground();
    else this.startBrowser();
  }

  /**
   * The app: a foreground service gets positions with the screen off, so no wake lock. In a
   * group hunt it also sends them to the database itself; the page only shows them.
   */
  private startBackground() {
    const gen = ++this.gen;
    if (!this.opts.nativePublish) return this.watchNative(gen, undefined);
    this.opts.nativePublish().catch(() => null).then((a) => {
      if (gen !== this.gen) return;
      const publish = a
        ? {
            config: { ...a, heartbeatMs: this.opts.heartbeatMs(), minMoveM: MIN_MOVE_M },
            onSent: (at: number) => {
              if (gen !== this.gen) return;
              this.lastSentAt = at;
              this.opts.onChange();
            },
            onDenied: () => {
              if (gen !== this.gen) return;
              this.stop(false);
              this.error = this.opts.deniedText?.() ?? '';
              this.state = 'error';
              this.opts.onChange();
            },
          }
        : undefined;
      this.watchNative(gen, publish);
    });
  }

  private watchNative(gen: number, publish: Parameters<typeof watchBackgroundLocation>[5]) {
    watchBackgroundLocation(
      this.opts.notification!(),
      (f) => this.onFix({ lat: f.lat, lng: f.lng, acc: f.acc ?? null }),
      () => {
        this.opts.onStoppedOutside?.();
        this.stop();
      },
      (s) => this.onSats(s),
      3000,
      publish,
    ).then(
      (w) => {
        if (gen === this.gen) this.native = w;
        // Stopped meanwhile: stop the service too, unless a newer start is using it.
        else if (this.active) w.detach();
        else w.stop();
      },
      (e: { code?: string; message?: string }) => {
        if (gen !== this.gen) return;
        if (e.code === 'DENIED') {
          this.stop(false);
          this.set('denied');
        } else this.startBrowser(); // no service on this phone: share while the screen is on
      },
    );
  }

  private startBrowser() {
    // No time limit: the watch goes on until a position comes (a cold GPS start can take minutes).
    this.stopWatch = watchLocation((p) => !p.cached && this.onFix({ lat: p.lat, lng: p.lng, acc: p.acc }), {
      // A remembered position is not sent to the others: only fresh ones.
      maxAgeMs: 10_000,
      onSatellites: (s) => this.onSats(s),
      onError: (e) => {
        this.stop(false);
        this.set(e.code === 'denied' ? 'denied' : 'unavailable');
      },
    });
    this.keepAwake();
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private onSats(s: Satellites) {
    if (this.state !== 'starting') return;
    this.sats = s;
    this.opts.onChange();
  }

  /** Stop watching; `clear` also removes my position from the map for everyone. */
  stop(clear = true) {
    this.stopWatch?.();
    this.stopWatch = null;
    this.sats = null;
    this.native?.stop();
    this.native = null;
    this.gen++;
    this.last = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    this.wake?.release().catch(() => {});
    this.wake = null;
    const wasActive = this.active;
    this.set('off');
    if (clear && wasActive) this.opts.clear().catch(() => {});
  }

  private set(s: ShareState) {
    this.state = s;
    if (s !== 'error') this.error = '';
    this.opts.onChange();
  }

  private async onFix(fix: Fix) {
    if (!this.active) return;
    this.lastFix = fix;
    this.opts.onFix?.(fix);
    const now = Date.now();
    if (this.state === 'starting') this.set('on');
    // The location service sends it to the database itself (see startBackground).
    if (this.native?.publishing) return;
    const d = sendDecision(this.last, fix, now, this.opts.heartbeatMs());
    if (!d.send || this.sending) return;
    this.sending = true;
    // Optimistic: firebase queues the write while offline and sends it on reconnect.
    this.last = { lat: fix.lat, lng: fix.lng, at: now };
    try {
      await this.opts.publish(fix, d.track);
      this.lastSentAt = Date.now();
      this.opts.onChange();
    } catch (e) {
      if ((e as { stop?: boolean }).stop) {
        this.stop(false);
        this.error = (e as Error).message;
        this.state = 'error';
        this.opts.onChange();
      }
    } finally {
      this.sending = false;
    }
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible' && this.active && !this.wake) this.keepAwake();
  };

  /** Keep the screen on while sharing; browsers pause location when it locks. */
  private keepAwake() {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLock & { addEventListener(e: string, f: () => void): void }> } }).wakeLock;
    wl?.request('screen').then(
      (lock) => {
        if (!this.active) return void lock.release();
        this.wake = lock;
        lock.addEventListener('release', () => {
          if (this.wake === lock) this.wake = null;
        });
      },
      () => {},
    );
  }
}
