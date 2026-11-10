// Group hunt section (polowanie zbiorowe): my hunts, new hunt, sign-up, hunt page
// with the participant list and the leader's controls. Rendered as a string like
// the other sections; main.ts forwards clicks, input and form submits here.

import { getLang, tt } from './i18n';
import {
  validateHunt,
  validPersonName,
  cleanText,
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
  heartbeatFor,
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
  windFocusTime,
  isLeader as leads,
  isLeaderDevice,
  isDeputy,
  otherLeaderDevices,
} from './hunt';
import { currentInvite, inviteExpiry, inviteLink, leaderPairLink, pairTokenOf, validToken, type Invite } from './invite';
import type { District } from './bdl';
import { fetchDistrictsAtPoint } from './bdl';
import { fold, districtSlug } from './data';
import { createHuntMap, type HuntMap, type PersonInfo, type DriveView, type SightView, type ShotView, type RouteView, type MeetView, type SeatView } from './huntMap';
import {
  spreadRoutes,
  focusDrive,
  standForSeat,
  cleanSeat,
  cleanPhone,
  fmtPhone,
  carcasses as listCarcasses,
  pickupOrder,
  myCarcassKinds,
  mapsLink,
  smsLink,
  msgFor,
  recipients,
  cleanMessage,
  POPUP_MS,
  PRESETS,
  BUZZ,
  CARCASS_KINDS,
  CREW_LIMITS,
  type Pt,
  type Route,
  type Transport,
  type Message,
  type MsgTo,
  type CarcassMark,
  type CarcassKind,
  type Carcass,
  type Carrier,
} from './huntCrew';
import { setGuide, guideCardHtml, guideLine, guideFix, enableCompass, type GuideText, type GuideTarget } from './huntGuide';
import { Sharer } from './huntShare';
import { publicBase, canShare, shareLink, copyText, printPage, saveTextFile, isApp } from './platform';
import { alertUser, vibrate } from './native';
import { openPocket, updatePocket } from './huntPocket';
import { roleIcon, speciesIcon, standIcon } from './huntIcons';
import { standsFromFile, sortStands, parseLatLng, fmtLatLng, nextStandName, STAND_LIMITS, type Stand, type StandKind } from './stands';
import { openReport, closeReport } from './huntSighting';
import { openShotSheet, closeShotSheet } from './huntShot';
import { renderPokot, renderPokotPrint, gameName, outcomeName, groupName, pl, type PokotCtx } from './huntPokot';
import { GAMES, NO_SHOOTER, OUTCOMES, outOfSeason, voivodeshipOf, type Outcome, type Shot, type ShotSpot } from './pokot';
import { firebaseConfig, getBackend, HuntError, type HuntBackend, type Unsubscribe } from './huntBackend';
import { ic } from './icons';

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
  errWrongPass: { pl: 'Nieprawidłowe hasło.', en: 'Wrong passphrase.' },
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
    pl: 'Goście zapisują się tym linkiem albo kodem QR, bez hasła koła. Każdą osobę potwierdzasz na liście uczestników.',
    en: 'Guests sign up with this link or QR code, without the club passphrase. You confirm each person in the participant list.',
  },
  inviteValid: { pl: 'Link działa do', en: 'The link works until' },
  inviteNone: { pl: 'Nie ma aktywnego linku zaproszenia.', en: 'There is no active invitation link.' },
  inviteCreate: { pl: 'Utwórz link zaproszenia', en: 'Create an invitation link' },
  inviteNew: { pl: 'Nowy link', en: 'New link' },
  inviteNewHint: { pl: 'Nowy link lub unieważnienie wyłącza poprzedni link. Osoby już zapisane zostają.', en: 'A new link or revoking turns the old link off. People already signed up stay.' },
  inviteRevoke: { pl: 'Unieważnij link', en: 'Revoke link' },
  inviteRevokeSure: { pl: 'Tak, unieważnij', en: 'Yes, revoke' },
  qrShow: { pl: 'Kod QR', en: 'QR code' },
  qrHide: { pl: 'Ukryj kod QR', en: 'Hide QR code' },
  qrHint: { pl: 'Zeskanuj aparatem telefonu.', en: 'Scan with a phone camera.' },
  leadTitle: { pl: 'Prowadzenie z telefonu', en: 'Run the hunt from your phone' },
  leadHint: {
    pl: 'Przygotuj polowanie tutaj, a prowadź je z telefonu: zeskanuj kod aparatem telefonu i potwierdź. Telefon dostanie prawa prowadzącego i to on będzie prowadzącym na mapie (pozycja, strzały). To urządzenie zachowa prawa, np. do pokotu i PDF po polowaniu.',
    en: 'Set the hunt up here and run it from your phone: scan the code with the phone camera and confirm. The phone gets the leader’s rights and becomes the leader on the map (position, shots). This device keeps its rights, e.g. for the results and PDF afterwards.',
  },
  leadCode: { pl: 'Pokaż kod QR dla telefonu', en: 'Show a QR code for the phone' },
  leadCodeValid: { pl: 'Kod jednorazowy, ważny do', en: 'One-time code, valid until' },
  leadCodeExpired: { pl: 'Kod wygasł.', en: 'The code has expired.' },
  leadCodeCancel: { pl: 'Anuluj kod', en: 'Cancel the code' },
  leadPaired: { pl: 'Telefon sparowany. Prowadzi polowanie w terenie, a to urządzenie zachowało prawa.', en: 'Phone paired. It now leads in the field; this device kept its rights.' },
  leadMoved: { pl: 'To urządzenie jest teraz prowadzącym w terenie.', en: 'This device is now the leader in the field.' },
  leadDevices: { pl: 'Urządzenia prowadzącego', en: 'Leader’s devices' },
  leadThis: { pl: 'To urządzenie', en: 'This device' },
  leadOther: { pl: 'Inne urządzenie', en: 'Another device' },
  leadField: { pl: 'w terenie', en: 'in the field' },
  leadTake: { pl: 'To urządzenie jest w terenie', en: 'This device is in the field' },
  leadTakeHint: { pl: 'Przenosi prowadzącego na mapie, w pokocie i na liście uczestników na to urządzenie.', en: 'Moves the leader on the map, in the results and in the participant list to this device.' },
  remoteLead: {
    pl: 'Prowadzisz to polowanie z tego urządzenia. Prowadzącym w terenie (pozycja na mapie, strzały) jest drugie urządzenie.',
    en: 'You run this hunt from this device. Another device is the leader in the field (position on the map, shots).',
  },
  deputies: { pl: 'Zastępcy prowadzącego', en: 'Deputy leaders' },
  deputyHint: {
    pl: 'Zastępca ma te same prawa co prowadzący, np. gdy telefon prowadzącego się rozładuje. Dodasz go przyciskiem „+ zastępca” na liście uczestników.',
    en: 'A deputy has the same rights as the leader, e.g. if the leader’s phone runs flat. Add one with “+ deputy” in the participant list.',
  },
  deputyMake: { pl: '+ zastępca', en: '+ deputy' },
  deputyDrop: { pl: 'Odbierz zastępstwo', en: 'Remove as deputy' },
  deputyBadge: { pl: 'zastępca', en: 'deputy' },
  deputyYou: { pl: 'Jesteś zastępcą prowadzącego: masz te same prawa co prowadzący.', en: 'You are a deputy leader: you have the same rights as the leader.' },
  pairTitle: { pl: 'Prowadzenie polowania na tym urządzeniu', en: 'Run this hunt on this device' },
  pairAsk: {
    pl: 'To urządzenie dostanie prawa prowadzącego i będzie prowadzącym na mapie. Urządzenie, na którym przygotowano polowanie, zachowa swoje prawa.',
    en: 'This device gets the leader’s rights and becomes the leader on the map. The device the hunt was set up on keeps its rights.',
  },
  pairOk: { pl: 'Potwierdź', en: 'Confirm' },
  errPair: { pl: 'Kod wygasł albo został już użyty. Pokaż nowy kod na komputerze i zeskanuj go jeszcze raz.', en: 'The code has expired or was already used. Show a new code on the computer and scan it again.' },
  clubLink: { pl: 'Link dla członków koła (zapis z hasłem koła)', en: 'Link for club members (sign-up with the club passphrase)' },
  guestTitle: { pl: 'Zaproszenie na polowanie', en: 'Invitation to the hunt' },
  guestHint: {
    pl: 'Masz link zaproszenia, więc hasło koła nie jest potrzebne. Po zapisie prowadzący potwierdzi Twój udział.',
    en: 'You have an invitation link, so no club passphrase is needed. After you sign up, the hunt leader confirms you.',
  },
  errInvite: {
    pl: 'Ten link zaproszenia wygasł albo został unieważniony. Poproś prowadzącego o nowy link albo zapisz się hasłem koła.',
    en: 'This invitation link has expired or was revoked. Ask the hunt leader for a new link, or sign up with the club passphrase.',
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
  districtHere: { pl: 'Obwód, w którym jestem', en: 'District I am in' },
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
  shareInBackground: {
    pl: 'Możesz zgasić ekran i schować telefon: aplikacja wysyła położenie w tle, dopóki widać jej powiadomienie.',
    en: 'You can lock the screen and pocket the phone: the app keeps sending your position while its notification is shown.',
  },
  shareNotifTitle: { pl: 'Polowanie: udostępniasz położenie', en: 'Polowanie: sharing your location' },
  shareNotifText: { pl: 'Widzą je uczestnicy polowania. Dotknij, aby otworzyć mapę.', en: 'Hunt participants can see it. Tap to open the map.' },
  shareDeniedApp: {
    pl: 'Aplikacja nie ma dostępu do lokalizacji. Zezwól na nią w ustawieniach telefonu (Aplikacje → Polowanie → Uprawnienia → Lokalizacja) i spróbuj ponownie.',
    en: 'The app has no access to your location. Allow it in the phone settings (Apps → Polowanie → Permissions → Location) and try again.',
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
  saveOffline: { pl: 'Zapisz mapę offline', en: 'Save map offline' },
  exportGpx: { pl: 'Pobierz ślady (GPX)', en: 'Download tracks (GPX)' },
  exportEmpty: { pl: 'Brak śladów do pobrania.', en: 'No tracks to download.' },
  lOsm: { pl: 'Mapa (OSM)', en: 'Map (OSM)' },
  lTopo: { pl: 'Topograficzna (OpenTopoMap)', en: 'Topographic (OpenTopoMap)' },
  lGeoTopo: { pl: 'Topograficzna (Geoportal, offline)', en: 'Topographic (Geoportal, offline)' },
  lSat: { pl: 'Ortofotomapa (Geoportal, offline)', en: 'Aerial photo (Geoportal, offline)' },
  lDistricts: { pl: 'Obwody łowieckie', en: 'Hunting districts' },
  lCompartments: { pl: 'Oddziały leśne', en: 'Forest compartments' },
  lWindArrows: { pl: 'Strzałki wiatru', en: 'Wind arrows' },
  stands: { pl: 'Zwyżki i ambony', en: 'High seats' },
  stZwyzka: { pl: 'Zwyżka', en: 'Open high seat (zwyżka)' },
  stAmbona: { pl: 'Ambona', en: 'Closed high seat (ambona)' },
  stBroken: { pl: 'powalona / uszkodzona', en: 'fallen / damaged' },
  stNone: { pl: 'Prowadzący nie wczytał zwyżek.', en: 'The leader has not loaded any high seats.' },
  stNoneLeader: {
    pl: 'Wczytaj plik KMZ lub KML z zwyżkami i ambonami koła (np. z Google Earth lub Moich Map). Zobaczą je tylko potwierdzeni uczestnicy tego polowania.',
    en: "Load a KMZ or KML file with the club's high seats (e.g. from Google Earth or My Maps). Only confirmed participants of this hunt will see them.",
  },
  stClubNote: { pl: 'Stałe zwyżki koła', en: "The club's permanent seats" },
  stHuntNote: { pl: 'Wczytane tylko do tego polowania', en: 'Loaded for this hunt only' },
  stOther: { pl: 'Inne dla tego polowania', en: 'Other seats for this hunt' },
  stSaveClub: { pl: 'Zapisz jako zwyżki koła', en: "Save as the club's seats" },
  stSaveClubSure: { pl: 'Zastąpić zwyżki koła tymi?', en: "Replace the club's seats with these?" },
  stClubSaved: { pl: 'Zapisano zwyżki koła:', en: "Club's seats saved:" },
  stLocked: { pl: 'Zwyżki koła są ukryte na tym urządzeniu. Wpisz hasło koła, aby je pokazać.', en: "The club's seats are hidden on this device. Enter the hunt passphrase to show them." },
  stUnlock: { pl: 'Pokaż', en: 'Show' },
  stEdit: { pl: 'Edytuj', en: 'Edit' },
  stEditClub: { pl: 'Edytujesz zwyżki koła (widoczne we wszystkich polowaniach).', en: "You are editing the club's seats (shown in every hunt)." },
  stEditHunt: { pl: 'Edytujesz zwyżki tylko tego polowania.', en: "You are editing this hunt's own seats." },
  stEditHint: {
    pl: 'Dotknij mapy, aby dodać zwyżkę. Dotknij znacznika, aby go zmienić; przeciągnij, aby przesunąć.',
    en: 'Tap the map to add a seat. Tap a marker to change it; drag it to move it.',
  },
  stName: { pl: 'Nazwa', en: 'Name' },
  stKind: { pl: 'Rodzaj', en: 'Type' },
  stPos: { pl: 'Położenie (szer., dł.)', en: 'Position (lat, lng)' },
  stBrokenBox: { pl: 'Powalona / uszkodzona', en: 'Fallen / damaged' },
  stDelete: { pl: 'Usuń tę', en: 'Delete this one' },
  stDone: { pl: 'Gotowe', en: 'Done' },
  stAddHere: { pl: 'Dodaj w mojej lokalizacji', en: 'Add at my location' },
  stSave: { pl: 'Zapisz zmiany', en: 'Save changes' },
  stSaved: { pl: 'Zapisano zwyżki.', en: 'Seats saved.' },
  stErrName: { pl: 'Każda zwyżka musi mieć nazwę.', en: 'Every seat needs a name.' },
  stErrLocate: { pl: 'Nie udało się ustalić lokalizacji.', en: 'Could not get your location.' },
  stLoad: { pl: 'Wczytaj z pliku KMZ/KML', en: 'Load from a KMZ/KML file' },
  stReplace: { pl: 'Zastąp z pliku', en: 'Replace from a file' },
  stReuse: { pl: 'Wczytaj ponownie', en: 'Load again' },
  stClear: { pl: 'Usuń z polowania', en: 'Remove from hunt' },
  stClearSure: { pl: 'Na pewno usunąć wszystkie?', en: 'Remove them all?' },
  stLoaded: { pl: 'Wczytano zwyżki i ambony:', en: 'High seats loaded:' },
  stCut: { pl: 'Wczytano tylko pierwsze', en: 'Only the first ones were loaded:' },
  stErrFile: { pl: 'Nie udało się odczytać pliku. Wybierz plik .kmz lub .kml.', en: 'Could not read the file. Choose a .kmz or .kml file.' },
  stErrEmpty: { pl: 'W pliku nie ma żadnych punktów.', en: 'The file has no points.' },
  lStands: { pl: 'Zwyżki i ambony', en: 'High seats' },
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
  dUndo: { pl: 'Cofnij narożnik', en: 'Undo corner' },
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
  shot: { pl: 'Strzał', en: 'Shot' },
  shotHint: { pl: 'Zapisz oddany strzał', en: 'Log a shot you fired' },
  shotTitle: { pl: 'Strzał zapisany. Efekt?', en: 'Shot logged. Result?' },
  shotLater: { pl: 'Uzupełnię później', en: 'Fill in later' },
  shotGameKill: { pl: 'Co leży?', en: 'What is down?' },
  shotGameWound: { pl: 'Co postrzelone?', en: 'What was wounded?' },
  shotUnknownGame: { pl: 'Nie wiem', en: 'Not sure' },
  shotSaved: { pl: 'Strzał zapisany', en: 'Shot logged' },
  shotWoundAlert: { pl: 'Postrzał', en: 'Wounded game' },
  fPhone: { pl: 'Telefon (opcjonalnie)', en: 'Phone (optional)' },
  fPhoneHint: { pl: 'Zobaczą go tylko potwierdzeni uczestnicy tego polowania, przez 7 dni po jego końcu.', en: 'Only confirmed participants of this hunt see it, until 7 days after it ends.' },
  errPhone: { pl: 'Nieprawidłowy numer telefonu (9–15 cyfr).', en: 'Invalid phone number (9–15 digits).' },
  phone: { pl: 'Telefon', en: 'Phone' },
  phoneNone: { pl: 'nie podano', en: 'not given' },
  phoneEdit: { pl: 'Zmień', en: 'Change' },
  phoneAdd: { pl: 'Dodaj numer', en: 'Add number' },
  phoneSave: { pl: 'Zapisz', en: 'Save' },
  phoneDel: { pl: 'Usuń numer', en: 'Remove number' },
  call: { pl: 'Zadzwoń', en: 'Call' },
  meet: { pl: 'Zbiórka na mapie', en: 'Meeting point on the map' },
  meetSet: { pl: 'Wskaż zbiórkę na mapie', en: 'Mark the meeting point on the map' },
  meetMove: { pl: 'Przesuń zbiórkę', en: 'Move the meeting point' },
  meetClear: { pl: 'Usuń z mapy', en: 'Remove from map' },
  meetPick: { pl: 'Dotknij mapy w miejscu zbiórki.', en: 'Tap the map where everyone meets.' },
  navigate: { pl: 'Nawiguj', en: 'Navigate' },
  navigateMeet: { pl: 'Nawiguj na zbiórkę', en: 'Navigate to the meeting point' },
  meetLabel: { pl: 'Zbiórka', en: 'Meeting point' },
  meetAfter: { pl: 'Zbiórka po miocie', en: 'Meeting point after the drive' },
  pickCancel: { pl: 'Anuluj wskazywanie', en: 'Cancel' },
  routes: { pl: 'Trasy', en: 'Routes' },
  routesTitle: { pl: 'Trasy naganiaczy', en: 'Beater routes' },
  routeNone: { pl: 'brak trasy', en: 'no route' },
  routePts: { pl: 'pkt', en: 'pts' },
  routeHint: {
    pl: 'Wybierz naganiacza i stukaj mapę: pierwszy punkt to start, ostatni to koniec trasy. Punkty można przeciągać.',
    en: 'Pick a beater and tap the map: the first point is the start, the last one the end. Points can be dragged.',
  },
  routeSpread: { pl: 'Rozłóż tyralierę', en: 'Spread the line' },
  routeSpreadHint: {
    pl: 'Zaznacz naganiaczy, potem stuknij 2 końce linii startu i 2 końce linii końca. Trasy rozłożą się równo.',
    en: 'Tick the beaters, then tap both ends of the start line and both ends of the end line. Routes are spread evenly.',
  },
  routeSpreadStep: { pl: 'Punkt', en: 'Point' },
  routeSpreadStart: { pl: 'linia startu', en: 'start line' },
  routeSpreadEnd: { pl: 'linia końca', en: 'end line' },
  routeSpreadNone: { pl: 'Zaznacz co najmniej jednego naganiacza.', en: 'Tick at least one beater.' },
  routeMeet: { pl: 'Zbiórka po miocie', en: 'Meeting point after' },
  routeMeetHint: { pl: 'Dotknij mapy w miejscu zbiórki po tym miocie.', en: 'Tap the map where everyone meets after this drive.' },
  routeMeetClear: { pl: 'Usuń zbiórkę po miocie', en: 'Remove the meeting point' },
  routeUndo: { pl: 'Cofnij punkt', en: 'Undo point' },
  routeDel: { pl: 'Usuń trasę', en: 'Delete route' },
  routeSave: { pl: 'Zapisz trasy', en: 'Save routes' },
  routeSaved: { pl: 'Zapisano trasy.', en: 'Routes saved.' },
  routeNoBeaters: { pl: 'Na polowanie nie zapisał się jeszcze żaden naganiacz.', en: 'No beaters have signed up yet.' },
  routeMine: { pl: 'Twoja trasa', en: 'Your route' },
  routeGuide: { pl: 'Prowadź mnie', en: 'Guide me' },
  gToStart: { pl: 'Idź na start trasy', en: 'Go to the start of your route' },
  gOnRoute: { pl: 'Na trasie · do końca', en: 'On your route · to the end:' },
  gOffL: { pl: 'w lewo od trasy, wróć', en: 'left of your route, go back' },
  gOffR: { pl: 'w prawo od trasy, wróć', en: 'right of your route, go back' },
  gOff: { pl: 'od trasy, wróć', en: 'off your route, go back' },
  gNearEnd: { pl: 'Uwaga: linia myśliwych za', en: "Careful: the hunters' line in" },
  gArrived: { pl: 'Koniec trasy', en: 'End of your route' },
  gPointArrived: { pl: 'Jesteś na miejscu', en: 'You are there' },
  gPointGo: { pl: 'Idź za strzałką', en: 'Follow the arrow' },
  gNoFix: { pl: 'Czekam na GPS…', en: 'Waiting for GPS…' },
  gNoCompass: { pl: 'Bez kompasu strzałka pokazuje kierunek względem północy (góra = N).', en: 'Without a compass the arrow is relative to north (up = N).' },
  gCompassOn: { pl: 'Włącz kompas', en: 'Turn on the compass' },
  gOffBtn: { pl: 'Wyłącz', en: 'Turn off' },
  gToCarcass: { pl: 'Do tuszy', en: 'To the carcass' },
  seat: { pl: 'Stanowisko', en: 'Stand' },
  seatMine: { pl: 'Twoje stanowisko', en: 'Your stand' },
  seatIn: { pl: 'w miocie', en: 'in drive' },
  seatHint: { pl: 'Wpisz numer z wylosowanej kartki albo wybierz zwyżkę.', en: 'Enter the number from your lottery card or pick a seat.' },
  seatPh: { pl: 'np. 9A', en: 'e.g. 9A' },
  seatSave: { pl: 'Zapisz', en: 'Save' },
  seatChange: { pl: 'Zmień', en: 'Change' },
  seats: { pl: 'Stanowiska myśliwych', en: "Hunters' stands" },
  seatsMissing: { pl: 'bez stanowiska', en: 'without a stand' },
  seatsSave: { pl: 'Zapisz stanowiska', en: 'Save stands' },
  seatsSaved: { pl: 'Zapisano stanowiska.', en: 'Stands saved.' },
  seatNoDrive: { pl: 'Stanowiska wpisuje się do miotu; dodaj najpierw mioty.', en: 'Stands are entered per drive; add the drives first.' },
  transport: { pl: 'Transport tusz', en: 'Carcass transport' },
  tr_boar: { pl: 'Dziki', en: 'Wild boar' },
  tr_deer: { pl: 'Zwierzyna płowa', en: 'Deer' },
  trNone: { pl: 'nie wyznaczono', en: 'nobody yet' },
  trEdit: { pl: 'Wyznacz', en: 'Assign' },
  trNobody: { pl: '— nikt —', en: '— nobody —' },
  trOutside: { pl: 'Osoba spoza aplikacji…', en: 'Someone outside the app…' },
  trName: { pl: 'Imię i nazwisko', en: 'Name' },
  trSaved: { pl: 'Zapisano transport.', en: 'Transport saved.' },
  trYou: { pl: 'Zbierasz tusze:', en: 'You collect:' },
  trErr: { pl: 'Podaj imię i poprawny numer telefonu osoby spoza aplikacji.', en: 'Enter the name and a valid phone number of the person outside the app.' },
  carcasses: { pl: 'Tusze do zabrania', en: 'Carcasses to collect' },
  cNone: { pl: 'Brak tusz do zabrania.', en: 'No carcasses to collect.' },
  cWait: { pl: 'po zakończeniu miotu', en: 'after the drive ends' },
  cPicked: { pl: 'zabrana', en: 'collected' },
  cPick: { pl: 'Zabrane', en: 'Collected' },
  cUnpick: { pl: 'Cofnij', en: 'Undo' },
  cHere: { pl: 'Leży tutaj', en: 'It lies here' },
  cOnMap: { pl: 'Wskaż na mapie', en: 'Mark on the map' },
  cPickHint: { pl: 'Dotknij mapy tam, gdzie leży tusza.', en: 'Tap the map where the carcass lies.' },
  cShow: { pl: 'Mapa', en: 'Map' },
  cNoPos: { pl: 'miejsce nieznane', en: 'location unknown' },
  cSrcSeat: { pl: 'stanowisko strzelca', en: "shooter's stand" },
  cSms: { pl: 'SMS z listą', en: 'Text the list' },
  cAlert: { pl: 'Do zabrania', en: 'To collect' },
  cSmsHead: { pl: 'Tusze do zabrania', en: 'Carcasses to collect' },
  messages: { pl: 'Wiadomości', en: 'Messages' },
  msgFromLeader: { pl: 'Wiadomość od prowadzącego', en: 'Message from the hunt leader' },
  msgTo: { pl: 'Do', en: 'To' },
  to_all: { pl: 'Wszyscy', en: 'Everyone' },
  to_hunter: { pl: 'Myśliwi', en: 'Hunters' },
  to_beater: { pl: 'Naganiacze', en: 'Beaters' },
  to_transport: { pl: 'Transport tusz', en: 'Carcass transport' },
  msgText: { pl: 'Treść', en: 'Text' },
  msgSend: { pl: 'Wyślij', en: 'Send' },
  msgSent: { pl: 'Wysłano wiadomość.', en: 'Message sent.' },
  msgAck: { pl: 'Przyjąłem', en: 'Got it' },
  msgLater: { pl: 'Później', en: 'Later' },
  msgAcked: { pl: 'przyjęte', en: 'received' },
  msgNone: { pl: 'Brak wiadomości.', en: 'No messages.' },
  msgWaiting: { pl: 'nie potwierdzili:', en: 'not confirmed yet:' },
  msgDel: { pl: 'Usuń', en: 'Delete' },
  msgHint: {
    pl: 'Wiadomość dotrze do telefonów z otwartą aplikacją (także w trybie kieszeni). Nie zastępuje sygnałów rogiem ani radia.',
    en: 'Messages reach phones with the app open (pocket mode too). They do not replace horn signals or radio.',
  },
  msgEmpty: { pl: 'Wpisz treść wiadomości.', en: 'Type the message.' },
  // hunt page tabs and field mode
  tabField: { pl: 'Teren', en: 'Field' },
  tabInfo: { pl: 'Informacje', en: 'Details' },
  tabPeople: { pl: 'Uczestnicy', en: 'People' },
  tabPokot: { pl: 'Pokot', en: 'Bag' },
  huntTabs: { pl: 'Części polowania', en: 'Parts of the hunt' },
  fmOn: { pl: 'Tryb terenowy', en: 'Field mode' },
  fmHint: { pl: 'Mapa na cały ekran i duże przyciski. Na czas miotu.', en: 'Full-screen map and big buttons. For the drive.' },
  fmExit: { pl: 'Wyjdź z trybu terenowego', en: 'Leave field mode' },
  fmSeat: { pl: 'Stanowisko', en: 'Stand' },
  fmRoute: { pl: 'Trasa', en: 'Route' },
  fmRouteSet: { pl: 'wyznaczona', en: 'set' },
  fmDrive: { pl: 'Miot', en: 'Drive' },
  fmLoc: { pl: 'Lokalizacja', en: 'Location' },
  fmLocOn: { pl: 'wysyłana', en: 'sharing' },
  fmLocStarting: { pl: 'łączenie…', en: 'starting…' },
  fmLocOff: { pl: 'wyłączona', en: 'off' },
  fmShareAsk: {
    pl: 'Nie udostępniasz położenia: prowadzący i inni uczestnicy nie widzą Cię na mapie.',
    en: 'You are not sharing your location: the leader and the others cannot see you on the map.',
  },
  fmNear: { pl: 'Sąsiednie stanowiska', en: 'Neighbouring stands' },
  fmClose: { pl: 'Zamknij', en: 'Close' },
  fmPocket: { pl: 'Kieszeń', en: 'Pocket' },
  fmPendingPokot: { pl: 'Pokot zobaczysz, gdy prowadzący potwierdzi Twój udział.', en: 'You will see the bag once the leader confirms you.' },
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
let copied: string | null = null;
/** Invitation token from the link this hunt was opened with (dropped once it is refused). */
let guestToken: { id: string; token: string } | null = null;
/** Tokens the database refused, so the link in the address bar does not bring the guest form back. */
const refusedTokens = new Set<string>();
/** Pairing code from the link this phone opened (`lead.<token>`), until used or refused. */
let pairToken: { id: string; token: string } | null = null;
/** The code this leader device shows for pairing another one, and the devices there were then. */
let pairCode: { id: string; token: string; exp: number; before: string } | null = null;
/** Shown once after a successful pairing. */
let pairedNote: string | null = null;
/** The "run from your phone" box opened or closed by hand (null: by default). */
let leadOpen: boolean | null = null;
/** The leader's invitation links: null until loaded. */
let invites: Invite[] | null = null;
let invitesFor: string | null = null;
let qrOpen = false;
/** QR code SVG for one link, made on demand (the generator is loaded lazily). */
let qr: { url: string; svg: string } | null = null;
/** Text typed into forms, kept across re-renders caused by live updates. */
const draft = new Map<string, string>();

/** Supplied by main.ts: the BDL district list, null while loading, or an error. */
export interface HuntContext {
  onChange: () => void;
  go: (id: string | null) => void;
  districts: () => { list: District[] | null; error: string };
  /** Opens "Save for offline" for the hunt's district. */
  saveOffline?: (d: HuntDistrict) => void;
}
let saveOfflineCb: HuntContext['saveOffline'];
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
let toast: { text: string; until: number; undo?: string; undoKind: 'sight' | 'shot' } | null = null;
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
let stands: Stand[] = [];
let standsUnsub: Unsubscribe | null = null;
/** The club's permanent seats; a hunt's own seats (stands) replace them. */
let clubStands: Stand[] = [];
let clubUnsub: Unsubscribe | null = null;
/** This device never gave the passphrase, so the club's seats are unreadable. */
let clubDenied = false;
const shownStands = () => (stands.length ? stands : clubStands);
/** Seats being edited: a copy of the shown ones, saved back to the club's or this hunt's list. */
let standEdit: { target: 'club' | 'hunt'; list: Stand[]; sel: number | null; dirty: boolean } | null = null;
let locatingStand = false;
/** Put the seats on the map: the edit copy while editing, else the shown ones. */
function drawStands() {
  if (!hmap) return;
  const e = standEdit;
  if (!e) return hmap.setStands(shownStands());
  hmap.setStands(e.list, {
    sel: e.sel,
    onSelect: (i) => {
      e.sel = i;
      rerender();
    },
    onMove: (i, lat, lng) => {
      Object.assign(e.list[i], { lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
      e.sel = i;
      e.dirty = true;
      rerender();
    },
    onAdd: addStandAt,
  });
}
function addStandAt(lat: number, lng: number) {
  const e = standEdit;
  if (!e || e.list.length >= STAND_LIMITS.stands) return;
  e.list.push({ name: nextStandName(e.list), kind: 'zwyzka', broken: false, lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  e.sel = e.list.length - 1;
  e.dirty = true;
  rerender();
  setTimeout(() => document.querySelector<HTMLInputElement>('[data-stand-field="name"]')?.select(), 0);
}
function watchClub() {
  if (conn.s !== 'ready') return;
  clubUnsub?.();
  clubDenied = false;
  clubUnsub = conn.be.watchClubStands(
    (ss) => {
      clubStands = ss;
      drawStands();
      rerender();
    },
    () => {
      clubUnsub = null;
      // A confirmed participant without the passphrase (an invited guest) may still see the seats of this hunt's club.
      const id = watched;
      const me = members?.find((p) => p.uid === myUid());
      if (id && me?.status === 'confirmed' && clubGuestTried !== id && conn.s === 'ready') {
        clubGuestTried = id;
        conn.be.clubGuest(id).then(watchClub, () => {
          clubDenied = true;
          rerender();
        });
        return;
      }
      clubDenied = true;
      rerender();
    },
  );
}
/** The hunt for which this device last asked to see the club's seats as a guest. */
let clubGuestTried: string | null = null;
let standListOpen: boolean | null = null;
const STANDS_KEY = 'huntStandsLast';
/** The leader's last loaded file, offered again in the next hunt. */
function lastStands(): { file: string; stands: Stand[] } | null {
  try {
    const v = JSON.parse(localStorage.getItem(STANDS_KEY) ?? 'null');
    return v && typeof v.file === 'string' && Array.isArray(v.stands) && v.stands.length ? v : null;
  } catch {
    return null;
  }
}
function rememberStands(file: string, ss: Stand[]) {
  try {
    localStorage.setItem(STANDS_KEY, JSON.stringify({ file, stands: ss }));
  } catch {
    /* storage unavailable */
  }
}
let purged = new Set<string>();
let shots: Shot[] = [];
let shotSpots = new Map<string, ShotSpot>();
let shotsUnsub: Unsubscribe | null = null;
let spotsUnsub: Unsubscribe | null = null;
/** Shot ids already announced as wounded (postrzał), null until the first load. */
let seenWounds: Set<string> | null = null;
/** Pokot row being edited: a shot id, 'new' (leader adds game) or `del:<id>`. */
let shotEdit: string | null = null;
let pokotError = '';

// ---- crew planning: routes, stands, phones, transport, messages, carcasses
let routes = new Map<string, Map<string, Route>>();
let seats = new Map<string, Map<string, string>>();
let phones = new Map<string, string>();
let transport: Transport = {};
let messages: Message[] = [];
let acks = new Map<string, Map<string, number>>();
let marks = new Map<string, CarcassMark>();
let crewUnsubs: Unsubscribe[] = [];
/** Messages already seen (popped up or there at the first load), so only new ones buzz. */
let seenMsgs: Set<string> | null = null;
/** Messages closed on this device without acknowledging (the sheet does not come back). */
const shelvedMsgs = new Set<string>();
/** Ready carcasses already announced to me as a carrier; null until the first check. */
let seenCarcasses: Set<string> | null = null;
/** The leader's route editor for one drive. */
let routeEdit: {
  driveId: string;
  routes: Map<string, Route>;
  sel: string | null;
  mode: 'route' | 'spread' | 'meet';
  spread: Pt[];
  spreadUids: Set<string>;
  meet: Pt | null;
  dirty: boolean;
} | null = null;
/** Picking a point on the map for the hunt's meeting point or a carcass. */
let pickMode: { kind: 'huntMeet' } | { kind: 'carcass'; shotId: string } | null = null;
/** Drive whose route guidance I turned off; carcass I asked to be guided to. */
let guideDismissed: string | null = null;
let guideCarcass: string | null = null;
let transportEdit = false;
let phoneEdit = false;
let seatEdit = false;
const SHARE_KEY = 'huntSharing';

const NAME_KEY = 'huntPersonName';
// ---- the hunt page: four tabs, and the full-screen field mode for the drive
type HTab = 'field' | 'info' | 'people' | 'pokot';
let htab: HTab = 'field';
type FieldPanel = 'msgs' | 'people' | 'drives' | 'pokot';
/** Field mode: the map fills the screen, with the few things needed during a drive around it. */
let fieldMode = false;
/** What is pulled up over the map in field mode. */
let fieldPanel: FieldPanel | null = null;
let fieldPanelScroll = 0;
const FIELD_KEY = 'huntFieldMode';
/** Field mode is remembered for the hunt, so it comes back after the phone reloads the page. */
function setFieldMode(on: boolean) {
  fieldMode = on;
  fieldPanel = null;
  fieldPanelScroll = 0;
  try {
    if (on && watched) localStorage.setItem(FIELD_KEY, watched);
    else localStorage.removeItem(FIELD_KEY);
  } catch {
    /* no storage: it lasts until the page is closed */
  }
}
const rememberedField = (): string | null => {
  try {
    return localStorage.getItem(FIELD_KEY);
  } catch {
    return null;
  }
};
/** True while the field-mode screen is what the person sees (Android's back button closes it first). */
export function huntBack(): boolean {
  if (!fieldMode || !document.querySelector('.hf')) return false;
  if (fieldPanel) fieldPanel = null;
  else setFieldMode(false);
  rerender();
  return true;
}
/** These actions point at something on the map, so whatever covers it steps aside. */
const MAP_ACTIONS = new Set(['carcassShow', 'carcassPick', 'carcassGuide', 'sightShow', 'standShow', 'meetPick', 'centerMe', 'fitAll']);

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
  standsUnsub?.();
  standsUnsub = null;
  stands = [];
  clubUnsub?.();
  clubUnsub = null;
  clubStands = [];
  clubDenied = false;
  standEdit = null;
  standListOpen = null;
  sightUnsub?.();
  sightUnsub = null;
  shotsUnsub?.();
  shotsUnsub = null;
  spotsUnsub?.();
  spotsUnsub = null;
  shots = [];
  shotSpots = new Map();
  seenWounds = null;
  crewUnsubs.forEach((u) => u());
  crewUnsubs = [];
  routes = new Map();
  seats = new Map();
  phones = new Map();
  transport = {};
  messages = [];
  acks = new Map();
  marks = new Map();
  seenMsgs = null;
  seenCarcasses = null;
  routeEdit = null;
  pickMode = null;
  guideDismissed = null;
  guideCarcass = null;
  transportEdit = false;
  seatEdit = false;
  closeMsgSheet();
  setGuide(null, guideText(), () => {});
  shotEdit = null;
  closeShotSheet();
  closePokotPrint();
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
  const allowed = !!(id && hunt && ((me && me.status === 'confirmed') || remoteLead()));
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
    standsUnsub = conn.be.watchStands(
      id!,
      (ss) => {
        stands = ss;
        drawStands();
        rerender();
      },
      () => (standsUnsub = null),
    );
    watchClub();
    sightUnsub = conn.be.watchSightings(id!, onSightings, () => (sightUnsub = null));
    shotsUnsub = conn.be.watchShots(id!, onShots, () => (shotsUnsub = null));
    spotsUnsub = conn.be.watchShotSpots(
      id!,
      (m) => {
        shotSpots = m;
        drawShots();
      },
      () => (spotsUnsub = null),
    );
    const be = conn.be;
    crewUnsubs = [
      be.watchRoutes(id!, (r) => {
        routes = r;
        drawCrew();
        syncGuide();
        rerender();
      }, () => {}),
      be.watchSeats(id!, (x) => {
        seats = x;
        drawCrew();
        rerender();
      }, () => {}),
      be.watchPhones(id!, (x) => {
        phones = x;
        rerender();
      }, () => {}),
      be.watchTransport(id!, (t) => {
        transport = t;
        checkCarcasses();
        rerender();
      }, () => {}),
      be.watchMessages(id!, (ms) => {
        messages = ms;
        onMessages();
      }, () => {}),
      be.watchAcks(id!, (a) => {
        acks = a;
        onMessages();
      }, () => {}),
      be.watchCarcasses(id!, (m) => {
        marks = m;
        drawShots();
        checkCarcasses();
        rerender();
      }, () => {}),
    ];
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
  if (id && hunt && leads(hunt, myUid()) && shouldPurge(hunt, now()) && !purged.has(id) && conn.s === 'ready') {
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
      alertUser(hunt?.name ?? 'Polowanie', text, [300, 150, 300]);
    }
  }
  lastActive = actId;
  if (driveEdit?.id && !drives.some((d) => d.id === driveEdit!.id)) driveEdit = null; // deleted meanwhile
  if (routeEdit && !drives.some((d) => d.id === routeEdit!.driveId)) routeEdit = null;
  drawCrew();
  syncGuide();
  checkCarcasses();
  rerender();
  updatePocket();
}

function showToast(text: string, undo?: string, undoKind: 'sight' | 'shot' = 'sight', ms = 10_000) {
  const t = { text, until: Date.now() + ms, undo, undoKind };
  toast = t;
  rerender();
  setTimeout(() => {
    if (toast === t) {
      toast = null;
      rerender();
    }
  }, ms + 500);
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
      const text = `${sightName(s)} ${l('sightToward')} (${Math.round(distanceM(s, me))} m)`;
      alertUser(hunt?.name ?? 'Polowanie', text, [200, 100, 200, 100, 400]);
      showToast(text);
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
      vibrate(80);
      showToast(`${l('sightSaved')}: ${sightName(r)} → ${compassPoint(r.heading)}`, sid);
    },
  );
}

// ---------------------------------------------------------------- shots and pokot

const shotLabel = (x: Pick<Shot, 'outcome' | 'game'>) => gameName(x.game) || outcomeName(x.outcome);
const personName = (uid: string) => (uid === NO_SHOOTER ? '?' : members?.find((p) => p.uid === uid)?.name ?? '?');

function onShots(ss: Shot[]) {
  shots = ss;
  const wounds = ss.filter((x) => x.outcome === 'wound');
  if (seenWounds) {
    for (const w of wounds) {
      if (seenWounds.has(w.id)) continue;
      seenWounds.add(w.id);
      if (w.uid === myUid()) continue;
      const d = drives.find((x) => x.id === w.driveId);
      const text = `${l('shotWoundAlert')}: ${[gameName(w.game), personName(w.uid), d?.name].filter(Boolean).join(' · ')}`;
      alertUser(hunt?.name ?? 'Polowanie', text, [400, 150, 400]);
      showToast(text);
    }
  } else seenWounds = new Set(wounds.map((w) => w.id));
  if (shotEdit && shotEdit !== 'new' && !ss.some((x) => shotEdit === x.id || shotEdit === `del:${x.id}`)) shotEdit = null;
  checkCarcasses();
  drawShots();
  rerender();
}

function drawShots() {
  if (!hmap) return;
  const views: ShotView[] = [];
  // Big game kills show where the carcass lies (moved by hand, or the shooter's stand), faded once collected.
  const cs = new Map(allCarcasses().map((c) => [c.shotId, c]));
  for (const x of shots) {
    const c = cs.get(x.id);
    const at = c?.at ?? shotSpots.get(x.id);
    if (!at || (x.outcome !== 'wound' && x.outcome !== 'kill')) continue;
    const label = `${shotLabel(x)}${x.outcome === 'wound' ? ` · ${outcomeName('wound')}` : ''}`;
    views.push({
      id: x.id,
      lat: at.lat,
      lng: at.lng,
      kind: x.outcome,
      picked: !!c?.pickedBy,
      label,
      popup: `<strong>${esc(label)}</strong><br>${esc(personName(x.uid))}<br>${esc(clock(x.ts))}${x.note ? `<br>${esc(x.note)}` : ''}${c?.pickedBy ? `<br>${ic('check', 14)} ${esc(l('cPicked'))} · ${esc(personName(c.pickedBy))}` : ''}`,
    });
  }
  hmap.setShots(views);
}

/** Position for a shot: the sharing fix right away, else a fresh fix within a few seconds, else none. */
function shotFix(): Promise<ShotSpot | null> {
  const known = myPos();
  if (sharer?.active && known) return Promise.resolve({ lat: known.lat, lng: known.lng });
  return Promise.race([getFix().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
}

const offSeason = (key: string) => !!hunt && outOfSeason(key, hunt.date, voivodeshipOf(hunt.district?.label));

function fireShot() {
  const id = watched;
  if (!id || conn.s !== 'ready') return;
  const be = conn.be;
  const driveId = activeDrive(drives)?.id ?? null;
  vibrate(60);
  // Log the shot first, so it counts even if the sheet is closed without an answer.
  const logged = shotFix().then((at) => be.addShot(id, { outcome: 'unknown', game: null, note: '', driveId }, at));
  logged.then(
    (sid) => showToast(l('shotSaved'), sid, 'shot', 30_000),
    (e) => {
      closeShotSheet();
      showToast(errText(e));
    },
  );
  openShotSheet(
    {
      title: l('shotTitle'),
      outcomes: { kill: outcomeName('kill'), wound: outcomeName('wound'), miss: outcomeName('miss') },
      later: l('shotLater'),
      gameTitle: (o) => (o === 'wound' ? l('shotGameWound') : l('shotGameKill')),
      groups: { deer: groupName('deer'), other: groupName('other'), pred: groupName('pred'), small: groupName('small'), birds: groupName('birds') },
      game: gameName,
      unknownGame: l('shotUnknownGame'),
      offSeason: pl('offSeason'),
      back: l('sightBack'),
      saving: l('sightSaving'),
    },
    offSeason,
    async (c) => {
      try {
        const sid = await logged;
        await be.updateShot(id, sid, { outcome: c.outcome, game: c.game });
      } catch (e) {
        throw new Error(errText(e));
      }
    },
  );
}

const pokotCtx = (h: Hunt): PokotCtx => ({
  hunt: h,
  shots,
  drives,
  members: members ?? [],
  myUid: myUid(),
  editing: shotEdit,
  busy,
  error: pokotError,
  clock,
  boarAt: new Map(allCarcasses().filter((x) => x.kind === 'boar').map((x) => [x.shotId, { at: x.at, src: x.src }])),
});

let printEl: HTMLElement | null = null;
let titleBefore = '';
const printKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closePokotPrint();
};

function closePokotPrint() {
  if (!printEl) return;
  document.removeEventListener('keydown', printKey);
  printEl.remove();
  printEl = null;
  document.body.classList.remove('pp-printing');
  document.title = titleBefore;
}

/** Full-screen preview of the printable pokot; its button opens the print dialog (Save as PDF). */
function openPokotPrint() {
  const h = hunt;
  if (!h) return;
  closePokotPrint();
  const el = document.createElement('div');
  el.id = 'pp-root';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', pl('pTitle'));
  el.innerHTML = renderPokotPrint(pokotCtx(h), (d) => fmtDate(d));
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pp]');
    if (b?.dataset.pp === 'print') printPage();
    else if (b?.dataset.pp === 'close') closePokotPrint();
  });
  document.body.append(el);
  document.body.classList.add('pp-printing');
  document.addEventListener('keydown', printKey);
  printEl = el;
  // Browsers suggest the PDF file name from the page title.
  titleBefore = document.title;
  document.title = `${h.date} pokot ${h.name}`;
}

