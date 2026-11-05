// Finds which atlas species a piece of Polish text (an exam question) is about.
//
// Each species has word patterns matched at the start of a word: stems that catch the
// inflected forms (sarna, sarny, sarnie…) and hunting terms (rogacz, odyniec, klępa…).
// Short or ambiguous words are listed as whole forms, so that e.g. "lis" does not match
// "listopad" and the adjective "dziki" ("dziki królik") does not count as a wild boar.

const W = '(?<![\\p{L}])'; // word start
const E = '(?![\\p{L}])'; // word end
const stems = (...xs: string[]) => xs.map((x) => `${W}${x}\\p{L}*`);
const words = (...xs: string[]) => xs.map((x) => `${W}${x}${E}`);

const PATTERNS: Record<string, string[]> = {
  sarna: [...stems('sarn', 'rogacz', 'kozioł', 'kozł', 'koźl', 'koźląt'), ...words('koza', 'kozy', 'kozę', 'kozą', 'kóz')],
  jelen: [...stems('jele[nń](?!iowat)', 'rykowisk', 'grandl'), ...words('jeleń')],
  daniel: stems('daniel', 'danieli', 'bekowisk'),
  los: [...stems('łoszak', 'łosi', 'łosz', 'klęp', 'bukowisk'), ...words('łoś', 'łosie', 'łosiem', 'łosiów', 'łosiom', 'łosiami', 'łosiach')],
  dzik: [
    ...words('dzik', 'dzików', 'dzikami', 'dzikach', 'dzikiem', 'dzikowi', 'dzikom'),
    `${W}dziki${E}(?!\\s+(?:królik|ptak|zwierz|gatun|kaczk|gęś|gołąb|kot|pies))`,
    `${W}dzika${E}(?!\\s+(?:zwierz|kaczk|gęś|przyrod|faun|flor|roślin|świni|kur))`,
    ...stems('odyń', 'odyniec', 'warchla', 'przelat(?:ek|ka|ki|kó|kom|kami|kach)', 'watah', 'buchtow', 'huczk', 'pasiak'),
    ...words('locha', 'lochy', 'lochę', 'lochą', 'loch', 'lochom', 'lochami', 'lochach'),
  ],
  muflon: [...stems('muflon', 'tryk', 'ślimy', 'ślimów')],
  lis: [
    ...words('lis', 'lisa', 'lisy', 'lisów', 'lisom', 'lisami', 'lisach', 'lisowi', 'lisem', 'lisie', 'lisi', 'lisia', 'lisiej', 'lisiego'),
    ...stems('lisic', 'lisię', 'lisiąt', 'lisięt', 'lisiak'),
  ],
  borsuk: stems('borsu'),
  tchorz: stems('tchórz', 'tchorz'),
  'kuna-lesna': stems('kun\\p{L}*\\s+leśn', 'tumak'),
  'kuna-domowa': stems('kun\\p{L}*\\s+domow', 'kamionk'),
  norka: stems('nork'),
  szakal: stems('szakal'),
  zajac: [...stems('zając', 'zajęc', 'szarak', 'zajęcz'), ...words('zajęcy')],
  krolik: stems('królik'),
  bazant: stems('bażant'),
  kuropatwa: stems('kuropat'),
  jarzabek: stems('jarząbe', 'jarząbk'),
  krzyzowka: stems('krzyżówk'),
  cyraneczka: stems('cyranecz'),
  glowienka: stems('głowien', 'głowienk'),
  czernica: stems('czernic'),
  gegawa: stems('gęgaw'),
  'ges-zbozowa': stems('gęs\\p{L}*\\s+zbożow', 'gęś\\s+zbożow'),
  'ges-bialoczelna': stems('białoczeln'),
  lyska: stems('łysk'),
  grzywacz: stems('grzywacz'),
  slonka: stems('słonk'),
};

/** Generic "kuna" (no "leśna"/"domowa") is about both martens. */
const MARTEN = new RegExp(`${W}kun(?:a|y|ę|ą|om|ami|ach|ie|ach)${E}`, 'iu');

const COMPILED = Object.entries(PATTERNS).map(([slug, ps]) => [slug, new RegExp(ps.join('|'), 'iu')] as const);

/** Slugs of the atlas species mentioned in the text, in atlas order. */
export function speciesIn(text: string): string[] {
  const hits = COMPILED.filter(([, re]) => re.test(text)).map(([slug]) => slug);
  if (MARTEN.test(text) && !hits.includes('kuna-lesna') && !hits.includes('kuna-domowa')) hits.push('kuna-lesna', 'kuna-domowa');
  return hits;
}

export const MATCHED_SLUGS = Object.keys(PATTERNS);
