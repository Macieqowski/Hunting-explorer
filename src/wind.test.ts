import { describe, it, expect } from 'vitest';
import { parseWind, windUrl, windAt, scentCone, coneHalfAngle, driveEdges, gridPoints, cellKey, angleDiff, windTo, speedColor } from './wind';
import { bearing, distanceM, windFocusTime, driveStartMs } from './hunt';

const T0 = Date.parse('2026-11-05T00:00:00Z') / 1000;
const hourly = (dir: number, wind = 10) => ({
  time: [T0, T0 + 3600, T0 + 7200],
  wind_speed_10m: [wind, wind + 1, wind + 2],
  wind_direction_10m: [dir, dir, dir],
  wind_gusts_10m: [wind + 5, null, wind + 7],
});

describe('forecast', () => {
  it('asks for several points in one request', () => {
    const u = new URL(windUrl([{ lat: 52.1, lng: 21 }, { lat: 52.2, lng: 21.1 }]));
    expect(u.searchParams.get('latitude')).toBe('52.100,52.200');
    expect(u.searchParams.get('longitude')).toBe('21.000,21.100');
    expect(u.searchParams.get('hourly')).toContain('wind_direction_10m');
  });

  it('parses a single object and an array', () => {
    const one = parseWind({ latitude: 52, longitude: 21, hourly: hourly(270) }, [{ lat: 52, lng: 21 }]);
    expect(one).toHaveLength(1);
    expect(one[0].hours[0]).toEqual({ time: T0 * 1000, wind: 10, dir: 270, gust: 15 });
    expect(one[0].hours[1].gust).toBe(11); // missing gust falls back to the wind
    const many = parseWind([{ hourly: hourly(90) }, { hourly: hourly(180) }], [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    expect(many.map((p) => [p.lat, p.hours[0].dir])).toEqual([[1, 90], [3, 180]]);
  });

  it('skips hours without data and survives an empty answer', () => {
    const p = parseWind({ hourly: { time: [T0, T0 + 3600], wind_speed_10m: [null, 4], wind_direction_10m: [10, 20] } }, [{ lat: 0, lng: 0 }]);
    expect(p[0].hours).toHaveLength(1);
    expect(parseWind({}, [{ lat: 0, lng: 0 }])[0].hours).toEqual([]);
  });

  it('picks the hour containing a time', () => {
    const h = parseWind({ hourly: hourly(0) }, [{ lat: 0, lng: 0 }])[0].hours;
    expect(windAt(h, T0 * 1000 + 5400_000)?.wind).toBe(11);
    expect(windAt(h, T0 * 1000 - 1)?.wind).toBe(10);
    expect(windAt(h, T0 * 1000 + 99 * 3600_000)?.wind).toBe(12);
    expect(windAt([], 0)).toBeNull();
  });

  it('builds a grid of cell centres and stable cell keys', () => {
    const g = gridPoints({ south: 50, west: 20, north: 51, east: 21 }, 2);
    expect(g).toEqual([
      { lat: 50.25, lng: 20.25 },
      { lat: 50.25, lng: 20.75 },
      { lat: 50.75, lng: 20.25 },
      { lat: 50.75, lng: 20.75 },
    ]);
    expect(cellKey(52.2312, 21.0101)).toBe(cellKey(52.2401, 21.0199));
  });

  it('colours by strength', () => {
    expect(speedColor(1)).not.toBe(speedColor(10));
    expect(speedColor(50)).toBe('#dc2626');
  });
});

describe('scent cone', () => {
  const o = { lat: 52, lng: 21 };
  it('points downwind', () => {
    expect(windTo(270)).toBe(90);
    const cone = scentCone(o, { wind: 15, dir: 270, gust: 20 });
    expect(cone[0]).toEqual(o);
    const tip = cone[1 + 4]; // middle of the arc
    expect(angleDiff(bearing(o, tip), 90)).toBeLessThan(1);
    expect(distanceM(o, tip)).toBeCloseTo(400, -1);
  });

  it('is wider in gusty wind, capped at 45°', () => {
    expect(coneHalfAngle(15, 15)).toBe(20);
    expect(coneHalfAngle(15, 30)).toBe(35);
    expect(coneHalfAngle(15, 90)).toBe(45);
  });

  it('is a circle when calm', () => {
    const c = scentCone(o, { wind: 1, dir: 0, gust: 2 });
    expect(c).toHaveLength(24);
    for (const p of c) expect(distanceM(o, p)).toBeCloseTo(200, -1);
  });
});

describe('drive edges', () => {
  // A square: SW, SE, NE, NW (counter-clockwise).
  const sq: [number, number][] = [
    [52, 21],
    [52, 21.01],
    [52.01, 21.01],
    [52.01, 21],
  ];
  const sides = (a: [number, number][], from: number) => driveEdges(a, from).map((e) => e.side);

  it('marks the downwind and upwind edges (wind from the west)', () => {
    // Edges: south, east, north, west.
    expect(sides(sq, 270)).toEqual(['side', 'downwind', 'side', 'upwind']);
  });

  it('does not depend on the drawing direction', () => {
    // Reversed: north, east, south, west edges.
    expect(sides([...sq].reverse(), 270)).toEqual(['side', 'downwind', 'side', 'upwind']);
  });

  it('wind from the north makes the south edge downwind', () => {
    const e = driveEdges(sq, 0);
    expect(e[0].side).toBe('downwind');
    expect(angleDiff(e[0].out, 180)).toBeLessThan(1);
    expect(e[2].side).toBe('upwind');
  });

  it('needs a polygon', () => {
    expect(driveEdges(sq.slice(0, 2), 0)).toEqual([]);
  });
});

describe('wind time for a hunt', () => {
  const h = { date: '2026-11-07', start: '08:00', end: '15:00' };
  const at = (hh: number, mm = 0) => new Date(2026, 10, 7, hh, mm).getTime();
  const d = (start: string, startedAt: number | null = null, endedAt: number | null = null) => ({ name: start, start, end: start, area: [], startedAt, endedAt });

  it('drive start times follow the hunt day, past midnight too', () => {
    expect(driveStartMs(h, { start: '09:30' })).toBe(at(9, 30));
    expect(driveStartMs({ date: '2026-11-07', start: '20:00', end: '02:00' }, { start: '01:00' })).toBe(at(25));
  });

  it('shows the next planned drive, the hunt start, or now', () => {
    const ds = [d('10:00'), d('12:00')];
    expect(windFocusTime(h, ds, at(6))).toBe(at(10));
    expect(windFocusTime(h, ds, at(11))).toBe(at(12));
    expect(windFocusTime(h, [], at(6))).toBe(at(8));
    expect(windFocusTime(h, [d('10:00', at(10), null)], at(10, 5))).toBeNull();
    expect(windFocusTime(h, ds, at(16))).toBeNull();
  });
});
