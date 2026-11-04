import { describe, it, expect } from 'vitest';
import { sunTimes, moonIllumination, moonTimes, moonPhaseName, nextMoonPhase, sunAltitude } from './astro';

const WAW = [52.2297, 21.0122] as const;
const minutesOff = (a: Date | null, iso: string) => Math.abs(a!.valueOf() - Date.parse(iso)) / 6e4;

describe('sun', () => {
  it('matches published Warsaw times on the summer solstice', () => {
    const s = sunTimes(new Date('2024-06-21T10:00:00Z'), ...WAW);
    // Published: sunrise 04:14, sunset 21:01 CEST.
    expect(minutesOff(s.sunrise, '2024-06-21T02:14:00Z')).toBeLessThan(3);
    expect(minutesOff(s.sunset, '2024-06-21T19:01:00Z')).toBeLessThan(3);
    expect(s.civilDawn!.valueOf()).toBeLessThan(s.sunrise!.valueOf());
    expect(s.civilDusk!.valueOf()).toBeGreaterThan(s.sunset!.valueOf());
    // No astronomical night in Warsaw in June.
    expect(s.astroDawn).toBeNull();
  });

  it('matches Warsaw times in winter', () => {
    const s = sunTimes(new Date('2024-12-21T11:00:00Z'), ...WAW);
    // Published: sunrise 07:43, sunset 15:25 CET.
    expect(minutesOff(s.sunrise, '2024-12-21T06:43:00Z')).toBeLessThan(3);
    expect(minutesOff(s.sunset, '2024-12-21T14:25:00Z')).toBeLessThan(3);
  });

  it('puts the sun high at noon and below the horizon at midnight', () => {
    expect(sunAltitude(new Date('2024-06-21T10:57:00Z'), ...WAW)).toBeGreaterThan(55);
    expect(sunAltitude(new Date('2024-06-21T23:00:00Z'), ...WAW)).toBeLessThan(0);
  });
});

describe('moon', () => {
  it('is full on 25 Jan 2024 and new on 9 Feb 2024', () => {
    const full = moonIllumination(new Date('2024-01-25T17:54:00Z'));
    expect(full.fraction).toBeGreaterThan(0.99);
    expect(moonPhaseName(full.phase)).toBe('full');
    const nu = moonIllumination(new Date('2024-02-09T22:59:00Z'));
    expect(nu.fraction).toBeLessThan(0.01);
    expect(moonPhaseName(nu.phase)).toBe('new');
  });

  it('finds the next full and new moon to within a few hours', () => {
    const from = new Date('2024-01-20T00:00:00Z');
    expect(minutesOff(nextMoonPhase(from, 0.5), '2024-01-25T17:54:00Z')).toBeLessThan(6 * 60);
    expect(minutesOff(nextMoonPhase(from, 0), '2024-02-09T22:59:00Z')).toBeLessThan(6 * 60);
  });

  it('rises around sunset on the day of the full moon', () => {
    const m = moonTimes(new Date('2024-01-24T23:00:00Z'), ...WAW); // local midnight, 25 Jan
    const s = sunTimes(new Date('2024-01-25T11:00:00Z'), ...WAW);
    expect(m.rise).not.toBeNull();
    expect(Math.abs(m.rise!.valueOf() - s.sunset!.valueOf()) / 36e5).toBeLessThan(2);
  });

  it('names the phases', () => {
    expect(moonPhaseName(0.1)).toBe('waxingCrescent');
    expect(moonPhaseName(0.25)).toBe('firstQuarter');
    expect(moonPhaseName(0.4)).toBe('waxingGibbous');
    expect(moonPhaseName(0.6)).toBe('waningGibbous');
    expect(moonPhaseName(0.76)).toBe('lastQuarter');
    expect(moonPhaseName(0.9)).toBe('waningCrescent');
    expect(moonPhaseName(0.99)).toBe('new');
  });
});
