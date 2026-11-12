import { describe, expect, it, vi } from 'vitest';

// Polish labels, whatever language the machine running the tests uses.
vi.hoisted(() => vi.stubGlobal('navigator', { language: 'pl-PL' }));
import { districtMatches, searchTerms } from './data';
import { pickName } from './offlinePick';
import type { District } from './bdl';

const d = (nr: string, voiv: string, holder: string, nadl = 'Celestynów') =>
  ({ objectid: Number(nr), hunt_dist_nr: nr, county_name: voiv, lease_holder_name: holder, inspectorate_name: nadl, district_name: 'otwocki', reg_mng_board_name: null }) as unknown as District;

describe('choosing districts to save offline', () => {
  it('matches the exact number or words in the text', () => {
    const x = d('191', 'mazowieckie', 'Koło Łowieckie "Szarak"');
    expect(districtMatches(x, searchTerms('191'))).toBe(true);
    expect(districtMatches(x, searchTerms('19'))).toBe(false);
    expect(districtMatches(x, searchTerms('szarak celestynow'))).toBe(true);
    expect(districtMatches(x, searchTerms('kolo lowieckie'))).toBe(true);
    expect(districtMatches(x, searchTerms('szarak lublin'))).toBe(false);
  });

  it('names one district like its page and several by their numbers', () => {
    expect(pickName([d('191', 'mazowieckie', 'A')])).toBe('Obwód nr 191 · Mazowieckie');
    expect(pickName([d('191', 'mazowieckie', 'A'), d('192', 'mazowieckie', 'B')])).toBe('Obwody nr 191, 192 · Mazowieckie');
    expect(pickName([d('5', 'mazowieckie', 'A'), d('7', 'lubelskie', 'B')])).toBe('Obwody nr 5, 7');
    const many = Array.from({ length: 9 }, (_, i) => d(String(i + 1), 'mazowieckie', 'A'));
    expect(pickName(many)).toBe('Obwody nr 1, 2, 3, 4, 5, 6 i jeszcze 3 · Mazowieckie');
  });
});
