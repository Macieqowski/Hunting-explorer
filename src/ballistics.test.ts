import { describe, expect, test } from 'vitest';
import { trajectory, energy, airDensity, zeroForHeight, verdict, reachWithEnergy, range, correctionMrad, FLOORS, MRAD_PER_MOA, type Shot } from './ballistics';
import ammo from './ammo.json';
import { BULLET_TYPES, makerIssues, type Load } from './ballisticsUi';

const loads = ammo.loads as Load[];
const shotFor = (x: Load, zero = 100): Shot => ({
  v0: x.v[0]!,
  mass: x.m,
  bc: x.g7 ?? x.g1!,
  model: x.g7 ? 'G7' : 'G1',
  zero,
  sightHeight: 5,
});

describe('physics', () => {
  test('energy is ½mv²', () => {
    expect(energy(11.7, 800)).toBeCloseTo(3744, 0);
  });

  test('standard air density', () => {
    expect(airDensity()).toBeCloseTo(1.225, 3);
    expect(airDensity(-10, 1013.25)).toBeGreaterThan(airDensity(30, 1013.25));
  });

  test('path crosses the line of sight at the zero and starts at minus sight height', () => {
    const p = trajectory({ v0: 800, mass: 11.7, bc: 0.35, model: 'G1', zero: 150, sightHeight: 5 }, [0, 150]);
    expect(p[0].drop).toBeCloseTo(-5, 5);
    expect(Math.abs(p[1].drop)).toBeLessThan(0.05);
  });

  test('a GEE zero puts the bullet 4 cm high at 100 m', () => {
    const base = { v0: 800, mass: 11.7, bc: 0.35, model: 'G1' as const, sightHeight: 5 };
    const z = zeroForHeight(base, 100, 4)!;
    expect(z).toBeGreaterThan(150);
    expect(z).toBeLessThan(220);
    expect(trajectory({ ...base, zero: z }, [100])[0].drop).toBeCloseTo(4, 1);
  });

  test('crosswind drift grows with distance and wind', () => {
    const s: Shot = { v0: 800, mass: 11.7, bc: 0.35, model: 'G1', zero: 100, sightHeight: 5, wind: 4 };
    const [, a, b] = trajectory(s, [0, 100, 200]);
    expect(a.drift).toBeGreaterThan(0);
    expect(b.drift).toBeGreaterThan(a.drift * 3);
    expect(trajectory({ ...s, wind: 0 }, [200])[0].drift).toBe(0);
  });

  test('MRAD and MOA corrections', () => {
    const [p] = trajectory({ v0: 800, mass: 11.7, bc: 0.35, model: 'G1', zero: 100, sightHeight: 5 }, [300]);
    const mrad = correctionMrad(p);
    expect(mrad).toBeCloseTo((-p.drop / 100 / 300) * 1000, 6);
    expect(1 / MRAD_PER_MOA).toBeCloseTo(3.4377, 3);
  });

  test('reach with energy stops at the first point below the floor', () => {
    const pts = trajectory({ v0: 800, mass: 11.7, bc: 0.35, model: 'G1', zero: 100, sightHeight: 5 }, range(800, 5));
    const r = reachWithEnergy(pts, 2000);
    expect(pts.find((p) => p.x === r)!.e).toBeGreaterThanOrEqual(2000);
    expect(pts.find((p) => p.x === r + 5)!.e).toBeLessThan(2000);
  });
});

describe('legal floors (Dz.U. 2022 poz. 2323)', () => {
  test('floors per species', () => {
    expect(Object.fromEntries(FLOORS.map((f) => [f.id, f.e100]))).toEqual({ moose: 2500, deer: 2000, roe: 1000, small: 400 });
  });
  test('verdicts', () => {
    const deer = FLOORS.find((f) => f.id === 'deer')!;
    expect(verdict(1999, deer)).toBe('below');
    expect(verdict(2000, deer)).toBe('borderline');
    expect(verdict(2199, deer)).toBe('borderline');
    expect(verdict(2200, deer)).toBe('ok');
  });
});

