import { toGpx, gpxFileName, freshness, distanceM, sendDecision, shouldPurge, parsePositions, parseTracks, STALE_MS, LOST_MS, HEARTBEAT_MS, RETENTION_MS, validateHunt, huntWindow, sortHunts, sortParticipants, countRoles, parseHunt, parseParticipants, cleanText, validPersonName, nextStatuses, type Hunt } from './hunt';

const base: Hunt = {
  id: 'x',
  name: 'Dziki',
  date: '2026-12-12',
  start: '08:00',
  end: '15:00',
  place: '',
  notes: '',
  leaderUid: 'L',
  leaderName: 'Jan',
  status: 'open',
  createdAt: 0,
  endedAt: null,
  district: null,
};

describe('validateHunt', () => {
  it('accepts a complete hunt', () => expect(validateHunt(base)).toEqual([]));
  it('flags empty name and bad date/times', () =>
    expect(validateHunt({ ...base, name: '  ', date: '12.12.2026', start: '8:00', end: '24:00' })).toEqual(['name', 'date', 'start', 'end']));
});

describe('huntWindow', () => {
  it('uses local time', () => {
    const w = huntWindow(base);
    expect(new Date(w.start).getHours()).toBe(8);
    expect(w.end - w.start).toBe(7 * 3600e3);
  });
  it('treats an end before the start as the next day', () => {
    const w = huntWindow({ ...base, start: '22:00', end: '02:00' });
    expect(w.end - w.start).toBe(4 * 3600e3);
  });
});

describe('sortHunts', () => {
  it('puts upcoming hunts first, soonest first, then past hunts newest first', () => {
    const now = new Date(2026, 11, 1).getTime();
    const hs = [
      { ...base, id: 'past-old', date: '2026-10-01' },
      { ...base, id: 'later', date: '2026-12-20' },
      { ...base, id: 'past-new', date: '2026-11-20' },
      { ...base, id: 'soon', date: '2026-12-05' },
      { ...base, id: 'ended-early', date: '2026-12-06', status: 'ended' as const },
    ];
    expect(sortHunts(hs, now).map((h) => h.id)).toEqual(['soon', 'later', 'ended-early', 'past-new', 'past-old']);
  });
});

describe('participants', () => {
  const ps = parseParticipants({
    u3: { name: 'Żaneta', role: 'beater', status: 'registered', joinedAt: 3 },
    u1: { name: 'Adam', role: 'hunter', status: 'confirmed', joinedAt: 1 },
    u0: { name: 'Zbigniew', role: 'leader', status: 'confirmed', joinedAt: 0 },
    u2: { name: 'Łukasz', role: 'hunter', status: 'registered', joinedAt: 2 },
    bad: { name: 'X', role: 'cook' },
  });
  it('parses, drops invalid records and sorts leader, hunters, beaters', () =>
    expect(ps.map((p) => p.name)).toEqual(['Zbigniew', 'Adam', 'Łukasz', 'Żaneta']));
  it('counts roles', () => expect(countRoles(ps)).toEqual({ leader: 1, hunter: 2, beater: 1 }));
  it('sorting is stable for an already sorted list', () => expect(sortParticipants(ps)).toEqual(ps));
});

describe('parseHunt', () => {
  it('returns null for missing or broken records', () => {
    expect(parseHunt('a', null)).toBeNull();
    expect(parseHunt('a', { name: 'x', status: 'weird', leaderUid: 'L' })).toBeNull();
  });
  it('fills optional fields', () => expect(parseHunt('a', { name: 'x', status: 'live', leaderUid: 'L' })?.place).toBe(''));
});

describe('helpers', () => {
  it('cleanText collapses whitespace and trims to length', () => expect(cleanText('  Jan   Kowalski \n', 6)).toBe('Jan Ko'));
  it('validPersonName needs two characters', () => {
    expect(validPersonName(' J ')).toBe(false);
    expect(validPersonName('Jo')).toBe(true);
  });
  it('a finished hunt can only be reopened as live', () => expect(nextStatuses('ended')).toEqual(['live']));
});

