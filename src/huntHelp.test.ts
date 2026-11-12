import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDES, fmt, renderGuide, uiLabels } from './huntHelp';
import { GUIDE_ROLES, hashToView, viewToHash } from './nav';

const texts = (role: keyof typeof GUIDES) =>
  GUIDES[role].sections.flatMap((s) => [...(s.text ?? []), ...(s.steps ?? []), ...(s.tips ?? []), ...(s.where ?? []).map((w) => `[[${w}]]`)]);

// Every string literal in the app's code, to check the guide quotes real buttons.
const source = readdirSync('src')
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'huntHelp.ts')
  .map((f) => readFileSync(`src/${f}`, 'utf8'))
  .join('\n');

describe('guides', () => {
  it('has a guide for each role with unique sections', () => {
    for (const r of GUIDE_ROLES) {
      const ids = GUIDES[r].sections.map((s) => s.id);
      expect(ids.length).toBeGreaterThan(5);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('quotes buttons and labels exactly as the app shows them', () => {
    const missing: string[] = [];
    for (const r of GUIDE_ROLES)
      for (const label of texts(r).flatMap(uiLabels))
        if (label !== 'Polowanie' && !source.includes(`'${label}'`) && !source.includes(`'${label} `) && !source.includes(`${label}'`)) missing.push(`${r}: ${label}`);
    expect(missing).toEqual([]);
  });

  it('describes what each role can do', () => {
    const all = (r: keyof typeof GUIDES) => texts(r).join(' ');
    expect(all('leader')).toContain('[[Rozpocznij miot]]');
    expect(all('leader')).toContain('[[Przekaż prowadzenie]]');
    expect(all('leader')).toContain('[[Zatwierdź pokot]]');
    expect(all('hunter')).toContain('[[Strzał]]');
    expect(all('beater')).toContain('[[Prowadź mnie]]');
    expect(all('beater')).not.toContain('[[Strzał]]');
  });

  it('escapes text and turns labels into chips', () => {
    expect(fmt('Dotknij [[Zapisz]] <b>')).toBe('Dotknij <span class="hg-ui">Zapisz</span> &lt;b&gt;');
  });

  it('renders the role picker and each guide', () => {
    expect(renderGuide(null)).toContain('data-role="beater"');
    const html = renderGuide('leader');
    expect(html).toContain('id="hg-mioty"');
    expect(html).not.toContain('[[');
  });
});

describe('guide addresses', () => {
  it('round-trips', () => {
    expect(viewToHash({ kind: 'guide', role: 'hunter' })).toBe('#/instrukcja/mysliwy');
    expect(hashToView('#/instrukcja/naganiacz')).toEqual({ kind: 'guide', role: 'beater' });
    expect(hashToView('#/instrukcja/prowadzacy')).toEqual({ kind: 'guide', role: 'leader' });
    expect(hashToView('#/instrukcja')).toEqual({ kind: 'guide', role: null });
    expect(hashToView('#/instrukcja/xyz')).toEqual({ kind: 'guide', role: null });
  });
});
