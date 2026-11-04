/**
 * Hunting seasons in Poland.
 *
 * Source: Rozporządzenie Ministra Środowiska z dnia 16 marca 2005 r. w sprawie określenia
 * okresów polowań na zwierzęta łowne – consolidated text Dz.U. 2023 poz. 99
 * (https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html), § 1.
 *
 * Dates are [month, day]. A range may wrap over New Year. "do końca lutego" is encoded as [2, 29].
 */

export type MD = [number, number];
export interface Range {
  from: MD;
  to: MD;
}

export interface Variant {
  /** Voivodeships (lower-case, as in BDL data) where this variant applies instead of the default. */
  voivodeships?: string[];
  /** Free-text condition (e.g. districts with capercaillie) – shown, not evaluated. */
  condition?: { pl: string; en: string };
  ranges: Range[];
  allYear?: boolean;
}

export interface Season {
  group: { pl: string; en: string };
  name: { pl: string; en: string };
  ranges: Range[];
  allYear?: boolean;
  variants?: Variant[];
  note?: { pl: string; en: string };
}

const r = (fm: number, fd: number, tm: number, td: number): Range => ({ from: [fm, fd], to: [tm, td] });
const END_FEB = 29;

const RED_DEER_WEST = ['dolnośląskie', 'lubuskie', 'opolskie', 'pomorskie', 'wielkopolskie', 'zachodniopomorskie'];
const FALLOW_WEST = ['wielkopolskie', 'kujawsko-pomorskie'];
const GEESE_WEST = ['zachodniopomorskie', 'lubuskie', 'wielkopolskie', 'dolnośląskie'];

const GROUSE = {
  pl: 'w obwodach, w których występuje głuszec lub cietrzew',
  en: 'in districts with capercaillie or black grouse',
};
const GROUSE_OR_RESTOCK = {
  pl: 'w obwodach z głuszcem lub cietrzewiem albo z zasiedleniami zająca, bażanta lub kuropatwy w ostatnich 2 latach',
  en: 'in districts with capercaillie/black grouse or with hare, pheasant or partridge restocking in the last 2 years',
};
const FALCONRY = { pl: 'z ptakami łowczymi', en: 'with birds of prey (falconry)' };

const G = {
  deer: { pl: 'Jeleniowate', en: 'Deer' },
  other: { pl: 'Inna zwierzyna gruba', en: 'Other big game' },
  pred: { pl: 'Drapieżniki', en: 'Predators' },
  small: { pl: 'Zwierzyna drobna', en: 'Small game' },
  birds: { pl: 'Ptactwo', en: 'Game birds' },
};

