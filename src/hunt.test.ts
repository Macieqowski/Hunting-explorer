import { validateHunt, huntWindow, sortHunts, sortParticipants, countRoles, parseHunt, parseParticipants, cleanText, validPersonName, nextStatuses, type Hunt } from './hunt';

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
