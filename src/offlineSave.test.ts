// Saving in the app (downloadInApp): the page records what the app's downloader wrote. iOS aborts
// the page's IndexedDB writes with a null error when the app leaves the screen for a moment
// (pulling down the notifications); the save must carry on, not end silently.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  areas: new Map<string, { id: string; status: string; done: number; total: number }>(),
  keys: new Map<string, string[]>(),
  recorded: [] as string[],
  /** recordAreaFiles calls still to reject with null. */
  abortRecord: 0,
}));
const fake = vi.hoisted(() => ({ units: [] as { t: unknown[] }[], cancelled: 0 }));

vi.mock('./offlineStore', () => ({
  blackShare: vi.fn(),
  deleteArea: vi.fn(async () => {}),
  dropViewed: vi.fn(async () => 0),
  getTile: vi.fn(async () => null),
  getAreaKeys: vi.fn(async (id: string) => db.keys.get(id) ?? []),
  getBdl: vi.fn(async () => undefined),
  hasTile: vi.fn(async () => false),
  listAreas: vi.fn(async () => [...db.areas.values()]),
  putArea: vi.fn(async (a: { id: string; status: string; done: number; total: number }) => void db.areas.set(a.id, a)),
  putAreaKeys: vi.fn(async (id: string, k: string[]) => void db.keys.set(id, k)),
  putAreaTile: vi.fn(async () => {}),
  putBdl: vi.fn(async () => {}),
  recordAreaFiles: vi.fn(async (entries: { url: string }[]) => {
    if (db.abortRecord > 0) {
      db.abortRecord--;
      // What txDone() rejects with when WebKit aborts the transaction.
      return Promise.reject(null);
    }
    db.recorded.push(...entries.map((e) => e.url));
  }),
  refTile: vi.fn(async () => false),
}));

// Not used by saving in the app (and they pull in Leaflet, which needs a browser).
vi.mock('./cachedLayer', () => ({ fetchLayerBlock: vi.fn(), fetchLayerTile: vi.fn() }));
vi.mock('./wmtsSave', () => ({ WMTS_CONCURRENCY: 32, wmtsTile: vi.fn() }));

vi.mock('./native', () => {
  let results: [number, number, number][] = [];
  const plugin = {
    start: vi.fn(async (o: { units: { t: unknown[] }[] }) => {
      fake.units = o.units;
      results = o.units.flatMap((u, ui) => u.t.map((_, ti): [number, number, number] => [ui, ti, 100]));
    }),
    // Half of what is left each call, so the save takes a few rounds.
    status: vi.fn(async ({ since }: { since: number }) => {
      const next = Math.min(results.length, since + Math.max(1, Math.ceil((results.length - since) / 2)));
      return { state: next >= results.length ? 'done' : 'running', results: results.slice(since, next), next, failed: 0, bg: 'started' };
    }),
    cancel: vi.fn(async () => void fake.cancelled++),
    forget: vi.fn(async () => {}),
  };
  return { nativeTileDownload: () => plugin };
});

import { saveDraft, savedAreas, isRunning, saveError } from './offline';

// A small area at the coast near Gdańsk: a few dozen tiles over the three layers.
const draft = { name: 'Test', kind: 'view' as const, ids: [], boxes: [[54.35, 18.6, 54.352, 18.603] as [number, number, number, number]], districts: [] };

async function finish(id: string) {
  for (let i = 0; i < 60 && isRunning(id); i++) await vi.advanceTimersByTimeAsync(1000);
}

describe('saving in the app', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    db.recorded = [];
    db.abortRecord = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('records every tile the app wrote and ends done', async () => {
    const a = await saveDraft(draft, 16);
    await finish(a.id);
    const total = fake.units.reduce((s, u) => s + u.t.length, 0);
    expect(total).toBeGreaterThan(5);
    expect(new Set(db.recorded).size).toBe(total);
    expect(savedAreas().find((x) => x.id === a.id)?.status).toBe('done');
  });

  it('carries on when the page’s database writes are aborted (null error)', async () => {
    db.abortRecord = 2;
    const a = await saveDraft(draft, 16);
    await finish(a.id);
    const total = fake.units.reduce((s, u) => s + u.t.length, 0);
    expect(new Set(db.recorded).size).toBe(total);
    // Nothing counted twice: the area is complete, not over 100%.
    const saved = savedAreas().find((x) => x.id === a.id)!;
    expect(saved.status).toBe('done');
    expect(saved.done).toBe(saved.total);
    expect(saveError(a.id)).toBeUndefined();
  });

  it('pauses with the reason when the writes keep failing', async () => {
    db.abortRecord = 1000;
    const before = fake.cancelled;
    const a = await saveDraft(draft, 16);
    await finish(a.id);
    expect(isRunning(a.id)).toBe(false);
    expect(savedAreas().find((x) => x.id === a.id)?.status).toBe('paused');
    expect(saveError(a.id)).toBe('database write aborted');
    // The app's own download is stopped too.
    expect(fake.cancelled).toBe(before + 1);
  });
});
