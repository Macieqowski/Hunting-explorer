import {
  spreadRoutes,
  guide,
  buzzFor,
  arrowAngle,
  encodeRoute,
  decodeRoute,
  parseRoutes,
  parseAllRoutes,
  encodePt,
  decodePt,
  parseSeats,
  standForSeat,
  focusDrive,
  cleanPhone,
  fmtPhone,
  carcassKind,
  parseTransport,
  myCarcassKinds,
  carcasses,
  parseCarcassMarks,
  pickupOrder,
  smsLink,
  parseMessages,
  parseAcks,
  msgFor,
  recipients,
  cleanMessage,
  OFF_ROUTE_M,
  type Route,
  type Transport,
} from './huntCrew';
import { distanceM, offsetPoint } from './hunt';
import { GAMES, type Shot } from './pokot';
import rulesFile from '../database.rules.json';

const rules = rulesFile as any;
const O = { lat: 52, lng: 21 };
const at = (deg: number, m: number) => offsetPoint(O, deg, m);

describe('points and routes', () => {
  it('round-trip through the stored string', () => {
    const r: Route = [O, at(0, 300), at(10, 600)];
    const back = decodeRoute(encodeRoute(r));
    expect(back).toHaveLength(3);
    back.forEach((p, i) => expect(distanceM(p, r[i])).toBeLessThan(0.2));
    expect(decodePt(encodePt(O))).toEqual(O);
    expect(decodePt('x')).toBeNull();
  });
  it('drop routes with fewer than two points', () => {
    const m = parseRoutes({ a: encodeRoute([O, at(0, 100)]), b: '52,21', c: 7 });
    expect([...m.keys()]).toEqual(['a']);
    expect(parseAllRoutes({ d1: { a: encodeRoute([O, at(0, 100)]) }, d2: {} }).size).toBe(1);
  });
  it('match the pattern in the rules', () => {
    const re = new RegExp(rules.rules.routes.$h.$d.$uid['.validate'].match(/matches\(\/(.*)\/\)/)[1]);
    expect(re.test(encodeRoute([O, at(0, 100), at(90, 100)]))).toBe(true);
    expect(re.test('52,21')).toBe(false);
  });
});

describe('spreadRoutes', () => {
  const a1 = at(270, 400);
  const a2 = at(90, 400);
  const b1 = offsetPoint(a1, 0, 800);
  const b2 = offsetPoint(a2, 0, 800);
  it('spaces beaters evenly along both lines', () => {
    const rs = spreadRoutes(a1, a2, b1, b2, 4);
    expect(rs).toHaveLength(4);
    // 800 m line, 4 beaters: 200 m apart, 100 m from each end.
    expect(distanceM(rs[0][0], a1)).toBeCloseTo(100, -1);
    expect(distanceM(rs[0][0], rs[1][0])).toBeCloseTo(200, -1);
    for (const r of rs) expect(distanceM(r[0], r[1])).toBeCloseTo(800, -1);
  });
  it('flips an end line drawn the other way, so routes do not cross', () => {
    const rs = spreadRoutes(a1, a2, b2, b1, 3);
    for (const r of rs) expect(distanceM(r[0], r[1])).toBeCloseTo(800, -1);
  });
  it('handles no beaters', () => expect(spreadRoutes(a1, a2, b1, b2, 0)).toEqual([]));
});

describe('guide', () => {
  // A route going north 1 km, then east 500 m.
  const route: Route = [O, at(0, 1000), offsetPoint(at(0, 1000), 90, 500)];
  it('leads to the start before the drive', () => {
    const g = guide(route, at(180, 200), false);
    expect(g.state).toBe('toStart');
    expect(g.distM).toBeCloseTo(200, -1);
    expect(Math.round(g.bearing)).toBe(0);
  });
  it('points along the route to the next waypoint', () => {
    const g = guide(route, at(0, 300), true);
    expect(g.state).toBe('onRoute');
    expect(distanceM(g.target, route[1])).toBeLessThan(1);
    expect(g.offM).toBeLessThan(1);
    expect(g.toEndM).toBeCloseTo(1200, -1);
  });
  it('tells which side the beater drifted to', () => {
    const left = guide(route, offsetPoint(at(0, 300), 270, 30), true);
    expect(left.state).toBe('onRoute');
    expect(left.side).toBe('left');
    const right = guide(route, offsetPoint(at(0, 300), 90, 30), true);
    expect(right.side).toBe('right');
  });
  it('leads back to the route when far off it', () => {
    const g = guide(route, offsetPoint(at(0, 300), 90, OFF_ROUTE_M + 30), true);
    expect(g.state).toBe('off');
    expect(g.side).toBe('right');
    expect(Math.round(g.bearing)).toBe(270);
  });
  it('turns at a waypoint', () => {
    const g = guide(route, offsetPoint(at(0, 1000), 90, 50), true);
    expect(distanceM(g.target, route[2])).toBeLessThan(1);
  });
  it('warns near the end (the hunters) and says when arrived', () => {
    expect(guide(route, offsetPoint(at(0, 1000), 90, 450), true).state).toBe('nearEnd');
    expect(guide(route, offsetPoint(at(0, 1000), 90, 490), true).state).toBe('arrived');
  });
});

