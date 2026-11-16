import { describe, expect, it } from 'vitest';
import {
  parseAlarm,
  parseAlarms,
  parseAlerts,
  alarmState,
  alarmRecord,
  alertRecord,
  cleanAlarmNote,
  parseKits,
  kitOf,
  hasAid,
  hasTq,
  kitCarriers,
  pendingAlarms,
  openAlerts,
  alarmKey,
  ALARM_NOTE_MAX,
  ALARM_PRESETS,
} from './huntAlarm';

const raw = { uid: 'u1', lat: 52.1, lng: 21.2, acc: 12, note: 'postrzał w udo', ts: 1000 };

describe('alarms', () => {
  it('reads an alarm and its state', () => {
    const a = parseAlarm('u1', raw)!;
    expect(a).toMatchObject({ uid: 'u1', lat: 52.1, lng: 21.2, acc: 12, note: 'postrzał w udo', ts: 1000 });
    expect(alarmState(a)).toBe('pending');
    expect(alarmState(parseAlarm('u1', { ...raw, approvedBy: 'L', approvedAt: 2000 })!)).toBe('approved');
    expect(alarmState(parseAlarm('u1', { ...raw, rejectedBy: 'L', rejectedAt: 2000 })!)).toBe('rejected');
  });

  it('ignores a decision time without who decided, and broken records', () => {
    expect(alarmState(parseAlarm('u1', { ...raw, approvedAt: 2000 })!)).toBe('pending');
    expect(parseAlarm('u1', { ...raw, lat: 95 })).toBeNull();
    expect(parseAlarm('u1', { ...raw, ts: 'x' })).toBeNull();
    expect(parseAlarm('u1', null)).toBeNull();
    expect(parseAlarm('u1', { ...raw, acc: 'far' })!.acc).toBeNull();
  });

  it('lists alarms newest first, keyed by the reporter', () => {
    const as = parseAlarms({ a: { ...raw, ts: 1 }, b: { ...raw, ts: 3 }, c: { lat: 'x' } });
    expect(as.map((a) => a.uid)).toEqual(['b', 'a']);
  });

  it('shows a leader only the alarms of others still waiting', () => {
    const as = parseAlarms({
      me: { ...raw, ts: 5 },
      a: { ...raw, ts: 4 },
      b: { ...raw, ts: 3, approvedBy: 'L', approvedAt: 6 },
      c: { ...raw, ts: 2, rejectedBy: 'L', rejectedAt: 6 },
    });
    expect(pendingAlarms(as, 'me').map((a) => a.uid)).toEqual(['a']);
  });

  it('writes what the rules accept: rounded position, clean short note, no empty note', () => {
    expect(alarmRecord({ lat: 52.123456789, lng: 21.987654321, acc: 7.6 }, '  krwawi\n mocno ')).toEqual({ lat: 52.123457, lng: 21.987654, acc: 8, note: 'krwawi mocno' });
    expect(alarmRecord({ lat: 52, lng: 21, acc: null }, '   ')).toEqual({ lat: 52, lng: 21 });
    expect(alarmRecord({ lat: 52, lng: 21, acc: 1e7 }, '').acc).toBe(100000);
    expect(cleanAlarmNote('x'.repeat(500))).toHaveLength(ALARM_NOTE_MAX);
  });

  it('copies an alarm for everyone without the decision fields', () => {
    const a = parseAlarm('u1', { ...raw, approvedBy: 'L', approvedAt: 9 })!;
    expect(alertRecord(a)).toEqual({ uid: 'u1', lat: 52.1, lng: 21.2, ts: 1000, acc: 12, note: 'postrzał w udo' });
    expect(alertRecord({ ...a, acc: null, note: '' })).toEqual({ uid: 'u1', lat: 52.1, lng: 21.2, ts: 1000 });
  });

  it('gives a new alarm by the same person a new key', () => {
    expect(alarmKey({ uid: 'u1', ts: 1 })).not.toBe(alarmKey({ uid: 'u1', ts: 2 }));
  });
});

describe('alerts (approved alarms)', () => {
  it('needs who approved it and when', () => {
    const as = parseAlerts({
      u1: { ...raw, by: 'L', at: 1500 },
      u2: { ...raw, at: 1500 },
      u3: { ...raw, by: 'L' },
    });
    expect(as.map((a) => a.uid)).toEqual(['u1']);
    expect(as[0].closedAt).toBeNull();
  });

  it('keeps closed ones out of the open list', () => {
    const as = parseAlerts({ u1: { ...raw, by: 'L', at: 1, closedAt: 5 }, u2: { ...raw, ts: 2000, by: 'L', at: 2 } });
    expect(openAlerts(as).map((a) => a.uid)).toEqual(['u2']);
  });
});

describe('first-aid kits', () => {
  it('reads only the three known values', () => {
    const k = parseKits({ a: 'a', b: 't', c: 'at', d: 'x', e: 1 });
    expect([...k]).toEqual([
      ['a', 'a'],
      ['b', 't'],
      ['c', 'at'],
    ]);
    expect(parseKits(null).size).toBe(0);
  });

  it('turns the two ticks into one value and back', () => {
    expect(kitOf(true, true)).toBe('at');
    expect(kitOf(true, false)).toBe('a');
    expect(kitOf(false, true)).toBe('t');
    expect(kitOf(false, false)).toBeNull();
    expect(hasAid('at') && hasTq('at')).toBe(true);
    expect(hasAid('t')).toBe(false);
    expect(hasTq(undefined)).toBe(false);
  });

  it('lists carriers nearest to the injured, tourniquets first at a tie, unknown positions last', () => {
    const people = ['far', 'near', 'tie-a', 'tie-t', 'nowhere', 'nokit'].map((uid) => ({ uid }));
    const kits = parseKits({ far: 'a', near: 'a', 'tie-a': 'a', 'tie-t': 't', nowhere: 'at' });
    const at = { lat: 52, lng: 21 };
    const pos = new Map([
      ['far', { lat: 52.05, lng: 21 }],
      ['near', { lat: 52.001, lng: 21 }],
      ['tie-a', { lat: 52.01, lng: 21 }],
      ['tie-t', { lat: 52.01, lng: 21 }],
      ['nokit', { lat: 52, lng: 21 }],
    ]);
    const list = kitCarriers(kits, people, pos, at);
    expect(list.map((x) => x.person.uid)).toEqual(['near', 'tie-t', 'tie-a', 'far', 'nowhere']);
    expect(list[0].dist).toBeGreaterThan(100);
    expect(list[0].dist).toBeLessThan(120);
    expect(list[list.length - 1].dist).toBeNull();
  });
});

describe('ready-made messages', () => {
  it('fit in a hunt message', () => {
    for (const p of ALARM_PRESETS) expect(p.length).toBeLessThanOrEqual(200);
  });
});
