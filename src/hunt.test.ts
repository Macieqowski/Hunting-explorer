import { toGpx, gpxFileName, freshness, distanceM, sendDecision, shouldPurge, parsePositions, parseTracks, STALE_MS, LOST_MS, HEARTBEAT_MS, RETENTION_MS, validateHunt, huntWindow, sortHunts, sortParticipants, countRoles, parseHunt, parseParticipants, cleanText, validPersonName, nextStatuses, validateDrive, encodeArea, decodeArea, sortDrives, driveState, activeDrive, nextDriveDefaults, parseDrives, splitByDrive, parseSightings, compassPoint, bearing, angleDiff, offsetPoint, headingToward, sightLook, headingFromOrientation, declination, type Hunt } from './hunt';

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
  pokotLockedAt: null,
  pokotTitles: false,
  meet: null,
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

describe('drives', () => {
  const area: [number, number][] = [
    [52.1, 21.1],
    [52.2, 21.1],
    [52.2, 21.2],
  ];
  const d = (name: string, start: string, end: string, startedAt: number | null = null, endedAt: number | null = null) => ({ id: name, name, start, end, area, startedAt, endedAt, meet: null });

  it('validates name, times and corners', () => {
    expect(validateDrive({ name: 'Miot 1', start: '08:30', end: '09:30', area })).toEqual([]);
    expect(validateDrive({ name: ' ', start: '8:30', end: '25:00', area: area.slice(0, 2) })).toEqual(['name', 'start', 'end', 'area']);
  });
  it('encodes and decodes areas', () => {
    const s = encodeArea([[52.1234567, 21.7654321], [52.2, 21.1], [52.2, 21.2]]);
    expect(s).toBe('52.123457,21.765432;52.2,21.1;52.2,21.2');
    expect(decodeArea(s)).toEqual([[52.123457, 21.765432], [52.2, 21.1], [52.2, 21.2]]);
    expect(decodeArea('x;52,21;91,0')).toEqual([[52, 21]]);
    expect(decodeArea(undefined)).toEqual([]);
  });
  it('sorts by planned start from the hunt start, also past midnight', () => {
    const ds = [d('Nocny', '00:30', '01:30'), d('Miot 10', '22:00', '23:00'), d('Miot 2', '21:00', '22:00')];
    expect(sortDrives(ds, '20:00').map((x) => x.name)).toEqual(['Miot 2', 'Miot 10', 'Nocny']);
  });
  it('knows the state and the running drive', () => {
    expect(driveState(d('a', '08:00', '09:00'))).toBe('planned');
    expect(driveState(d('a', '08:00', '09:00', 1))).toBe('active');
    expect(driveState(d('a', '08:00', '09:00', 1, 2))).toBe('done');
    expect(activeDrive([d('a', '08:00', '09:00', 1, 2), d('b', '09:00', '10:00', 3)])?.name).toBe('b');
    expect(activeDrive([d('a', '08:00', '09:00')])).toBeNull();
  });
  it('suggests the next drive 15 minutes after the last one', () => {
    expect(nextDriveDefaults([], { start: '08:00' })).toEqual({ name: 'Miot 1', start: '08:00', end: '09:00' });
    expect(nextDriveDefaults([d('Miot 1', '08:00', '09:00'), d('Miot 2', '09:15', '10:30')], { start: '08:00' })).toEqual({ name: 'Miot 3', start: '10:45', end: '11:45' });
    expect(nextDriveDefaults([d('Miot 1', '23:00', '23:50')], { start: '22:00' })).toEqual({ name: 'Miot 2', start: '00:05', end: '01:05' });
  });
  it('parses stored drives and ignores broken ones', () => {
    const ds = parseDrives({ d1: { name: 'Miot 1', start: '08:00', end: '09:00', area: '52,21;52.1,21;52.1,21.1', startedAt: 5, meet: '52.05,21.02' }, d2: { name: 1 }, d3: null });
    expect(ds).toEqual([{ id: 'd1', name: 'Miot 1', start: '08:00', end: '09:00', area: [[52, 21], [52.1, 21], [52.1, 21.1]], startedAt: 5, endedAt: null, meet: { lat: 52.05, lng: 21.02 } }]);
  });
  it('splits a track by drive and adds drive areas to the GPX', () => {
    const ds = [d('Miot 1', '08:00', '09:00', 100, 200), d('Miot 2', '09:00', '10:00', 300, 400)];
    const pts = [50, 120, 150, 250, 310, 500].map((ts) => ({ lat: 52, lng: 21, ts }));
    expect(splitByDrive(pts, ds).map((g) => [g.drive?.name ?? null, g.pts.length])).toEqual([[null, 1], ['Miot 1', 2], [null, 1], ['Miot 2', 1], [null, 1]]);
    const people = new Map([['u1', { name: 'Jan', role: 'hunter' as const }]]);
    const gpx = toGpx('Test', new Map([['u1', pts]]), [], people, () => 'Myśliwy', ds);
    expect(gpx).toContain('<trk><name>Miot 1</name><type>drive</type>');
    expect(gpx).toContain('<name>Jan (Myśliwy) · Miot 2</name>');
    expect(gpx.match(/<trk>/g)).toHaveLength(7); // 2 areas + 5 track parts
  });
});

