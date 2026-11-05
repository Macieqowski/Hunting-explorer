import { SPECIES, seasonsFor, speciesForSeason } from './atlas';
import { SEASONS } from './seasons';
import { hoofSvg } from './atlasTracks';
import credits from './atlasPhotos.json';

const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? \d(\.\d)?)/i;

describe('atlas', () => {
  it('has unique slugs', () => {
    expect(new Set(SPECIES.map((s) => s.slug)).size).toBe(SPECIES.length);
  });

  it('links every species to at least one season row', () => {
    for (const sp of SPECIES) expect(seasonsFor(sp).length, sp.slug).toBeGreaterThan(0);
  });

  it('maps season rows back to the right species', () => {
    const roe = SEASONS.find((s) => s.name.pl === 'Sarna – kozły')!;
    expect(speciesForSeason(roe)?.slug).toBe('sarna');
    const fox = SEASONS.find((s) => s.name.pl === 'Lis')!;
    expect(speciesForSeason(fox)).toBeUndefined();
  });

  it('has a credit with a free licence for every photo', () => {
    const c = credits as Record<string, { license: string; author: string; page: string }>;
    for (const sp of SPECIES)
      for (const p of sp.photos) {
        const cr = c[p.file];
        expect(cr, p.file).toBeTruthy();
        expect(cr.license).toMatch(ALLOWED);
        expect(cr.author).not.toBe('');
        expect(cr.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      }
  });

  it('has text in both languages', () => {
    for (const sp of SPECIES)
      for (const x of [sp.name, sp.terms, ...sp.sex, ...sp.age, ...sp.signs, ...sp.track.text, ...sp.facts.flat()]) {
        expect(x.pl.trim(), sp.slug).not.toBe('');
        expect(x.en.trim(), sp.slug).not.toBe('');
      }
  });

  it('draws a track that fits its frame', () => {
    for (const sp of SPECIES) {
      const svg = hoofSvg(sp.track.print, 'x');
      const nums = [...svg.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
      expect(Math.min(...nums), sp.slug).toBeGreaterThanOrEqual(0);
    }
  });
});
