import type { NativeFix } from './native';

// The app's location service, simulated: tests resolve or reject each start themselves.
const native = vi.hoisted(() => ({
  starts: [] as {
    onFix: (f: NativeFix) => void;
    onStopped: () => void;
    publish?: { config: Record<string, unknown>; onSent: (at: number) => void; onDenied: () => void };
    resolve: (publishing?: boolean) => void;
    reject: (e: unknown) => void;
    stop: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
  }[],
  app: true,
}));

vi.mock('./native', () => ({
  hasBackgroundLocation: () => native.app,
  watchBackgroundLocation: (
    _t: unknown,
    onFix: (f: NativeFix) => void,
    onStopped: () => void,
    _sats: unknown,
    _interval: unknown,
    publish?: { config: Record<string, unknown>; onSent: (at: number) => void; onDenied: () => void },
  ) =>
    new Promise((resolve, reject) => {
      const s = {
        onFix,
        onStopped,
        publish,
        stop: vi.fn(),
        detach: vi.fn(),
        resolve: (publishing = false) => resolve({ publishing, stop: s.stop, detach: s.detach }),
        reject,
      };
      native.starts.push(s);
    }),
}));

import { Sharer, type SharerOptions } from './huntShare';

const tick = () => new Promise((r) => setTimeout(r, 0));

function make(over: Partial<SharerOptions> = {}) {
  const opts = {
    publish: vi.fn(async () => {}),
    heartbeatMs: () => 90_000,
    clear: vi.fn(async () => {}),
    onChange: vi.fn(),
    onFix: vi.fn(),
    notification: () => ({ title: 'T', text: 'x', stop: 'Stop' }),
    onStoppedOutside: vi.fn(),
    ...over,
  };
  return { s: new Sharer('h1', opts), opts };
}

describe('Sharer in the app (background location)', () => {
  beforeEach(() => {
    native.starts.length = 0;
    native.app = true;
    vi.stubGlobal('navigator', { geolocation: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() } });
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends positions from the service, without the browser watch or a wake lock', async () => {
    const { s, opts } = make();
    s.start();
    expect(s.state).toBe('starting');
    native.starts[0].resolve();
    await tick();
    native.starts[0].onFix({ lat: 52, lng: 21, acc: 8, time: 1 });
    await tick();
    expect(s.state).toBe('on');
    expect(opts.publish).toHaveBeenCalledWith({ lat: 52, lng: 21, acc: 8 }, true);
    expect(opts.onFix).toHaveBeenCalledWith({ lat: 52, lng: 21, acc: 8 });
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    s.stop();
    expect(native.starts[0].stop).toHaveBeenCalled();
    expect(opts.clear).toHaveBeenCalled();
  });

  it('stops the service when sharing was stopped before it answered', async () => {
    const { s } = make();
    s.start();
    s.stop();
    native.starts[0].resolve();
    await tick();
    expect(native.starts[0].stop).toHaveBeenCalled();
  });

  it('leaves the service to a newer start', async () => {
    const { s } = make();
    s.start();
    s.stop();
    s.start();
    native.starts[0].resolve();
    native.starts[1].resolve();
    await tick();
    expect(native.starts[0].stop).not.toHaveBeenCalled();
    expect(native.starts[0].detach).toHaveBeenCalled();
    s.stop();
    expect(native.starts[1].stop).toHaveBeenCalled();
  });

  it('reports a refused permission', async () => {
    const { s } = make();
    s.start();
    native.starts[0].reject({ code: 'DENIED' });
    await tick();
    expect(s.state).toBe('denied');
  });

  it('falls back to the browser when the service cannot start', async () => {
    const { s } = make();
    s.start();
    native.starts[0].reject({ code: 'UNAVAILABLE' });
    await tick();
    expect(s.state).toBe('starting');
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
  });

  it('stops and forgets when Stop is tapped in the notification', async () => {
    const { s, opts } = make();
    s.start();
    native.starts[0].resolve();
    await tick();
    native.starts[0].onStopped();
    expect(opts.onStoppedOutside).toHaveBeenCalled();
    expect(s.state).toBe('off');
    expect(opts.clear).toHaveBeenCalled();
  });

  it('ignores positions that arrive after stopping', async () => {
    const { s, opts } = make();
    s.start();
    native.starts[0].resolve();
    await tick();
    s.stop();
    native.starts[0].onFix({ lat: 52, lng: 21, time: 1 });
    await tick();
    expect(opts.publish).not.toHaveBeenCalled();
  });

  it('uses the browser on the website', () => {
    native.app = false;
    const { s } = make();
    s.start();
    expect(native.starts).toHaveLength(0);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    s.stop();
  });

  describe('the service sends positions itself (screen locked)', () => {
    const auth = { dbUrl: 'https://db', apiKey: 'k', refreshToken: 'r', uid: 'u1', huntId: 'h1' };

    it('hands the sign-in to the service and does not send from the page', async () => {
      const { s, opts } = make({ nativePublish: async () => auth });
      s.start();
      await tick();
      const st = native.starts[0];
      expect(st.publish?.config).toEqual({ ...auth, heartbeatMs: 90_000, minMoveM: 20 });
      st.resolve(true);
      await tick();
      st.onFix({ lat: 52, lng: 21, acc: 8, time: 1 });
      await tick();
      expect(s.state).toBe('on');
      expect(opts.onFix).toHaveBeenCalledWith({ lat: 52, lng: 21, acc: 8 });
      expect(opts.publish).not.toHaveBeenCalled();
      st.publish!.onSent(12345);
      expect(s.lastSentAt).toBe(12345);
    });

    it('sends from the page when the service did not take it (older app)', async () => {
      const { s, opts } = make({ nativePublish: async () => auth });
      s.start();
      await tick();
      native.starts[0].resolve(false);
      await tick();
      native.starts[0].onFix({ lat: 52, lng: 21, acc: 8, time: 1 });
      await tick();
      expect(opts.publish).toHaveBeenCalled();
    });

    it('sends from the page when there is no sign-in to hand over', async () => {
      const { s } = make({ nativePublish: async () => null });
      s.start();
      await tick();
      expect(native.starts[0].publish).toBeUndefined();
    });

    it('stops with a message when the database refuses', async () => {
      const { s, opts } = make({ nativePublish: async () => auth, deniedText: () => 'koniec' });
      s.start();
      await tick();
      native.starts[0].resolve(true);
      await tick();
      native.starts[0].publish!.onDenied();
      expect(s.state).toBe('error');
      expect(s.error).toBe('koniec');
      expect(native.starts[0].stop).toHaveBeenCalled();
      expect(opts.clear).not.toHaveBeenCalled();
    });

    it('does not start the service when stopped while getting the sign-in', async () => {
      const { s } = make({ nativePublish: async () => auth });
      s.start();
      s.stop();
      await tick();
      expect(native.starts.length).toBe(0);
    });
  });
});
