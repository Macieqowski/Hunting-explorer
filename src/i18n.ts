export type Lang = 'pl' | 'en';

const dict = {
  title: { pl: 'Polowanie', en: 'Polowanie' },
  menu: { pl: 'Menu', en: 'Menu' },
  theme: { pl: 'Wygląd', en: 'Appearance' },
  themeAuto: { pl: 'automatyczny', en: 'automatic' },
  themeLight: { pl: 'jasny', en: 'light' },
  themeDark: { pl: 'ciemny', en: 'dark' },
  subtitle: { pl: 'Obwody łowieckie i ich dzierżawcy w całej Polsce', en: 'Hunting districts and their leaseholders across Poland' },
  sectionMap: { pl: 'Mapa', en: 'Map' },
  tabClubs: { pl: 'Koła', en: 'Clubs' },
  tabDistricts: { pl: 'Obwody', en: 'Districts' },
  tabStats: { pl: 'Statystyki', en: 'Statistics' },
  tabSeasons: { pl: 'Okresy polowań', en: 'Seasons' },
  tabAtlas: { pl: 'Atlas zwierzyny', en: 'Game atlas' },
  inAtlas: { pl: 'w atlasie', en: 'in the atlas' },
  tabExams: { pl: 'Egzaminy', en: 'Exams' },
  tabWeather: { pl: 'Pogoda', en: 'Weather' },
  tabHunt: { pl: 'Polowanie zbiorowe', en: 'Group hunts' },
  tabBallistics: { pl: 'Balistyka', en: 'Ballistics' },
  weatherHere: { pl: 'Pogoda w tym miejscu', en: 'Weather at this point' },
  tabAbout: { pl: 'O danych', en: 'About' },
  tabOffline: { pl: 'Offline', en: 'Offline' },
  offlineBadge: { pl: 'Offline', en: 'Offline' },
  saveOffline: { pl: 'Zapisz offline', en: 'Save offline' },
  searchClubs: { pl: 'Szukaj koła, np. „Leśnik” lub „Darz Bór”', en: 'Search clubs, e.g. “Leśnik” or “Darz Bór”' },
  searchDistricts: { pl: 'Nr obwodu, nadleśnictwo, powiat, dzierżawca…', en: 'District no., forest district, county, holder…' },
  allVoivodeships: { pl: 'Wszystkie województwa', en: 'All voivodeships' },
  allBoards: { pl: 'Wszystkie okręgi PZŁ', en: 'All PZŁ regions' },
  allTypes: { pl: 'Każdy zarządca', en: 'Any holder type' },
  loading: { pl: 'Wczytywanie danych z Banku Danych o Lasach…', en: 'Loading data from the Forest Data Bank…' },
  loadError: { pl: 'Nie udało się pobrać danych', en: 'Could not load data' },
  retry: { pl: 'Spróbuj ponownie', en: 'Retry' },
  results: { pl: 'wyników', en: 'results' },
  showMore: { pl: 'Pokaż więcej', en: 'Show more' },
  noResults: { pl: 'Brak wyników', en: 'No results' },
  district: { pl: 'Obwód', en: 'District' },
  districtNo: { pl: 'Obwód nr', en: 'District no.' },
  districts: { pl: 'obwody', en: 'districts' },
  districtsCap: { pl: 'Obwody', en: 'Districts' },
  holder: { pl: 'Dzierżawca / zarządca', en: 'Leaseholder / manager' },
  totalArea: { pl: 'Powierzchnia całkowita', en: 'Total area' },
  forestArea: { pl: 'Powierzchnia leśna', en: 'Forest area' },
  huntArea: { pl: 'Pow. po wyłączeniach', en: 'Area after exclusions' },
  forestShare: { pl: 'Lesistość', en: 'Forest cover' },
  voivodeship: { pl: 'Województwo', en: 'Voivodeship' },
  powiat: { pl: 'Powiat', en: 'County (powiat)' },
  nadlesnictwo: { pl: 'Nadleśnictwo', en: 'Forest district' },
  rdlp: { pl: 'RDLP', en: 'Regional State Forests directorate' },
  pzlBoard: { pl: 'Zarząd Okręgowy PZŁ', en: 'PZŁ regional board' },
  year: { pl: 'Rok danych', en: 'Data year' },
  back: { pl: '← Wstecz', en: '← Back' },
  showOnMap: { pl: 'Pokaż na mapie', en: 'Show on map' },
  searchWeb: { pl: 'Szukaj w internecie', en: 'Search the web' },
  copyLink: { pl: 'Kopiuj link', en: 'Copy link' },
  copied: { pl: 'Skopiowano', en: 'Copied' },
  openToday: { pl: 'Dziś można polować na', en: 'In season today' },
  allSeasons: { pl: 'Wszystkie okresy polowań', en: 'All hunting seasons' },
  inSeason: { pl: 'dziś', en: 'today' },
  inSeasonSome: { pl: 'dziś w części województw', en: 'today in some regions' },
  pickVoivHint: {
    pl: 'Bez wybranego województwa pokazujemy okresy ogólnokrajowe. Gatunki oznaczone „w części województw” są dziś dostępne tylko tam, gdzie obowiązuje wyjątek regionalny.',
    en: 'With no voivodeship picked, national seasons apply. Species marked “some regions” are open today only where a regional exception applies.',
  },
  seasonsFor: { pl: 'dla woj.', en: 'for' },
  clickHint: { pl: 'Kliknij na mapie obwód, aby zobaczyć szczegóły.', en: 'Click a district on the map to see its details.' },
  locate: { pl: 'Gdzie jestem?', en: 'Where am I?' },
  locating: { pl: 'Ustalanie położenia…', en: 'Locating…' },
  locateFail: { pl: 'Nie udało się ustalić położenia', en: 'Could not get your location' },
  outside: { pl: 'Ten punkt nie leży w żadnym obwodzie łowieckim (np. teren wyłączony, miasto).', en: 'This point is not inside any hunting district (e.g. excluded land or a town).' },
  identifying: { pl: 'Sprawdzanie obwodu…', en: 'Looking up district…' },
  clubOf: { pl: 'Koło łowieckie', en: 'Hunting club' },
  holderType: { pl: 'Rodzaj', en: 'Type' },
  type_club: { pl: 'Dzierżawa koła łowieckiego', en: 'Leased by a hunting club' },
  type_pzl: { pl: 'W zarządzie PZŁ (OHZ)', en: 'Managed by PZŁ (breeding centre)' },
  type_pgl: { pl: 'W zarządzie Lasów Państwowych (OHZ)', en: 'Managed by State Forests (breeding centre)' },
  type_other: { pl: 'W zarządzie innego podmiotu', en: 'Managed by another entity' },
  type_unknown: { pl: 'Brak danych', en: 'No data' },
  kDistricts: { pl: 'obwodów łowieckich', en: 'hunting districts' },
  kHolders: { pl: 'dzierżawców i zarządców', en: 'leaseholders & managers' },
  kArea: { pl: 'km² łącznej powierzchni', en: 'km² total area' },
  kClubShare: { pl: 'powierzchni dzierżą koła', en: 'of area leased by clubs' },
  byType: { pl: 'Kto gospodaruje obwodami', en: 'Who manages the districts' },
  byVoiv: { pl: 'Województwa', en: 'Voivodeships' },
  byBoard: { pl: 'Okręgi PZŁ', en: 'PZŁ regions' },
  topClubs: { pl: 'Największe koła (powierzchnia)', en: 'Largest clubs (by area)' },
  colName: { pl: 'Nazwa', en: 'Name' },
  colDistricts: { pl: 'Obwody', en: 'Districts' },
  colHolders: { pl: 'Dzierżawcy', en: 'Holders' },
  colArea: { pl: 'Pow. km²', en: 'Area km²' },
  colAvg: { pl: 'Śr. obwód km²', en: 'Avg km²' },
  seasonsIntro: {
    pl: 'Okresy polowań wg rozporządzenia Ministra Środowiska (tekst jednolity Dz.U. 2023 poz. 99). Zielone wiersze – polowanie dozwolone dziś. Wybierz województwo, by uwzględnić wyjątki regionalne.',
    en: 'Hunting seasons per the Minister of Environment regulation (consolidated text Dz.U. 2023 item 99). Green rows are open today. Pick a voivodeship to apply regional exceptions.',
  },
  seasonsRule: {
    pl: 'Jeśli początek okresu wypada bezpośrednio po dniu wolnym, okres zaczyna się w pierwszym dniu wolnym; jeśli koniec wypada przed dniem wolnym, kończy się w ostatnim dniu wolnym (soboty, niedziele, święta).',
    en: 'If a season starts right after a non-working day (Sat, Sun, holiday), it opens on the first such day; if it ends the day before one, it runs until the last such day.',
  },
  exceptions: { pl: 'Wyjątki', en: 'Exceptions' },
  species: { pl: 'Gatunek', en: 'Species' },
  period: { pl: 'Okres', en: 'Period' },
  today: { pl: 'dziś', en: 'today' },
  layers: { pl: 'Warstwy', en: 'Layers' },
  lDistricts: { pl: 'Obwody łowieckie (BDL)', en: 'Hunting districts (BDL)' },
  lOutlines: { pl: 'Granice i numery obwodów', en: 'District borders & numbers' },
  zoomForBorders: { pl: 'Przybliż mapę, by zobaczyć granice i numery obwodów', en: 'Zoom in to see district borders and numbers' },
  lForest: { pl: 'Nadleśnictwa (BDL)', en: 'Forest districts (BDL)' },
  lBans: { pl: 'Zakazy wstępu do lasu', en: 'Forest entry bans' },
  lFire: { pl: 'Zagrożenie pożarowe', en: 'Fire danger' },
  lWind: { pl: 'Strzałki wiatru', en: 'Wind arrows' },
  bOsm: { pl: 'Mapa (OSM)', en: 'Map (OSM)' },
  bTopo: { pl: 'Topograficzna (OpenTopoMap)', en: 'Topographic (OpenTopoMap)' },
  bGeoTopo: { pl: 'Topograficzna (Geoportal, offline)', en: 'Topographic (Geoportal, offline)' },
  bSat: { pl: 'Ortofotomapa (Geoportal, offline)', en: 'Aerial photo (Geoportal, offline)' },
  legend: { pl: 'Legenda', en: 'Legend' },
  dataAsOf: { pl: 'Dane BDL, rok łowiecki', en: 'BDL data, hunting year' },
} as const;

export type Key = keyof typeof dict;

let lang: Lang = (() => {
  try {
    const s = localStorage.getItem('lang');
    if (s === 'pl' || s === 'en') return s;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.startsWith('pl') ? 'pl' : navigator.language ? 'en' : 'pl';
})();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
}
export const t = (k: Key): string => dict[k][lang];
export const tt = (o: { pl: string; en: string }) => o[lang];

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
/** Hectares → "1 234 ha". */
export const fmtHa = (ha: number | null | undefined) => (ha == null ? '—' : `${fmtNum(ha)} ha`);
export const fmtKm2 = (ha: number) => fmtNum(ha / 100);
