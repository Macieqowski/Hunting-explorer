// Naming a saved area made of districts the user ticked in the Offline tab.

import { tt } from './i18n';
import type { District } from './bdl';

export const cap = (s: string | null) => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : '');

const L = {
  one: { pl: 'Obwód nr', en: 'District no.' },
  many: { pl: 'Obwody nr', en: 'Districts no.' },
  more: { pl: 'i jeszcze', en: 'and' },
  moreEnd: { pl: '', en: ' more' },
};

/** The saved area's name for chosen districts, e.g. "Obwody nr 12, 15 · Mazowieckie". */
export function pickName(ds: Pick<District, 'hunt_dist_nr' | 'county_name'>[]): string {
  if (ds.length === 1) return `${tt(L.one)} ${ds[0].hunt_dist_nr}${ds[0].county_name ? ` · ${cap(ds[0].county_name)}` : ''}`;
  const voivs = [...new Set(ds.map((d) => d.county_name).filter(Boolean))] as string[];
  const shown = ds.slice(0, 6).map((d) => d.hunt_dist_nr ?? '?');
  const rest = ds.length - shown.length;
  return `${tt(L.many)} ${shown.join(', ')}${rest > 0 ? ` ${tt(L.more)} ${rest}${tt(L.moreEnd)}` : ''}${voivs.length === 1 ? ` · ${cap(voivs[0])}` : ''}`;
}