describe('sightings', () => {
  it('parses stored sightings, newest first', () => {
    const ss = parseSightings({
      a: { uid: 'u', species: 'boar', count: '3-6', lat: 52, lng: 21, heading: 370, src: 'compass', ts: 1 },
      b: { uid: 'u', species: 'deer', count: '6+', lat: 52, lng: 21, heading: 90, src: 'buttons', driveId: 'd1', ts: 2 },
      c: { uid: 'u', species: 'bear', count: '1-3', lat: 52, lng: 21, heading: 0, ts: 3 },
    });
    expect(ss.map((s) => [s.id, s.heading, s.driveId])).toEqual([['b', 90, 'd1'], ['a', 10, null]]);
  });
  it('names compass points and bearings', () => {
    expect([0, 44, 46, 90, 180, 225, 315, 359].map(compassPoint)).toEqual(['N', 'NE', 'NE', 'E', 'S', 'SW', 'NW', 'N']);
    expect(Math.round(bearing({ lat: 52, lng: 21 }, { lat: 52.01, lng: 21 }))).toBe(0);
    expect(Math.round(bearing({ lat: 52, lng: 21 }, { lat: 52, lng: 21.01 }))).toBe(90);
    expect(angleDiff(350, 10)).toBe(20);
    const p = offsetPoint({ lat: 52, lng: 21 }, 90, 150);
    expect(Math.round(distanceM({ lat: 52, lng: 21 }, p))).toBe(150);
  });
  it('alerts hunters the game is heading toward', () => {
    const s = { lat: 52, lng: 21, heading: 90 }; // going east
    expect(headingToward(s, offsetPoint(s, 90, 300))).toBe(true);
    expect(headingToward(s, offsetPoint(s, 115, 300))).toBe(true);
    expect(headingToward(s, offsetPoint(s, 135, 300))).toBe(false); // 45° off
    expect(headingToward(s, offsetPoint(s, 90, 700))).toBe(false); // too far
    expect(headingToward(s, offsetPoint(s, 270, 20))).toBe(true); // right next to it
  });
  it('fades after 5 minutes and hides when the drive ends', () => {
    const t = 10 * 60e3;
    expect(sightLook({ ts: t - 60e3, driveId: 'd1' }, t, null)).toBe('bright');
    expect(sightLook({ ts: t - 6 * 60e3, driveId: 'd1' }, t, 'd1')).toBe('faded');
    expect(sightLook({ ts: t - 6 * 60e3, driveId: 'd1' }, t, 'd2')).toBe('old');
    expect(sightLook({ ts: t - 6 * 60e3, driveId: null }, t, null)).toBe('faded');
    expect(sightLook({ ts: t - 31 * 60e3, driveId: null }, t + 0, null)).toBe('old');
  });
  it('reads the compass from phone orientation, upright and flat', () => {
    const r = (v: number | null) => (v == null ? null : Math.round(v));
    expect(r(headingFromOrientation(0, 0, 0))).toBe(0); // flat, top edge north
    expect(r(headingFromOrientation(90, 0, 0))).toBe(270); // flat, turned left: west
    expect(r(headingFromOrientation(0, 90, 0))).toBe(0); // upright, back camera north
    expect(r(headingFromOrientation(270, 80, 0))).toBe(90); // upright, facing east
    expect(r(headingFromOrientation(0, 180 - 0.01, 0))).not.toBeNull();
    expect(declination(14)).toBe(5);
    expect(declination(24)).toBe(7.5);
  });
  it('adds sightings to the GPX as waypoints', () => {
    const [s] = parseSightings({ a: { uid: 'u', species: 'boar', count: '3-6', lat: 52, lng: 21, heading: 42, src: 'compass', ts: 1 } });
    const gpx = toGpx('T', new Map(), [], new Map(), () => '', [], [{ s, label: 'Dziki 3–6 → 42°' }]);
    expect(gpx).toContain('<name>Dziki 3–6 → 42°</name><type>boar</type>');
  });
});
