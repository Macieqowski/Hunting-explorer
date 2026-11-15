// The app's Gps plugin, simulated; `app` switches between it and the browser's geolocation.
const fake = vi.hoisted(() => ({
  app: false,
  listeners: {} as Record<string, (p: unknown) => void>,
  start: vi.fn(),
  stop: vi.fn(async () => {}),
  lastKnown: vi.fn(async () => ({})),
}));

vi.mock('./platform', () => ({ isApp: () => fake.app }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => fake.app },
  registerPlugin: () => ({
    start: fake.start,
    stop: fake.stop,
    lastKnown: fake.lastKnown,
    addListener: async (e: string, f: (p: unknown) => void) => {
      fake.listeners[e] = f;
      return { remove: async () => delete fake.listeners[e] };
    },
  }),
}));

import { GeoError, locate, watchLocation } from './geo';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('locate in the browser', () => {
  let watch: { ok: (p: unknown) => void; err: (e: unknown) => void; opts: PositionOptions };
  const pos = (acc: number) => ({ coords: { latitude: 52, longitude: 21, accuracy: acc }, timestamp: Date.now() });
  beforeEach(() => {
    fake.app = false;
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn((ok, err, opts) => {
          watch = { ok, err, opts };
          return 7;
        }),
        clearWatch: vi.fn(),
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('has no timeout and waits past browser timeouts for a good position', async () => {
    const job = locate({ goodAcc: 50 });
    expect(watch.opts.timeout).toBe(Infinity);
    watch.err({ code: 3, PERMISSION_DENIED: 1 });
    vi.advanceTimersByTime(120_000);
    watch.ok(pos(20));
    await expect(job.promise).resolves.toMatchObject({ lat: 52, acc: 20 });
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  it('takes the best position some time after the first live one', async () => {
    const job = locate({ goodAcc: 50, settleMs: 20_000 });
    watch.ok(pos(400));
    watch.ok(pos(120));
    vi.advanceTimersByTime(20_000);
    await expect(job.promise).resolves.toMatchObject({ acc: 120 });
  });

  it('stops on denial and on cancel', async () => {
    const a = locate({ goodAcc: 50 });
    watch.err({ code: 1, PERMISSION_DENIED: 1 });
    await expect(a.promise).rejects.toMatchObject({ code: 'denied' });
    const b = locate({ goodAcc: 50 });
    b.cancel();
    await expect(b.promise).rejects.toBeInstanceOf(GeoError);
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledTimes(2);
  });
});

describe('the app feed', () => {
  beforeEach(() => {
    fake.app = true;
    fake.listeners = {};
    fake.start.mockReset();
    fake.stop.mockClear();
  });

  it('starts once for all callers, gives the remembered position, and stops after the last', async () => {
    fake.start.mockResolvedValue({ enabled: true, last: { lat: 50, lng: 20, acc: 900, time: 1, age: 30_000 } });
    const a = vi.fn();
    const sats = vi.fn();
    const stopA = watchLocation(a, { onSatellites: sats });
    await flush();
    expect(fake.start).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(expect.objectContaining({ lat: 50, cached: true }));
    fake.listeners.satellites({ visible: 9, used: 0 });
    expect(sats).toHaveBeenCalledWith({ visible: 9, used: 0 });

    const b = vi.fn();
    const stopB = watchLocation(b);
    await flush();
    expect(fake.start).toHaveBeenCalledTimes(1);
    fake.listeners.fix({ lat: 52, lng: 21, acc: 5, time: Date.now(), age: 0 });
    expect(b).toHaveBeenCalledWith(expect.objectContaining({ lat: 52, acc: 5 }));
    stopA();
    expect(fake.stop).not.toHaveBeenCalled();
    stopB();
    expect(fake.stop).toHaveBeenCalledTimes(1);
  });

  it('reports location turned off', async () => {
    fake.start.mockRejectedValue({ code: 'OFF' });
    const job = locate({ goodAcc: 50 });
    await expect(job.promise).rejects.toMatchObject({ code: 'off' });
  });
});
