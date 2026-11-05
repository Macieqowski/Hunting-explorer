// Group hunt section (polowanie zbiorowe): my hunts, new hunt, sign-up, hunt page
// with the participant list and the leader's controls. Rendered as a string like
// the other sections; main.ts forwards clicks, input and form submits here.

import { getLang, tt } from './i18n';
import {
  validateHunt,
  validPersonName,
  sortHunts,
  countRoles,
  nextStatuses,
  registrationOpen,
  LIMITS,
  type Hunt,
  type HuntInput,
  type HuntStatus,
  type Participant,
  type Role,
  type HuntDistrict,
  type Position,
  shouldPurge,
  toGpx,
  gpxFileName,
  type TrackPoint,
  type Area,
  type Drive,
  DRIVE_LIMITS,
  activeDrive,
  driveState,
  sortDrives,
  validateDrive,
  nextDriveDefaults,
  type Sighting,
  type Herd,
  headingToward,
  sightLook,
  compassPoint,
  distanceM,
} from './hunt';
import type { District } from './bdl';
import { fetchDistrictsAtPoint } from './bdl';
import { fold, districtSlug } from './data';
import { createHuntMap, type HuntMap, type PersonInfo, type DriveView, type SightView } from './huntMap';
import { Sharer } from './huntShare';
import { openPocket, updatePocket } from './huntPocket';
import { roleIcon, speciesIcon } from './huntIcons';
import { openReport, closeReport } from './huntSighting';
import { firebaseConfig, getBackend, HuntError, type HuntBackend, type Unsubscribe } from './huntBackend';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  intro: {
    pl: 'Zorganizuj polowanie zbiorowe albo zapisz się na nie jako myśliwy lub naganiacz. Prowadzący tworzy polowanie i wysyła link uczestnikom.',
    en: 'Organise a group hunt or sign up for one as a hunter or beater. The hunt leader creates the hunt and sends the link to participants.',
  },
  notConfigured: {
    pl: 'Polowania zbiorowe nie są jeszcze skonfigurowane na tej stronie (brak ustawień Firebase).',
    en: 'Group hunts are not set up on this site yet (Firebase settings are missing).',
  },
  connecting: { pl: 'Łączenie…', en: 'Connecting…' },
  connectError: { pl: 'Nie udało się połączyć z serwerem polowań.', en: 'Could not connect to the hunt server.' },
  retry: { pl: 'Spróbuj ponownie', en: 'Retry' },
  myHunts: { pl: 'Twoje polowania', en: 'Your hunts' },
  noHunts: {
    pl: 'Nie masz jeszcze polowań. Utwórz nowe albo otwórz link od prowadzącego.',
    en: 'No hunts yet. Create one or open the link from the hunt leader.',
  },
  thisDevice: {
    pl: 'Lista jest zapamiętana na tym urządzeniu i w tej przeglądarce.',
    en: 'This list is remembered on this device and browser.',
  },
  newHunt: { pl: '+ Nowe polowanie', en: '+ New hunt' },
  loading: { pl: 'Wczytywanie…', en: 'Loading…' },
  fName: { pl: 'Nazwa polowania', en: 'Hunt name' },
  fNamePh: { pl: 'np. Polowanie zbiorowe na dziki', en: 'e.g. Driven boar hunt' },
  fDate: { pl: 'Data', en: 'Date' },
  fStart: { pl: 'Początek', en: 'Start' },
  fEnd: { pl: 'Koniec', en: 'End' },
  fPlace: { pl: 'Miejsce zbiórki', en: 'Meeting point' },
  fPlacePh: { pl: 'np. parking przy leśniczówce Borek', en: 'e.g. car park by the Borek forester’s lodge' },
  fNotes: { pl: 'Informacje dla uczestników', en: 'Notes for participants' },
  fNotesPh: {
    pl: 'np. kamizelki odblaskowe obowiązkowe, odprawa o 7:45',
    en: 'e.g. high-vis vests required, briefing at 7:45',
  },
  fYourName: { pl: 'Twoje imię i nazwisko', en: 'Your name' },
  fYourNameHint: { pl: 'Tak zobaczą Cię inni uczestnicy.', en: 'This is how other participants will see you.' },
  fPass: { pl: 'Hasło koła', en: 'Club passphrase' },
  fPassHint: { pl: 'Hasło znają członkowie koła; zapytaj prowadzącego.', en: 'Club members know it; ask the hunt leader.' },
  fRole: { pl: 'Zapisuję się jako', en: 'I am signing up as' },
  create: { pl: 'Utwórz polowanie', en: 'Create hunt' },
  save: { pl: 'Zapisz zmiany', en: 'Save changes' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  join: { pl: 'Zapisz się', en: 'Sign up' },
  errFields: { pl: 'Uzupełnij zaznaczone pola.', en: 'Fill in the highlighted fields.' },
  errPersonName: { pl: 'Podaj imię i nazwisko (co najmniej 2 znaki).', en: 'Enter your name (at least 2 characters).' },
  errPass: { pl: 'Podaj hasło koła.', en: 'Enter the club passphrase.' },
  errDeniedCreate: { pl: 'Nieprawidłowe hasło koła.', en: 'Wrong club passphrase.' },
  errDeniedJoin: {
    pl: 'Nie udało się zapisać: nieprawidłowe hasło albo zapisy zostały właśnie zamknięte.',
    en: 'Could not sign up: wrong passphrase, or registration has just closed.',
  },
  errDenied: { pl: 'Nie masz uprawnień do tej zmiany.', en: 'You are not allowed to make this change.' },
  errOffline: { pl: 'Brak połączenia. Spróbuj ponownie.', en: 'No connection. Try again.' },
  errUnknown: { pl: 'Coś poszło nie tak:', en: 'Something went wrong:' },
  notFound: {
    pl: 'Nie znaleziono polowania. Link może być błędny albo prowadzący usunął polowanie.',
    en: 'Hunt not found. The link may be wrong, or the leader deleted the hunt.',
  },
  allHunts: { pl: '← Wszystkie polowania', en: '← All hunts' },
  leader: { pl: 'Prowadzący', en: 'Hunt leader' },
  when: { pl: 'Kiedy', en: 'When' },
  where: { pl: 'Zbiórka', en: 'Meeting point' },
  st_open: { pl: 'Zapisy otwarte', en: 'Sign-up open' },
  st_closed: { pl: 'Zapisy zamknięte', en: 'Sign-up closed' },
  st_live: { pl: 'Trwa', en: 'In progress' },
  st_ended: { pl: 'Zakończone', en: 'Finished' },
  to_open: { pl: 'Otwórz zapisy', en: 'Reopen sign-up' },
  to_closed: { pl: 'Zamknij zapisy', en: 'Close sign-up' },
  to_live: { pl: 'Rozpocznij polowanie', en: 'Start the hunt' },
  to_ended: { pl: 'Zakończ polowanie', en: 'End the hunt' },
  r_leader: { pl: 'Prowadzący', en: 'Leader' },
  r_hunter: { pl: 'Myśliwy', en: 'Hunter' },
  r_beater: { pl: 'Naganiacz', en: 'Beater' },
  g_hunter: { pl: 'Myśliwi', en: 'Hunters' },
  g_beater: { pl: 'Naganiacze', en: 'Beaters' },
  pending: { pl: 'czeka na potwierdzenie', en: 'awaiting confirmation' },
  you: { pl: 'Ty', en: 'You' },
  youAre: { pl: 'Twoja rola:', en: 'Your role:' },
  youPending: {
    pl: 'Prowadzący jeszcze nie potwierdził Twojego udziału.',
    en: 'The hunt leader has not confirmed you yet.',
  },
  joinTitle: { pl: 'Zapisz się na polowanie', en: 'Sign up for this hunt' },
  closedNote: {
    pl: 'Zapisy są zamknięte. Jeśli chcesz dołączyć, skontaktuj się z prowadzącym.',
    en: 'Sign-up is closed. Contact the hunt leader if you want to join.',
  },
  participants: { pl: 'Uczestnicy', en: 'Participants' },
  nobody: { pl: 'Nikt się jeszcze nie zapisał.', en: 'Nobody has signed up yet.' },
  confirm: { pl: 'Potwierdź', en: 'Confirm' },
  makeHunter: { pl: '→ myśliwy', en: '→ hunter' },
  makeBeater: { pl: '→ naganiacz', en: '→ beater' },
  remove: { pl: 'Usuń', en: 'Remove' },
  sure: { pl: 'Na pewno?', en: 'Sure?' },
  invite: { pl: 'Zaproś uczestników', en: 'Invite participants' },
  inviteHint: {
    pl: 'Wyślij ten link na grupę koła. Do zapisu potrzebne jest też hasło koła.',
    en: 'Send this link to the club group. The club passphrase is also needed to sign up.',
  },
  share: { pl: 'Udostępnij link', en: 'Share link' },
  copy: { pl: 'Kopiuj link', en: 'Copy link' },
  copied: { pl: 'Skopiowano', en: 'Copied' },
  manage: { pl: 'Zarządzanie', en: 'Manage' },
  editHunt: { pl: 'Edytuj szczegóły', en: 'Edit details' },
  deleteHunt: { pl: 'Usuń polowanie', en: 'Delete hunt' },
  deleteSure: { pl: 'Tak, usuń polowanie i listę uczestników', en: 'Yes, delete the hunt and its participant list' },
  withdraw: { pl: 'Wypisz się', en: 'Withdraw' },
  withdrawSure: { pl: 'Tak, wypisz mnie', en: 'Yes, withdraw me' },
  fDistrict: { pl: 'Obwód łowiecki', en: 'Hunting district' },
  fDistrictHint: {
    pl: 'Opcjonalnie. Mapa polowania pokaże granice obwodu.',
    en: 'Optional. The hunt map will show the district boundary.',
  },
  districtPh: { pl: 'Numer obwodu, koło, nadleśnictwo…', en: 'District number, club, forest district…' },
  districtLoading: { pl: 'Wczytywanie listy obwodów…', en: 'Loading the district list…' },
  districtUnavailable: { pl: 'Lista obwodów jest niedostępna.', en: 'The district list is unavailable.' },
  districtNone: { pl: 'Nie znaleziono obwodu.', en: 'No district found.' },
  districtHere: { pl: '◎ Obwód, w którym jestem', en: '◎ District I am in' },
  districtHereNone: { pl: 'W tym miejscu nie ma obwodu łowieckiego.', en: 'There is no hunting district here.' },
  districtHereError: { pl: 'Nie udało się ustalić obwodu z lokalizacji.', en: 'Could not find the district from your location.' },
  districtClear: { pl: 'Usuń obwód', en: 'Remove district' },
  district: { pl: 'Obwód', en: 'District' },
  districtNo: { pl: 'Obwód nr', en: 'District no.' },
  mapTitle: { pl: 'Mapa polowania', en: 'Hunt map' },
  unconfirmedMap: {
    pl: 'Mapę z uczestnikami zobaczysz, gdy prowadzący potwierdzi Twój udział.',
    en: 'You will see the map of participants once the hunt leader confirms you.',
  },
  shareTitle: { pl: 'Udostępnianie lokalizacji', en: 'Sharing your location' },
  shareConsent: {
    pl: 'Twoje położenie zobaczą tylko potwierdzeni uczestnicy tego polowania, wyłącznie gdy polowanie trwa. Zapisywany jest też ślad Twojej trasy; położenie i ślady są przechowywane 7 dni po zakończeniu polowania, potem są usuwane. Możesz przestać w każdej chwili.',
    en: 'Only confirmed participants of this hunt will see your position, and only while the hunt is in progress. Your track is recorded too; positions and tracks are kept for 7 days after the hunt ends, then deleted. You can stop at any time.',
  },
  shareKeepOpen: {
    pl: 'Zostaw tę stronę otwartą: po zablokowaniu ekranu telefon przestaje wysyłać położenie.',
    en: 'Keep this page open: phones stop sending your position when the screen locks.',
  },
  shareSafety: {
    pl: 'Położenie na mapie może mieć kilka minut i kilkadziesiąt metrów błędu. Nie zastępuje zasad bezpieczeństwa ani odprawy.',
    en: 'Positions on the map can be minutes old and tens of metres off. They do not replace safety rules or the briefing.',
  },
  shareStart: { pl: 'Udostępniaj moją lokalizację', en: 'Share my location' },
  shareStop: { pl: 'Zatrzymaj', en: 'Stop' },
  shareOn: { pl: 'Udostępniasz lokalizację', en: 'You are sharing your location' },
  shareStarting: { pl: 'Ustalanie położenia…', en: 'Getting your position…' },
  shareDenied: {
    pl: 'Przeglądarka nie ma dostępu do lokalizacji. Zezwól na nią w ustawieniach strony i spróbuj ponownie.',
    en: 'The browser has no access to your location. Allow it in the site settings and try again.',
  },
  shareUnavailable: { pl: 'To urządzenie nie udostępnia lokalizacji.', en: 'This device does not provide a location.' },
  shareStopped: { pl: 'Udostępnianie zatrzymane:', en: 'Sharing stopped:' },
  shareNotLive: {
    pl: 'Udostępnianie lokalizacji będzie możliwe, gdy prowadzący rozpocznie polowanie.',
    en: 'Location sharing becomes available when the leader starts the hunt.',
  },
  shareEnded: { pl: 'Polowanie zakończone. Położenie i ślady są dostępne jeszcze przez 7 dni od zakończenia.', en: 'The hunt has ended. Positions and tracks stay available for 7 days after the end.' },
  lastSent: { pl: 'ostatnio wysłano', en: 'last sent' },
  visible: { pl: 'na mapie', en: 'on the map' },
  showTracks: { pl: 'Pokaż ślady', en: 'Show tracks' },
  hideTracks: { pl: 'Ukryj ślady', en: 'Hide tracks' },
  fitAll: { pl: 'Pokaż wszystkich', en: 'Show everyone' },
  centerMe: { pl: 'Moje położenie', en: 'My position' },
  justNow: { pl: 'przed chwilą', en: 'just now' },
  minAgo: { pl: 'min temu', en: 'min ago' },
  hAgo: { pl: 'godz. temu', en: 'h ago' },
  accuracy: { pl: 'Dokładność', en: 'Accuracy' },
  distanceFromYou: { pl: 'Odległość od Ciebie', en: 'Distance from you' },
  pocket: { pl: 'Tryb kieszeni', en: 'Pocket mode' },
  pocketHint: {
    pl: 'Czarny ekran, który nie reaguje na przypadkowe dotknięcia. Ekran pozostaje włączony, żeby telefon dalej wysyłał położenie.',
    en: 'A black screen that ignores accidental touches. The screen stays on so the phone keeps sending your position.',
  },
  pocketUnlock: { pl: 'Przesuń, aby wrócić', en: 'Slide to go back' },
  pocketStopped: { pl: 'Udostępnianie zatrzymane', en: 'Sharing has stopped' },
  pocketStoppedDetail: { pl: 'Odblokuj ekran, żeby sprawdzić.', en: 'Unlock the screen to check.' },
  exportGpx: { pl: '⤓ Pobierz ślady (GPX)', en: '⤓ Download tracks (GPX)' },
  exportEmpty: { pl: 'Brak śladów do pobrania.', en: 'No tracks to download.' },
  lOsm: { pl: 'Mapa (OSM)', en: 'Map (OSM)' },
  lTopo: { pl: 'Topograficzna', en: 'Topographic' },
  lSat: { pl: 'Satelitarna', en: 'Satellite' },
  lDistricts: { pl: 'Obwody łowieckie', en: 'Hunting districts' },
  lCompartments: { pl: 'Oddziały leśne', en: 'Forest compartments' },
  drives: { pl: 'Mioty', en: 'Drives' },
  noDrives: { pl: 'Prowadzący nie dodał jeszcze miotów.', en: 'The leader has not added any drives yet.' },
  noDrivesLeader: {
    pl: 'Dodaj mioty: obszar na mapie i planowane godziny. Uczestnicy zobaczą je na mapie.',
    en: 'Add the drives: an area on the map and the planned times. Participants will see them on the map.',
  },
  addDrive: { pl: '+ Miot', en: '+ Drive' },
  editDrive: { pl: 'Edytuj', en: 'Edit' },
  newDriveTitle: { pl: 'Nowy miot', en: 'New drive' },
  editDriveTitle: { pl: 'Edycja miotu', en: 'Edit drive' },
  dName: { pl: 'Nazwa', en: 'Name' },
  dStart: { pl: 'Początek', en: 'Start' },
  dEnd: { pl: 'Koniec', en: 'End' },
  dCorners: { pl: 'Dotknij mapy, aby dodać narożniki miotu. Narożniki można przeciągać.', en: 'Tap the map to add the corners of the drive. Corners can be dragged.' },
  dCornerCount: { pl: 'Narożniki:', en: 'Corners:' },
  dUndo: { pl: '↶ Cofnij narożnik', en: '↶ Undo corner' },
  dSave: { pl: 'Zapisz miot', en: 'Save drive' },
  errArea: { pl: 'Zaznacz na mapie co najmniej 3 narożniki miotu.', en: 'Mark at least 3 corners of the drive on the map.' },
  dStartNow: { pl: 'Rozpocznij miot', en: 'Start drive' },
  dEndNow: { pl: 'Zakończ miot', en: 'End drive' },
  dDeleteSure: { pl: 'Tak, usuń miot', en: 'Yes, delete the drive' },
  dPlanned: { pl: 'planowo', en: 'planned' },
  dRunning: { pl: 'trwa od', en: 'running since' },
  dDone: { pl: 'odbył się', en: 'took place' },
  dNow: { pl: 'Trwa', en: 'Now' },
  dUntil: { pl: 'planowo do', en: 'planned until' },
  dNext: { pl: 'Następny', en: 'Next' },
  dStarted: { pl: 'rozpoczęty', en: 'started' },
  dEnded: { pl: 'zakończony', en: 'ended' },
  dMax: { pl: 'Osiągnięto limit miotów.', en: 'The drive limit has been reached.' },
  sightReport: { pl: 'Zwierzyna', en: 'Game spotted' },
  sightReportHint: { pl: 'Zgłoś zwierzynę i kierunek, w którym poszła', en: 'Report game and the direction it went' },
  sightTitle: { pl: 'Co widzisz?', en: 'What do you see?' },
  sightCount: { pl: 'Ile', en: 'How many' },
  sp_deer: { pl: 'Jelenie', en: 'Red deer' },
  sp_boar: { pl: 'Dziki', en: 'Wild boar' },
  sp_roe: { pl: 'Sarny', en: 'Roe deer' },
  sp_predator: { pl: 'Drapieżniki', en: 'Predators' },
  sightPoint: {
    pl: 'Skieruj telefon tam, dokąd poszła zwierzyna (tyłem telefonu albo górną krawędzią).',
    en: 'Point the phone where the game went (with its back or its top edge).',
  },
  sightWent: { pl: 'Tam poszły', en: 'They went there' },
  sightWhere: { pl: 'dokąd poszły?', en: 'which way?' },
  sightNoCompass: { pl: 'Kompas niedostępny. Wybierz kierunek (góra = północ).', en: 'No compass. Pick the direction (up = north).' },
  sightCalibrate: { pl: 'Kompas niedokładny: zatocz telefonem ósemkę.', en: 'Compass is inaccurate: move the phone in a figure of eight.' },
  sightButtons: { pl: 'Wybiorę kierunek przyciskiem', en: 'Pick the direction with a button' },
  sightCompass: { pl: 'Użyj kompasu', en: 'Use the compass' },
  sightBack: { pl: 'Wstecz', en: 'Back' },
  sightSaving: { pl: 'Zapisywanie…', en: 'Saving…' },
  sightNoFix: { pl: 'Nie udało się ustalić Twojego położenia.', en: 'Could not get your position.' },
  sightSaved: { pl: 'Zgłoszono', en: 'Reported' },
  sightUndo: { pl: 'Cofnij', en: 'Undo' },
  sightToward: { pl: 'idą w Twoją stronę', en: 'heading your way' },
  sightings: { pl: 'Zwierzyna', en: 'Game' },
  sightNone: { pl: 'Nikt jeszcze nie zgłosił zwierzyny.', en: 'Nobody has reported game yet.' },
  sightBy: { pl: 'zgłosił(a)', en: 'reported by' },
} as const;
const l = (k: keyof typeof L) => tt(L[k]);

