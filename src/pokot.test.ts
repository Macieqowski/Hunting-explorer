import { GAMES, parseShots, parseShotSpots, hunterTotals, huntKing, huntMisser, shotsByDrive, bagBySpecies, outOfSeason, voivodeshipOf, gameByKey, NO_SHOOTER, type Shot } from './pokot';
import { SEASONS } from './seasons';
import rulesFile from '../database.rules.json';

const rules = rulesFile as any;

const shot = (id: string, uid: string, outcome: Shot['outcome'], game: string | null = null, driveId: string | null = null, ts = 1): Shot => ({
  id,
  uid,
  outcome,
  game,
  driveId,
  ts,
  note: '',
});

describe('GAMES', () => {
  it('have unique keys', () => expect(new Set(GAMES.map((x) => x.key)).size).toBe(GAMES.length));
  it('point at seasons that exist', () => {
    const names = new Set(SEASONS.map((s) => s.name.pl));
    for (const x of GAMES) for (const s of x.seasons) expect(names, `${x.key}: ${s}`).toContain(s);
  });
  it('are the same list the database rules accept', () => {
    const re = new RegExp(rules.rules.shots.$h.$s.game['.validate'].match(/matches\(\/(.*)\/\)/)[1]);
    for (const x of GAMES) expect(re.test(x.key), x.key).toBe(true);
    expect(re.test('bear')).toBe(false);
    expect(re.test('fox_x')).toBe(false);
  });
});

describe('parseShots', () => {
  it('keeps valid shots, oldest first, and drops unknown game keys', () => {
    const ss = parseShots({
      b: { uid: 'u1', outcome: 'kill', game: 'fox', driveId: 'd1', ts: 20 },
      a: { uid: 'u2', outcome: 'miss', ts: 10, note: 'za daleko' },
      c: { uid: 'u2', outcome: 'kill', game: 'bear', ts: 30 },
      bad1: { uid: 'u1', outcome: 'hit', ts: 5 },
      bad2: { outcome: 'miss', ts: 5 },
      bad3: null,
    });
    expect(ss.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(ss[0]).toMatchObject({ outcome: 'miss', game: null, driveId: null, note: 'za daleko' });
    expect(ss[1]).toMatchObject({ game: 'fox', driveId: 'd1' });
    expect(ss[2].game).toBeNull();
  });
  it('tolerates empty input', () => {
    expect(parseShots(null)).toEqual([]);
    expect(parseShotSpots(undefined).size).toBe(0);
  });
  it('reads shot spots', () => {
    const m = parseShotSpots({ a: { lat: 52, lng: 21 }, b: { lat: 'x' } });
    expect([...m.keys()]).toEqual(['a']);
  });
});

describe('hunterTotals', () => {
  const ss = [
    shot('1', 'anna', 'kill', 'fox'),
    shot('2', 'anna', 'miss'),
    shot('3', 'bob', 'kill', 'boar_sow'),
    shot('4', 'bob', 'wound', 'boar_piglet'),
    shot('5', 'bob', 'miss'),
    shot('6', 'bob', 'miss'),
    shot('7', NO_SHOOTER, 'kill', 'hare'),
    shot('8', 'cyryl', 'unknown'),
  ];
  it('counts every shot per hunter and skips game with no shooter', () => {
    const t = hunterTotals(ss, ['anna', 'bob', 'cyryl', 'dawid']);
    expect(t.map((x) => x.uid)).toEqual(['bob', 'anna', 'cyryl', 'dawid']); // bob: 1 kill of big game beats anna's fox
    expect(t[0]).toMatchObject({ shots: 4, kill: 1, wound: 1, miss: 2, unknown: 0 });
    expect(t[1]).toMatchObject({ shots: 2, kill: 1, miss: 1 });
    expect(t[2]).toMatchObject({ shots: 1, unknown: 1 });
    expect(t[3].shots).toBe(0);
    expect(t.some((x) => x.uid === NO_SHOOTER)).toBe(false);
  });
  it('names the king and the misser, but not on a tie', () => {
    const t = hunterTotals(ss);
    expect(huntKing(t)).toBe('bob');
    expect(huntMisser(t)).toBe('bob');
    const tie = hunterTotals([shot('1', 'a', 'kill', 'fox'), shot('2', 'b', 'kill', 'fox'), shot('3', 'a', 'miss'), shot('4', 'b', 'miss')]);
    expect(huntKing(tie)).toBeNull();
    expect(huntMisser(tie)).toBeNull();
    expect(huntKing(hunterTotals([shot('1', 'a', 'miss')]))).toBeNull();
  });
});

describe('shotsByDrive', () => {
  it('groups in drive order, with loose and deleted-drive shots last', () => {
    const ds = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
    const gs = shotsByDrive([shot('a', 'u', 'kill', 'fox', 'd2'), shot('b', 'u', 'miss', null, 'd1'), shot('c', 'u', 'miss'), shot('d', 'u', 'miss', null, 'gone')], ds);
    expect(gs.map((x) => x.drive?.id ?? null)).toEqual(['d1', 'd2', null]);
    expect(gs[2].shots.map((s) => s.id)).toEqual(['c', 'd']);
  });
});

describe('bagBySpecies', () => {
  it('adds up kills per species in list order', () => {
    const bag = bagBySpecies(
      [shot('1', 'a', 'kill', 'fox'), shot('2', 'a', 'kill', 'boar_sow'), shot('3', 'a', 'kill', 'boar_piglet'), shot('4', 'a', 'wound', 'boar_male'), shot('5', 'a', 'kill')],
      'pl',
    );
    expect(bag).toEqual([
      ['Dzik', 2],
      ['Lis', 1],
      ['Nieokreślona', 1],
    ]);
  });
});

describe('outOfSeason', () => {
  it('warns about game shot outside its season', () => {
    expect(outOfSeason('roe_buck', '2026-12-12')).toBe(true); // bucks: 11 May – 30 Sep
    expect(outOfSeason('roe_doe', '2026-12-12')).toBe(false);
    expect(outOfSeason('boar_sow', '2026-07-01')).toBe(false); // all year
    expect(outOfSeason('raccoon_dog', '2026-07-01')).toBe(false); // no season data
  });
  it('uses the voivodeship exception', () => {
    expect(outOfSeason('red_stag', '2026-06-15')).toBe(true);
    expect(outOfSeason('red_stag', '2026-06-15', 'lubuskie')).toBe(false);
  });
  it('reads the voivodeship from the district label', () => {
    expect(voivodeshipOf('Obwód nr 12 · KŁ Darz Bór (Mazowieckie)')).toBe('mazowieckie');
    expect(voivodeshipOf('Obwód nr 12')).toBeNull();
    expect(gameByKey('nope')).toBeNull();
  });
});
