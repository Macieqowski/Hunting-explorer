import { SPECIES, seasonsFor, speciesForSeason, speciesBySlug, protectedLookalikes } from './atlas';
import { SEASONS } from './seasons';
import { trackSvg } from './atlasTracks';
import credits from './atlasPhotos.json';

const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? \d(\.\d)?)/i;

describe('atlas', () => {
  it('has unique slugs', () => {
    expect(new Set(SPECIES.map((s) => s.slug)).size).toBe(SPECIES.length);
  });

  it('has a page for every SEASONS row', () => {
    for (const s of SEASONS) expect(speciesForSeason(s).length, s.name.pl).toBeGreaterThan(0);
  });

  it('links every game species to at least one season row', () => {
    for (const sp of SPECIES.filter((s) => !s.protection)) expect(seasonsFor(sp).length, sp.slug).toBeGreaterThan(0);
  });

  it('keeps protected species out of the hunting seasons', () => {
    const prot = SPECIES.filter((s) => s.protection);
    expect(prot.length).toBeGreaterThan(0);
    for (const sp of prot) {
      expect(sp.season, sp.slug).toBeUndefined();
      expect(sp.group.id, sp.slug).toBe('protected');
    }
    for (const s of SEASONS) expect(speciesForSeason(s).some((sp) => sp.protection), s.name.pl).toBe(false);
  });

  it('links protected species to existing game look-alikes and back', () => {
    for (const sp of SPECIES.filter((s) => s.protection)) {
      expect(sp.lookalikes?.length, sp.slug).toBeGreaterThan(0);
      for (const slug of sp.lookalikes!) {
        const game = speciesBySlug(slug);
        expect(game, `${sp.slug} -> ${slug}`).toBeTruthy();
        expect(game!.protection, slug).toBeUndefined();
        expect(protectedLookalikes(game!).map((p) => p.slug)).toContain(sp.slug);
      }
    }
    expect(protectedLookalikes(speciesBySlug('lis')!).map((p) => p.slug)).toEqual(['wilk', 'rys']);
  });

  it('maps season rows back to the right species', () => {
    const roe = SEASONS.find((s) => s.name.pl === 'Sarna – kozły')!;
    expect(speciesForSeason(roe).map((s) => s.slug)).toEqual(['sarna']);
    const ducks = SEASONS.find((s) => s.name.pl.startsWith('Kaczki'))!;
    expect(speciesForSeason(ducks).map((s) => s.slug)).toEqual(['krzyzowka', 'cyraneczka', 'glowienka', 'czernica']);
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
      for (const x of [sp.name, sp.terms, ...sp.sex, ...(sp.age ?? []), ...(sp.identify ?? []), ...sp.signs, ...sp.track.text, ...sp.facts.flat()]) {
        expect(x.pl.trim(), sp.slug).not.toBe('');
        expect(x.en.trim(), sp.slug).not.toBe('');
      }
  });

  it('draws a track that fits its frame', () => {
    for (const sp of SPECIES) {
      const svg = trackSvg(sp.track.print, 'x');
      const nums = [...svg.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
      expect(Math.min(...nums), sp.slug).toBeGreaterThanOrEqual(0);
    }
  });
});
