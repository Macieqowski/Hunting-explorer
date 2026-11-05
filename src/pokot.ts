// Hunt results (pokot): shots logged by hunters during a group hunt, what they
// brought down, and the totals shown at the end. Pure logic, no Firebase.

import { SEASONS, isOpen } from './seasons';

export type Outcome = 'kill' | 'wound' | 'miss' | 'unknown';
export const OUTCOMES: Outcome[] = ['kill', 'wound', 'miss', 'unknown'];

export type GameGroup = 'deer' | 'other' | 'pred' | 'small' | 'birds';
export const GAME_GROUPS: GameGroup[] = ['deer', 'other', 'pred', 'small', 'birds'];

export interface Game {
  key: string;
  group: GameGroup;
  pl: string;
  en: string;
  /** Names (pl) of the SEASONS entries that cover it; empty = no season check. */
  seasons: string[];
}

const g = (key: string, group: GameGroup, pl: string, en: string, ...seasons: string[]): Game => ({ key, group, pl, en, seasons });

/** What can be put on the pokot. Keys are stored in the database and listed in database.rules.json. */
export const GAMES: Game[] = [
  g('red_stag', 'deer', 'Jeleń – byk', 'Red deer – stag', 'Jeleń szlachetny – byki w 2. roku życia', 'Jeleń szlachetny – byki od 3. roku życia'),
  g('red_hind', 'deer', 'Jeleń – łania', 'Red deer – hind', 'Jeleń szlachetny – łanie w 2. roku życia', 'Jeleń szlachetny – łanie od 3. roku życia'),
  g('red_calf', 'deer', 'Jeleń – cielę', 'Red deer – calf', 'Jeleń szlachetny – cielęta'),
  g('fallow_buck', 'deer', 'Daniel – byk', 'Fallow deer – buck', 'Daniel – byki w 2. roku życia', 'Daniel – byki od 3. roku życia'),
  g('fallow_doe', 'deer', 'Daniel – łania', 'Fallow deer – doe', 'Daniel – łanie w 2. roku życia', 'Daniel – łanie od 3. roku życia'),
  g('fallow_fawn', 'deer', 'Daniel – cielę', 'Fallow deer – fawn', 'Daniel – cielęta'),
  g('roe_buck', 'deer', 'Sarna – kozioł', 'Roe deer – buck', 'Sarna – kozły'),
  g('roe_doe', 'deer', 'Sarna – koza', 'Roe deer – doe', 'Sarna – kozy i koźlęta'),
  g('roe_kid', 'deer', 'Sarna – koźlę', 'Roe deer – kid', 'Sarna – kozy i koźlęta'),
  g('boar_male', 'other', 'Dzik – odyniec', 'Wild boar – male', 'Dzik'),
  g('boar_sow', 'other', 'Dzik – locha', 'Wild boar – sow', 'Dzik'),
  g('boar_yearling', 'other', 'Dzik – przelatek', 'Wild boar – yearling', 'Dzik'),
  g('boar_piglet', 'other', 'Dzik – warchlak', 'Wild boar – piglet', 'Dzik'),
  g('mouflon_ram', 'other', 'Muflon – tryk', 'Mouflon – ram', 'Muflon – tryki'),
  g('mouflon_ewe', 'other', 'Muflon – owca lub jagnię', 'Mouflon – ewe or lamb', 'Muflon – owce i jagnięta'),
  g('fox', 'pred', 'Lis', 'Red fox', 'Lis'),
  g('raccoon_dog', 'pred', 'Jenot', 'Raccoon dog'),
  g('raccoon', 'pred', 'Szop pracz', 'Raccoon'),
  g('badger', 'pred', 'Borsuk', 'Badger', 'Borsuk'),
  g('marten', 'pred', 'Kuna', 'Marten', 'Tchórz, kuna leśna i domowa'),
  g('polecat', 'pred', 'Tchórz', 'Polecat', 'Tchórz, kuna leśna i domowa'),
  g('mink', 'pred', 'Norka amerykańska', 'American mink', 'Norka amerykańska'),
  g('jackal', 'pred', 'Szakal złocisty', 'Golden jackal', 'Szakal złocisty'),
  g('hare', 'small', 'Zając', 'Brown hare', 'Zając szarak, dziki królik'),
  g('rabbit', 'small', 'Dziki królik', 'Wild rabbit', 'Zając szarak, dziki królik'),
  g('pheasant_cock', 'birds', 'Bażant – kogut', 'Pheasant – cock', 'Bażant – koguty'),
  g('pheasant_hen', 'birds', 'Bażant – kura', 'Pheasant – hen', 'Bażant – kury'),
  g('partridge', 'birds', 'Kuropatwa', 'Grey partridge', 'Kuropatwa'),
  g('duck', 'birds', 'Kaczka', 'Duck', 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica'),
  g('goose', 'birds', 'Gęś', 'Goose', 'Gęś zbożowa i białoczelna', 'Gęgawa'),
  g('coot', 'birds', 'Łyska', 'Coot', 'Łyska'),
  g('pigeon', 'birds', 'Gołąb grzywacz', 'Wood pigeon', 'Gołąb grzywacz'),
  g('woodcock', 'birds', 'Słonka', 'Woodcock', 'Słonka'),
];

const BY_KEY = new Map(GAMES.map((x) => [x.key, x]));
export const gameByKey = (k: string | null | undefined) => (k ? BY_KEY.get(k) ?? null : null);

/** "Dzik – locha" → "Dzik": the species line used in the per-species totals. */
export const speciesOf = (x: Game, lang: 'pl' | 'en') => (lang === 'pl' ? x.pl : x.en).split(' – ')[0];

/** Weight used to break ties for the hunt king: big game counts more than birds. */
const WEIGHT: Record<GameGroup, number> = { deer: 10, other: 10, pred: 3, small: 2, birds: 1 };

/** Shooter value for game the leader adds without knowing who shot it (found by the beaters, say). */
export const NO_SHOOTER = '-';
export const NOTE_MAX = 120;

export interface ShotInput {
  outcome: Outcome;
  game: string | null;
  note: string;
}

export interface Shot extends ShotInput {
  id: string;
  uid: string; // shooter, or NO_SHOOTER
  driveId: string | null;
  ts: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export function parseShots(v: unknown): Shot[] {
  if (!v || typeof v !== 'object') return [];
  const out: Shot[] = [];
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.uid !== 'string' || !OUTCOMES.includes(o.outcome as Outcome) || !isNum(o.ts)) continue;
    out.push({
      id,
      uid: o.uid,
      outcome: o.outcome as Outcome,
      game: typeof o.game === 'string' && BY_KEY.has(o.game) ? o.game : null,
      note: typeof o.note === 'string' ? o.note : '',
      driveId: typeof o.driveId === 'string' ? o.driveId : null,
      ts: o.ts,
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export interface ShotSpot {
  lat: number;
  lng: number;
}

export function parseShotSpots(v: unknown): Map<string, ShotSpot> {
  const out = new Map<string, ShotSpot>();
  if (!v || typeof v !== 'object') return out;
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const o = raw as Record<string, unknown> | null;
    if (o && isNum(o.lat) && isNum(o.lng)) out.set(id, { lat: o.lat, lng: o.lng });
  }
  return out;
}

export interface HunterTotals {
  uid: string;
  shots: number;
  kill: number;
  wound: number;
  miss: number;
  unknown: number;
  /** Sum of WEIGHT over the game killed. */
  score: number;
}

const emptyTotals = (uid: string): HunterTotals => ({ uid, shots: 0, kill: 0, wound: 0, miss: 0, unknown: 0, score: 0 });

/**
 * Shots, kills, wounds and misses per hunter, most kills first (then bigger game, then
 * more shots). `hunters` are listed even with no shots, so the table shows everyone.
 */
export function hunterTotals(shots: Shot[], hunters: string[] = []): HunterTotals[] {
  const by = new Map<string, HunterTotals>(hunters.map((u) => [u, emptyTotals(u)]));
  for (const s of shots) {
    if (s.uid === NO_SHOOTER) continue;
    let t = by.get(s.uid);
    if (!t) by.set(s.uid, (t = emptyTotals(s.uid)));
    t.shots++;
    t[s.outcome]++;
    const x = s.outcome === 'kill' ? gameByKey(s.game) : null;
    if (x) t.score += WEIGHT[x.group];
  }
  return [...by.values()].sort((a, b) => b.kill - a.kill || b.score - a.score || b.shots - a.shots || a.uid.localeCompare(b.uid));
}

/** Król polowania: most kills, ties broken by bigger game; null when nobody killed, or on a full tie. */
export function huntKing(t: HunterTotals[]): string | null {
  const [a, b] = t;
  if (!a || a.kill === 0) return null;
  if (b && b.kill === a.kill && b.score === a.score) return null;
  return a.uid;
}

/** Pudłarz: most misses (at least one); null on a tie. */
export function huntMisser(t: HunterTotals[]): string | null {
  const s = [...t].sort((a, b) => b.miss - a.miss);
  if (!s[0] || s[0].miss === 0 || (s[1] && s[1].miss === s[0].miss)) return null;
  return s[0].uid;
}

export interface DriveGroup<D> {
  drive: D | null; // null = outside any drive
  shots: Shot[];
}

/** Shots grouped by drive, in the drives' order; shots with no (or a deleted) drive come last. */
export function shotsByDrive<D extends { id: string }>(shots: Shot[], drives: D[]): DriveGroup<D>[] {
  const ids = new Set(drives.map((d) => d.id));
  const groups: DriveGroup<D>[] = drives.map((d) => ({ drive: d, shots: shots.filter((s) => s.driveId === d.id) }));
  const loose = shots.filter((s) => !s.driveId || !ids.has(s.driveId));
  if (loose.length) groups.push({ drive: null, shots: loose });
  return groups.filter((x) => x.shots.length);
}

/** Bag per species, e.g. [["Dzik", 3], ["Lis", 2]], biggest groups first. */
export function bagBySpecies(shots: Shot[], lang: 'pl' | 'en'): [string, number][] {
  const m = new Map<string, { n: number; order: number }>();
  for (const s of shots) {
    const x = s.outcome === 'kill' ? gameByKey(s.game) : null;
    const name = x ? speciesOf(x, lang) : s.outcome === 'kill' ? (lang === 'pl' ? 'Nieokreślona' : 'Unspecified') : null;
    if (!name) continue;
    const cur = m.get(name) ?? { n: 0, order: x ? GAMES.indexOf(x) : GAMES.length };
    cur.n++;
    m.set(name, cur);
  }
  return [...m.entries()].sort((a, b) => a[1].order - b[1].order).map(([k, v]) => [k, v.n]);
}

/** "Obwód nr 12 · KŁ Darz Bór (mazowieckie)" → "mazowieckie". */
export const voivodeshipOf = (label: string | null | undefined) => /\(([^()]+)\)\s*$/.exec(label ?? '')?.[1]?.toLowerCase() ?? null;

/** Whether this game is outside its hunting season on the given date (YYYY-MM-DD); false when unknown. */
export function outOfSeason(key: string, date: string, voivodeship?: string | null): boolean {
  const x = gameByKey(key);
  if (!x || !x.seasons.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, mo, d] = date.split('-').map(Number);
  const day = new Date(y, mo - 1, d);
  const ss = SEASONS.filter((s) => x.seasons.includes(s.name.pl));
  return ss.length > 0 && !ss.some((s) => isOpen(s, day, voivodeship));
}

/** File name for the printed pokot, e.g. "2026-12-12-pokot-dziki.pdf" (the browser suggests it from the title). */
export function pokotTitle(h: { date: string; name: string }): string {
  return `${h.date} pokot ${h.name}`.trim();
}
