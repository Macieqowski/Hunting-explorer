import { describe, expect, it } from 'vitest';
import { nextThemePref, resolveTheme } from './theme';
import { ic, moonIcon } from './icons';

describe('theme choice', () => {
  it('follows the system only when the choice is automatic', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('cycles automatic, light, dark and back', () => {
    expect(nextThemePref('auto')).toBe('light');
    expect(nextThemePref('light')).toBe('dark');
    expect(nextThemePref('dark')).toBe('auto');
  });
});

describe('icons', () => {
  it('are decorative inline SVG of the requested size', () => {
    const svg = ic('check', 16);
    expect(svg).toContain('width="16"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
  });
  it('draws the moon lit on the right while waxing and on the left while waning', () => {
    expect(moonIcon(0, true)).not.toContain('moon-lit');
    expect(moonIcon(1, true)).toContain('<circle class="moon-lit"');
    expect(moonIcon(0.3, true)).not.toContain('scale(-1 1)');
    expect(moonIcon(0.3, false)).toContain('scale(-1 1)');
    // crescent and gibbous differ only in which way the terminator bulges
    expect(moonIcon(0.25, true)).toContain(' 0 0 0 0-18Z');
    expect(moonIcon(0.75, true)).toContain(' 0 0 1 0-18Z');
  });
});