// ---------------------------------------------------------------- state

type Conn = { s: 'idle' } | { s: 'loading' } | { s: 'ready'; be: HuntBackend } | { s: 'error'; msg: string };
let conn: Conn = { s: 'idle' };
let rerender: () => void = () => {};
let go: (id: string | null) => void = () => {};

let mine: { s: 'idle' } | { s: 'loading' } | { s: 'done'; hunts: Hunt[] } | { s: 'error'; msg: string } = { s: 'idle' };
let creating = false;

let watched: string | null = null;
let unsubs: Unsubscribe[] = [];
let hunt: Hunt | null | undefined; // undefined = loading
let huntError = '';
let members: Participant[] | null = null; // null = not a participant (or not loaded)
let membersLoaded = false;

let editing = false;
let confirming: string | null = null; // 'delete' | 'withdraw' | `remove:${uid}`
let busy = false;
let formError = '';
let badFields = new Set<string>();
let copied = false;
/** Text typed into forms, kept across re-renders caused by live updates. */
const draft = new Map<string, string>();

/** Supplied by main.ts: the BDL district list, null while loading, or an error. */
export interface HuntContext {
  onChange: () => void;
  go: (id: string | null) => void;
  districts: () => { list: District[] | null; error: string };
}
let districtsOf: HuntContext['districts'] = () => ({ list: null, error: '' });
let locatingDistrict = false;

