import { describe, expect, it } from 'vitest';
import { applyTake, dayOf, fingerprint, readLimits, takesFor } from '../src/limits';

describe('limits', () => {
  it('reads limits from the environment, with defaults', () => {
    expect(readLimits({})).toEqual({ user: 9, ip: 60, global: 2000 });
    expect(readLimits({ LIMIT_USER: '3', LIMIT_IP: 'x', LIMIT_GLOBAL: '-1' })).toEqual({ user: 3, ip: 60, global: 2000 });
  });

  it('counts days in Polish time', () => {
    expect(dayOf(Date.UTC(2026, 10, 13, 22, 30))).toBe('2026-11-13');
    expect(dayOf(Date.UTC(2026, 10, 13, 23, 30))).toBe('2026-11-14');
    expect(dayOf(Date.UTC(2026, 6, 1, 21, 59))).toBe('2026-07-01');
    expect(dayOf(Date.UTC(2026, 6, 1, 22, 1))).toBe('2026-07-02');
  });

  it('fingerprints do not contain the value and change every day', async () => {
    const a = await fingerprint('u', 'user-1', '2026-11-13');
    expect(a).toMatch(/^u:[0-9a-f]{24}$/);
    expect(a).not.toContain('user-1');
    expect(await fingerprint('u', 'user-1', '2026-11-13')).toBe(a);
    expect(await fingerprint('u', 'user-1', '2026-11-14')).not.toBe(a);
    expect(await fingerprint('u', 'user-2', '2026-11-13')).not.toBe(a);
  });

  it('charges all counters or none', async () => {
    const takes = await takesFor('user-1', '203.0.113.7', '2026-11-13', { user: 2, ip: 3, global: 100 });
    const counts = new Map<string, number>();
    expect(applyTake(counts, takes)).toEqual({ ok: true, blocked: null, left: [1, 2, 99] });
    expect(applyTake(counts, takes)).toEqual({ ok: true, blocked: null, left: [0, 1, 98] });
    expect(applyTake(counts, takes)).toEqual({ ok: false, blocked: 0, left: [0, 1, 98] });
    expect(counts.get('all')).toBe(2);
    // Another user on the same address: the address limit is next.
    const second = await takesFor('user-2', '203.0.113.7', '2026-11-13', { user: 2, ip: 3, global: 100 });
    expect(applyTake(counts, second).ok).toBe(true);
    expect(applyTake(counts, second)).toMatchObject({ ok: false, blocked: 1 });
  });
});