describe('location sharing', () => {
  const at = { lat: 52.0, lng: 21.0 };
  it('measures distance', () => {
    expect(distanceM(at, { lat: 52.001, lng: 21.0 })).toBeCloseTo(111.2, 0);
  });
  it('sends the first fix, real movement, and a heartbeat', () => {
    expect(sendDecision(null, { ...at, acc: 10 }, 0)).toEqual({ send: true, track: true });
    const last = { ...at, at: 0 };
    expect(sendDecision(last, { lat: 52.0001, lng: 21.0, acc: 5 }, 5000)).toEqual({ send: false, track: false });
    expect(sendDecision(last, { lat: 52.0003, lng: 21.0, acc: 5 }, 5000)).toEqual({ send: true, track: true });
    expect(sendDecision(last, { lat: 52.0001, lng: 21.0, acc: 5 }, HEARTBEAT_MS)).toEqual({ send: true, track: false });
  });
  it('does not treat GPS jitter within the accuracy as movement', () => {
    expect(sendDecision({ ...at, at: 0 }, { lat: 52.0004, lng: 21.0, acc: 80 }, 1000).track).toBe(false);
  });
  it('grades freshness', () => {
    expect(freshness(0, STALE_MS - 1)).toBe('fresh');
    expect(freshness(0, STALE_MS)).toBe('stale');
    expect(freshness(0, LOST_MS)).toBe('lost');
  });
  it('purges 24 h after the end only', () => {
    expect(shouldPurge({ status: 'ended', endedAt: 0 }, RETENTION_MS)).toBe(true);
    expect(shouldPurge({ status: 'ended', endedAt: 0 }, RETENTION_MS - 1)).toBe(false);
    expect(shouldPurge({ status: 'live', endedAt: 0 }, RETENTION_MS)).toBe(false);
  });
  it('parses positions and tracks', () => {
    expect(parsePositions({ a: { lat: 1, lng: 2, ts: 3, role: 'beater' }, b: { lat: 'x' } })).toEqual([
      { uid: 'a', lat: 1, lng: 2, acc: null, ts: 3, role: 'beater' },
    ]);
    const tr = parseTracks({ a: { p2: { lat: 2, lng: 2, ts: 2 }, p1: { lat: 1, lng: 1, ts: 1 } } });
    expect(tr.get('a')!.map((p) => p.ts)).toEqual([1, 2]);
  });
});

describe('GPX export', () => {
  const people = new Map([
    ['a', { name: 'Adam & <Syn>', role: 'hunter' as const }],
    ['b', { name: 'Basia', role: 'beater' as const }],
  ]);
  const tracks = new Map([
    ['a', [{ lat: 52, lng: 21, ts: 0 }, { lat: 52.001, lng: 21.001, ts: 60000 }]],
    ['gone', [{ lat: 1, lng: 1, ts: 0 }]],
  ]);
  const gpx = toGpx('Dziki', tracks, [{ uid: 'b', lat: 52.1, lng: 21.1, acc: 5, ts: 0, role: 'beater' }], people, (r) => r);
  it('writes one track per known participant and waypoints for last positions', () => {
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx.match(/<trk>/g)).toHaveLength(1);
    expect(gpx).toContain('<trkpt lat="52.001" lon="21.001"><time>1970-01-01T00:01:00.000Z</time></trkpt>');
    expect(gpx).toContain('<wpt lat="52.1" lon="21.1">');
  });
  it('escapes names', () => expect(gpx).toContain('Adam &amp; &lt;Syn&gt; (hunter)'));
  it('builds a safe file name', () => expect(gpxFileName({ date: '2026-12-12', name: 'Polowanie na dziki – Łęg' })).toBe('2026-12-12-polowanie-na-dziki-leg.gpx'));
});