export const SEASONS: Season[] = [
  {
    group: G.deer,
    name: { pl: 'Jeleń szlachetny – byki w 2. roku życia', en: 'Red deer – stags in 2nd year' },
    ranges: [r(8, 21, 2, END_FEB)],
    variants: [{ voivodeships: RED_DEER_WEST, ranges: [r(6, 1, 2, END_FEB)] }],
  },
  {
    group: G.deer,
    name: { pl: 'Jeleń szlachetny – byki od 3. roku życia', en: 'Red deer – stags 3rd year and older' },
    ranges: [r(8, 21, 2, END_FEB)],
  },
  {
    group: G.deer,
    name: { pl: 'Jeleń szlachetny – łanie w 2. roku życia', en: 'Red deer – hinds in 2nd year' },
    ranges: [r(9, 1, 1, 15)],
    variants: [{ voivodeships: RED_DEER_WEST, ranges: [r(6, 1, 7, 31), r(9, 1, 1, 15)] }],
  },
  {
    group: G.deer,
    name: { pl: 'Jeleń szlachetny – łanie od 3. roku życia', en: 'Red deer – hinds 3rd year and older' },
    ranges: [r(9, 1, 1, 15)],
  },
  {
    group: G.deer,
    name: { pl: 'Jeleń szlachetny – cielęta', en: 'Red deer – calves' },
    ranges: [r(9, 1, 2, END_FEB)],
    variants: [{ voivodeships: RED_DEER_WEST, ranges: [r(9, 1, 3, 31)] }],
  },
  {
    group: G.deer,
    name: { pl: 'Daniel – byki w 2. roku życia', en: 'Fallow deer – bucks in 2nd year' },
    ranges: [r(9, 1, 2, END_FEB)],
    variants: [{ voivodeships: FALLOW_WEST, ranges: [r(6, 1, 2, END_FEB)] }],
  },
  {
    group: G.deer,
    name: { pl: 'Daniel – byki od 3. roku życia', en: 'Fallow deer – bucks 3rd year and older' },
    ranges: [r(9, 1, 2, END_FEB)],
  },
  {
    group: G.deer,
    name: { pl: 'Daniel – łanie w 2. roku życia', en: 'Fallow deer – does in 2nd year' },
    ranges: [r(9, 1, 1, 15)],
    variants: [{ voivodeships: FALLOW_WEST, ranges: [r(6, 1, 7, 31), r(9, 1, 1, 15)] }],
  },
  {
    group: G.deer,
    name: { pl: 'Daniel – łanie od 3. roku życia', en: 'Fallow deer – does 3rd year and older' },
    ranges: [r(9, 1, 1, 15)],
  },
  {
    group: G.deer,
    name: { pl: 'Daniel – cielęta', en: 'Fallow deer – fawns' },
    ranges: [r(9, 1, 2, END_FEB)],
    variants: [{ voivodeships: FALLOW_WEST, ranges: [r(9, 1, 3, 31)] }],
  },
  { group: G.deer, name: { pl: 'Sarna – kozły', en: 'Roe deer – bucks' }, ranges: [r(5, 11, 9, 30)] },
  { group: G.deer, name: { pl: 'Sarna – kozy i koźlęta', en: 'Roe deer – does and kids' }, ranges: [r(10, 1, 1, 15)] },
  {
    group: G.deer,
    name: { pl: 'Łoś', en: 'Elk (moose)' },
    ranges: [],
    note: { pl: 'Całoroczna ochrona – polowanie zabronione', en: 'Protected all year – no hunting' },
  },
  { group: G.other, name: { pl: 'Dzik', en: 'Wild boar' }, ranges: [], allYear: true },
  { group: G.other, name: { pl: 'Muflon – tryki', en: 'Mouflon – rams' }, ranges: [r(10, 1, 2, END_FEB)] },
  { group: G.other, name: { pl: 'Muflon – owce i jagnięta', en: 'Mouflon – ewes and lambs' }, ranges: [r(10, 1, 1, 15)] },
  {
    group: G.pred,
    name: { pl: 'Lis', en: 'Red fox' },
    ranges: [r(6, 1, 3, 31)],
    variants: [{ condition: GROUSE_OR_RESTOCK, ranges: [], allYear: true }],
  },
  {
    group: G.pred,
    name: { pl: 'Borsuk', en: 'Badger' },
    ranges: [r(9, 1, 11, 30)],
    variants: [{ condition: GROUSE, ranges: [], allYear: true }],
  },
  {
    group: G.pred,
    name: { pl: 'Tchórz, kuna leśna i domowa', en: 'Polecat, pine & stone marten' },
    ranges: [r(9, 1, 3, 31)],
    variants: [{ condition: GROUSE, ranges: [], allYear: true }],
  },
  { group: G.pred, name: { pl: 'Norka amerykańska', en: 'American mink' }, ranges: [], allYear: true },
  {
    group: G.pred,
    name: { pl: 'Szakal złocisty', en: 'Golden jackal' },
    ranges: [r(8, 1, 2, END_FEB)],
    variants: [{ condition: GROUSE_OR_RESTOCK, ranges: [], allYear: true }],
  },
  {
    group: G.small,
    name: { pl: 'Zając szarak, dziki królik', en: 'Brown hare, wild rabbit' },
    ranges: [r(11, 1, 12, 31)],
    variants: [
      { condition: { pl: 'odłów', en: 'live capture' }, ranges: [r(11, 1, 1, 15)] },
      { condition: FALCONRY, ranges: [r(9, 1, 1, 31)] },
    ],
  },
  {
    group: G.birds,
    name: { pl: 'Bażant – koguty', en: 'Pheasant – cocks' },
    ranges: [r(10, 1, 2, END_FEB)],
    variants: [{ condition: FALCONRY, ranges: [r(9, 1, 2, END_FEB)] }],
  },
  {
    group: G.birds,
    name: { pl: 'Bażant – kury', en: 'Pheasant – hens' },
    ranges: [r(10, 1, 1, 31)],
    note: {
      pl: 'Tylko w OHZ z wolierową hodowlą bażanta; z ptakami łowczymi we wszystkich obwodach 1.09 – koniec lutego',
      en: 'Only in game-breeding centres with aviary pheasant breeding; with falconry in all districts 1 Sep – end of Feb',
    },
  },
  {
    group: G.birds,
    name: { pl: 'Kuropatwa', en: 'Grey partridge' },
    ranges: [r(9, 11, 10, 21)],
    variants: [
      { condition: { pl: 'odłów', en: 'live capture' }, ranges: [r(9, 11, 1, 15)] },
      { condition: FALCONRY, ranges: [r(9, 11, 11, 30)] },
    ],
  },
  {
    group: G.birds,
    name: { pl: 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica', en: 'Ducks: mallard, teal, pochard, tufted duck' },
    ranges: [r(9, 1, 12, 31)],
  },
  {
    group: G.birds,
    name: { pl: 'Gęś zbożowa i białoczelna', en: 'Bean & white-fronted goose' },
    ranges: [r(9, 1, 12, 21)],
    variants: [{ voivodeships: GEESE_WEST, ranges: [r(9, 1, 1, 31)] }],
  },
  {
    group: G.birds,
    name: { pl: 'Gęgawa', en: 'Greylag goose' },
    ranges: [r(9, 1, 12, 21)],
    variants: [{ voivodeships: GEESE_WEST, ranges: [r(9, 1, 1, 15)] }],
  },
  { group: G.birds, name: { pl: 'Łyska', en: 'Coot' }, ranges: [r(9, 1, 12, 31)] },
  { group: G.birds, name: { pl: 'Gołąb grzywacz', en: 'Wood pigeon' }, ranges: [r(8, 15, 11, 30)] },
  { group: G.birds, name: { pl: 'Słonka', en: 'Woodcock' }, ranges: [r(9, 1, 12, 21)] },
  { group: G.birds, name: { pl: 'Jarząbek', en: 'Hazel grouse' }, ranges: [r(9, 1, 11, 30)] },
];

const mdNum = ([m, d]: MD) => m * 100 + d;

export function inRange(date: Date, range: Range): boolean {
  const x = mdNum([date.getMonth() + 1, date.getDate()]);
  const a = mdNum(range.from);
  const b = mdNum(range.to);
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}

/** Ranges (or all-year flag) applying to a voivodeship, ignoring free-text conditions. */
export function effective(season: Season, voivodeship?: string | null): { ranges: Range[]; allYear: boolean } {
  const v = voivodeship?.toLowerCase();
  const regional = v ? season.variants?.find((x) => x.voivodeships?.includes(v)) : undefined;
  if (regional) return { ranges: regional.ranges, allYear: !!regional.allYear };
  return { ranges: season.ranges, allYear: !!season.allYear };
}

export function isOpen(season: Season, date: Date, voivodeship?: string | null): boolean {
  const e = effective(season, voivodeship);
  return e.allYear || e.ranges.some((rg) => inRange(date, rg));
}

const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMD([m, d]: MD, lang: 'pl' | 'en'): string {
  if (m === 2 && d === END_FEB) return lang === 'pl' ? 'koniec lut' : 'end Feb';
  return `${d} ${(lang === 'pl' ? MONTHS_PL : MONTHS_EN)[m - 1]}`;
}

export function formatRanges(ranges: Range[], allYear: boolean, lang: 'pl' | 'en'): string {
  if (allYear) return lang === 'pl' ? 'cały rok' : 'all year';
  if (!ranges.length) return lang === 'pl' ? 'ochrona' : 'protected';
  return ranges.map((x) => `${formatMD(x.from, lang)} – ${formatMD(x.to, lang)}`).join(', ');
}

/** Fraction of the year (0..1) for a month-day, for drawing the timeline. */
export function yearFrac([m, d]: MD): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const dd = m === 2 && d === END_FEB ? 28 : d;
  return (cum[m - 1] + dd - 1) / 365;
}
