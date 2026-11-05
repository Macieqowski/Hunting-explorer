// Shared types and helpers for the game atlas data files.

import type { TrackPrint } from './atlasTracks';

export interface Tx {
  pl: string;
  en: string;
}

export interface AtlasGroup {
  id: string;
  name: Tx;
}

export interface AtlasPhoto {
  /** Commons file title without the "File:" prefix. */
  file: string;
  caption: Tx;
}

export interface Species {
  slug: string;
  group: AtlasGroup;
  name: Tx;
  latin: string;
  /** Hunting terms (gwara łowiecka) for sexes and young. */
  terms: Tx;
  /** Polish name of the matching SEASONS rows (exact match or "<name> – …" prefix). */
  season: string;
  facts: [Tx, Tx][];
  /** How to tell the species from look-alikes. */
  identify?: Tx[];
  sex: Tx[];
  age?: Tx[];
  track: { print: TrackPrint; text: Tx[] };
  signs: Tx[];
  photos: AtlasPhoto[];
  sources: { label: string; url: string }[];
}

export const GROUPS = {
  deer: { id: 'deer', name: { pl: 'Jeleniowate', en: 'Deer' } },
  other: { id: 'other', name: { pl: 'Inna zwierzyna gruba', en: 'Other big game' } },
  pred: { id: 'pred', name: { pl: 'Drapieżniki', en: 'Predators' } },
  small: { id: 'small', name: { pl: 'Zwierzyna drobna', en: 'Small game' } },
  birds: { id: 'birds', name: { pl: 'Ptactwo', en: 'Game birds' } },
} satisfies Record<string, AtlasGroup>;

export const F = {
  weight: { pl: 'Masa ciała', en: 'Body weight' },
  height: { pl: 'Wysokość w kłębie', en: 'Shoulder height' },
  length: { pl: 'Długość ciała', en: 'Body length' },
  breeding: { pl: 'Rozród', en: 'Breeding' },
  food: { pl: 'Pokarm', en: 'Food' },
  where: { pl: 'Gdzie żyje', en: 'Habitat' },
  rut: { pl: 'Rui', en: 'Rut' },
  birth: { pl: 'Poród', en: 'Birth' },
  life: { pl: 'Tryb życia', en: 'Way of life' },
  headgear: { pl: 'Poroże', en: 'Antlers' },
  horns: { pl: 'Rogi', en: 'Horns' },
  tusks: { pl: 'Oręż', en: 'Tusks' },
};

export const SEJM_SEASONS = { label: 'Dz.U. 2023 poz. 99 – okresy polowań', url: 'https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html' };
export const wiki = (pl: string, en: string) => [
  { label: `Wikipedia: ${pl}`, url: `https://pl.wikipedia.org/wiki/${encodeURIComponent(pl.replace(/ /g, '_'))}` },
  { label: `Wikipedia (EN): ${en}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(en.replace(/ /g, '_'))}` },
];