let hmap: HuntMap | null = null;
let positions: Position[] = [];
let posUnsub: Unsubscribe | null = null;
let tracksUnsub: Unsubscribe | null = null;
let showTracks = false;
let ticker: ReturnType<typeof setInterval> | undefined;
let sharer: Sharer | null = null;
let drives: Drive[] = [];
let drivesUnsub: Unsubscribe | null = null;
/** id of the running drive at the last update; undefined until the first one arrives. */
let lastActive: string | null | undefined;
let toast: { text: string; until: number; undo?: string } | null = null;
let sightings: Sighting[] = [];
let sightUnsub: Unsubscribe | null = null;
/** Sightings already seen, so only new ones raise an alert; null until the first update. */
let seenSights: Set<string> | null = null;
/** The drive being added (id null) or redrawn; name and times live in the form draft. */
let driveEdit: { id: string | null; area: Area; name: string; start: string; end: string } | null = null;
/** Scroll the drive form and the map below it into view after the next render. */
let scrollToDriveForm = false;
let locatingDrive = false;
/** The drive list's open state once the user toggles it; until then open except for others during the hunt. */
let driveListOpen: boolean | null = null;
let purged = new Set<string>();
const SHARE_KEY = 'huntSharing';

const NAME_KEY = 'huntPersonName';
const storedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
const storeName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------- data

function connect() {
  if (conn.s === 'loading' || conn.s === 'ready') return;
  conn = { s: 'loading' };
  getBackend().then(
    (be) => {
      conn = { s: 'ready', be };
      if (watched) subscribe(watched);
      rerender();
    },
    (e) => {
      conn = { s: 'error', msg: String((e as Error)?.message ?? e) };
      rerender();
    },
  );
}

function unsubscribe() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

// ---------------------------------------------------------------- live map

function stopLive() {
  posUnsub?.();
  posUnsub = null;
  tracksUnsub?.();
  tracksUnsub = null;
  drivesUnsub?.();
  drivesUnsub = null;
  sightUnsub?.();
  sightUnsub = null;
  sightings = [];
  seenSights = null;
  closeReport();
  drives = [];
  lastActive = undefined;
  toast = null;
  driveEdit = null;
  driveListOpen = null;
  showTracks = false;
  positions = [];
  clearInterval(ticker);
  ticker = undefined;
  hmap?.destroy();
  hmap = null;
}

const people = (): Map<string, PersonInfo> => new Map((members ?? []).map((p) => [p.uid, { name: p.name, role: p.role }]));
const myUid = () => (conn.s === 'ready' ? conn.be.uid : '');
const now = () => (conn.s === 'ready' ? conn.be.serverNow() : Date.now());

function ago(ms: number) {
  const m = Math.floor(ms / 60e3);
  if (m < 1) return l('justNow');
  if (m < 60) return `${m} ${l('minAgo')}`;
  return `${Math.floor(m / 60)} ${l('hAgo')}`;
}

/** Start or stop the position listener depending on whether I may read positions. */
function syncLive() {
  const id = watched;
  const me = members?.find((p) => p.uid === myUid());
  const allowed = !!(id && hunt && me && me.status === 'confirmed');
  if (!allowed) {
    if (posUnsub || hmap) stopLive();
  } else if (conn.s === 'ready' && !posUnsub) {
    posUnsub = conn.be.watchPositions(
      id!,
      (ps) => {
        positions = ps;
        drawPositions();
      },
      () => {
        posUnsub = null;
      },
    );
    drivesUnsub = conn.be.watchDrives(id!, onDrives, () => (drivesUnsub = null));
    sightUnsub = conn.be.watchSightings(id!, onSightings, () => (sightUnsub = null));
    ticker = setInterval(() => {
      hmap?.refreshAges(now());
      drawSightings();
      updateLiveText();
    }, 15_000);
  }
  // Sharing follows the hunt: only while it is live and I am confirmed.
  // (Deferred: these re-render, and syncLive runs during rendering.)
  if (sharer && sharer.huntId === id && sharer.active && (!allowed || hunt?.status !== 'live')) {
    const s = sharer;
    const clear = hunt?.status === 'live';
    queueMicrotask(() => s.stop(clear));
    forgetSharing();
  }
  // Resume sharing after a reload if it was on for this hunt.
  if (allowed && hunt?.status === 'live' && rememberedSharing() === id && !sharer?.active && sharer?.state !== 'denied')
    queueMicrotask(startSharing);
  // The leader's app deletes positions and tracks RETENTION_MS after the end (there is no server code).
  if (id && hunt && hunt.leaderUid === myUid() && shouldPurge(hunt, now()) && !purged.has(id) && conn.s === 'ready') {
    purged.add(id);
    conn.be.purgeLocations(id).catch(() => purged.delete(id));
  }
}

function onDrives(ds: Drive[]) {
  drives = sortDrives(ds, hunt?.start ?? '00:00');
  const act = activeDrive(drives);
  const actId = act?.id ?? null;
  if (lastActive !== undefined && actId !== lastActive) {
    const prev = drives.find((d) => d.id === lastActive);
    const text = act ? `${act.name} ${l('dStarted')}` : prev ? `${prev.name} ${l('dEnded')}` : '';
    if (text) {
      showToast(text);
      navigator.vibrate?.([300, 150, 300]);
    }
  }
  lastActive = actId;
  if (driveEdit?.id && !drives.some((d) => d.id === driveEdit!.id)) driveEdit = null; // deleted meanwhile
  rerender();
  updatePocket();
}

function showToast(text: string, undo?: string) {
  const t = { text, until: Date.now() + 10_000, undo };
  toast = t;
  rerender();
  setTimeout(() => {
    if (toast === t) {
      toast = null;
      rerender();
    }
  }, 10_500);
}

// ---------------------------------------------------------------- game sightings

const herdLabel = (h: Herd) => h.replace('-', '–');
const sightName = (s: Pick<Sighting, 'species' | 'count'>) => `${l(`sp_${s.species}` as keyof typeof L)} ${herdLabel(s.count)}`;

/** Where I am: the sharing fix, or my last published position. */
function myPos(): { lat: number; lng: number } | null {
  if (sharer?.active && sharer.huntId === watched && sharer.lastFix) return sharer.lastFix;
  return positions.find((p) => p.uid === myUid()) ?? null;
}

