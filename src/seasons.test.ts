import { SEASONS, isOpen, inRange, formatRanges, effective } from './seasons';

const find = (pl: string) => SEASONS.find((s) => s.name.pl === pl)!;

describe('seasons', () => {
  it('handles ranges wrapping over new year', () => {
    const r = { from: [10, 1] as [number, number], to: [1, 15] as [number, number] };
    expect(inRange(new Date(2026, 11, 24), r)).toBe(true);
    expect(inRange(new Date(2027, 0, 15), r)).toBe(true);
    expect(inRange(new Date(2027, 0, 16), r)).toBe(false);
  });

  it('roe buck season is 11 May – 30 Sep', () => {
    const s = find('Sarna – kozły');
    expect(isOpen(s, new Date(2026, 4, 10))).toBe(false);
    expect(isOpen(s, new Date(2026, 4, 11))).toBe(true);
    expect(isOpen(s, new Date(2026, 8, 30))).toBe(true);
    expect(isOpen(s, new Date(2026, 9, 1))).toBe(false);
  });

  it('applies regional exceptions for red deer stags in 2nd year', () => {
    const s = find('Jeleń szlachetny – byki w 2. roku życia');
    const june = new Date(2026, 5, 15);
    expect(isOpen(s, june, 'mazowieckie')).toBe(false);
    expect(isOpen(s, june, 'wielkopolskie')).toBe(true);
    expect(isOpen(s, new Date(2027, 1, 28), 'mazowieckie')).toBe(true);
  });

  it('wild boar all year, elk protected', () => {
    expect(isOpen(find('Dzik'), new Date(2026, 6, 1))).toBe(true);
    expect(isOpen(find('Łoś'), new Date(2026, 9, 1))).toBe(false);
    const e = effective(find('Łoś'));
    expect(formatRanges(e.ranges, e.allYear, 'pl')).toBe('ochrona');
  });
});