describe('buzzFor', () => {
  it('buzzes on leaving the route and repeats only after a while', () => {
    expect(buzzFor('onRoute', 'off', 0, 1000)).toBe('off');
    expect(buzzFor('off', 'off', 1000, 10_000)).toBeNull();
    expect(buzzFor('off', 'off', 1000, 40_000)).toBe('off');
  });
  it('buzzes once near the end and once on arrival', () => {
    expect(buzzFor('onRoute', 'nearEnd', 0, 0)).toBe('nearEnd');
    expect(buzzFor('nearEnd', 'nearEnd', 0, 0)).toBeNull();
    expect(buzzFor('nearEnd', 'arrived', 0, 0)).toBe('arrived');
    expect(buzzFor('arrived', 'nearEnd', 0, 0)).toBeNull();
    expect(buzzFor(null, 'onRoute', 0, 0)).toBeNull();
  });
  it('turns the arrow by the phone heading', () => {
    expect(arrowAngle(90, null)).toBe(90);
    expect(arrowAngle(90, 80)).toBe(10);
    expect(arrowAngle(10, 350)).toBe(20);
  });
});

describe('seats', () => {
  it('parse per drive and person', () => {
    const m = parseSeats({ d1: { a: '9A', b: ' ', c: 3 }, d2: 'x' });
    expect(m.get('d1')?.get('a')).toBe('9A');
    expect(m.get('d1')?.has('b')).toBe(false);
    expect(m.has('d2')).toBe(false);
  });
  it('find the stand by its name', () => {
    const stands = [{ name: '9A' }, { name: 'Ambona 12' }];
    expect(standForSeat('9a', stands)).toBe(stands[0]);
    expect(standForSeat('nr 9A', stands)).toBe(stands[0]);
    expect(standForSeat('ambona12', stands)).toBe(stands[1]);
    expect(standForSeat('7', stands)).toBeNull();
    expect(standForSeat('', stands)).toBeNull();
  });
  it('focus on the running, else the next planned, else the last drive', () => {
    const d = (id: string, startedAt: number | null, endedAt: number | null) => ({ id, startedAt, endedAt });
    expect(focusDrive([d('a', 1, 2), d('b', 3, null), d('c', null, null)])?.id).toBe('b');
    expect(focusDrive([d('a', 1, 2), d('c', null, null)])?.id).toBe('c');
    expect(focusDrive([d('a', 1, 2), d('b', 3, 4)])?.id).toBe('b');
    expect(focusDrive([])).toBeNull();
  });
});

describe('phones', () => {
  it('accept usual ways of writing a number', () => {
    expect(cleanPhone('600 100 200')).toBe('600100200');
    expect(cleanPhone('+48 600-100-200')).toBe('+48600100200');
    expect(cleanPhone('12345')).toBeNull();
    expect(cleanPhone('abc')).toBeNull();
  });
  it('print in groups of three', () => {
    expect(fmtPhone('600100200')).toBe('600 100 200');
    expect(fmtPhone('+48600100200')).toBe('+48 600 100 200');
  });
  it('match the rules', () => {
    const re = new RegExp(rules.rules.phones.$h.$uid['.validate'].match(/matches\(\/(.*)\/\)/)[1]);
    expect(re.test('+48600100200')).toBe(true);
    expect(re.test('600 100 200')).toBe(false);
  });
});

describe('transport', () => {
  it('splits boar from red game (zwierzyna płowa)', () => {
    expect(carcassKind('boar_sow')).toBe('boar');
    for (const k of ['red_stag', 'fallow_doe', 'roe_kid', 'mouflon_ram']) expect(carcassKind(k)).toBe('deer');
    expect(carcassKind('fox')).toBeNull();
    expect(carcassKind(null)).toBeNull();
    // Every big game on the pokot list has a carrier.
    for (const g of GAMES) if (g.group === 'deer' || g.group === 'other') expect(carcassKind(g.key), g.key).not.toBeNull();
  });
  it('parses participants and outside people', () => {
    const t = parseTransport({ boar: { uid: 'a' }, deer: { name: 'Kierowca', phone: '600100200' } });
    expect(t).toEqual({ boar: { uid: 'a' }, deer: { name: 'Kierowca', phone: '600100200' } });
    expect(parseTransport({ boar: { name: 'X', phone: '1' } })).toEqual({});
    expect(myCarcassKinds(t, 'a')).toEqual(['boar']);
    expect(myCarcassKinds({ boar: { uid: 'a' }, deer: { uid: 'a' } }, 'a')).toEqual(['boar', 'deer']);
  });
});