function pokotRun(task: (be: HuntBackend) => Promise<void>, after?: () => void) {
  if (conn.s !== 'ready' || busy) return;
  const be = conn.be;
  busy = true;
  pokotError = '';
  rerender();
  task(be).then(
    () => after?.(),
    (e) => (pokotError = errText(e)),
  ).finally(() => {
    busy = false;
    rerender();
  });
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
      layers: { osm: l('lOsm'), topo: l('lTopo'), geotopo: l('lGeoTopo'), sat: l('lSat'), districts: l('lDistricts'), compartments: l('lCompartments'), wind: l('lWindArrows'), stands: l('lStands') },
      standKind: (k) => l(k === 'ambona' ? 'stAmbona' : 'stZwyzka'),
      standBroken: l('stBroken'),
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
  drawStands();
  // Wind for when it matters: the next planned drive, or now while one runs.
  m.setWindTime(hunt && hunt.status !== 'ended' ? windFocusTime(hunt, drives, now()) : null);
  if (driveEdit) m.startDraw(driveEdit.area, onAreaChange, driveEdit.id);
  else m.stopDraw();
  if (scrollToDriveForm) {
    scrollToDriveForm = false;
    document.querySelector('.hd-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  drawPositions();
  drawSightings();
  drawShots();
  drawCrew();
  syncGuide();
  if (showTracks) m.setTracks(lastTracks, people());
  updateLiveText();
  const body = document.querySelector('.hf-panel-body');
  if (body) body.scrollTop = fieldPanelScroll;
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
      void saveTextFile(gpxFileName(h), 'application/gpx+xml', gpx).catch(() => {});
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
  const timer = document.querySelector<HTMLElement>('.hf-timer[data-since]');
  if (timer) timer.textContent = fieldElapsed(+timer.dataset.since!);
  updatePocket();
}

function pocketStatus() {
  const on = !!sharer?.active;
  const sentAgo = sharer?.lastSentAt ? `${l('lastSent')} ${ago(Date.now() - sharer.lastSentAt)}` : '';
  const act = activeDrive(drives);
  const g = guideLine();
  return on
    ? { ok: true, title: g || (sharer!.state === 'on' ? l('shareOn') : l('shareStarting')), detail: [act ? `${l('dNow')}: ${act.name}` : hunt?.name, sentAgo].filter(Boolean).join(' · ') }
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
        try {
          await be.publishPosition(id, fix, track);
        } catch (e) {
          // Refused by the rules: the hunt ended or I was removed. Stop instead of retrying forever.
          if (e instanceof HuntError && e.code === 'denied') throw Object.assign(new Error(l('shareNotLive')), { stop: true });
          throw e;
        }
      },
      heartbeatMs: () => heartbeatFor(members?.find((p) => p.uid === be.uid)?.role ?? 'hunter'),
      clear: () => be.clearPosition(id),
      onChange: () => {
        rerender();
        updatePocket();
      },
      // With the screen off only these fixes arrive, so the beater guidance uses them too.
      onFix: (f) => guideFix({ lat: f.lat, lng: f.lng }, f.acc),
      notification: () => ({ title: l('shareNotifTitle'), text: l('shareNotifText'), stop: l('shareStop') }),
      onStoppedOutside: forgetSharing,
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

/** Leader only: invitation links are unreadable for everyone else. */
function watchInvites(id: string) {
  if (conn.s !== 'ready' || invitesFor === id) return;
  invitesFor = id;
  unsubs.push(
    conn.be.watchInvites(
      id,
      (list) => {
        invites = list;
        rerender();
      },
      () => {
        invites = [];
        rerender();
      },
    ),
  );
}

/** The guest's invitation token for the open hunt, if any. */
const myGuestToken = () => (guestToken && guestToken.id === watched ? guestToken.token : null);

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
  copied = null;
  invites = null;
  invitesFor = null;
  qrOpen = false;
  leadOpen = null;
  pairCode = null;
  pairedNote = null;
  htab = 'field';
  fieldPanel = null;
  fieldPanelScroll = 0;
  fieldMode = !!id && rememberedField() === id;
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

export function renderHunts(id: string | null, invite: string | undefined, ctx: HuntContext): string {
  rerender = ctx.onChange;
  go = ctx.go;
  districtsOf = ctx.districts;
  saveOfflineCb = ctx.saveOffline;
  if (!firebaseConfig()) return `<div class="hunts"><h2>${tt({ pl: 'Polowanie zbiorowe', en: 'Group hunts' })}</h2><div class="notice">${l('notConfigured')}</div></div>`;
  setRoute(id);
  if (id && validToken(invite) && !refusedTokens.has(invite)) guestToken = { id, token: invite };
  const pt = pairTokenOf(invite);
  if (id && pt && !refusedTokens.has(pt)) pairToken = { id, token: pt };
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
              ${statusBadge(h.status)}${conn.s === 'ready' && leads(h, conn.be.uid) ? ` <span class="h-mine">${roleIcon('leader', 14)} ${l('r_leader')}</span>` : ''}
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
      <button type="button" class="btn small ghost" data-hunt="clearDistrict" data-form="${form}" aria-label="${l('districtClear')}">${ic('x', 16)}</button></div></div>`;
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
    <div><button type="button" class="btn small ghost" data-hunt="districtHere" data-form="${form}"${locatingDistrict ? ' disabled aria-busy="true"' : ''}>${ic('locate', 16)} ${l('districtHere')}</button></div>
    <small class="muted">${l('fDistrictHint')}</small></div>`;
}

function renderLive(h: Hunt, me: Participant): string {
  if (me.status !== 'confirmed') return `<div class="notice">${l('unconfirmedMap')}</div>`;
  const remote = remoteLead();
  let share = '';
  if (remote) share = '';
  else if (h.status === 'live') {
    const st = sharer && sharer.huntId === h.id ? sharer.state : 'off';
    if (st === 'on' || st === 'starting')
      share = `<div class="h-share on" role="status"><span class="h-share-dot" aria-hidden="true"></span>
        <div><strong>${st === 'on' ? l('shareOn') : l('shareStarting')}</strong><br><small class="h-share-sent muted"></small>
        <small class="muted">${l(isApp() ? 'shareInBackground' : 'shareKeepOpen')}</small></div>
        <div class="h-share-btns"><button type="button" class="btn" data-hunt="pocket" title="${esc(l('pocketHint'))}">${l('fmPocket')}</button>
        <button type="button" class="btn danger" data-hunt="shareStop">${l('shareStop')}</button></div></div>`;
    else {
      const problem =
        st === 'denied' ? l(isApp() ? 'shareDeniedApp' : 'shareDenied') : st === 'unavailable' ? l('shareUnavailable') : st === 'error' ? `${l('shareStopped')} ${sharer?.error ?? ''}` : '';
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
      ? `<div class="hd-toast" role="alert"><span>${esc(toast.text)}</span>${toast.undo ? `<button type="button" class="btn small" data-hunt="${toast.undoKind === 'shot' ? 'shotUndo' : 'sightUndo'}" data-sid="${esc(toast.undo)}">${l('sightUndo')}</button>` : ''}</div>`
      : '';
  const drawing = !!driveEdit && leads(h, myUid());
  const canShoot = me.role !== 'beater';
  const report =
    h.status === 'live' && !drawing && !remote
      ? `<div class="hs-actions${canShoot ? ' hs-two' : ''}"><button type="button" class="btn hs-report" data-hunt="sightOpen" aria-label="${esc(l('sightReportHint'))}">${speciesIcon('boar', 28)} ${l('sightReport')}</button>${
          canShoot ? `<button type="button" class="btn hs-report hp-fire" data-hunt="shotFire" aria-label="${esc(l('shotHint'))}"><span class="hp-fire-icon" aria-hidden="true">${ic('crosshair', 26)}</span> ${l('shot')}</button>` : ''
        }</div>`
      : '';
  const isLead = leads(h, myUid());
  const planning = !!routeEdit && isLead;
  const picking = pickMode
    ? `<div class="notice hr-pickbar"><span>${l(pickMode.kind === 'huntMeet' ? 'meetPick' : 'cPickHint')}</span><button type="button" class="btn small ghost" data-hunt="pickCancel">${l('pickCancel')}</button></div>`
    : '';
  const mine = drawing || planning || remote ? '' : `${h.status === 'live' ? renderMyRoute(me) : ''}${h.status !== 'ended' ? renderMySeat(me) : ''}`;
  const msgs = isLead ? '' : renderMessages(false, h);
  const enter =
    h.status === 'live' && !remote && !drawing && !planning
      ? `<button type="button" class="hf-enter" data-hunt="fieldOn">${ic('expand', 22)}<span><strong>${l('fmOn')}</strong><small>${l('fmHint')}</small></span>${ic('chevron', 20)}</button>`
      : '';
  // Starting the hunt is the leader's next step on the day, so it is offered here too, not only under "Informacje".
  const start =
    isLead && !drawing && !planning && (h.status === 'open' || h.status === 'closed')
      ? `<div class="h-actions h-startbar"><button type="button" class="btn" data-hunt="status" data-to="live"${btnBusy()}>${l('to_live')}</button></div>`
      : '';
  return `${t}${isLead ? '' : errorBox()}${enter}${start}${mine}${msgs}${report}${share}${renderDrives(h, isLead)}${drawing || planning ? '' : `${isLead ? renderSeatsLeader() : ''}${renderStands(isLead)}`}
    <div class="hm-bar"${drawing ? ' hidden' : ''}><div class="hm-counts">${liveCounts()}</div>
      <div class="hm-tools">
        ${iShare ? `<button type="button" class="btn small ghost" data-hunt="centerMe">${ic('locate', 16)} ${l('centerMe')}</button>` : ''}
        <button type="button" class="btn small ghost" data-hunt="fitAll">${l('fitAll')}</button>
        <button type="button" class="btn small ghost" data-hunt="tracks" aria-pressed="${showTracks}">${showTracks ? l('hideTracks') : l('showTracks')}</button>
        <button type="button" class="btn small ghost" data-hunt="gpx">${ic('download', 16)} ${l('exportGpx')}</button>
        ${h.district && saveOfflineCb ? `<button type="button" class="btn small ghost" data-hunt="saveOffline">${ic('download', 16)} ${l('saveOffline')}</button>` : ''}
      </div></div>
    ${picking}<div class="hm-slot"></div>
    ${drawing || planning ? '' : `${renderCarcasses(isLead)}${isLead ? renderMessages(true, h) : ''}<h4>${l('sightings')}</h4><div class="hs-list">${sightListHtml()}</div>`}`;
}

const fieldElapsed = (since: number) => `${Math.max(0, Math.floor((now() - since) / 60e3))} min`;

/** Who stands on the numbers next to mine in the drive to come ("6 Piotr · 8 Adam"). */
function seatNeighbours(me: Participant): string {
  const d = upcoming();
  const m = d ? seats.get(d.id) : undefined;
  const mineSeat = m?.get(me.uid)?.trim() ?? '';
  if (!m || !/^\d+$/.test(mineSeat)) return '';
  const near = [...m]
    .filter(([u, seat]) => u !== me.uid && /^\d+$/.test(seat.trim()) && Math.abs(+seat - +mineSeat) === 1)
    .sort((a, b) => +a[1] - +b[1])
    .map(([u, seat]) => `<strong>${esc(seat.trim())} ${esc(personName(u))}</strong>`);
  return near.length ? `${l('fmNear')}: ${near.join(' · ')}` : '';
}

/**
 * Field mode: what a hunter or beater needs during a drive and nothing else. The map fills the
 * screen; above it the drive, the stand and whether the position is being sent; below it the
 * big buttons. Lists (people, drives, pokot, messages) pull up over the map and close again.
 */
function renderField(h: Hunt, me: Participant, isLead: boolean): string {
  const act = activeDrive(drives);
  const next = drives.find((d) => driveState(d) === 'planned');
  const title = act ? act.name : next ? `${l('dNext')}: ${next.name}` : h.name;
  const timer = act?.startedAt
    ? `<span class="hf-timer" data-since="${act.startedAt}">${fieldElapsed(act.startedAt)}</span>`
    : next
      ? `<span class="hf-timer">${esc(next.start)}</span>`
      : '';
  const st = sharer && sharer.huntId === h.id ? sharer.state : 'off';
  const sharing = st === 'on' || st === 'starting';
  const d = upcoming();
  const seat = d ? seats.get(d.id)?.get(me.uid) : undefined;
  const route = d ? routes.get(d.id)?.get(me.uid) : undefined;
  const cur = act ?? next;
  const driveNo = cur ? `${drives.indexOf(cur) + 1}/${drives.length}` : drives.length ? `${drives.length}/${drives.length}` : '—';
  const cell = (panel: FieldPanel, label: string, value: string, cls = '') =>
    `<button type="button" data-hunt="fieldPanel" data-panel="${panel}"><small>${label}</small><b class="${cls}">${value}</b></button>`;
  const first = me.role === 'beater' ? cell('drives', l('fmRoute'), route ? l('fmRouteSet') : '—') : cell('drives', l('fmSeat'), seat ? esc(seat) : '—', 'hf-seat');
  const loc = `<div class="hf-loc${sharing ? ' on' : ''}"><small>${l('fmLoc')}</small><b><span class="hf-dot" aria-hidden="true"></span>${l(st === 'on' ? 'fmLocOn' : st === 'starting' ? 'fmLocStarting' : 'fmLocOff')}</b></div>`;
  const problem =
    st === 'denied' ? l(isApp() ? 'shareDeniedApp' : 'shareDenied') : st === 'unavailable' ? l('shareUnavailable') : st === 'error' ? `${l('shareStopped')} ${sharer?.error ?? ''}` : '';
  const ask = sharing
    ? ''
    : `<div class="hf-ask" role="status"><span>${esc(problem || l('fmShareAsk'))}</span><button type="button" class="btn small" data-hunt="shareStart">${l('shareStart')}</button></div>`;
  const t =
    toast && Date.now() < toast.until
      ? `<div class="hd-toast" role="alert"><span>${esc(toast.text)}</span>${toast.undo ? `<button type="button" class="btn small" data-hunt="${toast.undoKind === 'shot' ? 'shotUndo' : 'sightUndo'}" data-sid="${esc(toast.undo)}">${l('sightUndo')}</button>` : ''}</div>`
      : '';
  const picking = pickMode
    ? `<div class="notice hr-pickbar"><span>${l(pickMode.kind === 'huntMeet' ? 'meetPick' : 'cPickHint')}</span><button type="button" class="btn small ghost" data-hunt="pickCancel">${l('pickCancel')}</button></div>`
    : '';
  const canShoot = me.role !== 'beater';
  const unread = isLead ? 0 : myUnacked().length;
  const near = canShoot ? seatNeighbours(me) : '';
  const panelTitle: Record<FieldPanel, string> = { msgs: l('messages'), people: l('participants'), drives: l('drives'), pokot: l('tabPokot') };
  let panel = '';
  if (fieldPanel) {
    fieldPanelScroll = document.querySelector('.hf-panel-body')?.scrollTop ?? fieldPanelScroll;
    const body =
      fieldPanel === 'msgs'
        ? renderMessages(isLead, h) || `<p class="muted">${l('msgNone')}</p>`
        : fieldPanel === 'people'
          ? renderMembers(myUid(), isLead)
          : fieldPanel === 'drives'
            ? `${renderDrives(h, isLead, true)}${isLead ? renderSeatsLeader() : renderMySeat(me)}`
            : `${renderCarcasses(isLead)}${renderPokot(pokotCtx(h))}<h4>${l('sightings')}</h4><div class="hs-list">${sightListHtml()}</div>`;
    panel = `<div class="hf-scrim" data-hunt="fieldPanel" data-panel=""></div>
      <section class="hf-panel" role="dialog" aria-label="${esc(panelTitle[fieldPanel])}">
        <header><h3>${esc(panelTitle[fieldPanel])}</h3><button type="button" class="btn small ghost" data-hunt="fieldPanel" data-panel="">${ic('x', 16)} ${l('fmClose')}</button></header>
        <div class="hf-panel-body hf-p-${fieldPanel}">${!isLead || fieldPanel === 'msgs' || fieldPanel === 'pokot' ? errorBox() : ''}${body}</div>
      </section>`;
  }
  const iShare = !!sharer?.active && sharer.huntId === h.id;
  return `<div class="hf">
    <header class="hf-top${act ? ' live' : ''}">
      <button type="button" class="hf-exit" data-hunt="fieldOff" aria-label="${esc(l('fmExit'))}" title="${esc(l('fmExit'))}">${ic('back', 24)}</button>
      <h2>${act ? '<span class="hd-dot" aria-hidden="true"></span>' : ''}<span>${esc(title)}</span></h2>${timer}
      ${iShare ? `<button type="button" class="hf-pocket" data-hunt="pocket" title="${esc(l('pocketHint'))}">${l('fmPocket')}</button>` : ''}
    </header>
    <div class="hf-info">${first}${cell('drives', l('fmDrive'), driveNo)}${loc}</div>
    ${ask}${t}${picking}${renderMyRoute(me)}
    <div class="hf-map"><div class="hm-slot"></div>
      ${iShare ? `<button type="button" class="hf-center" data-hunt="centerMe" aria-label="${esc(l('centerMe'))}" title="${esc(l('centerMe'))}">${ic('locate', 22)}</button>` : ''}
    </div>
    <footer class="hf-bottom">
      ${near ? `<p class="hf-near">${near}</p>` : ''}
      <div class="hf-actions${canShoot ? '' : ' hf-two'}">
        <button type="button" class="hf-btn hf-game" data-hunt="sightOpen" aria-label="${esc(l('sightReportHint'))}">${speciesIcon('boar', 34)}<span>${l('sightReport')}</span></button>
        ${canShoot ? `<button type="button" class="hf-btn hf-shot" data-hunt="shotFire" aria-label="${esc(l('shotHint'))}">${ic('crosshair', 34)}<span>${l('shot')}</span></button>` : ''}
        <button type="button" class="hf-btn" data-hunt="fieldPanel" data-panel="msgs">${ic('message', 34)}<span>${l('messages')}</span>${unread ? `<span class="hf-badge">${unread}</span>` : ''}</button>
      </div>
      <div class="hf-links">
        <button type="button" data-hunt="fieldPanel" data-panel="people">${l('participants')}</button>
        <button type="button" data-hunt="fieldPanel" data-panel="drives">${l('drives')} ${driveNo === '—' ? '' : driveNo}</button>
        <button type="button" data-hunt="fieldPanel" data-panel="pokot">${l('tabPokot')}</button>
      </div>
    </footer>
    ${panel}
  </div>`;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

function renderDrives(h: Hunt, isLeader: boolean, forceOpen = false): string {
  const act = activeDrive(drives);
  const next = drives.find((d) => driveState(d) === 'planned');
  let strip = '';
  if (act) strip = `<div class="hd-now"><span class="hd-dot" aria-hidden="true"></span><strong>${l('dNow')}: ${esc(act.name)}</strong> <span>· ${l('dUntil')} ${esc(act.end)}</span></div>`;
  else if (next && h.status === 'live') strip = `<div class="hd-now hd-next">${l('dNext')}: <strong>${esc(next.name)}</strong> · ${esc(next.start)}</div>`;
  if (driveEdit && isLeader) return `${strip}${renderDriveForm()}`;
  if (routeEdit && isLeader) return `${strip}${renderRouteEditor()}`;
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
          : `${startEnd}<button type="button" class="btn small ghost" data-hunt="routeEdit" data-drive="${esc(d.id)}">${l('routes')}${routes.get(d.id)?.size ? ` (${routes.get(d.id)!.size})` : ''}</button><button type="button" class="btn small ghost" data-hunt="driveEdit" data-drive="${esc(d.id)}">${l('editDrive')}</button>
             <button type="button" class="btn small ghost" data-hunt="askDriveDelete" data-drive="${esc(d.id)}" aria-label="${l('remove')} ${esc(d.name)}">${ic('x', 16)}</button>`;
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
  const open = forceOpen || (driveListOpen ?? (isLeader || h.status !== 'live' || !drives.length));
  return `${strip}<details class="hd-box"${open ? ' open' : ''}><summary data-hunt="driveList" data-open="${open}"><strong>${l('drives')}</strong> <span class="muted">(${drives.length})</span></summary>
    ${list}${add}${isLeader ? errorBox() : ''}</details>`;
}

function renderStandEditor(): string {
  const e = standEdit!;
  const s = e.sel != null ? e.list[e.sel] : null;
  const opt = (k: StandKind) => `<option value="${k}"${s?.kind === k ? ' selected' : ''}>${l(k === 'ambona' ? 'stAmbona' : 'stZwyzka')}</option>`;
  const seat = s
    ? `<div class="hst-seat">
        <div class="hst-row">
          <label class="h-field"><span>${l('stName')}</span><input type="text" maxlength="${STAND_LIMITS.name}" value="${esc(s.name)}" data-stand-field="name"${s.name.trim() ? '' : ' aria-invalid="true"'}></label>
          <label class="h-field"><span>${l('stKind')}</span><select data-stand-field="kind">${opt('zwyzka')}${opt('ambona')}</select></label>
        </div>
        <div class="hst-row">
          <label class="h-field"><span>${l('stPos')}</span><input type="text" inputmode="decimal" value="${fmtLatLng(s)}" data-stand-field="pos"></label>
          <label class="h-check"><input type="checkbox" data-stand-field="broken"${s.broken ? ' checked' : ''}> ${l('stBrokenBox')}</label>
        </div>
        <div class="h-actions">
          <button type="button" class="btn small ghost" data-hunt="standDeselect">${l('stDone')}</button>
          <button type="button" class="btn small danger" data-hunt="standDel">${l('stDelete')}</button>
        </div>
      </div>`
    : '';
  return `<div class="hst-edit card">
      <p class="small"><strong>${l(e.target === 'club' ? 'stEditClub' : 'stEditHunt')}</strong> ${l('stEditHint')}</p>
      ${seat}
      ${errorBox()}
      <div class="h-actions">
        <button type="button" class="btn small" data-hunt="standsSave"${btnBusy()}>${l('stSave')}</button>
        <button type="button" class="btn small ghost" data-hunt="standAddHere"${locatingStand ? ' disabled aria-busy="true"' : ''}>${ic('locate', 16)} ${l('stAddHere')}</button>
        <button type="button" class="btn small ghost" data-hunt="standsEditCancel">${l('cancel')}</button>
      </div>
    </div>`;
}

function renderStands(isLeader: boolean): string {
  if (standEdit && isLeader) {
    const e = standEdit;
    const list = `<ul class="hst-names">${sortStands(e.list.map((s, i) => ({ ...s, i })))
      .map(
        (s) =>
          `<li><button type="button" data-hunt="standPick" data-i="${s.i}"${e.sel === s.i ? ' class="hst-on"' : ''}>${standIcon(s.kind, s.broken, 18)}<span>${esc(s.name || '?')}</span></button></li>`,
      )
      .join('')}</ul>`;
    return `<details class="hd-box hst-box" open><summary data-hunt="standList" data-open="true"><strong class="hst-summary">${standIcon('zwyzka', false, 18)} ${l('stands')}</strong> <span class="muted">(${e.list.length})</span></summary>
      ${renderStandEditor()}${list}</details>`;
  }
  const shown = shownStands();
  const own = stands.length > 0;
  const locked = clubDenied && !own;
  if (!isLeader && !shown.length && !locked) return '';
  const kindName = (s: Stand) => `${l(s.kind === 'ambona' ? 'stAmbona' : 'stZwyzka')}${s.broken ? `, ${l('stBroken')}` : ''}`;
  const note = own ? l('stHuntNote') : clubStands.length ? l('stClubNote') : '';
  const list = shown.length
    ? `${note ? `<p class="muted small">${note}</p>` : ''}<ul class="hst-names">${sortStands(shown)
        .map(
          (s) =>
            `<li><button type="button" data-hunt="standShow" data-lat="${s.lat}" data-lng="${s.lng}" title="${esc(kindName(s))}">${standIcon(s.kind, s.broken, 18)}<span>${esc(s.name)}</span></button></li>`,
        )
        .join('')}</ul>`
    : locked
      ? ''
      : `<p class="muted small">${isLeader ? l('stNoneLeader') : l('stNone')}</p>`;
  const unlock = locked
    ? `<form class="h-form hst-unlock" data-hunt-form="club" novalidate><p class="small">${l('stLocked')}</p>
        <div class="hst-unlock-row">${field('club', 'pass', l('fPass'), '', { req: true, auto: 'off' })}
        <button type="submit" class="btn"${btnBusy()}>${l('stUnlock')}</button></div></form>`
    : '';
  let ctl = '';
  if (isLeader) {
    const last = lastStands();
    const label = own ? l('stReplace') : clubStands.length ? l('stOther') : l('stLoad');
    const file = `<label class="btn small${shown.length ? ' ghost' : ''}"><input type="file" class="hst-file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" data-stands-file${busy ? ' disabled' : ''}>${ic('upload', 16)} ${label}</label>`;
    const reuse =
      !shown.length && last
        ? `<button type="button" class="btn small ghost" data-hunt="standsReuse"${btnBusy()}>${l('stReuse')}: ${esc(last.file)} (${last.stands.length})</button>`
        : '';
    const sure = (action: string, text: string) =>
      `<button type="button" class="btn small danger" data-hunt="${action}"${btnBusy()}>${text}</button>
       <button type="button" class="btn small ghost" data-hunt="unconfirm">${l('cancel')}</button>`;
    const saveClub =
      own && !clubDenied
        ? confirming === 'club'
          ? sure('clubSave', l('stSaveClubSure'))
          : `<button type="button" class="btn small" data-hunt="${clubStands.length ? 'askClubSave' : 'clubSave'}"${btnBusy()}>${l('stSaveClub')}</button>`
        : '';
    const clear = !own
      ? ''
      : confirming === 'stands'
        ? sure('standsClear', l('stClearSure'))
        : `<button type="button" class="btn small ghost" data-hunt="askStandsClear">${l('stClear')}</button>`;
    const edit = `<button type="button" class="btn small${shown.length ? '' : ' ghost'}" data-hunt="standsEdit">${ic('edit', 16)} ${l('stEdit')}</button>`;
    ctl = `<div class="hst-actions">${edit}${saveClub}${file}${reuse}${clear}</div>`;
  }
  const open = standListOpen ?? ((isLeader && !shown.length) || locked);
  return `<details class="hd-box hst-box"${open ? ' open' : ''}><summary data-hunt="standList" data-open="${open}"><strong class="hst-summary">${standIcon('zwyzka', false, 18)} ${l('stands')}</strong> <span class="muted">(${shown.length})</span></summary>
    ${list}${unlock}${ctl}${isLeader || locked ? errorBox() : ''}</details>`;
}

/** The leader picked a KMZ/KML file: read it and put its points into this hunt. */
export function handleHuntChange(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement) || !('standsFile' in el.dataset)) return false;
  const f = el.files?.[0];
  el.value = '';
  const id = watched;
  if (!f || !id) return true;
  f.arrayBuffer()
    .then(standsFromFile)
    .then(
      (ss) => {
        if (!ss.length) {
          formError = l('stErrEmpty');
          rerender();
          return;
        }
        rememberStands(f.name, ss.slice(0, STAND_LIMITS.stands));
        saveStands(id, ss);
      },
      () => {
        formError = l('stErrFile');
        rerender();
      },
    );
  return true;
}

function saveStands(id: string, ss: Stand[]) {
  standListOpen = true;
  run(async (be) => {
    await be.saveStands(id, ss);
    const cut = ss.length > STAND_LIMITS.stands;
    showToast(cut ? `${l('stCut')} ${STAND_LIMITS.stands} / ${ss.length}` : `${l('stLoaded')} ${ss.length}`);
  });
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
      <button type="button" class="btn small ghost" data-hunt="driveLocate"${locatingDrive ? ' disabled aria-busy="true"' : ''}>${ic('locate', 16)} ${l('centerMe')}</button>
      <button type="button" class="btn small ghost" data-hunt="driveUndo"${e.area.length ? '' : ' disabled'}>${ic('undo', 16)} ${l('dUndo')}</button>
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
  const isLeader = leads(h, uid);
  const remote = isLeader && !!members && !members.some((p) => p.uid === uid);
  const me: Participant | undefined = members?.find((p) => p.uid === uid) ?? (remote ? { uid, name: h.leaderName, role: 'leader', status: 'confirmed', joinedAt: 0 } : undefined);
  const info = (withTitle: boolean) => `<article class="card h-head">
      ${withTitle ? `<div class="h-title"><h2>${esc(h.name)}</h2>${statusBadge(h.status)}</div>` : ''}
      <dl class="kv">
        <dt>${l('when')}</dt><dd>${esc(fmtDate(h.date))}<br>${esc(h.start)}–${esc(h.end)}</dd>
        ${h.place ? `<dt>${l('where')}</dt><dd>${esc(h.place)}</dd>` : ''}
        ${h.district ? `<dt>${l('district')}</dt><dd><a href="#/obwod/${esc(h.district.slug)}" data-nav="district" data-slug="${esc(h.district.slug)}">${esc(h.district.label)}</a></dd>` : ''}
        <dt>${l('leader')}</dt><dd>${roleIcon('leader', 16)} ${esc(h.leaderName)}</dd>
      </dl>
      ${me?.status === 'confirmed' ? renderMeetLine(h, isLeader) : ''}
      ${h.notes ? `<p class="h-notes">${esc(h.notes).replace(/\n/g, '<br>')}</p>` : ''}
    </article>`;
  if (editing && isLeader) return `${back}${renderHuntForm('edit')}`;
  if (!membersLoaded) return `${back}${info(true)}<p class="muted">${l('loading')}</p>`;
  const pairing = pairToken && pairToken.id === h.id ? renderPairAsk(h) : '';
  if (!me) {
    syncLive();
    return `${back}${info(true)}${pairing || renderJoin(h)}`;
  }
  syncLive();
  if (isLeader) watchInvites(h.id);
  const confirmed = me.status === 'confirmed';
  // Drawing on the map or picking a point on it happens on the map's tab.
  if (driveEdit || routeEdit || standEdit || pickMode) htab = 'field';
  if (fieldMode && confirmed && h.status === 'live' && !remote && !driveEdit && !routeEdit && !standEdit) return renderField(h, me, isLeader);
  const crew = confirmed ? renderTransport(isLeader) : '';
  const meBox = remote ? renderRemoteLead(h) : renderMe(me, isLeader);
  const leadBox = isLeaderDevice(h, uid) ? renderLeadDevices(h) : isDeputy(h, uid) ? `<div class="notice small">${l('deputyYou')}</div>` : '';
  const head = `<div class="h-title h-top"><h2>${esc(h.name)}</h2>${statusBadge(h.status)}</div>
    <p class="muted small h-when">${esc(fmtDate(h.date, false))}, ${esc(h.start)}–${esc(h.end)}${h.place ? ` · ${esc(h.place)}` : ''}</p>`;
  const ps = members ?? [];
  const pending = isLeader ? ps.filter((p) => p.status === 'registered').length : 0;
  const tab = (id: HTab, label: string, extra = '') =>
    `<button type="button" role="tab" data-hunt="htab" data-pane="${id}" aria-selected="${htab === id}">${label}${extra}</button>`;
  const tabs = `<div class="h-tabs" role="tablist" aria-label="${esc(l('huntTabs'))}">${tab('field', l('tabField'))}${tab('info', l('tabInfo'))}${tab(
    'people',
    l('tabPeople'),
    pending ? ` <span class="h-tabbadge">${pending}</span>` : ` <span class="h-tabcount">${ps.length}</span>`,
  )}${tab('pokot', l('tabPokot'))}</div>`;
  const pane = (id: HTab, html: string) => `<section class="h-pane" data-hpane="${id}"${htab === id ? '' : ' hidden'}>${html}</section>`;
  return `${back}${head}${pairing}${tabs}
    ${pane('field', renderLive(h, me))}
    ${pane('info', `${info(false)}${leadBox}${crew}${isLeader ? `${renderManage(h)}${errorBox()}` : ''}`)}
    ${pane('people', `${meBox}${isLeader ? renderInvite(h) : ''}${renderMembers(uid, isLeader)}`)}
    ${pane('pokot', confirmed ? renderPokot(pokotCtx(h)) : `<div class="notice">${l('fmPendingPokot')}</div>`)}`;
}

function renderJoin(h: Hunt): string {
  if (!registrationOpen(h)) return `<div class="notice">${l('closedNote')}</div>`;
  const role = draft.get('join.role') ?? 'hunter';
  const radio = (r: 'hunter' | 'beater') =>
    `<label class="h-role"><input type="radio" name="role" value="${r}" data-hunt-field="join"${role === r ? ' checked' : ''} />${roleIcon(r, 22)}<span>${l(`r_${r}`)}</span></label>`;
  const guest = !!myGuestToken();
  return `<form class="card h-form" data-hunt-form="join" novalidate>
    <h3>${l(guest ? 'guestTitle' : 'joinTitle')}</h3>
    ${guest ? `<p class="small">${l('guestHint')}</p>` : ''}
    <fieldset class="h-roles"><legend>${l('fRole')}</legend>${radio('hunter')}${radio('beater')}</fieldset>
    ${field('join', 'pname', l('fYourName'), storedName(), { max: LIMITS.name, req: true, hint: l('fYourNameHint'), auto: 'name' })}
    ${field('join', 'phone', l('fPhone'), '', { type: 'tel', auto: 'tel', hint: l('fPhoneHint') })}
    ${guest ? '' : field('join', 'pass', l('fPass'), '', { req: true, hint: l('fPassHint'), auto: 'off' })}
    ${errorBox()}
    <div class="h-actions"><button type="submit" class="btn"${btnBusy()}>${l('join')}</button></div>
  </form>`;
}

function renderMe(me: Participant, isLeader: boolean): string {
  const withdraw = me.role === 'leader'
    ? ''
    : confirming === 'withdraw'
      ? `<button type="button" class="btn danger" data-hunt="withdraw"${btnBusy()}>${l('withdrawSure')}</button>
         <button type="button" class="btn ghost" data-hunt="unconfirm">${l('cancel')}</button>`
      : `<button type="button" class="btn ghost" data-hunt="askWithdraw">${l('withdraw')}</button>`;
  return `<div class="notice h-me">${roleIcon(me.role, 22)}<div><strong>${l('youAre')} ${l(`r_${me.role}`).toLocaleLowerCase(locale())}</strong>
      ${me.status === 'registered' ? `<br><span class="small">${l('youPending')}</span>` : ''}</div>
      ${withdraw ? `<div class="h-actions">${withdraw}</div>` : ''}</div>${me.status === 'confirmed' ? renderPhone() : ''}${!isLeader ? errorBox() : ''}`;
}

function renderInvite(h: Hunt): string {
  const now = conn.s === 'ready' ? conn.be.serverNow() : Date.now();
  const inv = invites ? currentInvite(invites, now) : null;
  const copyBtn = (what: string) =>
    `<button type="button" class="btn ghost" data-hunt="copy" data-what="${what}">${copied === what ? `${ic('check', 16)} ${l('copied')}` : l('copy')}</button>`;
  let body: string;
  if (invites === null) body = `<p class="muted small">${l('loading')}</p>`;
  else if (!inv)
    body = `<p class="small muted">${l('inviteNone')}</p>
      <div class="h-actions"><button type="button" class="btn" data-hunt="inviteNew"${btnBusy()}>${l('inviteCreate')}</button></div>`;
  else {
    const url = inviteLink(appBase(), h.id, inv.token);
    const exp = new Date(inv.exp).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    if (qrOpen && qr?.url !== url) makeQr(url);
    const revoke =
      confirming === 'revoke'
        ? `<button type="button" class="btn small danger" data-hunt="inviteRevoke"${btnBusy()}>${l('inviteRevokeSure')}</button>
           <button type="button" class="btn small ghost" data-hunt="unconfirm">${l('cancel')}</button>`
        : `<button type="button" class="btn small ghost" data-hunt="inviteNew"${btnBusy()}>${l('inviteNew')}</button>
           <button type="button" class="btn small ghost danger-text" data-hunt="askRevoke">${l('inviteRevoke')}</button>`;
    body = `<p class="small muted">${l('inviteHint')}</p>
      <div class="h-invite"><input type="text" readonly value="${esc(url)}" aria-label="${l('invite')}" data-hunt-select />
        ${canShare() ? `<button type="button" class="btn" data-hunt="share">${l('share')}</button>` : ''}
        ${copyBtn('invite')}
        <button type="button" class="btn ghost" data-hunt="qr" aria-expanded="${qrOpen}">${qrOpen ? l('qrHide') : l('qrShow')}</button></div>
      ${qrOpen ? `<figure class="h-qr">${qr?.url === url ? qr.svg : `<p class="muted small">${l('loading')}</p>`}<figcaption class="small muted">${esc(h.name)} · ${l('qrHint')}</figcaption></figure>` : ''}
      <p class="small">${l('inviteValid')} ${esc(exp)}</p>
      <div class="h-actions">${revoke}</div>
      <p class="small muted">${l('inviteNewHint')}</p>`;
  }
  return `<h3>${l('invite')}</h3>${body}
    <details class="h-clublink"><summary class="small">${l('clubLink')}</summary>
      <div class="h-invite"><input type="text" readonly value="${esc(inviteUrl(h.id))}" aria-label="${l('clubLink')}" data-hunt-select />${copyBtn('club')}</div>
    </details>`;
}

function makeQr(url: string, done: (q: { url: string; svg: string }) => void = (q) => (qr = q)) {
  import('qrcode-generator').then(({ default: qrcode }) => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    done({ url, svg: q.createSvgTag({ cellSize: 6, margin: 3, scalable: true }) });
    rerender();
  });
}
let pairQr: { url: string; svg: string } | null = null;

/** Leader devices other than this one, and which is in the field: changes when another device pairs or takes over. */
const devicesKey = (h: Hunt) => `${otherLeaderDevices(h).filter((u) => u !== myUid()).sort().join(',')}|${h.leaderUid}`;

/** On a leader device: pair a phone, see the leader's devices, move the field role here. */
function renderLeadDevices(h: Hunt): string {
  const uid = myUid();
  if (pairCode && (pairCode.id !== h.id || devicesKey(h) !== pairCode.before)) {
    if (pairCode.id === h.id) pairedNote = l('leadPaired');
    pairCode = null;
  }
  const now = conn.s === 'ready' ? conn.be.serverNow() : Date.now();
  const devs = [h.leaderUid, ...Object.keys(h.leaders).filter((u) => h.leaders[u] === 'device' && u !== h.leaderUid)];
  const rows = devs
    .map(
      (u) => `<li class="h-person">${roleIcon('leader')}<span class="h-pname">${l(u === uid ? 'leadThis' : 'leadOther')}${u === h.leaderUid ? ` <span class="hr-badge">${l('leadField')}</span>` : ''}</span>${
        u !== uid && u !== h.leaderUid ? `<span class="h-pctl"><button type="button" class="btn small ghost" data-hunt="leadRemove" data-uid="${esc(u)}"${btnBusy()}>${l('remove')}</button></span>` : ''
      }</li>`,
    )
    .join('');
  let code: string;
  if (pairCode && pairCode.exp > now) {
    const url = leaderPairLink(appBase(), h.id, pairCode.token);
    if (pairQr?.url !== url) makeQr(url, (q) => (pairQr = q));
    code = `<figure class="h-qr">${pairQr?.url === url ? pairQr.svg : `<p class="muted small">${l('loading')}</p>`}<figcaption class="small muted">${esc(h.name)} · ${l('leadTitle')}</figcaption></figure>
      <div class="h-invite"><input type="text" readonly value="${esc(url)}" aria-label="${l('leadTitle')}" data-hunt-select /></div>
      <p class="small">${l('leadCodeValid')} ${esc(clock(pairCode.exp))}</p>
      <div class="h-actions"><button type="button" class="btn small ghost" data-hunt="leadCodeCancel"${btnBusy()}>${l('leadCodeCancel')}</button></div>`;
  } else
    code = `${pairCode ? `<p class="small muted">${l('leadCodeExpired')}</p>` : ''}<div class="h-actions"><button type="button" class="btn" data-hunt="leadCode"${btnBusy()}>${l('leadCode')}</button></div>`;
  const deps = Object.keys(h.leaders).filter((u) => h.leaders[u] === 'deputy');
  const take =
    h.leaderUid !== uid
      ? `<div class="h-actions"><button type="button" class="btn small ghost" data-hunt="leadTake"${btnBusy()}>${l('leadTake')}</button></div><p class="small muted">${l('leadTakeHint')}</p>`
      : '';
  const open = leadOpen ?? !!(pairCode || pairedNote);
  return `<details class="card h-lead"${open ? ' open' : ''}><summary data-hunt="leadBox" data-open="${open}"><strong>${l('leadTitle')}</strong></summary>
    ${pairedNote ? `<p class="small" role="status">${ic('check', 16)} ${esc(pairedNote)}</p>` : ''}
    <p class="small muted">${l('leadHint')}</p>${code}
    <h4>${l('leadDevices')}</h4><ul class="h-people">${rows}</ul>${take}
    <h4>${l('deputies')}</h4>${deps.length ? `<ul class="h-people">${deps.map((u) => `<li class="h-person">${roleIcon('hunter')}<span class="h-pname">${esc(personName(u))}</span></li>`).join('')}</ul>` : ''}
    <p class="small muted">${l('deputyHint')}</p>${errorBox()}</details>`;
}

/** A leader device whose leader row is on another device. */
function renderRemoteLead(h: Hunt): string {
  return `<div class="notice h-me">${roleIcon('leader', 22)}<div><strong>${esc(h.leaderName)}</strong><br><span class="small">${l('remoteLead')}</span></div></div>`;
}

/** On the phone that opened a pairing link. */
function renderPairAsk(h: Hunt): string {
  if (h.leaderUid === myUid()) {
    pairToken = null;
    return '';
  }
  return `<div class="card h-form"><h3>${roleIcon('leader', 22)} ${l('pairTitle')}</h3>
    <p><strong>${esc(h.name)}</strong> · ${esc(h.leaderName)}</p><p class="small">${l('pairAsk')}</p>${errorBox()}
    <div class="h-actions"><button type="button" class="btn" data-hunt="pairConfirm"${btnBusy()}>${l('pairOk')}</button>
    <button type="button" class="btn ghost" data-hunt="pairCancel">${l('cancel')}</button></div></div>`;
}

function renderMembers(uid: string, isLeader: boolean): string {
  const ps = members ?? [];
  const c = countRoles(ps);
  const h = hunt;
  const canAppoint = isLeaderDevice(h, uid);
  const row = (p: Participant) => {
    const deputy = isDeputy(h, p.uid);
    const appoint =
      canAppoint && p.role !== 'leader' && p.status === 'confirmed' && confirming !== `remove:${p.uid}`
        ? `<button type="button" class="btn small ghost" data-hunt="deputy" data-uid="${esc(p.uid)}" data-on="${deputy ? '' : '1'}"${btnBusy()}>${l(deputy ? 'deputyDrop' : 'deputyMake')}</button>`
        : '';
    const controls =
      isLeader && p.role !== 'leader'
        ? confirming === `remove:${p.uid}`
          ? `<button type="button" class="btn small danger" data-hunt="remove" data-uid="${esc(p.uid)}"${btnBusy()}>${l('sure')}</button>
             <button type="button" class="btn small ghost" data-hunt="unconfirm">${l('cancel')}</button>`
          : `${p.status === 'registered' ? `<button type="button" class="btn small" data-hunt="confirm" data-uid="${esc(p.uid)}"${btnBusy()}>${l('confirm')}</button>` : ''}
             <button type="button" class="btn small ghost" data-hunt="role" data-uid="${esc(p.uid)}" data-to="${p.role === 'hunter' ? 'beater' : 'hunter'}"${btnBusy()}>${l(p.role === 'hunter' ? 'makeBeater' : 'makeHunter')}</button>
             <button type="button" class="btn small ghost" data-hunt="askRemove" data-uid="${esc(p.uid)}">${l('remove')}</button>${appoint}`
        : '';
    const fd = focus();
    const seat = fd && p.role !== 'beater' ? seats.get(fd.id)?.get(p.uid) : undefined;
    const carries = myCarcassKinds(transport, p.uid);
    const ph = phones.get(p.uid);
    return `<li class="h-person${p.status === 'registered' ? ' pending' : ''}">${roleIcon(p.role)}
      <span class="h-pname">${esc(p.name)}${p.uid === uid ? ` <span class="muted">(${l('you')})</span>` : ''}${deputy ? ` <span class="hr-badge">${roleIcon('leader', 12)} ${l('deputyBadge')}</span>` : ''}${seat ? ` <span class="hr-badge" title="${esc(l('seat'))}">${standIcon('zwyzka', false, 12)} ${esc(seat)}</span>` : ''}${carries.length ? ` <span class="hr-badge hr-badge-tr">${esc(carries.map(kindName).join(', '))}</span>` : ''}
        ${p.status === 'registered' ? `<small class="muted">${l('pending')}</small>` : ''}${ph && p.uid !== uid ? `<small>${telLink(ph)}</small>` : ''}</span>
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

// ---------------------------------------------------------------- crew: routes, stands, transport, messages

const guideText = (): GuideText => ({
  toStart: l('gToStart'),
  onRoute: (m) => `${l('gOnRoute')} ${m}`,
  off: (m, side) => `${m} ${l(side === 'left' ? 'gOffL' : side === 'right' ? 'gOffR' : 'gOff')}`,
  nearEnd: (m) => `${l('gNearEnd')} ${m}`,
  arrived: l('gArrived'),
  pointArrived: l('gPointArrived'),
  pointGo: l('gPointGo'),
  noFix: l('gNoFix'),
  noCompass: l('gNoCompass'),
  compassOn: l('gCompassOn'),
  calibrate: l('sightCalibrate'),
  off_: l('gOffBtn'),
  north: 'N',
});

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const meName = () => members?.find((p) => p.uid === myUid());
const isLeaderNow = () => leads(hunt, myUid());
/** A leader device with no row of its own: the leader is in the field on another device. */
const remoteLead = () => !!hunt && leads(hunt, myUid()) && !!members && !members.some((p) => p.uid === myUid());
const beaters = () => (members ?? []).filter((p) => p.role === 'beater');
const shooters = () => (members ?? []).filter((p) => p.role === 'hunter' || p.role === 'leader');
const kindName = (k: CarcassKind) => l(k === 'boar' ? 'tr_boar' : 'tr_deer');
const driveName = (id: string | null) => drives.find((d) => d.id === id)?.name ?? '';
/** The drive routes and stands are shown for: running, else next planned, else last held. */
const focus = () => focusDrive(drives);
/** The drive a beater or hunter prepares for now: running or next planned, never one already held. */
const upcoming = () => {
  const f = focus();
  return f && f.endedAt == null ? f : null;
};

function carrierOf(k: CarcassKind): { name: string; phone: string | null; uid: string | null } | null {
  const c: Carrier | undefined = transport[k];
  if (!c) return null;
  if ('uid' in c) return { name: personName(c.uid), phone: phones.get(c.uid) ?? null, uid: c.uid };
  return { name: c.name, phone: c.phone, uid: null };
}

/** Position of a hunter's stand in a drive, from the seat they wrote and the shown high seats. */
function seatAt(uid: string, driveId: string | null): Pt | null {
  if (!driveId) return null;
  const seat = seats.get(driveId)?.get(uid);
  const st = seat ? standForSeat(seat, shownStands()) : null;
  return st ? { lat: st.lat, lng: st.lng } : null;
}

const allCarcasses = (): Carcass[] => listCarcasses(shots, shotSpots, marks, drives, seatAt);

/** Carcasses this person deals with: the leader all, a carrier their kind, a shooter their own. */
function myCarcasses(): Carcass[] {
  const uid = myUid();
  const kinds = myCarcassKinds(transport, uid);
  const all = allCarcasses();
  if (isLeaderNow()) return all;
  return all.filter((c) => kinds.includes(c.kind) || c.shooter === uid);
}

/** Tell a carrier when carcasses of their kind become ready (their drive ended). */
function checkCarcasses() {
  const uid = myUid();
  const kinds = myCarcassKinds(transport, uid);
  const ready = allCarcasses().filter((c) => c.ready && !c.pickedBy && kinds.includes(c.kind));
  if (!seenCarcasses) {
    // Wait for shots and transport to load before the first (silent) look.
    if (shotsUnsub && kinds.length) seenCarcasses = new Set(ready.map((c) => c.shotId));
    return;
  }
  const fresh = ready.filter((c) => !seenCarcasses!.has(c.shotId));
  fresh.forEach((c) => seenCarcasses!.add(c.shotId));
  if (!fresh.length) return;
  const counts = new Map<string, number>();
  for (const c of fresh) {
    const name = gameName(c.game).split(' – ')[0];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const drv = [...new Set(fresh.map((c) => driveName(c.driveId)).filter(Boolean))].join(', ');
  const text = `${l('cAlert')}: ${[...counts].map(([n, k]) => (k > 1 ? `${k} × ${n}` : n)).join(', ')}${drv ? ` (${drv})` : ''}`;
  alertUser(hunt?.name ?? 'Polowanie', text, BUZZ.carcass);
  showToast(text, undefined, 'sight', 20_000);
}

/** Text message body listing carcasses to collect, with map links. */
function carcassSms(list: Carcass[]): string {
  const lines = list.map((c, i) => `${i + 1}. ${gameName(c.game)}${c.driveId ? ` (${driveName(c.driveId)})` : ''}: ${c.at ? mapsLink(c.at) : l('cNoPos')}`);
  return `${l('cSmsHead')} – ${hunt?.name ?? ''}\n${lines.join('\n')}`;
}

/** Routes, meeting points and stands on the map, and where a map tap goes. */
function drawCrew() {
  if (!hmap) return;
  const e = routeEdit;
  const ppl = people();
  const label = (uid: string) => ppl.get(uid)?.name ?? '?';
  if (e) {
    const views: RouteView[] = [...e.routes].map(([uid, pts]) => ({ uid, pts, label: label(uid), strong: false }));
    if (e.mode === 'spread' && e.spread.length) views.push({ uid: '__spread', pts: e.spread, label: `${l('routeSpreadStep')} ${e.spread.length}/4`, strong: true });
    hmap.setRoutes(views, {
      sel: e.mode === 'route' ? e.sel : null,
      onSelect: (uid) => {
        if (!e.routes.has(uid)) return;
        e.sel = uid;
        e.mode = 'route';
        rerender();
      },
      onMove: (i, lat, lng) => {
        const r = e.sel ? e.routes.get(e.sel) : null;
        if (!r || !r[i]) return;
        r[i] = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
        e.dirty = true;
        drawCrew();
      },
    });
  } else {
    const f = focus();
    const rs = f ? routes.get(f.id) : undefined;
    hmap.setRoutes(rs ? [...rs].map(([uid, pts]) => ({ uid, pts, label: label(uid), strong: uid === myUid() })) : []);
  }
  const meets: MeetView[] = [];
  if (hunt?.meet) meets.push({ ...hunt.meet, label: l('meetLabel') });
  const f = e ? drives.find((d) => d.id === e.driveId) : focus();
  const dm = e ? e.meet : f?.meet;
  if (dm && f) meets.push({ ...dm, label: `${l('meetLabel')} · ${f.name}` });
  hmap.setMeets(meets);
  const seatViews: SeatView[] = [];
  const sd = focus();
  for (const [uid, seat] of (sd && seats.get(sd.id)) || []) {
    const st = standForSeat(seat, shownStands());
    if (st) seatViews.push({ lat: st.lat, lng: st.lng, label: label(uid) });
  }
  hmap.setSeats(seatViews);
  hmap.setTapHandler(e || pickMode ? onMapTap : null);
}

function onMapTap(lat: number, lng: number) {
  const p = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  const e = routeEdit;
  if (e) {
    if (e.mode === 'meet') {
      e.meet = p;
      e.mode = 'route';
      e.dirty = true;
    } else if (e.mode === 'spread') {
      e.spread.push(p);
      if (e.spread.length === 4) {
        const uids = beaters().filter((b) => e.spreadUids.has(b.uid)).map((b) => b.uid);
        const [a1, a2, b1, b2] = e.spread;
        spreadRoutes(a1, a2, b1, b2, uids.length).forEach((r, i) => e.routes.set(uids[i], r));
        e.spread = [];
        e.mode = 'route';
        e.sel = uids[0] ?? null;
        e.dirty = true;
      }
    } else if (e.sel) {
      const r = e.routes.get(e.sel) ?? [];
      if (r.length >= CREW_LIMITS.routePoints) return;
      r.push(p);
      e.routes.set(e.sel, r);
      e.dirty = true;
    }
    drawCrew();
    rerender();
    return;
  }
  const pm = pickMode;
  const id = watched;
  if (!pm || !id) return;
  pickMode = null;
  if (pm.kind === 'huntMeet') run((be) => be.setHuntMeet(id, p));
  else run((be) => be.moveCarcass(id, pm.shotId, p));
  drawCrew();
}

/** Point the guidance at my route in the running (or next) drive, or at the carcass I chose. */
let guideKey = '';
function syncGuide() {
  const t = guideTarget();
  setGuide(t, guideText(), (g, me) => hmap?.setGuideLine(g ? me : null, g ? g.target : null));
  // The card is part of the page: show or drop it when the target changes.
  const key = t ? `${t.kind}|${t.title}` : '';
  if (key !== guideKey) {
    guideKey = key;
    queueMicrotask(rerender);
  }
}

function guideTarget(): GuideTarget | null {
  const h = hunt;
  if (!h || h.status !== 'live' || routeEdit) return null;
  if (guideCarcass) {
    const c = allCarcasses().find((x) => x.shotId === guideCarcass);
    if (c?.at && !c.pickedBy) return { kind: 'point', at: c.at, title: `${l('gToCarcass')}: ${gameName(c.game)}` };
    guideCarcass = null;
  }
  const d = upcoming();
  const r = d ? routes.get(d.id)?.get(myUid()) : undefined;
  if (d && r && guideDismissed !== d.id) return { kind: 'route', route: r, started: d.startedAt != null, title: `${l('routeMine')} · ${d.name}` };
  return null;
}

// ---- messages

let msgSheet: HTMLElement | null = null;
let msgSheetId: string | null = null;

function closeMsgSheet() {
  msgSheet?.remove();
  msgSheet = null;
  msgSheetId = null;
}

const toName = (to: MsgTo) => (to.startsWith('u:') ? personName(to.slice(2)) : l(`to_${to as 'all' | 'hunter' | 'beater' | 'transport'}`));

/** Messages for me not yet acknowledged, newest first. */
function myUnacked(): Message[] {
  const me = meName();
  if (!me) return [];
  return messages.filter((m) => msgFor(m, me, transport) && !acks.get(m.id)?.has(me.uid));
}

function onMessages() {
  const t = now();
  const pending = myUnacked().filter((m) => t - m.ts < POPUP_MS && !shelvedMsgs.has(m.id));
  const fresh = seenMsgs ? pending.filter((m) => !seenMsgs!.has(m.id)) : [];
  if (!seenMsgs) seenMsgs = new Set(messages.map((m) => m.id));
  else messages.forEach((m) => seenMsgs!.add(m.id));
  if (fresh.length) alertUser(l('msgFromLeader'), fresh.map((m) => m.text).join('\n'), BUZZ.message);
  const show = pending[0];
  if (show && show.id !== msgSheetId) openMsgSheet(show);
  else if (!show) closeMsgSheet();
  rerender();
  updatePocket();
}

/** Full-screen message with one big button; above the pocket screen, so it can be acknowledged from the pocket. */
function openMsgSheet(m: Message) {
  closeMsgSheet();
  const el = document.createElement('div');
  el.className = 'hmsg-sheet';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', l('msgFromLeader'));
  el.innerHTML = `<div class="hmsg-box"><p class="hmsg-from">${roleIcon('leader', 22)} ${esc(l('msgFromLeader'))} · ${esc(clock(m.ts))}</p>
    <p class="hmsg-text">${esc(m.text)}</p>
    <button type="button" class="btn hmsg-ack" data-msg="ack">${l('msgAck')}</button>
    <button type="button" class="btn ghost small hmsg-later" data-msg="later">${l('msgLater')}</button></div>`;
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-msg]');
    if (!b) return;
    const id = watched;
    if (b.dataset.msg === 'ack' && id && conn.s === 'ready') {
      const be = conn.be;
      b.setAttribute('disabled', '');
      be.ackMessage(id, m.id).then(
        () => closeMsgSheet(),
        (err) => {
          b.removeAttribute('disabled');
          showToast(errText(err));
        },
      );
    } else if (b.dataset.msg === 'later') {
      shelvedMsgs.add(m.id);
      closeMsgSheet();
      onMessages();
    }
  });
  document.body.append(el);
  msgSheet = el;
  msgSheetId = m.id;
}

// ---- rendering

function renderMeetLine(h: Hunt, isLeader: boolean): string {
  const set = isLeader
    ? pickMode?.kind === 'huntMeet'
      ? `<span class="small hr-picking">${l('meetPick')}</span> <button type="button" class="btn small ghost" data-hunt="pickCancel">${l('pickCancel')}</button>`
      : `<button type="button" class="btn small ghost" data-hunt="meetPick">${ic('flag', 16)} ${l(h.meet ? 'meetMove' : 'meetSet')}</button>${
          h.meet ? ` <button type="button" class="btn small ghost" data-hunt="meetClear">${l('meetClear')}</button>` : ''
        }`
    : '';
  const nav = h.meet ? `<a class="btn small" href="${esc(mapsLink(h.meet))}" target="_blank" rel="noopener">${ic('flag', 16)} ${l('navigateMeet')}</a>` : '';
  if (!nav && !set) return '';
  return `<div class="h-actions hr-meetline">${nav}${set}</div>`;
}

/** My phone number: shown, or a small form to add or change it. */
function renderPhone(): string {
  const mine = phones.get(myUid());
  if (phoneEdit)
    return `<form class="h-form hr-phone" data-hunt-form="phone" novalidate>
      ${field('phone', 'phone', l('fPhone'), mine ?? '', { type: 'tel', auto: 'tel', hint: l('fPhoneHint') })}
      <div class="h-actions"><button type="submit" class="btn small"${btnBusy()}>${l('phoneSave')}</button>
      ${mine ? `<button type="button" class="btn small ghost" data-hunt="phoneDel"${btnBusy()}>${l('phoneDel')}</button>` : ''}
      <button type="button" class="btn small ghost" data-hunt="phoneCancel">${l('cancel')}</button></div></form>`;
  return `<div class="small hr-phone">${ic('phone', 16)} ${l('phone')}: ${mine ? `<strong>${esc(fmtPhone(mine))}</strong>` : `<span class="muted">${l('phoneNone')}</span>`}
    <button type="button" class="btn small ghost" data-hunt="phoneEdit">${l(mine ? 'phoneEdit' : 'phoneAdd')}</button></div>`;
}

const telLink = (p: string) => `<a class="h-tel" href="tel:${esc(p)}" title="${esc(l('call'))}">${ic('phone', 14)} ${esc(fmtPhone(p))}</a>`;

/** Who collects carcasses; the leader assigns them. */
function renderTransport(isLeader: boolean): string {
  if (transportEdit && isLeader) {
    const sel = (k: CarcassKind) => {
      const c = transport[k];
      const cur = draft.get(`transport.${k}Sel`) ?? (c ? ('uid' in c ? c.uid : '__out') : '');
      const opts = [`<option value="">${l('trNobody')}</option>`]
        .concat((members ?? []).map((p) => `<option value="${esc(p.uid)}"${cur === p.uid ? ' selected' : ''}>${esc(p.name)}</option>`))
        .concat(`<option value="__out"${cur === '__out' ? ' selected' : ''}>${l('trOutside')}</option>`)
        .join('');
      const out = c && !('uid' in c) ? c : null;
      return `<fieldset class="hr-tr"><legend>${kindName(k)}</legend>
        <select name="${k}Sel" data-hunt-field="transport" aria-label="${esc(kindName(k))}">${opts}</select>
        ${cur === '__out' ? `<div class="h-row">${field('transport', `${k}Name`, l('trName'), out?.name ?? '', { max: CREW_LIMITS.transportName })}${field('transport', `${k}Phone`, l('phone'), out?.phone ?? '', { type: 'tel' })}</div>` : ''}
      </fieldset>`;
    };
    return `<h3>${l('transport')}</h3><form class="card h-form" data-hunt-form="transport" novalidate>${CARCASS_KINDS.map(sel).join('')}${errorBox()}
      <div class="h-actions"><button type="submit" class="btn small"${btnBusy()}>${l('save')}</button>
      <button type="button" class="btn small ghost" data-hunt="transportCancel">${l('cancel')}</button></div></form>`;
  }
  const rows = CARCASS_KINDS.map((k) => {
    const c = carrierOf(k);
    return `<li><strong>${kindName(k)}:</strong> ${c ? `${esc(c.name)}${c.uid === myUid() ? ` <span class="muted">(${l('you')})</span>` : ''} ${c.phone ? telLink(c.phone) : ''}` : `<span class="muted">${l('trNone')}</span>`}</li>`;
  }).join('');
  return `<h3>${l('transport')}</h3><ul class="hr-trlist">${rows}</ul>${isLeader ? `<button type="button" class="btn small ghost" data-hunt="transportEdit">${l('trEdit')}</button>` : ''}`;
}

/** Carcasses for the leader, the carriers and the shooters, nearest first. */
function renderCarcasses(isLeader: boolean): string {
  const list = myCarcasses();
  const uid = myUid();
  const kinds = myCarcassKinds(transport, uid);
  if (!list.length && !isLeader && !kinds.length) return '';
  const me = myPos();
  const ready = pickupOrder(list.filter((c) => c.ready && !c.pickedBy), me);
  const waiting = list.filter((c) => !c.ready && !c.pickedBy);
  const picked = list.filter((c) => c.pickedBy);
  const row = (c: Carcass) => {
    const canPick = isLeader || kinds.includes(c.kind);
    const canMove = isLeader || c.shooter === uid;
    const where = c.at
      ? `${me ? `${fmtDist(distanceM(me, c.at))} ${compassPoint(bearingTo(me, c.at))}` : ''}${c.src === 'seat' ? ` · ${l('cSrcSeat')}` : ''}`
      : l('cNoPos');
    const btns: string[] = [];
    if (c.at && !c.pickedBy) {
      btns.push(`<button type="button" class="btn small" data-hunt="carcassGuide" data-sid="${esc(c.shotId)}">${ic('navigate', 16)} ${l('routeGuide')}</button>`);
      btns.push(`<a class="btn small ghost" href="${esc(mapsLink(c.at))}" target="_blank" rel="noopener">${l('navigate')}</a>`);
      btns.push(`<button type="button" class="btn small ghost" data-hunt="carcassShow" data-sid="${esc(c.shotId)}">${l('cShow')}</button>`);
    }
    if (canMove && !c.pickedBy) {
      btns.push(`<button type="button" class="btn small ghost" data-hunt="carcassHere" data-sid="${esc(c.shotId)}"${btnBusy()}>${ic('pin', 16)} ${l('cHere')}</button>`);
      btns.push(
        pickMode?.kind === 'carcass' && pickMode.shotId === c.shotId
          ? `<button type="button" class="btn small ghost" data-hunt="pickCancel">${l('pickCancel')}</button>`
          : `<button type="button" class="btn small ghost" data-hunt="carcassPick" data-sid="${esc(c.shotId)}">${l('cOnMap')}</button>`,
      );
    }
    if (canPick && c.ready && !c.pickedBy) btns.push(`<button type="button" class="btn small" data-hunt="carcassTaken" data-sid="${esc(c.shotId)}"${btnBusy()}>${ic('check', 16)} ${l('cPick')}</button>`);
    if (c.pickedBy && (isLeader || c.pickedBy === uid)) btns.push(`<button type="button" class="btn small ghost" data-hunt="carcassUntaken" data-sid="${esc(c.shotId)}"${btnBusy()}>${l('cUnpick')}</button>`);
    const state = c.pickedBy ? `${ic('check', 14)} ${l('cPicked')} · ${esc(personName(c.pickedBy))}${c.pickedAt ? ` · ${clock(c.pickedAt)}` : ''}` : c.ready ? where : `${l('cWait')}`;
    return `<li class="hc-item${c.pickedBy ? ' hc-picked' : c.ready ? ' hc-ready' : ''}"><div><strong>${esc(gameName(c.game))}</strong>
      <span class="muted small">· ${esc(personName(c.shooter))}${c.driveId ? ` · ${esc(driveName(c.driveId))}` : ''} · ${esc(kindName(c.kind))}</span></div>
      <div class="small">${state}</div>${btns.length ? `<div class="h-actions">${btns.join('')}</div>` : ''}</li>`;
  };
  // Text the list to a carrier (for one outside the app, the only way to reach them).
  const sms = (isLeader ? CARCASS_KINDS : [])
    .map((k) => {
      const c = carrierOf(k);
      const todo = ready.filter((x) => x.kind === k);
      return c?.phone && todo.length
        ? `<a class="btn small ghost" href="${esc(smsLink(c.phone, carcassSms(todo)))}">${ic('mail', 16)} ${l('cSms')}: ${esc(c.name)} (${todo.length})</a>`
        : '';
    })
    .join('');
  const you = kinds.length ? `<p class="small">${l('trYou')} <strong>${kinds.map(kindName).join(', ')}</strong></p>` : '';
  const all = [...ready, ...waiting, ...picked];
  return `<h4>${l('carcasses')} <span class="muted">(${ready.length})</span></h4>${you}
    ${all.length ? `<ul class="hc-list">${all.map(row).join('')}</ul>` : `<p class="muted small">${l('cNone')}</p>`}
    ${sms ? `<div class="h-actions">${sms}</div>` : ''}`;
}

const bearingTo = (a: Pt, b: Pt) => {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
};

/** A hunter's own stand in the drive to come, typed from the lottery card. */
function renderMySeat(me: Participant): string {
  if (me.role === 'beater' || me.status !== 'confirmed') return '';
  const d = upcoming();
  if (!d) return '';
  const cur = seats.get(d.id)?.get(me.uid) ?? '';
  const names = sortStands(shownStands()).map((s) => `<option value="${esc(s.name)}"></option>`).join('');
  if (cur && !seatEdit)
    return `<div class="hr-seatcard card"><span>${standIcon('zwyzka', false, 20)} ${l('seatMine')} ${l('seatIn')} <strong>${esc(d.name)}</strong>: <strong class="hr-seatno">${esc(cur)}</strong></span>
      <button type="button" class="btn small ghost" data-hunt="seatEdit">${l('seatChange')}</button></div>`;
  return `<form class="hr-seatcard card h-form" data-hunt-form="seat" data-drive="${esc(d.id)}" novalidate>
    <label class="h-field"><span>${standIcon('zwyzka', false, 18)} ${l('seatMine')} ${l('seatIn')} <strong>${esc(d.name)}</strong></span>
    <input type="text" name="seat" maxlength="${CREW_LIMITS.seat}" list="hr-seat-names" value="${esc(draft.get('seat.seat') ?? cur)}" data-hunt-field="seat" placeholder="${esc(l('seatPh'))}" autocomplete="off" />
    <small class="muted">${l('seatHint')}</small></label><datalist id="hr-seat-names">${names}</datalist>
    <div class="h-actions"><button type="submit" class="btn small"${btnBusy()}>${l('seatSave')}</button>${cur ? `<button type="button" class="btn small ghost" data-hunt="seatCancel">${l('cancel')}</button>` : ''}</div></form>`;
}

/** Leader: everyone's stand in the drive in focus, editable, with who is missing. */
function renderSeatsLeader(): string {
  const d = focus();
  const hs = shooters().filter((p) => p.status === 'confirmed' && p.role === 'hunter');
  if (!hs.length) return '';
  if (!d) return `<details class="hd-box"><summary><strong>${l('seats')}</strong></summary><p class="muted small">${l('seatNoDrive')}</p></details>`;
  const m = seats.get(d.id) ?? new Map<string, string>();
  const missing = hs.filter((p) => !m.has(p.uid)).length;
  const rows = hs
    .map(
      (p) => `<li><label><span>${roleIcon('hunter', 16)} ${esc(p.name)}</span>
      <input type="text" name="s_${esc(p.uid)}" maxlength="${CREW_LIMITS.seat}" list="hr-seat-names-l" value="${esc(m.get(p.uid) ?? '')}" placeholder="—" /></label></li>`,
    )
    .join('');
  const names = sortStands(shownStands()).map((s) => `<option value="${esc(s.name)}"></option>`).join('');
  return `<details class="hd-box hr-seats"><summary><strong>${l('seats')}</strong> <span class="muted">· ${esc(d.name)} · ${missing ? `${missing} ${l('seatsMissing')}` : ic('check', 16)}</span></summary>
    <form class="h-form" data-hunt-form="seats" data-drive="${esc(d.id)}" novalidate><ul class="hr-seatlist">${rows}</ul><datalist id="hr-seat-names-l">${names}</datalist>
    <div class="h-actions"><button type="submit" class="btn small"${btnBusy()}>${l('seatsSave')}</button></div></form></details>`;
}

/** A beater's own route in the drive to come: where it starts, and the guidance switch. */
function renderMyRoute(me: Participant): string {
  const d = upcoming();
  const r = d ? routes.get(d.id)?.get(me.uid) : undefined;
  const g = guideCardHtml();
  if (g) return g;
  if (!d || !r || hunt?.status !== 'live') return '';
  const pos = myPos();
  return `<div class="hr-seatcard card"><span>${roleIcon('beater', 18)} ${l('routeMine')} · <strong>${esc(d.name)}</strong>${pos ? ` · ${ic('navigate', 13)} ${fmtDist(distanceM(pos, r[0]))}` : ''}</span>
    <button type="button" class="btn small" data-hunt="guideOn">${ic('navigate', 16)} ${l('routeGuide')}</button></div>`;
}

/** Leader: draw the beaters' routes and the meeting point of one drive. */
function renderRouteEditor(): string {
  const e = routeEdit!;
  const d = drives.find((x) => x.id === e.driveId);
  const bs = beaters();
  const hint = e.mode === 'spread' ? `${l('routeSpreadHint')} <strong>${l('routeSpreadStep')} ${e.spread.length + 1}/4: ${l(e.spread.length < 2 ? 'routeSpreadStart' : 'routeSpreadEnd')}</strong>` : e.mode === 'meet' ? l('routeMeetHint') : l('routeHint');
  const list = bs.length
    ? `<ul class="hr-beaters">${bs
        .map((b) => {
          const r = e.routes.get(b.uid);
          const on = e.sel === b.uid && e.mode === 'route';
          const tick =
            e.mode === 'spread'
              ? `<input type="checkbox" data-route-spread="${esc(b.uid)}"${e.spreadUids.has(b.uid) ? ' checked' : ''} aria-label="${esc(b.name)}">`
              : '';
          return `<li class="${on ? 'hr-on' : ''}">${tick}<button type="button" data-hunt="routeSel" data-uid="${esc(b.uid)}">${roleIcon('beater', 16)} <span>${esc(b.name)}</span>
            <small class="muted">${r ? `${r.length} ${l('routePts')} · ${fmtDist(routeLen(r))}` : l('routeNone')}</small></button></li>`;
        })
        .join('')}</ul>`
    : `<p class="muted small">${l('routeNoBeaters')}</p>`;
  const sel = e.sel && e.mode === 'route' ? e.routes.get(e.sel) : null;
  return `<div class="card hr-edit"><strong>${l('routesTitle')} · ${esc(d?.name ?? '')}</strong>
    <p class="small${e.mode !== 'route' ? ' hr-picking' : ''}">${hint}</p>
    ${list}
    <div class="h-actions">
      ${e.sel && e.mode === 'route' ? `<button type="button" class="btn small ghost" data-hunt="routeUndo"${sel?.length ? '' : ' disabled'}>${ic('undo', 16)} ${l('routeUndo')}</button>
      <button type="button" class="btn small ghost danger-text" data-hunt="routeDel"${sel ? '' : ' disabled'}>${l('routeDel')}</button>` : ''}
      <button type="button" class="btn small ghost" data-hunt="routeSpread" aria-pressed="${e.mode === 'spread'}"${bs.length ? '' : ' disabled'}>${l('routeSpread')}</button>
      <button type="button" class="btn small ghost" data-hunt="routeMeet" aria-pressed="${e.mode === 'meet'}">${ic('flag', 16)} ${l('routeMeet')}</button>
      ${e.meet ? `<button type="button" class="btn small ghost" data-hunt="routeMeetClear">${l('routeMeetClear')}</button>` : ''}
    </div>
    ${errorBox()}
    <div class="h-actions"><button type="button" class="btn small" data-hunt="routeSave"${btnBusy()}>${l('routeSave')}</button>
      <button type="button" class="btn small ghost" data-hunt="routeCancel">${l('cancel')}</button></div></div>`;
}

const routeLen = (r: Route) => r.slice(1).reduce((s, p, i) => s + distanceM(r[i], p), 0);

/** Leader: compose and history with who acknowledged; others: messages meant for them. */
function renderMessages(isLeader: boolean, h: Hunt): string {
  const confirmed = (members ?? []).filter((p) => p.status === 'confirmed');
  const t = now();
  if (!isLeader) {
    const me = meName();
    const mine = me ? messages.filter((m) => msgFor(m, me, transport)).slice(0, 5) : [];
    if (!mine.length) return '';
    return `<h4>${l('messages')}</h4><ul class="hmsg-list">${mine
      .map((m) => {
        const ok = acks.get(m.id)?.has(myUid());
        return `<li><span class="muted small">${clock(m.ts)}</span> ${esc(m.text)} ${
          ok ? `<span class="small hmsg-ok">${ic('check', 16)} ${l('msgAcked')}</span>` : `<button type="button" class="btn small" data-hunt="msgAck" data-mid="${esc(m.id)}">${l('msgAck')}</button>`
        }</li>`;
      })
      .join('')}</ul>`;
  }
  const to = (draft.get('msg.to') ?? 'all') as MsgTo;
  const opt = (v: string, label: string) => `<option value="${esc(v)}"${to === v ? ' selected' : ''}>${esc(label)}</option>`;
  const opts = [opt('all', l('to_all')), opt('hunter', l('to_hunter')), opt('beater', l('to_beater')), opt('transport', l('to_transport'))]
    .concat(confirmed.filter((p) => p.uid !== myUid()).map((p) => opt(`u:${p.uid}`, `→ ${p.name}`)))
    .join('');
  const presets = (getLang() === 'pl' ? PRESETS.pl : PRESETS.en).map((p, i) => `<button type="button" class="btn small ghost" data-hunt="msgPreset" data-i="${i}">${esc(p)}</button>`).join('');
  const hist = messages.slice(0, 10).map((m) => {
    const rc = recipients(m, confirmed, transport);
    const got = acks.get(m.id) ?? new Map();
    const missing = rc.filter((p) => !got.has(p.uid));
    return `<li><div><span class="muted small">${clock(m.ts)} · ${l('msgTo')}: ${esc(toName(m.to))}</span>
      <span class="hmsg-count${missing.length ? '' : ' all'}">${ic('check', 16)} ${rc.length - missing.length}/${rc.length}</span>
      <button type="button" class="btn small ghost" data-hunt="msgDel" data-mid="${esc(m.id)}" aria-label="${l('msgDel')}">${ic('x', 16)}</button></div>
      <div>${esc(m.text)}</div>${missing.length && t - m.ts < 6 * 3600e3 ? `<div class="small muted">${l('msgWaiting')} ${missing.map((p) => esc(p.name)).join(', ')}</div>` : ''}</li>`;
  });
  return `<details class="hd-box hmsg-box"${h.status === 'live' ? ' open' : ''}><summary><strong>${ic('mail', 16)} ${l('messages')}</strong> <span class="muted">(${messages.length})</span></summary>
    <form class="h-form hmsg-form" data-hunt-form="msg" novalidate>
      <label class="h-field"><span>${l('msgTo')}</span><select name="to" data-hunt-field="msg">${opts}</select></label>
      <div class="hmsg-presets">${presets}</div>
      ${field('msg', 'text', l('msgText'), '', { max: CREW_LIMITS.message })}
      <div class="h-actions"><button type="submit" class="btn"${btnBusy()}>${l('msgSend')}</button></div>
      <p class="small muted">${l('msgHint')}</p>
    </form>
    ${hist.length ? `<ul class="hmsg-list">${hist.join('')}</ul>` : `<p class="muted small">${l('msgNone')}</p>`}</details>`;
}

const appBase = publicBase;
const inviteUrl = (id: string) => `${appBase()}#/polowanie/${id}`;
/** The link the share button sends: the invitation if there is one. */
function shareUrl(id: string): string {
  const inv = invites && conn.s === 'ready' ? currentInvite(invites, conn.be.serverNow()) : null;
  return inv ? inviteLink(appBase(), id, inv.token) : inviteUrl(id);
}

// ---------------------------------------------------------------- events

export function handleHuntClick(el: HTMLElement): boolean {
  const action = el.dataset.hunt;
  if (!action) return false;
  const id = watched;
  const uid = el.dataset.uid ?? '';
  if (fieldPanel && MAP_ACTIONS.has(action)) {
    fieldPanel = null;
    rerender();
  }
  switch (action) {
    case 'htab':
      htab = el.dataset.pane as HTab;
      break;
    case 'fieldOn':
      setFieldMode(true);
      break;
    case 'fieldOff':
      setFieldMode(false);
      htab = 'field';
      break;
    case 'fieldPanel':
      fieldPanel = (el.dataset.panel as FieldPanel) || null;
      fieldPanelScroll = 0;
      break;
    case 'saveOffline':
      if (hunt?.district) saveOfflineCb?.(hunt.district);
      break;
    case 'meetPick':
      driveEdit = null;
      standEdit = null;
      routeEdit = null;
      pickMode = { kind: 'huntMeet' };
      drawCrew();
      setTimeout(() => document.querySelector('.hm-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      break;
    case 'meetClear':
      if (id) run((be) => be.setHuntMeet(id, null));
      return true;
    case 'pickCancel':
      pickMode = null;
      drawCrew();
      break;
    case 'phoneEdit':
      phoneEdit = true;
      clearDraft('phone');
      break;
    case 'phoneCancel':
      phoneEdit = false;
      formError = '';
      break;
    case 'phoneDel':
      if (id)
        run(async (be) => {
          await be.setPhone(id, null);
          phoneEdit = false;
        });
      return true;
    case 'transportEdit':
      transportEdit = true;
      clearDraft('transport');
      formError = '';
      break;
    case 'transportCancel':
      transportEdit = false;
      clearDraft('transport');
      formError = '';
      break;
    case 'seatEdit':
      seatEdit = true;
      clearDraft('seat');
      break;
    case 'seatCancel':
      seatEdit = false;
      clearDraft('seat');
      break;
    case 'guideOn':
      guideDismissed = null;
      syncGuide();
      break;
    case 'guideOff':
      if (guideCarcass) guideCarcass = null;
      else guideDismissed = upcoming()?.id ?? null;
      syncGuide();
      break;
    case 'guideCompass':
      enableCompass();
      return true;
    case 'carcassGuide':
      guideCarcass = el.dataset.sid ?? null;
      syncGuide();
      setTimeout(() => document.querySelector('.hg-card')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      break;
    case 'carcassShow': {
      const c = allCarcasses().find((x) => x.shotId === el.dataset.sid);
      if (c?.at) {
        hmap?.centerOnPoint(c.at.lat, c.at.lng);
        document.querySelector('.hm-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return true;
    }
    case 'carcassHere': {
      const sid = el.dataset.sid;
      if (id && sid)
        run(async (be) => {
          const p = await getFix();
          await be.moveCarcass(id, sid, p);
        });
      return true;
    }
    case 'carcassPick':
      if (el.dataset.sid) {
        driveEdit = null;
        standEdit = null;
        routeEdit = null;
        pickMode = { kind: 'carcass', shotId: el.dataset.sid };
        drawCrew();
        setTimeout(() => document.querySelector('.hm-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      }
      break;
    case 'carcassTaken':
    case 'carcassUntaken':
      if (id && el.dataset.sid) run((be) => be.pickCarcass(id, el.dataset.sid!, action === 'carcassTaken'));
      return true;
    case 'routeEdit': {
      const d = drives.find((x) => x.id === el.dataset.drive);
      if (!d) break;
      driveEdit = null;
      standEdit = null;
      pickMode = null;
      formError = '';
      const copy = new Map([...(routes.get(d.id) ?? new Map<string, Route>())].map(([u, r]) => [u, r.map((p) => ({ ...p }))]));
      const bs = beaters();
      routeEdit = { driveId: d.id, routes: copy, sel: bs[0]?.uid ?? null, mode: 'route', spread: [], spreadUids: new Set(bs.map((b) => b.uid)), meet: d.meet, dirty: false };
      syncGuide();
      setTimeout(() => {
        drawCrew();
        document.querySelector('.hr-edit')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 0);
      break;
    }
    case 'routeSel':
      if (routeEdit) {
        routeEdit.sel = uid;
        routeEdit.mode = 'route';
        routeEdit.spread = [];
        const r = routeEdit.routes.get(uid);
        if (r?.length) hmap?.centerOnPoint(r[0].lat, r[0].lng);
        drawCrew();
      }
      break;
    case 'routeUndo':
      if (routeEdit?.sel) {
        const r = routeEdit.routes.get(routeEdit.sel);
        r?.pop();
        if (r && !r.length) routeEdit.routes.delete(routeEdit.sel);
        routeEdit.dirty = true;
        drawCrew();
      }
      break;
    case 'routeDel':
      if (routeEdit?.sel) {
        routeEdit.routes.delete(routeEdit.sel);
        routeEdit.dirty = true;
        drawCrew();
      }
      break;
    case 'routeSpread':
      if (routeEdit) {
        routeEdit.mode = routeEdit.mode === 'spread' ? 'route' : 'spread';
        routeEdit.spread = [];
        drawCrew();
      }
      break;
    case 'routeMeet':
      if (routeEdit) {
        routeEdit.mode = routeEdit.mode === 'meet' ? 'route' : 'meet';
        routeEdit.spread = [];
        drawCrew();
      }
      break;
    case 'routeMeetClear':
      if (routeEdit) {
        routeEdit.meet = null;
        routeEdit.dirty = true;
        drawCrew();
      }
      break;
    case 'routeCancel':
      routeEdit = null;
      formError = '';
      drawCrew();
      syncGuide();
      break;
    case 'routeSave': {
      const e = routeEdit;
      if (!e || !id) break;
      const d = drives.find((x) => x.id === e.driveId);
      run(async (be) => {
        const keep = new Map([...e.routes].filter(([, r]) => r.length >= 2));
        await be.saveRoutes(id, e.driveId, keep);
        const before = d?.meet ? `${d.meet.lat},${d.meet.lng}` : '';
        const after = e.meet ? `${e.meet.lat},${e.meet.lng}` : '';
        if (before !== after) await be.setDriveMeet(id, e.driveId, e.meet);
        if (routeEdit === e) routeEdit = null;
        showToast(l('routeSaved'));
        drawCrew();
        syncGuide();
      });
      return true;
    }
    case 'msgPreset': {
      const list = getLang() === 'pl' ? PRESETS.pl : PRESETS.en;
      const text = list[+el.dataset.i!] ?? '';
      draft.set('msg.text', text);
      const input = document.querySelector<HTMLInputElement>('.hmsg-form [name="text"]');
      if (input) {
        input.value = text;
        input.focus();
      }
      return true;
    }
    case 'msgDel':
      if (id && el.dataset.mid) run((be) => be.deleteMessage(id, el.dataset.mid!));
      return true;
    case 'msgAck':
      if (id && el.dataset.mid) run((be) => be.ackMessage(id, el.dataset.mid!));
      return true;
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
      standEdit = null;
      clearDraft('drive');
      driveEdit = { id: null, area: [], ...nextDriveDefaults(drives, hunt) };
      scrollToDriveForm = true;
      formError = '';
      badFields = new Set();
      break;
    case 'driveEdit': {
      const d = drives.find((x) => x.id === el.dataset.drive);
      if (!d) break;
      standEdit = null;
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
    case 'shotFire':
      fireShot();
      return true;
    case 'shotUndo':
      if (id && el.dataset.sid) {
        toast = null;
        closeShotSheet();
        pokotRun((be) => be.deleteShot(id, el.dataset.sid!));
      }
      return true;
    case 'shotEdit':
      shotEdit = el.dataset.sid ?? null;
      pokotError = '';
      break;
    case 'pokotAdd':
      shotEdit = 'new';
      pokotError = '';
      break;
    case 'shotCancel':
      shotEdit = null;
      pokotError = '';
      break;
    case 'askShotDelete':
      shotEdit = `del:${el.dataset.sid}`;
      break;
    case 'shotDelete':
      if (id && el.dataset.sid) pokotRun((be) => be.deleteShot(id, el.dataset.sid!), () => (shotEdit = null));
      return true;
    case 'pokotLock':
    case 'pokotUnlock':
      if (id) pokotRun((be) => be.lockPokot(id, action === 'pokotLock'));
      return true;
    case 'pokotTitles':
      if (id && hunt) {
        const on = !hunt.pokotTitles;
        pokotRun((be) => be.setPokotTitles(id, on));
      }
      return true;
    case 'pokotPdf':
      openPokotPrint();
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
    case 'standList':
      standListOpen = el.dataset.open !== 'true';
      break;
    case 'leadBox':
      leadOpen = el.dataset.open !== 'true';
      break;
    case 'standsEdit': {
      const own = stands.length > 0;
      driveEdit = null;
      confirming = null;
      formError = '';
      standEdit = { target: own || clubDenied ? 'hunt' : 'club', list: shownStands().map((s) => ({ ...s })), sel: null, dirty: false };
      standListOpen = true;
      setTimeout(() => document.querySelector('.hst-edit')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
      break;
    }
    case 'standsEditCancel':
      standEdit = null;
      formError = '';
      break;
    case 'standPick': {
      if (!standEdit) break;
      const i = +el.dataset.i!;
      standEdit.sel = i;
      const s = standEdit.list[i];
      if (s) hmap?.centerOnPoint(s.lat, s.lng);
      break;
    }
    case 'standDeselect':
      if (standEdit) standEdit.sel = null;
      break;
    case 'standDel':
      if (standEdit && standEdit.sel != null) {
        standEdit.list.splice(standEdit.sel, 1);
        standEdit.sel = null;
        standEdit.dirty = true;
      }
      break;
    case 'standAddHere':
      if (!standEdit || !('geolocation' in navigator)) break;
      locatingStand = true;
      formError = '';
      navigator.geolocation.getCurrentPosition(
        (p) => {
          locatingStand = false;
          hmap?.centerOnPoint(p.coords.latitude, p.coords.longitude);
          addStandAt(p.coords.latitude, p.coords.longitude);
        },
        () => {
          locatingStand = false;
          formError = l('stErrLocate');
          rerender();
        },
        { enableHighAccuracy: true, timeout: 20000 },
      );
      break;
    case 'standsSave': {
      const e = standEdit;
      if (!e) break;
      for (const s of e.list) s.name = s.name.replace(/\s+/g, ' ').trim();
      const bad = e.list.findIndex((s) => !s.name);
      if (bad >= 0) {
        e.sel = bad;
        formError = l('stErrName');
        break;
      }
      const target = e.target;
      const huntId = id;
      run(async (be) => {
        if (target === 'club') await be.saveClubStands(e.list);
        else if (huntId) await be.saveStands(huntId, e.list);
        if (standEdit === e) standEdit = null;
        showToast(l('stSaved'));
      });
      return true;
    }
    case 'standShow':
      hmap?.centerOnPoint(+el.dataset.lat!, +el.dataset.lng!);
      document.querySelector('.hm-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return true;
    case 'standsReuse': {
      const last = lastStands();
      if (id && last) saveStands(id, last.stands);
      return true;
    }
    case 'askClubSave':
      confirming = 'club';
      break;
    case 'clubSave':
      confirming = null;
      run(async (be) => {
        await be.saveClubStands(stands);
        showToast(`${l('stClubSaved')} ${Math.min(stands.length, STAND_LIMITS.stands)}`);
      });
      return true;
    case 'askStandsClear':
      confirming = 'stands';
      break;
    case 'standsClear':
      confirming = null;
      if (id) run((be) => be.saveStands(id, []));
      return true;
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
        void shareLink({ title: hunt.name, text: `${hunt.name} – ${fmtDate(hunt.date)} ${hunt.start}`, url: shareUrl(id) });
      return true;
    case 'qr':
      qrOpen = !qrOpen;
      break;
    case 'leadCode':
      if (id && hunt) {
        const before = devicesKey(hunt);
        pairedNote = null;
        run(async (be) => {
          const c = await be.newLeaderCode(id);
          pairCode = { id, ...c, before };
        });
      }
      return true;
    case 'leadCodeCancel':
      if (id) {
        pairCode = null;
        run((be) => be.cancelLeaderCode(id));
      }
      return true;
    case 'leadTake':
      if (id) {
        pairedNote = null;
        run(async (be) => {
          await be.takeField(id);
          pairedNote = l('leadMoved');
        });
      }
      return true;
    case 'leadRemove':
      if (id && uid) run((be) => be.removeLeader(id, uid));
      return true;
    case 'deputy':
      if (id && uid) run((be) => be.setDeputy(id, uid, el.dataset.on === '1'));
      return true;
    case 'pairCancel':
      pairToken = null;
      formError = '';
      if (id) go(id);
      break;
    case 'pairConfirm':
      if (id && pairToken?.id === id) {
        const token = pairToken.token;
        run(async (be) => {
          try {
            await be.pairLeader(id, token);
          } catch (e) {
            if (e instanceof HuntError && e.code === 'denied') refusedTokens.add(token);
            throw e;
          }
          pairToken = null;
          pairedNote = l('leadMoved');
          mine = { s: 'idle' };
          // The participant list was unreadable before; listen again now that this device leads.
          membersLoaded = false;
          watchMembers(id);
          go(id);
        }, 'errPair');
      }
      return true;
    case 'askRevoke':
      confirming = 'revoke';
      break;
    case 'inviteRevoke':
      confirming = null;
      if (id) run((be) => be.revokeInvites(id));
      return true;
    case 'inviteNew':
      if (id && hunt) {
        const h = hunt;
        run(async (be) => {
          await be.newInvite(id, inviteExpiry(h, be.serverNow()));
        });
      }
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
    case 'copy': {
      const what = el.dataset.what ?? 'invite';
      if (id)
        copyText(what === 'club' ? inviteUrl(id) : shareUrl(id)).then(() => {
          copied = what;
          rerender();
          setTimeout(() => {
            copied = null;
            rerender();
          }, 2000);
        }, () => {});
      return true;
    }
  }
  rerender();
  return true;
}

function clearDraft(form: string) {
  for (const k of [...draft.keys()]) if (k.startsWith(`${form}.`)) draft.delete(k);
}

export function handleHuntInput(el: HTMLElement): boolean {
  const rs = el.dataset.routeSpread;
  if (rs !== undefined) {
    if (routeEdit) {
      if ((el as HTMLInputElement).checked) routeEdit.spreadUids.add(rs);
      else routeEdit.spreadUids.delete(rs);
    }
    return true;
  }
  const sf = el.dataset.standField;
  if (sf) {
    const e = standEdit;
    const s = e && e.sel != null ? e.list[e.sel] : null;
    if (!e || !s) return true;
    const input = el as HTMLInputElement;
    if (sf === 'name') {
      s.name = input.value.slice(0, STAND_LIMITS.name);
      input.setAttribute('aria-invalid', String(!s.name.trim()));
    } else if (sf === 'kind') s.kind = input.value === 'ambona' ? 'ambona' : 'zwyzka';
    else if (sf === 'broken') s.broken = input.checked;
    else if (sf === 'pos') {
      const p = parseLatLng(input.value);
      input.setAttribute('aria-invalid', String(!p));
      if (!p) return true;
      Object.assign(s, p);
      hmap?.centerOnPoint(p.lat, p.lng);
    }
    e.dirty = true;
    drawStands(); // only the map; re-rendering would steal the focus from the field
    return true;
  }
  const form = el.dataset.huntField;
  if (!form) return false;
  const input = el as HTMLInputElement;
  draft.set(`${form}.${input.name}`, input.value);
  if (input.name === 'districtQ' || (form === 'transport' && input.name.endsWith('Sel'))) rerender();
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
  } else if (kind === 'shot' && watched) {
    const id = watched;
    const sid = form.dataset.sid || null;
    const outcome = (OUTCOMES.includes(v('outcome') as Outcome) ? v('outcome') : 'unknown') as Outcome;
    const game = GAMES.some((x) => x.key === v('game')) && outcome !== 'miss' ? v('game') : null;
    const isLead = leads(hunt, myUid());
    const lead = isLead ? { uid: v('uid') || NO_SHOOTER, driveId: v('driveId') || null } : {};
    const patch = { outcome, game, note: v('note'), ...lead };
    pokotRun(
      (be) =>
        sid
          ? be.updateShot(id, sid, patch)
          : be.addShotFor(id, v('uid') || NO_SHOOTER, { outcome, game, note: v('note'), driveId: v('driveId') || null }).then(() => {}),
      () => (shotEdit = null),
    );
  } else if (kind === 'phone' && watched) {
    const id = watched;
    const phone = cleanPhone(v('phone'));
    if (!phone) {
      badFields.add('phone');
      formError = l('errPhone');
      rerender();
      return true;
    }
    run(async (be) => {
      await be.setPhone(id, phone);
      phoneEdit = false;
      clearDraft('phone');
    });
  } else if (kind === 'transport' && watched) {
    const id = watched;
    const t: Transport = {};
    for (const k of CARCASS_KINDS) {
      const sel = v(`${k}Sel`);
      if (sel === '__out') {
        const phone = cleanPhone(v(`${k}Phone`));
        const name = cleanText(v(`${k}Name`), CREW_LIMITS.transportName);
        if (!phone || name.length < 2) {
          formError = l('trErr');
          rerender();
          return true;
        }
        t[k] = { name, phone };
      } else if (sel) t[k] = { uid: sel };
    }
    run(async (be) => {
      await be.saveTransport(id, t);
      transportEdit = false;
      clearDraft('transport');
      showToast(l('trSaved'));
    });
  } else if (kind === 'seat' && watched) {
    const id = watched;
    const driveId = form.dataset.drive!;
    const seat = cleanSeat(v('seat'));
    run(async (be) => {
      await be.setSeat(id, driveId, myUid(), seat || null);
      seatEdit = false;
      clearDraft('seat');
    });
  } else if (kind === 'seats' && watched) {
    const id = watched;
    const driveId = form.dataset.drive!;
    const cur = seats.get(driveId) ?? new Map<string, string>();
    const changes: [string, string][] = [];
    for (const p of shooters()) {
      const input = form.elements.namedItem(`s_${p.uid}`) as HTMLInputElement | null;
      if (!input) continue;
      const val = cleanSeat(input.value);
      if (val !== (cur.get(p.uid) ?? '')) changes.push([p.uid, val]);
    }
    run(async (be) => {
      for (const [who, val] of changes) await be.setSeat(id, driveId, who, val || null);
      showToast(l('seatsSaved'));
    });
  } else if (kind === 'msg' && watched) {
    const id = watched;
    const text = cleanMessage(v('text'));
    const to = (v('to') || 'all') as MsgTo;
    if (!text) {
      formError = l('msgEmpty');
      rerender();
      return true;
    }
    run(async (be) => {
      await be.sendMessage(id, text, to);
      draft.delete('msg.text');
      showToast(l('msgSent'));
    });
  } else if (kind === 'club') {
    if (!v('pass').trim()) {
      badFields.add('pass');
      formError = l('errPass');
      rerender();
      return true;
    }
    run(async (be) => {
      await be.joinClub(v('pass'));
      clearDraft('club');
      watchClub();
    }, 'errWrongPass');
  } else if (kind === 'join' && watched) {
    const id = watched;
    const role = (form.querySelector<HTMLInputElement>('input[name="role"]:checked')?.value ?? 'hunter') as 'hunter' | 'beater';
    const token = myGuestToken();
    if (!validPersonName(v('pname'))) badFields.add('pname');
    if (!token && !v('pass').trim()) badFields.add('pass');
    const phone = v('phone').trim() ? cleanPhone(v('phone')) : null;
    if (v('phone').trim() && !phone) badFields.add('phone');
    if (badFields.size) {
      formError = !validPersonName(v('pname')) ? l('errPersonName') : badFields.has('phone') ? l('errPhone') : l('errPass');
      rerender();
      return true;
    }
    storeName(v('pname').trim());
    run(async (be) => {
      if (token) {
        try {
          await be.joinByInvite(id, v('pname'), role, token, phone);
        } catch (e) {
          // Expired or revoked: fall back to the passphrase form.
          if (e instanceof HuntError && e.code === 'denied') {
            refusedTokens.add(token);
            guestToken = null;
          }
          throw e;
        }
        guestToken = null;
        // Drop the token from the address bar, so it is not shared further by accident.
        go(id);
      } else await be.join(id, v('pname'), role, v('pass'), phone);
      clearDraft('join');
      mine = { s: 'idle' };
      // The participant list was unreadable before joining; listen again now that we are in.
      membersLoaded = false;
      watchMembers(id);
    }, token ? 'errInvite' : 'errDeniedJoin');
  }
  return true;
}
