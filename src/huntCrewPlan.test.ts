import { describe, it, expect } from 'vitest';
import {
  routeSet,
  keepSlots,
  assignRoutes,
  hungarian,
  parseRoutePlan,
  parseRoutePlans,
  encodeRoutePlan,
  emptyPlan,
  decodeAssigned,
  encodeAssigned,
  parseAssignments,
  presentBeaters,
  nearestRoute,
  sameAssignment,
  PRESENT_MS,
  type RoutePlan,
  type Route,
  type AssignBeater,
} from './huntCrew';
import { offsetPoint } from './hunt';

const O = { lat: 52, lng: 21 };
const at = (deg: number, m: number) => offsetPoint(O, deg, m);
// Start line runs west → east 400 m, end line 600 m to the north.
const A1 = O;
const A2 = at(90, 400);
const B1 = at(0, 600);
const B2 = offsetPoint(B1, 90, 400);
const lines: [typeof O, typeof O, typeof O, typeof O] = [A1, A2, B1, B2];
const straight = (x: number, len = 600): Route => [at(90, x), offsetPoint(at(90, x), 0, len)];

describe('routeSet', () => {
  it('uses the exact hand-made variant first', () => {
    const p: RoutePlan = { lines, gaps: 'middle', variants: new Map([[3, [straight(0), straight(200), straight(400)]]]) };
    const s = routeSet(p, 3)!;
    expect(s.source).toBe('variant');
    expect(s.slots).toEqual([0, 1, 2]);
  });
  it('spreads from the lines when there is no variant for n', () => {
    const p: RoutePlan = { lines, gaps: 'middle', variants: new Map([[3, [straight(0), straight(200), straight(400)]]]) };
    const s = routeSet(p, 6)!;
    expect(s.source).toBe('lines');
    expect(s.routes).toHaveLength(6);
    expect(s.slots).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('without lines: more beaters pair up on the longest routes of the biggest variant below', () => {
    const p: RoutePlan = { lines: null, gaps: 'middle', variants: new Map([[3, [straight(0), straight(200, 900), straight(400)]], [8, Array.from({ length: 8 }, (_, i) => straight(i * 50))]]) };
    const s = routeSet(p, 5)!;
    expect(s.source).toBe('nearest');
    expect(s.base).toBe(3);
    expect(s.slots).toEqual([0, 0, 1, 1, 2]);
  });
  it('without lines: fewer beaters than the smallest variant leave gaps in the middle', () => {
    const p: RoutePlan = { lines: null, gaps: 'middle', variants: new Map([[5, Array.from({ length: 5 }, (_, i) => straight(i * 100))]]) };
    expect(routeSet(p, 3)!.slots).toEqual([0, 2, 4]);
    expect(routeSet({ ...p, gaps: 'flanks' }, 3)!.slots).toEqual([1, 2, 3]);
  });
  it('a variant with fewer drawn routes than n: extras pair up', () => {
    const p: RoutePlan = { lines: null, gaps: 'middle', variants: new Map([[4, [straight(0), straight(100), straight(200)]]]) };
    const s = routeSet(p, 4)!;
    expect(s.source).toBe('variant');
    expect(s.slots).toHaveLength(4);
  });
  it('nothing to plan from', () => {
    expect(routeSet(emptyPlan(), 4)).toBeNull();
    expect(routeSet(null, 4)).toBeNull();
    expect(routeSet({ ...emptyPlan(), lines }, 0)).toBeNull();
  });
});

describe('keepSlots', () => {
  it('middle: flanks stay covered', () => {
    expect(keepSlots([0, 1, 2, 3, 4], 4, 'middle')).toEqual([0, 1, 3, 4]);
    expect(keepSlots([0, 1, 2, 3, 4], 2, 'middle')).toEqual([0, 4]);
    expect(keepSlots([0, 1, 2, 3, 4, 5], 4, 'middle')).toEqual([0, 2, 3, 5]);
  });
  it('flanks: the outer routes go first', () => {
    expect(keepSlots([0, 1, 2, 3, 4], 3, 'flanks')).toEqual([1, 2, 3]);
    expect(keepSlots([0, 1, 2, 3, 4], 4, 'flanks')).toEqual([0, 1, 2, 3]);
    expect(keepSlots([0, 1, 2, 3, 4], 1, 'flanks')).toEqual([2]);
  });
  it('enough beaters: all kept', () => expect(keepSlots([0, 1, 2], 5, 'middle')).toEqual([0, 1, 2]));
});

describe('hungarian', () => {
  it('finds the cheapest matching', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
    expect(hungarian([])).toEqual([]);
    expect(hungarian([[7]])).toEqual([0]);
  });
});

describe('assignRoutes', () => {
  const p: RoutePlan = { lines, gaps: 'middle', variants: new Map() };
  const b = (uid: string, x: number | null, dog = false): AssignBeater => ({ uid, name: uid, pos: x == null ? null : offsetPoint(at(90, x), 180, 30), dog });
  it('each beater takes the start nearest to where they stand', () => {
    const s = routeSet(p, 4)!;
    const a = assignRoutes([b('d', 350), b('a', 40), b('c', 260), b('b', 150)], s);
    expect([...a].sort()).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
  });
  it('dogs go to the middle routes', () => {
    const s = routeSet(p, 5)!;
    const a = assignRoutes([b('a', 0), b('b', 80), b('dog', 0, true), b('d', 250), b('e', 390)], s);
    expect(a.get('dog')).toBe(2);
    expect(new Set(a.values()).size).toBe(5);
  });
  it('pins win, the rest fill around them', () => {
    const s = routeSet(p, 3)!;
    const a = assignRoutes([b('a', 0), b('b', 200), b('c', 390)], s, new Map([['c', 0]]));
    expect(a.get('c')).toBe(0);
    expect(new Set(a.values())).toEqual(new Set([0, 1, 2]));
  });
  it('no locations: names left to right', () => {
    const s = routeSet(p, 3)!;
    const a = assignRoutes([b('Zenon', null), b('Adam', null), b('Marek', null)], s);
    expect([a.get('Adam'), a.get('Marek'), a.get('Zenon')]).toEqual([0, 1, 2]);
  });
  it('two pins on one route: nobody is left without a route', () => {
    const s = routeSet(p, 3)!;
    const a = assignRoutes([b('a', 0), b('b', 200), b('c', 390)], s, new Map([['a', 1], ['b', 1]]));
    expect(a.size).toBe(3);
    expect(a.get('a')).toBe(1);
    expect(a.get('b')).toBe(1);
  });
});

describe('stored plan and assignments', () => {
  it('round-trips a plan', () => {
    const p: RoutePlan = { lines, gaps: 'flanks', variants: new Map([[3, [straight(0), [], straight(400)]]]) };
    const enc = JSON.parse(JSON.stringify(encodeRoutePlan(p)));
    expect(Object.keys(enc.v[3])).toEqual(['0', '2']);
    const back = parseRoutePlan(enc)!;
    expect(back.gaps).toBe('flanks');
    expect(back.lines).toHaveLength(4);
    expect(back.variants.get(3)!.map((r) => r.length)).toEqual([2, 0, 2]);
    expect(parseRoutePlans({ d1: enc, d2: { gaps: 'middle' } }).size).toBe(1);
  });
  it('an empty plan stores nothing', () => expect(encodeRoutePlan(emptyPlan())).toBeNull());
  it('assignment strings', () => {
    expect(decodeAssigned(encodeAssigned({ base: 5, slot: 2, pin: true }))).toEqual({ base: 5, slot: 2, pin: true });
    expect(decodeAssigned('5:5')).toBeNull();
    expect(decodeAssigned('x')).toBeNull();
    expect(parseAssignments({ d: { u1: '3:0', u2: 'bad' } }).get('d')!.size).toBe(1);
  });
  it('sameAssignment', () => {
    const saved = parseAssignments({ d: { u1: '3:0', u2: '3:1!' } }).get('d');
    expect(sameAssignment(saved, new Map([['u1', 0], ['u2', 1]]), 3)).toBe(true);
    expect(sameAssignment(saved, new Map([['u1', 1], ['u2', 0]]), 3)).toBe(false);
    expect(sameAssignment(saved, new Map([['u1', 0], ['u2', 1]]), 4)).toBe(false);
  });
});

describe('presence', () => {
  const now = 1_000_000_000;
  const ps = [
    { uid: 'a', role: 'beater' as const, status: 'confirmed' },
    { uid: 'b', role: 'beater' as const, status: 'confirmed', here: now - 3600e3 },
    { uid: 'c', role: 'beater' as const, status: 'confirmed' },
    { uid: 'd', role: 'beater' as const, status: 'registered' },
    { uid: 'h', role: 'hunter' as const, status: 'confirmed' },
  ];
  const seen = new Map([['a', now - 60e3], ['c', now - PRESENT_MS - 1], ['d', now], ['h', now]]);
  it('fresh location or "I am here"', () => expect(presentBeaters(ps, seen, now).map((p) => p.uid)).toEqual(['a', 'b']));
  it('the leader ticks win', () => expect(presentBeaters(ps, seen, now, new Map([['a', false], ['c', true]])).map((p) => p.uid)).toEqual(['b', 'c']));
});

describe('nearestRoute', () => {
  it('picks the closest route for a late beater', () => {
    expect(nearestRoute([straight(0), straight(200), straight(400)], at(90, 210))).toBe(1);
    expect(nearestRoute([[], straight(200)], null)).toBe(1);
    expect(nearestRoute([], O)).toBeNull();
  });
});