describe('carcasses', () => {
  const shot = (id: string, game: string | null, outcome: Shot['outcome'] = 'kill', driveId: string | null = 'd1', uid = 'h1'): Shot => ({ id, uid, outcome, game, driveId, ts: 1, note: '' });
  const drives = [
    { id: 'd1', startedAt: 1, endedAt: 2 },
    { id: 'd2', startedAt: 3, endedAt: null },
  ];
  it('lists kills of boar and red game only', () => {
    const list = carcasses([shot('a', 'boar_sow'), shot('b', 'fox'), shot('c', 'roe_doe', 'wound'), shot('d', 'red_hind'), shot('e', null)], new Map(), new Map(), drives);
    expect(list.map((c) => [c.shotId, c.kind])).toEqual([
      ['a', 'boar'],
      ['d', 'deer'],
    ]);
  });
  it('are ready once their drive ended', () => {
    const list = carcasses([shot('a', 'boar_sow', 'kill', 'd1'), shot('b', 'boar_sow', 'kill', 'd2'), shot('c', 'boar_sow', 'kill', null)], new Map(), new Map(), drives);
    expect(list.map((c) => c.ready)).toEqual([true, false, false]);
    expect(carcasses([shot('c', 'boar_sow', 'kill', null)], new Map(), new Map(), [])[0].ready).toBe(true);
  });
  it('take the moved position, else the shot, else the stand', () => {
    const spots = new Map([['a', { lat: 1, lng: 1 }], ['b', { lat: 2, lng: 2 }]]);
    const marks = parseCarcassMarks({ a: { lat: 5, lng: 5, pickedBy: 't', pickedAt: 9 }, x: 3 });
    const list = carcasses([shot('a', 'boar_sow'), shot('b', 'boar_sow'), shot('c', 'boar_sow')], spots, marks, drives, (uid, d) => (uid === 'h1' && d === 'd1' ? { lat: 3, lng: 3 } : null));
    expect(list.map((c) => [c.src, c.at?.lat])).toEqual([
      ['mark', 5],
      ['shot', 2],
      ['seat', 3],
    ]);
    expect(list[0].pickedBy).toBe('t');
  });
  it('are visited nearest first', () => {
    const c = (id: string, m: number | null) => ({ id, at: m == null ? null : at(0, m) });
    expect(pickupOrder([c('far', 900), c('none', null), c('near', 100), c('mid', 400)], O).map((x) => x.id)).toEqual(['near', 'mid', 'far', 'none']);
  });
  it('make an sms link', () => expect(smsLink('600100200', 'Dzik: a&b')).toBe('sms:600100200?&body=Dzik%3A%20a%26b'));
});

describe('messages', () => {
  const t: Transport = { boar: { uid: 'tr' } };
  it('parse and sort newest first', () => {
    const ms = parseMessages({ a: { text: 'x', to: 'all', ts: 1 }, b: { text: 'y', to: 'u:abc', ts: 2 }, c: { text: 'z', to: 'nobody', ts: 3 }, d: { to: 'all', ts: 4 } });
    expect(ms.map((m) => m.id)).toEqual(['b', 'a']);
    expect(parseAcks({ a: { u1: 5, u2: 'x' } }).get('a')?.size).toBe(1);
  });
  it('reach the right people', () => {
    const hunter = { uid: 'h', role: 'hunter' as const };
    const beater = { uid: 'b', role: 'beater' as const };
    const carrier = { uid: 'tr', role: 'beater' as const };
    expect(msgFor({ to: 'all' }, hunter, t)).toBe(true);
    expect(msgFor({ to: 'all' }, { uid: 'l', role: 'leader' }, t)).toBe(false);
    expect(msgFor({ to: 'hunter' }, beater, t)).toBe(false);
    expect(msgFor({ to: 'beater' }, beater, t)).toBe(true);
    expect(msgFor({ to: 'transport' }, carrier, t)).toBe(true);
    expect(msgFor({ to: 'transport' }, beater, t)).toBe(false);
    expect(msgFor({ to: 'u:h' }, hunter, t)).toBe(true);
    expect(msgFor({ to: 'u:h' }, beater, t)).toBe(false);
  });
  it('count only confirmed recipients', () => {
    const ps = [
      { uid: 'h', role: 'hunter' as const, status: 'confirmed' },
      { uid: 'h2', role: 'hunter' as const, status: 'registered' },
      { uid: 'b', role: 'beater' as const, status: 'confirmed' },
    ];
    expect(recipients({ to: 'all' }, ps, t).map((p) => p.uid)).toEqual(['h', 'b']);
  });
  it('are cleaned and cut', () => {
    expect(cleanMessage('  a \n b ')).toBe('a b');
    expect(cleanMessage('x'.repeat(300))).toHaveLength(200);
  });
});