function onSightings(ss: Sighting[]) {
  sightings = ss;
  if (seenSights) {
    const me = myPos();
    for (const s of ss) {
      if (seenSights.has(s.id)) continue;
      seenSights.add(s.id);
      if (s.uid === myUid() || now() - s.ts > 2 * 60e3 || !me || !headingToward(s, me)) continue;
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      showToast(`${sightName(s)} ${l('sightToward')} (${Math.round(distanceM(s, me))} m)`);
    }
  } else seenSights = new Set(ss.map((s) => s.id));
  drawSightings();
}

/** Sightings shown on the map: bright and faded ones, and old ones too while tracks are shown. */
function visibleSightings(): { s: Sighting; look: ReturnType<typeof sightLook> }[] {
  const act = activeDrive(drives)?.id ?? null;
  const t = now();
  return sightings.map((s) => ({ s, look: sightLook(s, t, act) })).filter((x) => x.look !== 'old' || showTracks);
}

function sightPopup(s: Sighting): string {
  const who = members?.find((p) => p.uid === s.uid)?.name ?? '?';
  return `<strong>${esc(sightName(s))}</strong> → ${compassPoint(s.heading)} · ${Math.round(s.heading)}°<br>${l('sightBy')} ${esc(who)}<br>${esc(ago(Math.max(0, now() - s.ts)))}`;
}

function drawSightings() {
  const vis = visibleSightings();
  hmap?.setSightings(
    vis.map(({ s, look }): SightView => ({ id: s.id, species: s.species, label: sightName(s), lat: s.lat, lng: s.lng, heading: s.heading, look, popup: sightPopup(s) })),
  );
  const list = document.querySelector('.hs-list');
  if (list) list.innerHTML = sightListHtml();
}

function sightListHtml(): string {
  const vis = visibleSightings().slice(0, 12);
  if (!vis.length) return `<p class="muted small">${l('sightNone')}</p>`;
  return `<ul>${vis
    .map(({ s, look }) => {
      const who = members?.find((p) => p.uid === s.uid)?.name ?? '?';
      return `<li class="hs-${look}"><button type="button" data-hunt="sightShow" data-sid="${esc(s.id)}">${speciesIcon(s.species, 22)}
        <strong>${esc(sightName(s))}</strong> <span class="hs-dir" style="--deg:${Math.round(s.heading)}deg" aria-hidden="true">↑</span> ${compassPoint(s.heading)}
        <span class="muted small">· ${esc(who)} · ${esc(ago(Math.max(0, now() - s.ts)))}</span></button></li>`;
    })
    .join('')}</ul>`;
}

function getFix(): Promise<{ lat: number; lng: number }> {
  const known = sharer?.active && sharer.huntId === watched ? sharer.lastFix : null;
  if (known) return Promise.resolve(known);
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error(l('sightNoFix')));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error(l('sightNoFix'))),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  });
}

function openSightReport() {
  const id = watched;
  if (!id || conn.s !== 'ready') return;
  const be = conn.be;
  // Start the GPS fix right away, while the person picks the animal.
  const fix = getFix();
  fix.catch(() => {});
  let lng: number | null = myPos()?.lng ?? null;
  fix.then((f) => (lng = f.lng), () => {});
  openReport(
    {
      title: l('sightTitle'),
      count: l('sightCount'),
      species: { deer: l('sp_deer'), boar: l('sp_boar'), roe: l('sp_roe'), predator: l('sp_predator') },
      herd: herdLabel,
      where: (name) => `${name}: ${l('sightWhere')}`,
      point: l('sightPoint'),
      went: l('sightWent'),
      noCompass: l('sightNoCompass'),
      calibrate: l('sightCalibrate'),
      useButtons: l('sightButtons'),
      useCompass: l('sightCompass'),
      cancel: l('cancel'),
      back: l('sightBack'),
      saving: l('sightSaving'),
    },
    () => lng,
    async (r) => {
      const at = await fix;
      let sid: string;
      try {
        sid = await be.addSighting(id, { ...r, lat: at.lat, lng: at.lng, driveId: activeDrive(drives)?.id ?? null });
      } catch (e) {
        throw new Error(errText(e));
      }
      navigator.vibrate?.(80);
      showToast(`${l('sightSaved')}: ${sightName(r)} → ${compassPoint(r.heading)}`, sid);
    },
  );
}

const driveViews = (): DriveView[] => drives.map((d) => ({ id: d.id, name: d.name, area: d.area, state: driveState(d) }));

function onAreaChange(a: Area) {
  if (!driveEdit) return;
  driveEdit.area = a;
  const el = document.querySelector('.hd-corner-count');
  if (el) el.textContent = String(a.length);
  const undo = document.querySelector<HTMLButtonElement>('[data-hunt="driveUndo"]');
  if (undo) undo.disabled = !a.length;
  if (a.length >= DRIVE_LIMITS.minCorners && badFields.has('area')) {
    badFields.delete('area');
    if (!badFields.size) formError = '';
    document.querySelector('.hd-hint')?.classList.remove('h-error');
    if (!formError) document.querySelector('.hd-form [role="alert"]')?.remove();
  }
}

function drawPositions() {
  if (!hmap) return;
  hmap.setPositions(positions, people(), myUid(), now());
  updateLiveText();
}

function ensureMap(): HuntMap {
  if (!hmap) {
    hmap = createHuntMap({
      you: l('you'),
      role: (r) => l(`r_${r}`),
      ago,
      accuracy: l('accuracy'),
      distance: l('distanceFromYou'),
      layers: { osm: l('lOsm'), topo: l('lTopo'), sat: l('lSat'), districts: l('lDistricts'), compartments: l('lCompartments') },
    });
  }
  return hmap;
}