describe('ammunition data', () => {
  test('every load is complete and sourced', () => {
    expect(loads.length).toBeGreaterThan(400);
    const ids = new Set<string>();
    for (const x of loads) {
      expect(ids.has(x.id), x.id).toBe(false);
      ids.add(x.id);
      expect(x.c && x.mk && x.n, x.id).toBeTruthy();
      expect(x.m, x.id).toBeGreaterThan(1);
      expect(x.v[0], x.id).toBeGreaterThan(200); // subsonic loads start below 340 m/s
      expect(x.g7 ?? x.g1, x.id).toBeGreaterThan(0.05);
      expect(x.g7 ?? x.g1, x.id).toBeLessThan(1.2);
      expect(x.u, x.id).toMatch(/^https:\/\//);
    }
  });

  test('the makers hunters ask for are there', () => {
    const makers = new Set(loads.map((x) => x.mk));
    for (const m of ['Sellier & Bellot', 'Norma', 'RWS', 'Geco', 'Sako', 'Lapua', 'Hornady', 'Federal', 'Remington', 'Winchester', 'Browning', 'Nosler', 'Fiocchi', 'Blaser', 'Brenneke', 'Sax', 'PPU (Prvi Partizan)', 'Swift']) expect(makers.has(m), m).toBe(true);
  });

  test('bullet types', () => {
    const count = new Map<string, number>();
    for (const x of loads) {
      if (x.t !== undefined) expect(BULLET_TYPES, x.id).toContain(x.t);
      count.set(x.t ?? 'none', (count.get(x.t ?? 'none') ?? 0) + 1);
    }
    // every type is on offer, and the maker leaves it unsaid for only a few loads
    for (const t of BULLET_TYPES) if (t !== 'lead') expect(count.get(t) ?? 0, t).toBeGreaterThan(0);
    expect(count.get('none') ?? 0).toBeLessThan(loads.length / 50);
    // spot checks against the makers' own descriptions
    const typeOf = (id: string) => loads.find((x) => x.id === id)?.t;
    expect(loads.filter((x) => x.mk === 'Norma' && x.n === 'Jaktmatch').every((x) => x.t === 'fmj')).toBe(true);
    expect(loads.filter((x) => x.mk === 'RWS' && x.n === 'HIT').every((x) => x.t === 'mono')).toBe(true);
    expect(loads.filter((x) => x.mk === 'Lapua' && x.n.startsWith('Scenar')).every((x) => x.t === 'match')).toBe(true);
    expect(loads.filter((x) => x.mk === 'Swift').map((x) => x.t).sort().filter((t, i, a) => a.indexOf(t) === i)).toEqual(['solid', 'sp', 'tip']);
    expect(typeOf('sel-308-win-soft-point-11-7g')).toBe('sp');
  });

  test('calibres popular in Poland are covered', () => {
    const cals = new Set(loads.map((x) => x.c));
    for (const c of ['.243 Win.', '6,5x55 SE', '6,5 Creedmoor', '.270 Win.', '7x64', '7x65 R', '.308 Win.', '.30-06 Springfield', '.300 Win. Mag.', '8x57 JS', '8x57 JRS', '9,3x62', '9,3x74 R', '.222 Rem.', '.223 Rem.'])
      expect(cals.has(c), c).toBe(true);
  });

  // The solver must reproduce each maker's own published table: this checks both the
  // calculator and the data we copied from the maker's page. Where the maker's own numbers
  // disagree, the load lists the cells (x) and the calculator shows a note instead.
  test.each(loads.map((x) => [x.id, x] as const))('%s matches the maker table', (_, x) => {
    const p = trajectory(shotFor(x), [0, 100, 200, 300]);
    const noted = new Set(x.x ?? []);
    for (const i of [1, 2, 3]) {
      const v = x.v[i];
      if (v && !noted.has(`v${i}`)) expect(Math.abs(p[i].v - v) / v, `v at ${i * 100} m`).toBeLessThan(0.03);
    }
    for (const i of [0, 1, 2, 3]) {
      const [v, e] = [x.v[i], x.e[i]];
      if (v && e && !noted.has(`e${i}`)) expect(Math.abs(energy(x.m, v) - e) / e, `E at ${i * 100} m`).toBeLessThan(0.03);
    }
  });

  test('loads whose maker data disagree carry a note with the numbers', () => {
    const noted = loads.filter((x) => x.x?.length);
    expect(noted.length).toBeGreaterThan(30);
    expect(noted.length).toBeLessThan(loads.length / 20);
    for (const x of noted) {
      const issues = makerIssues(x);
      expect(issues.length, x.id).toBe(x.x!.length);
      for (const i of issues) expect(Math.abs(i.calc - i.printed) / i.printed, `${x.id} ${i.kind}${i.d}`).toBeGreaterThan(0.025);
    }
    // a misprint in the Fiocchi Caccia catalogue: 830 m/s at 200 m, after 715 m/s at 100 m
    const sest = loads.find((x) => x.mk === 'Fiocchi' && x.c === '.30-06 Springfield' && x.n === 'Excellence SEST' && x.m > 11.5)!;
    expect(sest.x).toContain('v2');
    expect(makerIssues(loads.find((x) => x.id === 'sel-308-win-soft-point-11-7g')!)).toEqual([]);
  });

  test('drag model follows the maker tables', () => {
    const share = (mk: string) => loads.filter((x) => x.mk === mk && x.g7).length / loads.filter((x) => x.mk === mk).length;
    expect(share('Sellier & Bellot')).toBeGreaterThan(0.9);
    expect(share('Lapua')).toBeGreaterThan(0.5);
    expect(share('Norma')).toBeLessThan(0.05);
    // the Fiocchi catalogues: every European load names its page
    const eu = loads.filter((x) => x.s);
    expect(eu.length).toBeGreaterThan(60);
    for (const x of eu) expect(x.mk, x.id).toBe('Fiocchi');
  });

  test('legal verdict from calculated E100 agrees with the maker E100', () => {
    let disagree = 0;
    for (const x of loads) {
      if (!x.e[1] || x.x?.length) continue;
      const mine = trajectory(shotFor(x), [100])[0].e;
      for (const f of FLOORS) if ((mine >= f.e100) !== (x.e[1] >= f.e100) && Math.abs(x.e[1] - f.e100) / f.e100 > 0.02) disagree++;
    }
    expect(disagree).toBe(0);
  });
});