/** Called by main.ts after the page HTML is in place: put the live map into its slot. */
export function mountHuntMap() {
  const slot = document.querySelector<HTMLElement>('.hm-slot');
  if (!slot) return;
  const m = ensureMap();
  slot.replaceWith(m.el);
  m.invalidate();
  m.setDistrict(hunt?.district?.id ?? null);
  m.setDrives(driveViews());
  if (driveEdit) m.startDraw(driveEdit.area, onAreaChange, driveEdit.id);
  else m.stopDraw();
  if (scrollToDriveForm) {
    scrollToDriveForm = false;
    document.querySelector('.hd-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  drawPositions();
  drawSightings();
  if (showTracks) m.setTracks(lastTracks, people());
  updateLiveText();
}

let lastTracks: Map<string, TrackPoint[]> | null = null;

/** Download everyone's tracks and last positions as a GPX file. */
function exportGpx() {
  const id = watched;
  const h = hunt;
  if (!id || !h || conn.s !== 'ready') return;
  let done = false;
  let unsub: Unsubscribe | null = null;
  unsub = conn.be.watchTracks(
    id,
    (tracks) => {
      if (done) return;
      done = true;
      setTimeout(() => unsub?.(), 0);
      if (!tracks.size && !positions.length) {
        formError = l('exportEmpty');
        rerender();
        return;
      }
      const sights = sightings.map((s) => ({ s, label: `${sightName(s)} → ${Math.round(s.heading)}°` }));
      const gpx = toGpx(h.name, tracks, positions, people(), (r) => l(`r_${r}`), drives, sights);
      const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: gpxFileName(h) });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    () => {},
  );
}

function toggleTracks() {
  if (!watched || conn.s !== 'ready') return;
  showTracks = !showTracks;
  queueMicrotask(drawSightings); // old sightings show with the tracks
  tracksUnsub?.();
  tracksUnsub = null;
  if (showTracks)
    tracksUnsub = conn.be.watchTracks(
      watched,
      (t) => {
        lastTracks = t;
        hmap?.setTracks(t, people());
      },
      () => {},
    );
  else {
    lastTracks = null;
    hmap?.setTracks(null, people());
  }
}

/** Counts and the "last sent" line change with every position; update them without re-rendering the page. */
function updateLiveText() {
  const el = document.querySelector('.hm-counts');
  if (el) el.innerHTML = liveCounts();
  const sent = document.querySelector('.h-share-sent');
  if (sent && sharer?.lastSentAt) sent.textContent = `${l('lastSent')} ${ago(Date.now() - sharer.lastSentAt)}`;
  updatePocket();
}

function pocketStatus() {
  const on = !!sharer?.active;
  const sentAgo = sharer?.lastSentAt ? `${l('lastSent')} ${ago(Date.now() - sharer.lastSentAt)}` : '';
  const act = activeDrive(drives);
  return on
    ? { ok: true, title: sharer!.state === 'on' ? l('shareOn') : l('shareStarting'), detail: [act ? `${l('dNow')}: ${act.name}` : hunt?.name, sentAgo].filter(Boolean).join(' · ') }
    : { ok: false, title: l('pocketStopped'), detail: l('pocketStoppedDetail') };
}

function liveCounts(): string {
  const ppl = people();
  const visible = positions.filter((p) => ppl.has(p.uid));
  const by = (r: Role) => visible.filter((p) => ppl.get(p.uid)!.role === r).length;
  return (['leader', 'hunter', 'beater'] as Role[])
    .map((r) => `<span class="hm-count">${roleIcon(r, 16)} ${by(r)}</span>`)
    .join('') + `<span class="muted small">${l('visible')}</span>`;
}

const rememberedSharing = () => {
  try {
    return localStorage.getItem(SHARE_KEY);
  } catch {
    return null;
  }
};
const forgetSharing = () => {
  try {
    localStorage.removeItem(SHARE_KEY);
  } catch {
    /* ignore */
  }
};

function startSharing() {
  const id = watched;
  if (!id || conn.s !== 'ready') return;
  const be = conn.be;
  if (sharer && sharer.huntId !== id) sharer.stop();
  if (!sharer || sharer.huntId !== id)
    sharer = new Sharer(id, {
      publish: async (fix, track) => {
        const role = members?.find((p) => p.uid === be.uid)?.role ?? 'hunter';
        try {
          await be.publishPosition(id, fix, role, track);
        } catch (e) {
          // Refused by the rules: the hunt ended or I was removed. Stop instead of retrying forever.
          if (e instanceof HuntError && e.code === 'denied') throw Object.assign(new Error(l('shareNotLive')), { stop: true });
          throw e;
        }
      },
      clear: () => be.clearPosition(id),
      onChange: () => {
        rerender();
        updatePocket();
      },
    });
  try {
    localStorage.setItem(SHARE_KEY, id);
  } catch {
    /* ignore */
  }
  sharer.start();
}

function subscribe(id: string) {
  if (conn.s !== 'ready') return;
  const be = conn.be;
  unsubscribe();
  unsubs.push(
    be.watchHunt(
      id,
      (h) => {
        hunt = h;
        rerender();
      },
      (e) => {
        huntError = e.message;
        hunt = null;
        rerender();
      },
    ),
  );
  watchMembers(id);
}

function watchMembers(id: string) {
  if (conn.s !== 'ready') return;
  unsubs.push(
    conn.be.watchParticipants(
      id,
      (ps) => {
        members = ps;
        membersLoaded = true;
        rerender();
      },
      () => {
        members = null;
        membersLoaded = true;
        rerender();
      },
    ),
  );
}

function loadMine() {
  if (conn.s !== 'ready') return;
  mine = { s: 'loading' };
  conn.be.myHunts().then(
    (hunts) => {
      mine = { s: 'done', hunts: sortHunts(hunts) };
      rerender();
    },
    (e) => {
      mine = { s: 'error', msg: errText(e) };
      rerender();
    },
  );
}

function setRoute(id: string | null) {
  if (id === watched) return;
  unsubscribe();
  stopLive();
  watched = id;
  hunt = undefined;
  huntError = '';
  members = null;
  membersLoaded = false;
  editing = false;
  confirming = null;
  formError = '';
  badFields = new Set();
  copied = false;
  if (id) subscribe(id);
  else mine = { s: 'idle' };
}

/** Called by main.ts when the user leaves the section, so live listeners stop. */
export function leaveHunts() {
  setRoute(null);
  creating = false;
}

function errText(e: unknown, deniedKey: keyof typeof L = 'errDenied'): string {
  if (e instanceof HuntError) {
    if (e.code === 'denied') return l(deniedKey);
    if (e.code === 'offline') return l('errOffline');
  }
  return `${l('errUnknown')} ${(e as Error)?.message ?? e}`;
}

async function run(task: (be: HuntBackend) => Promise<void>, deniedKey: keyof typeof L = 'errDenied') {
  if (conn.s !== 'ready' || busy) return;
  busy = true;
  formError = '';
  rerender();
  try {
    await task(conn.be);
  } catch (e) {
    formError = errText(e, deniedKey);
  } finally {
    busy = false;
    rerender();
  }
}

// ---------------------------------------------------------------- formatting

const locale = () => (getLang() === 'pl' ? 'pl-PL' : 'en-GB');
function fmtDate(date: string, long = true) {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(locale(), long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' });
}
const statusBadge = (s: HuntStatus) => `<span class="h-status h-st-${s}">${l(`st_${s}`)}</span>`;

function field(form: string, name: string, label: string, def: string, opts: { type?: string; ph?: string; max?: number; hint?: string; req?: boolean; area?: boolean; auto?: string } = {}) {
  const v = draft.get(`${form}.${name}`) ?? def;
  const id = `hf-${form}-${name}`;
  const bad = badFields.has(name) ? ' aria-invalid="true"' : '';
  const common = `id="${id}" name="${name}" data-hunt-field="${form}"${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.req ? ' required' : ''}${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''}${opts.auto ? ` autocomplete="${opts.auto}"` : ''}${bad}`;
  const input = opts.area
    ? `<textarea ${common} rows="3">${esc(v)}</textarea>`
    : `<input type="${opts.type ?? 'text'}" ${common} value="${esc(v)}" />`;
  return `<label class="h-field" for="${id}"><span>${label}</span>${input}${opts.hint ? `<small class="muted">${opts.hint}</small>` : ''}</label>`;
}

const errorBox = () => (formError ? `<p class="h-error" role="alert">${esc(formError)}</p>` : '');
const btnBusy = () => (busy ? ' disabled aria-busy="true"' : '');

// ---------------------------------------------------------------- rendering

export function renderHunts(id: string | null, ctx: HuntContext): string {
  rerender = ctx.onChange;
  go = ctx.go;
  districtsOf = ctx.districts;
  if (!firebaseConfig()) return `<div class="hunts"><h2>${tt({ pl: 'Polowanie zbiorowe', en: 'Group hunts' })}</h2><div class="notice">${l('notConfigured')}</div></div>`;
  setRoute(id);
  connect();
  let body: string;
  if (conn.s === 'error')
    body = `<div class="notice error"><strong>${l('connectError')}</strong><p class="small">${esc(conn.msg)}</p>
      <button type="button" class="btn" data-hunt="reconnect">${l('retry')}</button></div>`;
  else if (conn.s !== 'ready') body = `<p class="muted">${l('connecting')}</p>`;
  else body = id ? renderHunt() : renderList();
  return `<div class="hunts">${body}</div>`;
}

function renderList(): string {
  if (mine.s === 'idle') loadMine();
  const head = `<h2>${tt({ pl: 'Polowanie zbiorowe', en: 'Group hunts' })}</h2><p class="muted">${l('intro')}</p>`;
  if (creating) return `${head}${renderHuntForm('create')}`;
  let list = '';
  if (mine.s === 'done')
    list = mine.hunts.length
      ? `<ul class="list h-list">${mine.hunts
          .map(
            (h) => `<li><a href="#/polowanie/${esc(h.id)}" data-hunt="open" data-id="${esc(h.id)}">
              <strong>${esc(h.name)}</strong>
              <span class="meta">${esc(fmtDate(h.date, false))}, ${esc(h.start)}–${esc(h.end)}${h.place ? ` · ${esc(h.place)}` : ''}</span>
              ${statusBadge(h.status)}${conn.s === 'ready' && h.leaderUid === conn.be.uid ? ` <span class="h-mine">${roleIcon('leader', 14)} ${l('r_leader')}</span>` : ''}
            </a></li>`,
          )
          .join('')}</ul>`
      : `<p class="muted">${l('noHunts')}</p>`;
  else if (mine.s === 'error') list = `<div class="notice error">${esc(mine.msg)}</div>`;
  else list = `<p class="muted">${l('loading')}</p>`;
  return `${head}<button type="button" class="btn" data-hunt="new">${l('newHunt')}</button>
    <h3>${l('myHunts')}</h3>${list}<p class="muted small">${l('thisDevice')}</p>`;
}

function renderHuntForm(kind: 'create' | 'edit'): string {
  const h: Partial<HuntInput> = kind === 'edit' && hunt ? hunt : {};
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const who =
    kind === 'create'
      ? `${field(kind, 'leaderName', l('fYourName'), storedName(), { max: LIMITS.name, req: true, hint: l('fYourNameHint'), auto: 'name' })}
         ${field(kind, 'pass', l('fPass'), '', { req: true, auto: 'off' })}`
      : '';
  return `<form class="card h-form" data-hunt-form="${kind}" novalidate>
    ${field(kind, 'name', l('fName'), h.name ?? '', { max: LIMITS.huntName, req: true, ph: l('fNamePh') })}
    <div class="h-row">
      ${field(kind, 'date', l('fDate'), h.date ?? iso, { type: 'date', req: true })}
      ${field(kind, 'start', l('fStart'), h.start ?? '08:00', { type: 'time', req: true })}
      ${field(kind, 'end', l('fEnd'), h.end ?? '15:00', { type: 'time', req: true })}
    </div>
    ${renderDistrictPicker(kind, h.district ?? null)}
    ${field(kind, 'place', l('fPlace'), h.place ?? '', { max: LIMITS.place, ph: l('fPlacePh') })}
    ${field(kind, 'notes', l('fNotes'), h.notes ?? '', { max: LIMITS.notes, ph: l('fNotesPh'), area: true })}
    ${who}
    ${errorBox()}
    <div class="h-actions">
      <button type="submit" class="btn"${btnBusy()}>${kind === 'create' ? l('create') : l('save')}</button>
      <button type="button" class="btn ghost" data-hunt="${kind === 'create' ? 'cancelNew' : 'cancelEdit'}">${l('cancel')}</button>
    </div>
  </form>`;
}

function pickedDistrict(form: string, def: HuntDistrict | null): HuntDistrict | null {
  const v = draft.get(`${form}.district`);
  if (v === undefined) return def;
  try {
    return JSON.parse(v) as HuntDistrict | null;
  } catch {
    return null;
  }
}

const cap = (s: string | null) => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : '');

export function districtToHunt(d: District): HuntDistrict {
  const where = [d.lease_holder_name, d.county_name && `woj. ${d.county_name}`].filter(Boolean).join(', ');
  return { id: d.objectid, slug: districtSlug(d), label: `Obwód nr ${d.hunt_dist_nr ?? '?'}${where ? ` · ${where}` : ''}` };
}

/** Districts matching every word of the query: exact district number, or holder / forest district / county / voivodeship text. */
export function searchDistricts(list: District[], q: string, limit = 8): District[] {
  const terms = fold(q.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: District[] = [];
  for (const d of list) {
    const text = fold([d.lease_holder_name, d.inspectorate_name, d.district_name, d.county_name].join(' '));
    if (terms.every((t) => d.hunt_dist_nr === t || text.includes(t))) {
      out.push(d);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function renderDistrictPicker(form: string, def: HuntDistrict | null): string {
  const picked = pickedDistrict(form, def);
  const head = `<span>${l('fDistrict')}</span>`;
  if (picked)
    return `<div class="h-field">${head}<div class="h-district-picked"><span>${esc(picked.label)}</span>
      <button type="button" class="btn small ghost" data-hunt="clearDistrict" data-form="${form}" aria-label="${l('districtClear')}">✕</button></div></div>`;
  const q = draft.get(`${form}.districtQ`) ?? '';
  const { list, error } = districtsOf();
  let results = '';
  if (q.trim()) {
    if (!list) results = `<li class="muted small">${error ? l('districtUnavailable') : l('districtLoading')}</li>`;
    else {
      const hits = searchDistricts(list, q);
      results = hits.length
        ? hits
            .map((d) => {
              const hd = districtToHunt(d);
              return `<li><button type="button" data-hunt="pickDistrict" data-form="${form}" data-district="${esc(JSON.stringify(hd))}">
                <strong>${l('districtNo')} ${esc(d.hunt_dist_nr)}</strong> <span class="muted">· ${esc(cap(d.county_name))}</span>
                <small class="muted">${esc(d.lease_holder_name ?? '—')} · ${esc(d.inspectorate_name ?? '')}</small></button></li>`;
            })
            .join('')
        : `<li class="muted small">${l('districtNone')}</li>`;
    }
  }
  const id = `hf-${form}-districtQ`;
  return `<div class="h-field"><label for="${id}">${head}</label>
    <input type="search" id="${id}" name="districtQ" data-hunt-field="${form}" value="${esc(q)}" placeholder="${esc(l('districtPh'))}" autocomplete="off" />
    ${results ? `<ul class="h-district-results">${results}</ul>` : ''}
    <div><button type="button" class="btn small ghost" data-hunt="districtHere" data-form="${form}"${locatingDistrict ? ' disabled aria-busy="true"' : ''}>${l('districtHere')}</button></div>
    <small class="muted">${l('fDistrictHint')}</small></div>`;
}

function renderLive(h: Hunt, me: Participant): string {
  if (me.status !== 'confirmed') return `<div class="notice">${l('unconfirmedMap')}</div>`;
  let share = '';
  if (h.status === 'live') {
    const st = sharer && sharer.huntId === h.id ? sharer.state : 'off';
    if (st === 'on' || st === 'starting')
      share = `<div class="h-share on" role="status"><span class="h-share-dot" aria-hidden="true"></span>
        <div><strong>${st === 'on' ? l('shareOn') : l('shareStarting')}</strong><br><small class="h-share-sent muted"></small>
        <small class="muted">${l('shareKeepOpen')}</small></div>
        <div class="h-share-btns"><button type="button" class="btn" data-hunt="pocket" title="${esc(l('pocketHint'))}">${l('pocket')}</button>
        <button type="button" class="btn danger" data-hunt="shareStop">${l('shareStop')}</button></div></div>`;
    else {
      const problem =
        st === 'denied' ? l('shareDenied') : st === 'unavailable' ? l('shareUnavailable') : st === 'error' ? `${l('shareStopped')} ${sharer?.error ?? ''}` : '';
      share = `<div class="h-share card"><strong>${l('shareTitle')}</strong>
        <p class="small">${l('shareConsent')}</p><p class="small muted">${l('shareSafety')}</p>
        ${problem ? `<p class="h-error">${esc(problem)}</p>` : ''}
        <button type="button" class="btn" data-hunt="shareStart">${l('shareStart')}</button></div>`;
    }
  } else if (h.status === 'ended') share = `<p class="muted small">${l('shareEnded')}</p>`;
  else share = `<p class="muted small">${l('shareNotLive')}</p>`;
  const iShare = !!sharer?.active && sharer.huntId === h.id;
  const t =
    toast && Date.now() < toast.until
      ? `<div class="hd-toast" role="alert"><span>${esc(toast.text)}</span>${toast.undo ? `<button type="button" class="btn small" data-hunt="sightUndo" data-sid="${esc(toast.undo)}">${l('sightUndo')}</button>` : ''}</div>`
      : '';
  const drawing = !!driveEdit && h.leaderUid === myUid();
  const report =
    h.status === 'live' && !drawing
      ? `<button type="button" class="btn hs-report" data-hunt="sightOpen" aria-label="${esc(l('sightReportHint'))}">${speciesIcon('boar', 28)} ${l('sightReport')}</button>`
      : '';
  return `<h3>${l('mapTitle')}</h3>${t}${report}${share}${renderDrives(h, h.leaderUid === myUid())}
    <div class="hm-bar"${drawing ? ' hidden' : ''}><div class="hm-counts">${liveCounts()}</div>
      <div class="hm-tools">
        ${iShare ? `<button type="button" class="btn small ghost" data-hunt="centerMe">◎ ${l('centerMe')}</button>` : ''}
        <button type="button" class="btn small ghost" data-hunt="fitAll">${l('fitAll')}</button>
        <button type="button" class="btn small ghost" data-hunt="tracks" aria-pressed="${showTracks}">${showTracks ? l('hideTracks') : l('showTracks')}</button>
        <button type="button" class="btn small ghost" data-hunt="gpx">${l('exportGpx')}</button>
      </div></div>
    <div class="hm-slot"></div>
    ${drawing ? '' : `<h4>${l('sightings')}</h4><div class="hs-list">${sightListHtml()}</div>`}`;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

function renderDrives(h: Hunt, isLeader: boolean): string {
  const act = activeDrive(drives);
  const next = drives.find((d) => driveState(d) === 'planned');
  let strip = '';
  if (act) strip = `<div class="hd-now"><span class="hd-dot" aria-hidden="true"></span><strong>${l('dNow')}: ${esc(act.name)}</strong> <span>· ${l('dUntil')} ${esc(act.end)}</span></div>`;
  else if (next && h.status === 'live') strip = `<div class="hd-now hd-next">${l('dNext')}: <strong>${esc(next.name)}</strong> · ${esc(next.start)}</div>`;
  if (driveEdit && isLeader) return `${strip}${renderDriveForm()}`;
  const row = (d: Drive, i: number) => {
    const st = driveState(d);
    const when =
      st === 'planned'
        ? `${l('dPlanned')} ${esc(d.start)}–${esc(d.end)}`
        : st === 'active'
          ? `${l('dRunning')} ${clock(d.startedAt!)} · ${l('dUntil')} ${esc(d.end)}`
          : `${l('dDone')} ${clock(d.startedAt!)}–${clock(d.endedAt!)}`;
    let ctl = '';
    if (isLeader) {
      const startEnd =
        h.status === 'live' && st !== 'active'
          ? `<button type="button" class="btn small${st === 'planned' && d === next && !act ? '' : ' ghost'}" data-hunt="driveStart" data-drive="${esc(d.id)}"${btnBusy()}>${l('dStartNow')}</button>`
          : st === 'active'
            ? `<button type="button" class="btn small" data-hunt="driveEnd" data-drive="${esc(d.id)}"${btnBusy()}>${l('dEndNow')}</button>`
            : '';
      ctl =
        confirming === `drive:${d.id}`
          ? `<button type="button" class="btn small danger" data-hunt="driveDelete" data-drive="${esc(d.id)}"${btnBusy()}>${l('dDeleteSure')}</button>
             <button type="button" class="btn small ghost" data-hunt="unconfirm">${l('cancel')}</button>`
          : `${startEnd}<button type="button" class="btn small ghost" data-hunt="driveEdit" data-drive="${esc(d.id)}">${l('editDrive')}</button>
             <button type="button" class="btn small ghost" data-hunt="askDriveDelete" data-drive="${esc(d.id)}" aria-label="${l('remove')} ${esc(d.name)}">✕</button>`;
    }
    return `<li class="hd-drive hd-${st}"><span class="hd-num">${i + 1}</span>
      <span class="hd-info"><strong>${esc(d.name)}</strong><small class="muted">${when}</small></span>
      ${ctl ? `<span class="h-pctl">${ctl}</span>` : ''}</li>`;
  };
  const list = drives.length
    ? `<ul class="hd-list">${drives.map(row).join('')}</ul>`
    : `<p class="muted small">${isLeader ? l('noDrivesLeader') : l('noDrives')}</p>`;
  const add = isLeader
    ? drives.length < DRIVE_LIMITS.drives
      ? `<button type="button" class="btn small" data-hunt="driveNew">${l('addDrive')}</button>`
      : `<p class="muted small">${l('dMax')}</p>`
    : '';
  const open = driveListOpen ?? (isLeader || h.status !== 'live' || !drives.length);
  return `${strip}<details class="hd-box"${open ? ' open' : ''}><summary data-hunt="driveList" data-open="${open}"><strong>${l('drives')}</strong> <span class="muted">(${drives.length})</span></summary>
    ${list}${add}${isLeader ? errorBox() : ''}</details>`;
}

function renderDriveForm(): string {
  const e = driveEdit!;
  return `<form class="card h-form hd-form" data-hunt-form="drive" novalidate>
    <strong>${e.id ? l('editDriveTitle') : l('newDriveTitle')}</strong>
    <div class="h-row">
      ${field('drive', 'name', l('dName'), e.name, { max: DRIVE_LIMITS.name, req: true })}
      ${field('drive', 'start', l('dStart'), e.start, { type: 'time', req: true })}
      ${field('drive', 'end', l('dEnd'), e.end, { type: 'time', req: true })}
    </div>
    <p class="small hd-hint${badFields.has('area') ? ' h-error' : ''}">${l('dCorners')} ${l('dCornerCount')} <strong class="hd-corner-count">${e.area.length}</strong></p>
    ${errorBox()}
    <div class="h-actions">
      <button type="button" class="btn small ghost" data-hunt="driveLocate"${locatingDrive ? ' disabled aria-busy="true"' : ''}>◎ ${l('centerMe')}</button>
      <button type="button" class="btn small ghost" data-hunt="driveUndo"${e.area.length ? '' : ' disabled'}>${l('dUndo')}</button>
      <button type="submit" class="btn small"${btnBusy()}>${l('dSave')}</button>
      <button type="button" class="btn small ghost" data-hunt="driveCancel">${l('cancel')}</button>
    </div>
  </form>`;
}

function renderHunt(): string {
  const back = `<button type="button" class="btn ghost back" data-hunt="list">${l('allHunts')}</button>`;
  if (hunt === undefined) return `${back}<p class="muted">${l('loading')}</p>`;
  if (hunt === null) return `${back}<div class="notice">${l('notFound')}${huntError ? `<p class="muted small">${esc(huntError)}</p>` : ''}</div>`;
  const h = hunt;
  const uid = conn.s === 'ready' ? conn.be.uid : '';
  const isLeader = h.leaderUid === uid;
  const me = members?.find((p) => p.uid === uid);
  const info = `<article class="card h-head">
      <div class="h-title"><h2>${esc(h.name)}</h2>${statusBadge(h.status)}</div>
      <dl class="kv">
        <dt>${l('when')}</dt><dd>${esc(fmtDate(h.date))}<br>${esc(h.start)}–${esc(h.end)}</dd>
        ${h.place ? `<dt>${l('where')}</dt><dd>${esc(h.place)}</dd>` : ''}
        ${h.district ? `<dt>${l('district')}</dt><dd><a href="#/obwod/${esc(h.district.slug)}" data-nav="district" data-slug="${esc(h.district.slug)}">${esc(h.district.label)}</a></dd>` : ''}
        <dt>${l('leader')}</dt><dd>${roleIcon('leader', 16)} ${esc(h.leaderName)}</dd>
      </dl>
      ${h.notes ? `<p class="h-notes">${esc(h.notes).replace(/\n/g, '<br>')}</p>` : ''}
    </article>`;
  if (editing && isLeader) return `${back}${renderHuntForm('edit')}`;
  if (!membersLoaded) return `${back}${info}<p class="muted">${l('loading')}</p>`;
  if (!me) {
    syncLive();
    return `${back}${info}${renderJoin(h)}`;
  }
  syncLive();
  return `${back}${info}${renderMe(me, isLeader)}${renderLive(h, me)}${isLeader ? renderInvite(h) : ''}${renderMembers(uid, isLeader)}${isLeader ? renderManage(h) : ''}`;
}

function renderJoin(h: Hunt): string {
  if (!registrationOpen(h)) return `<div class="notice">${l('closedNote')}</div>`;
  const role = draft.get('join.role') ?? 'hunter';
  const radio = (r: 'hunter' | 'beater') =>
    `<label class="h-role"><input type="radio" name="role" value="${r}" data-hunt-field="join"${role === r ? ' checked' : ''} />${roleIcon(r, 22)}<span>${l(`r_${r}`)}</span></label>`;
  return `<form class="card h-form" data-hunt-form="join" novalidate>
    <h3>${l('joinTitle')}</h3>
    <fieldset class="h-roles"><legend>${l('fRole')}</legend>${radio('hunter')}${radio('beater')}</fieldset>
    ${field('join', 'pname', l('fYourName'), storedName(), { max: LIMITS.name, req: true, hint: l('fYourNameHint'), auto: 'name' })}
    ${field('join', 'pass', l('fPass'), '', { req: true, hint: l('fPassHint'), auto: 'off' })}
    ${errorBox()}
    <div class="h-actions"><button type="submit" class="btn"${btnBusy()}>${l('join')}</button></div>
  </form>`;
}

function renderMe(me: Participant, isLeader: boolean): string {
  const withdraw = isLeader
    ? ''
    : confirming === 'withdraw'
      ? `<button type="button" class="btn danger" data-hunt="withdraw"${btnBusy()}>${l('withdrawSure')}</button>
         <button type="button" class="btn ghost" data-hunt="unconfirm">${l('cancel')}</button>`
      : `<button type="button" class="btn ghost" data-hunt="askWithdraw">${l('withdraw')}</button>`;
  return `<div class="notice h-me">${roleIcon(me.role, 22)}<div><strong>${l('youAre')} ${l(`r_${me.role}`).toLocaleLowerCase(locale())}</strong>
      ${me.status === 'registered' ? `<br><span class="small">${l('youPending')}</span>` : ''}</div>
      ${withdraw ? `<div class="h-actions">${withdraw}</div>` : ''}</div>${!isLeader ? errorBox() : ''}`;
}

function renderInvite(h: Hunt): string {
  const url = inviteUrl(h.id);
  return `<h3>${l('invite')}</h3><p class="small muted">${l('inviteHint')}</p>
    <div class="h-invite"><input type="text" readonly value="${esc(url)}" aria-label="${l('invite')}" data-hunt-select />
      ${'share' in navigator ? `<button type="button" class="btn" data-hunt="share">${l('share')}</button>` : ''}
      <button type="button" class="btn ghost" data-hunt="copy">${copied ? `✓ ${l('copied')}` : l('copy')}</button></div>`;
}

function renderMembers(uid: string, isLeader: boolean): string {
  const ps = members ?? [];
  const c = countRoles(ps);
  const row = (p: Participant) => {
    const controls =
      isLeader && p.role !== 'leader'
        ? confirming === `remove:${p.uid}`
          ? `<button type="button" class="btn small danger" data-hunt="remove" data-uid="${esc(p.uid)}"${btnBusy()}>${l('sure')}</button>
             <button type="button" class="btn small ghost" data-hunt="unconfirm">${l('cancel')}</button>`
          : `${p.status === 'registered' ? `<button type="button" class="btn small" data-hunt="confirm" data-uid="${esc(p.uid)}"${btnBusy()}>${l('confirm')}</button>` : ''}
             <button type="button" class="btn small ghost" data-hunt="role" data-uid="${esc(p.uid)}" data-to="${p.role === 'hunter' ? 'beater' : 'hunter'}"${btnBusy()}>${l(p.role === 'hunter' ? 'makeBeater' : 'makeHunter')}</button>
             <button type="button" class="btn small ghost" data-hunt="askRemove" data-uid="${esc(p.uid)}">${l('remove')}</button>`
        : '';
    return `<li class="h-person${p.status === 'registered' ? ' pending' : ''}">${roleIcon(p.role)}
      <span class="h-pname">${esc(p.name)}${p.uid === uid ? ` <span class="muted">(${l('you')})</span>` : ''}
        ${p.status === 'registered' ? `<small class="muted">${l('pending')}</small>` : ''}</span>
      ${controls ? `<span class="h-pctl">${controls}</span>` : ''}</li>`;
  };
  const group = (role: 'hunter' | 'beater') => {
    const list = ps.filter((p) => p.role === role);
    return `<h4>${roleIcon(role, 16)} ${l(`g_${role}`)} <span class="muted">(${c[role]})</span></h4>
      ${list.length ? `<ul class="h-people">${list.map(row).join('')}</ul>` : `<p class="muted small">${l('nobody')}</p>`}`;
  };
  const leaders = ps.filter((p) => p.role === 'leader');
  return `<h3>${l('participants')} <span class="muted">(${ps.length})</span></h3>
    <ul class="h-people">${leaders.map(row).join('')}</ul>${group('hunter')}${group('beater')}
    ${isLeader ? errorBox() : ''}`;
}

function renderManage(h: Hunt): string {
  const statusButtons = nextStatuses(h.status)
    .map((s) => `<button type="button" class="btn${s === 'live' || s === 'ended' ? '' : ' ghost'}" data-hunt="status" data-to="${s}"${btnBusy()}>${l(`to_${s}`)}</button>`)
    .join('');
  const del =
    confirming === 'delete'
      ? `<button type="button" class="btn danger" data-hunt="delete"${btnBusy()}>${l('deleteSure')}</button>
         <button type="button" class="btn ghost" data-hunt="unconfirm">${l('cancel')}</button>`
      : `<button type="button" class="btn ghost danger-text" data-hunt="askDelete">${l('deleteHunt')}</button>`;
  return `<h3>${l('manage')}</h3><div class="h-actions">${statusButtons}
      <button type="button" class="btn ghost" data-hunt="edit">${l('editHunt')}</button></div>
    <div class="h-actions h-danger">${del}</div>`;
}

const inviteUrl = (id: string) => `${location.origin}${location.pathname}#/polowanie/${id}`;

// ---------------------------------------------------------------- events

export function handleHuntClick(el: HTMLElement): boolean {
  const action = el.dataset.hunt;
  if (!action) return false;
  const id = watched;
  const uid = el.dataset.uid ?? '';
  switch (action) {
    case 'reconnect':
      conn = { s: 'idle' };
      connect();
      break;
    case 'open':
      go(el.dataset.id!);
      return true;
    case 'list':
      go(null);
      return true;
    case 'new':
      creating = true;
      formError = '';
      badFields = new Set();
      break;
    case 'cancelNew':
      creating = false;
      clearDraft('create');
      formError = '';
      break;
    case 'edit':
      editing = true;
      formError = '';
      badFields = new Set();
      break;
    case 'cancelEdit':
      editing = false;
      clearDraft('edit');
      formError = '';
      break;
    case 'askWithdraw':
    case 'askDelete':
      confirming = action === 'askWithdraw' ? 'withdraw' : 'delete';
      break;
    case 'askRemove':
      confirming = `remove:${uid}`;
      break;
    case 'unconfirm':
      confirming = null;
      break;
    case 'withdraw':
      confirming = null;
      if (sharer?.huntId === id) {
        forgetSharing();
        sharer.stop(false);
      }
      if (id) run((be) => be.withdraw(id));
      return true;
    case 'delete':
      confirming = null;
      if (id)
        run(async (be) => {
          await be.deleteHunt(id);
          mine = { s: 'idle' };
          go(null);
        });
      return true;
    case 'remove':
      confirming = null;
      if (id) run((be) => be.removeParticipant(id, uid));
      return true;
    case 'confirm':
      if (id) run((be) => be.setParticipant(id, uid, { status: 'confirmed' }));
      return true;
    case 'role':
      if (id) run((be) => be.setParticipant(id, uid, { role: el.dataset.to as 'hunter' | 'beater' }));
      return true;
    case 'status':
      if (id)
        run(async (be) => {
          const to = el.dataset.to as HuntStatus;
          const act = activeDrive(drives);
          if (to === 'ended' && act) await be.endDrive(id, act.id);
          await be.updateHunt(id, { status: to });
        });
      return true;
    case 'driveNew':
      if (!hunt) break;
      clearDraft('drive');
      driveEdit = { id: null, area: [], ...nextDriveDefaults(drives, hunt) };
      scrollToDriveForm = true;
      formError = '';
      badFields = new Set();
      break;
    case 'driveEdit': {
      const d = drives.find((x) => x.id === el.dataset.drive);
      if (!d) break;
      clearDraft('drive');
      driveEdit = { id: d.id, area: d.area.map(([a, b]) => [a, b] as [number, number]), name: d.name, start: d.start, end: d.end };
      scrollToDriveForm = true;
      formError = '';
      badFields = new Set();
      break;
    }
    case 'sightOpen':
      openSightReport();
      return true;
    case 'sightUndo':
      if (id && el.dataset.sid) {
        toast = null;
        run((be) => be.deleteSighting(id, el.dataset.sid!));
      }
      return true;
    case 'sightShow': {
      const s = sightings.find((x) => x.id === el.dataset.sid);
      if (s) {
        hmap?.centerOnPoint(s.lat, s.lng);
        document.querySelector('.hm-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return true;
    }
    case 'driveList':
      driveListOpen = el.dataset.open !== 'true';
      break;
    case 'driveUndo':
      hmap?.undoCorner();
      return true;
    case 'driveLocate':
      if (!('geolocation' in navigator)) break;
      locatingDrive = true;
      navigator.geolocation.getCurrentPosition(
        (p) => {
          locatingDrive = false;
          hmap?.showPoint(p.coords.latitude, p.coords.longitude);
          rerender();
        },
        () => {
          locatingDrive = false;
          formError = l('shareDenied');
          rerender();
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
      );
      break;
    case 'driveCancel':
      driveEdit = null;
      clearDraft('drive');
      formError = '';
      badFields = new Set();
      break;
    case 'askDriveDelete':
      confirming = `drive:${el.dataset.drive}`;
      break;
    case 'driveDelete':
      confirming = null;
      if (id) run((be) => be.deleteDrive(id, el.dataset.drive!));
      return true;
    case 'driveStart':
      if (id) run((be) => be.startDrive(id, el.dataset.drive!, drives.filter((d) => driveState(d) === 'active').map((d) => d.id)));
      return true;
    case 'driveEnd':
      if (id) run((be) => be.endDrive(id, el.dataset.drive!));
      return true;
    case 'share':
      if (id && hunt)
        navigator.share?.({ title: hunt.name, text: `${hunt.name} – ${fmtDate(hunt.date)} ${hunt.start}`, url: inviteUrl(id) }).catch(() => {});
      return true;
    case 'pickDistrict':
      draft.set(`${el.dataset.form}.district`, el.dataset.district ?? 'null');
      draft.delete(`${el.dataset.form}.districtQ`);
      break;
    case 'clearDistrict':
      draft.set(`${el.dataset.form}.district`, 'null');
      break;
    case 'districtHere': {
      const form = el.dataset.form!;
      if (!('geolocation' in navigator)) break;
      locatingDistrict = true;
      formError = '';
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          try {
            const res = await fetchDistrictsAtPoint(p.coords.latitude, p.coords.longitude);
            if (res[0]) draft.set(`${form}.district`, JSON.stringify(districtToHunt(res[0].attributes)));
            else formError = l('districtHereNone');
          } catch {
            formError = l('districtHereError');
          }
          locatingDistrict = false;
          rerender();
        },
        () => {
          locatingDistrict = false;
          formError = l('districtHereError');
          rerender();
        },
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
      );
      break;
    }
    case 'shareStart':
      startSharing();
      break;
    case 'pocket':
      openPocket(pocketStatus, { unlock: l('pocketUnlock'), hint: l('pocketHint') });
      return true;
    case 'shareStop':
      forgetSharing(); // first: stop() re-renders, and a remembered flag would resume sharing
      sharer?.stop();
      break;
    case 'tracks':
      toggleTracks();
      break;
    case 'fitAll':
      hmap?.fitAll();
      return true;
    case 'gpx':
      exportGpx();
      return true;
    case 'centerMe':
      hmap?.centerOn(myUid());
      return true;
    case 'copy':
      if (id)
        navigator.clipboard?.writeText(inviteUrl(id)).then(() => {
          copied = true;
          rerender();
          setTimeout(() => {
            copied = false;
            rerender();
          }, 2000);
        });
      return true;
  }
  rerender();
  return true;
}

function clearDraft(form: string) {
  for (const k of [...draft.keys()]) if (k.startsWith(`${form}.`)) draft.delete(k);
}

export function handleHuntInput(el: HTMLElement): boolean {
  const form = el.dataset.huntField;
  if (!form) return false;
  const input = el as HTMLInputElement;
  draft.set(`${form}.${input.name}`, input.value);
  if (input.name === 'districtQ') rerender();
  return true;
}

export function handleHuntSubmit(form: HTMLFormElement): boolean {
  const kind = form.dataset.huntForm;
  if (!kind) return false;
  const v = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  formError = '';
  badFields = new Set();
  if (kind === 'create' || kind === 'edit') {
    const input: HuntInput = {
      name: v('name'),
      date: v('date'),
      start: v('start'),
      end: v('end'),
      place: v('place'),
      notes: v('notes'),
      district: pickedDistrict(kind, kind === 'edit' && hunt ? hunt.district : null),
    };
    validateHunt(input).forEach((f) => badFields.add(f));
    if (kind === 'create') {
      if (!validPersonName(v('leaderName'))) badFields.add('leaderName');
      if (!v('pass').trim()) badFields.add('pass');
    }
    if (badFields.size) {
      formError = l('errFields');
      rerender();
      return true;
    }
    if (kind === 'create') {
      storeName(v('leaderName').trim());
      run(async (be) => {
        const id = await be.createHunt(input, v('leaderName'), v('pass'));
        creating = false;
        clearDraft('create');
        mine = { s: 'idle' };
        go(id);
      }, 'errDeniedCreate');
    } else if (watched) {
      const id = watched;
      run(async (be) => {
        await be.updateHunt(id, input);
        editing = false;
        clearDraft('edit');
      });
    }
  } else if (kind === 'drive' && watched && driveEdit) {
    const id = watched;
    const edit = driveEdit;
    const input = { name: v('name'), start: v('start'), end: v('end'), area: edit.area };
    validateDrive(input).forEach((f) => badFields.add(f));
    if (badFields.size) {
      formError = badFields.size === 1 && badFields.has('area') ? l('errArea') : l('errFields');
      rerender();
      return true;
    }
    run(async (be) => {
      await be.saveDrive(id, edit.id, input);
      if (driveEdit === edit) driveEdit = null;
      clearDraft('drive');
    });
  } else if (kind === 'join' && watched) {
    const id = watched;
    const role = (form.querySelector<HTMLInputElement>('input[name="role"]:checked')?.value ?? 'hunter') as 'hunter' | 'beater';
    if (!validPersonName(v('pname'))) badFields.add('pname');
    if (!v('pass').trim()) badFields.add('pass');
    if (badFields.size) {
      formError = !validPersonName(v('pname')) ? l('errPersonName') : l('errPass');
      rerender();
      return true;
    }
    storeName(v('pname').trim());
    run(async (be) => {
      await be.join(id, v('pname'), role, v('pass'));
      clearDraft('join');
      mine = { s: 'idle' };
      // The participant list was unreadable before joining; listen again now that we are in.
      membersLoaded = false;
      watchMembers(id);
    }, 'errDeniedJoin');
  }
  return true;
}
