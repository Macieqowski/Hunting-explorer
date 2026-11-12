// The "Offline" tab of the map section: save areas for use without signal and manage them.

import { getLang, fmtNum, tt } from './i18n';
import {
  draftEstimate,
  draftKm2,
  isInstalled,
  isIos,
  isRunning,
  MAX_VIEW_KM2,
  prepareDraft,
  removeArea,
  requestPersistence,
  resumeArea,
  saveDraft,
  savedAreas,
  storageInfo,
  updateArea,
  type AreaTarget,
  type Draft,
  type SavedArea,
  type StorageInfo,
} from './offline';
import { boxKm2, DETAILS, isDetail, type Box, type Detail } from './tiles';
import { isApp } from './platform';
import { fetchDistrictsAtPoint, fetchDistrictsByIds, fetchOutlinesInBounds, type District, type DistrictWithGeometry } from './bdl';
import { districtMatches, fold, searchTerms, type Club } from './data';
import { cap, pickName } from './offlinePick';
import { ic } from './icons';

const L = {
  title: { pl: 'Mapy offline', en: 'Offline maps' },
  intro: {
    pl: 'Zapisz obszar polowania na telefonie, żeby mapa działała w lesie bez zasięgu: ortofotomapa i mapa topograficzna z Geoportalu, granice obwodów i oddziały leśne. Twoja pozycja GPS działa bez internetu.',
    en: 'Save a hunting area on your phone so the map works in the forest without signal: Geoportal aerial photo and topographic map, district borders and forest compartments. Your GPS position works without internet.',
  },
  online: { pl: 'Jesteś online.', en: 'You are online.' },
  offline: { pl: 'Brak internetu. Widzisz zapisane mapy i dane.', en: 'No internet. You see saved maps and data.' },
  used: { pl: 'Zajęte miejsce', en: 'Space used' },
  free: { pl: 'wolne', en: 'free' },
  persisted: { pl: 'Przeglądarka nie usunie zapisanych map.', en: 'The browser will not delete saved maps.' },
  notPersisted: {
    pl: 'Przeglądarka może usunąć zapisane mapy, gdy zabraknie miejsca.',
    en: 'The browser may delete saved maps when space runs low.',
  },
  keep: { pl: 'Zachowaj na stałe', en: 'Keep permanently' },
  appStorage: {
    pl: 'Zapisane mapy są w pamięci aplikacji. Telefon ich nie usunie; znikną dopiero po usunięciu obszaru albo aplikacji.',
    en: 'Saved maps are kept in the app’s storage. The phone will not delete them; they go only when you delete the area or the app.',
  },
  savedSize: { pl: 'Zapisane mapy', en: 'Saved maps' },
  iosHint: {
    pl: 'Na iPhonie dodaj aplikację do ekranu początkowego (Udostępnij → Do ekranu początkowego) i otwieraj ją stamtąd. Inaczej Safari usunie zapisane mapy po 7 dniach bez używania.',
    en: 'On iPhone, add the app to your Home Screen (Share → Add to Home Screen) and open it from there. Otherwise Safari deletes saved maps after 7 days without use.',
  },
  saveView: { pl: 'Zapisz widoczny obszar mapy', en: 'Save the visible map area' },
  zoomIn: {
    pl: `Przybliż mapę do obszaru mniejszego niż ${MAX_VIEW_KM2} km², żeby zapisać widok.`,
    en: `Zoom the map in to an area under ${MAX_VIEW_KM2} km² to save the view.`,
  },
  hintPages: {
    pl: 'Obwód, koło lub obwód polowania zbiorowego zapiszesz też przyciskiem „Zapisz offline” na jego stronie.',
    en: 'You can also save a district, club or a group hunt’s district with “Save offline” on its page.',
  },
  pickOpen: { pl: 'Wybierz obwody do zapisania', en: 'Choose districts to save' },
  pickTitle: { pl: 'Wybierz obwody', en: 'Choose districts' },
  pickHint: {
    pl: 'Wyszukaj koło, numer obwodu, nadleśnictwo lub powiat i zaznacz obwody, które chcesz mieć bez zasięgu (przy kole jednym przyciskiem wszystkie jego obwody), albo dotknij obwodu na mapie. Zapiszą się mapy tylko wokół granic zaznaczonych obwodów.',
    en: 'Search a club, district number, forest district or county and tick the districts you want without signal (for a club, all its districts with one button), or tap a district on the map. Maps are saved only around the borders of the ticked districts.',
  },
  pickTapNone: { pl: 'W tym miejscu nie ma obwodu łowieckiego.', en: 'There is no hunting district at this spot.' },
  pickSearch: { pl: 'Nr obwodu, koło, nadleśnictwo, powiat…', en: 'District no., club, forest district, county…' },
  pickClubs: { pl: 'Koła', en: 'Clubs' },
  pickDistrictsList: { pl: 'Obwody', en: 'Districts' },
  pickMoreClubs: { pl: 'Więcej kół pasuje do wyszukiwania – wpisz dokładniejszą nazwę lub miejscowość', en: 'More clubs match the search – type a more exact name or town' },
  pickClubAll: { pl: 'Zaznacz wszystkie obwody', en: 'Select all districts' },
  pickClubNone: { pl: 'Odznacz obwody koła', en: 'Untick the club’s districts' },
  pickClubTooMany: { pl: 'Za dużo obwodów naraz', en: 'Too many districts at once' },
  districtsCount: { pl: 'obw.', en: 'districts' },
  pickInView: { pl: 'Obwody widoczne na mapie', en: 'Districts visible on the map' },
  pickInViewLoading: { pl: 'Szukam obwodów na mapie…', en: 'Finding districts on the map…' },
  pickInViewNone: { pl: 'Na widocznej mapie nie ma obwodów. Przesuń lub przybliż mapę.', en: 'No districts on the visible map. Move or zoom the map.' },
  pickInViewTooBig: {
    pl: 'Przybliż mapę, żeby wybrać spośród widocznych obwodów.',
    en: 'Zoom the map in to pick from the visible districts.',
  },
  pickSelected: { pl: 'Zaznaczone', en: 'Selected' },
  pickNone: { pl: 'Nic nie zaznaczono.', en: 'Nothing selected.' },
  pickNoResults: { pl: 'Brak obwodów pasujących do wyszukiwania.', en: 'No districts match the search.' },
  pickMoreResults: { pl: 'Pokazano pierwsze wyniki – zawęź wyszukiwanie.', en: 'Showing the first results – narrow the search.' },
  pickMax: { pl: 'Naraz można zaznaczyć najwyżej', en: 'You can select at most' },
  pickSave: { pl: 'Dalej', en: 'Next' },
  pickClear: { pl: 'Odznacz wszystkie', en: 'Clear all' },
  pickUnselect: { pl: 'Odznacz', en: 'Untick' },
  pickLoadingList: { pl: 'Wczytywanie listy obwodów…', en: 'Loading the district list…' },
  districtNo: { pl: 'Obwód nr', en: 'District no.' },
  saved: { pl: 'Zapisane obszary', en: 'Saved areas' },
  none: { pl: 'Nic jeszcze nie zapisano.', en: 'Nothing saved yet.' },
  preparing: { pl: 'Wczytywanie granic obwodów…', en: 'Loading district borders…' },
  needOnline: { pl: 'Do zapisania mapy potrzebny jest internet.', en: 'Saving a map needs internet.' },
  newArea: { pl: 'Nowy obszar', en: 'New area' },
  districtsN: { pl: 'Obwody', en: 'Districts' },
  detail: { pl: 'Dokładność', en: 'Detail' },
  d16: { pl: 'Standardowa (zoom 16)', en: 'Standard (zoom 16)' },
  d17: { pl: 'Dokładniejsze zdjęcie lotnicze (zoom 17)', en: 'Closer aerial photo (zoom 17)' },
  d18: { pl: 'Bardzo dokładne zdjęcie lotnicze (zoom 18)', en: 'Very close aerial photo (zoom 18)' },
  d19: { pl: 'Najdokładniejsze zdjęcie lotnicze (zoom 19)', en: 'Closest aerial photo (zoom 19)' },
  deepTooBig: { pl: 'Za duży obszar na ten zoom (ponad 2 GB) – wybierz mniej obwodów.', en: 'Too large for this zoom (over 2 GB) – choose fewer districts.' },
  detailHint: {
    pl: 'Bliżej niż zapisany zoom mapa powiększa zapisane zdjęcie od razu, a gdy jest internet, podmienia je na ostrzejsze.',
    en: 'Closer than the saved zoom the map enlarges the saved photo straight away, and with internet swaps in a sharper one.',
  },
  about: { pl: 'ok.', en: 'about' },
  download: { pl: 'Pobierz', en: 'Download' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  tooBig: { pl: 'Za mało wolnego miejsca na ten obszar.', en: 'Not enough free space for this area.' },
  downloading: { pl: 'Pobieranie', en: 'Downloading' },
  waiting: { pl: 'Czeka w kolejce', en: 'Waiting in queue' },
  paused: { pl: 'Wstrzymane', en: 'Paused' },
  missing: { pl: 'kafelków nie pobrano', en: 'tiles not downloaded' },
  resume: { pl: 'Wznów', en: 'Resume' },
  savedOn: { pl: 'Zapisano', en: 'Saved' },
  show: { pl: 'Pokaż na mapie', en: 'Show on map' },
  update: { pl: 'Aktualizuj', en: 'Update' },
  updateHint: {
    pl: 'Dane BDL zmieniają się raz w roku (od 1 kwietnia). Zaktualizuj obszar po nowym roku łowieckim.',
    en: 'BDL data changes once a year (from 1 April). Update the area after the new hunting year starts.',
  },
  remove: { pl: 'Usuń', en: 'Delete' },
  sure: { pl: 'Na pewno usunąć?', en: 'Delete for sure?' },
  kind_district: { pl: 'Obwód', en: 'District' },
  kind_districts: { pl: 'Obwody', en: 'Districts' },
  kind_club: { pl: 'Koło', en: 'Club' },
  kind_view: { pl: 'Widok mapy', en: 'Map view' },
  kind_hunt: { pl: 'Polowanie', en: 'Hunt' },
  error: { pl: 'Nie udało się przygotować obszaru', en: 'Could not prepare the area' },
};
const l = (k: keyof typeof L) => tt(L[k]);
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Download time, roughly: "ok. 12 min", "ok. 1 godz. 20 min". */
const mins = (m: number) => {
  if (m < 1) return '< 1 min';
  const r = Math.round(m);
  const h = Math.floor(r / 60);
  return `${l('about')} ${h ? `${h} ${getLang() === 'pl' ? 'godz.' : 'h'} ` : ''}${r % 60 || !h ? `${r % 60} min` : ''}`.trim();
};
const mb = (bytes: number) => (bytes >= 1e9 ? `${fmtNum(bytes / 1e9, 1)} GB` : `${fmtNum(Math.max(bytes / 1e6, 0.1), bytes < 1e7 ? 1 : 0)} MB`);

export interface OfflineUiHost {
  rerender(): void;
  /** Visible map box, or null when the map is not shown. */
  mapBox(): Box | null;
  showBoxes(boxes: Box[]): void;
  /** The loaded district list (empty while it loads). */
  districts(): District[];
  /** Clubs (leaseholders) with their districts (empty while the list loads). */
  clubs(): Club[];
  /** Outlines the chosen districts on the map (an empty list clears it). */
  highlight(items: DistrictWithGeometry[]): void;
}

let host: OfflineUiHost = { rerender: () => {}, mapBox: () => null, showBoxes: () => {}, districts: () => [], clubs: () => [], highlight: () => {} };

/** Most districts saved together: a district is ~50 MB at zoom 16. */
export const MAX_PICK = 30;
/** Largest save at zoom 18 or 19, in bytes: a district is about 200 MB at 18 and 800 MB at 19;
 *  2 GB is about two hours' download. */
const MAX_DEEP_BYTES = 2e9;
const PICK_RESULTS = 40;
const PICK_CLUBS = 6;
/** Largest map view whose districts are listed for picking, in km² (about 25 districts). */
const PICK_VIEW_KM2 = 2500;
/** The district picker: search words, ticked district ids, and districts found in the map view. */
let pick: { q: string; ids: number[]; inView: 'loading' | number[] | null; inViewError: string | null; tapNote: string | null } | null = null;
/** District shapes already loaded, for outlining the chosen ones on the map. */
const shapes = new Map<number, DistrictWithGeometry>();

/** Whether the district picker is open (map taps then choose districts). */
export const pickActive = () => !!pick && !draft;

function toggle(id: number) {
  if (!pick) return;
  if (pick.ids.includes(id)) pick.ids = pick.ids.filter((x) => x !== id);
  else if (pick.ids.length < MAX_PICK) pick.ids = [...pick.ids, id];
  syncHighlight();
}

let shapeToken = 0;
/** Outlines the chosen districts, loading shapes it does not have yet. */
function syncHighlight() {
  const token = ++shapeToken;
  const ids = pick?.ids ?? [];
  const draw = () => {
    if (token === shapeToken) host.highlight(ids.map((i) => shapes.get(i)).filter((d): d is DistrictWithGeometry => !!d));
  };
  draw();
  const missing = ids.filter((i) => !shapes.has(i));
  if (missing.length && navigator.onLine)
    fetchDistrictsByIds(missing, 0.0002).then((got) => {
      for (const d of got) shapes.set(d.attributes.objectid, d);
      draw();
    }, () => {});
}

/** A tap on the map while the picker is open: ticks or unticks the district there. */
export function pickAtPoint(lat: number, lng: number) {
  const p = pick;
  if (!p) return;
  fetchDistrictsAtPoint(lat, lng).then(
    (found) => {
      if (pick !== p) return;
      for (const d of found) shapes.set(d.attributes.objectid, d);
      p.tapNote = found.length ? null : l('pickTapNone');
      if (found[0]) toggle(found[0].attributes.objectid);
      host.rerender();
    },
    (err: Error) => {
      if (pick !== p) return;
      p.tapNote = err.message;
      host.rerender();
    },
  );
}
let draft: { s: 'loading'; target: AreaTarget } | { s: 'ready'; d: Draft } | { s: 'error'; target: AreaTarget; msg: string } | null = null;
let detail: Detail = 16;
let storage: StorageInfo | null = null;
let confirmDelete: string | null = null;
let storageAt = 0;

export function initOfflineUi(h: OfflineUiHost) {
  host = h;
}

function refreshStorage() {
  if (Date.now() - storageAt < 3000) return;
  storageAt = Date.now();
  void storageInfo().then((s) => {
    storage = s;
    host.rerender();
  });
}

/** Opens the save panel for a district, club or hunt (call before showing the Offline tab). */
export function startDraft(target: AreaTarget) {
  confirmDelete = null;
  pick = null;
  draft = { s: 'loading', target };
  detail = 16;
  prepareDraft(target).then(
    (d) => {
      if (draft?.s === 'loading' && draft.target === target) draft = { s: 'ready', d };
      host.rerender();
    },
    (e: Error) => {
      if (draft?.s === 'loading' && draft.target === target) draft = { s: 'error', target, msg: e.message };
      host.rerender();
    },
  );
}

export function renderOffline(): string {
  refreshStorage();
  const online = navigator.onLine;
  const st = storage;
  const space =
    st?.usage != null
      ? `<p class="small">${l('used')}: <b>${mb(st.usage)}</b>${st.quota ? ` · ${mb(Math.max(0, st.quota - st.usage))} ${l('free')}` : ''}</p>`
      : '';
  // In the app saved tiles are files (tileFiles.ts): the browser's storage numbers do not apply.
  const appBytes = savedAreas().reduce((n, a) => n + a.bytes, 0);
  const persist = isApp()
    ? `${appBytes ? `<p class="small">${l('savedSize')}: <b>${mb(appBytes)}</b></p>` : ''}<p class="muted small">${ic('check', 16)} ${l('appStorage')}</p>`
    : st?.persisted === true
      ? `<p class="muted small">${ic('check', 16)} ${l('persisted')}</p>`
      : st?.persisted === false && savedAreas().length
        ? `<p class="muted small">${l('notPersisted')} <button type="button" class="btn small ghost" data-offline="persist">${l('keep')}</button></p>`
        : '';
  const ios = isIos() && !isInstalled() ? `<div class="notice small">${l('iosHint')}</div>` : '';
  const box = host.mapBox();
  const viewOk = online && box && boxKm2(box) <= MAX_VIEW_KM2;
  return `<h2>${l('title')}</h2>
    <p class="small">${l('intro')}</p>
    <p class="off-net ${online ? 'on' : 'off'} small"><span aria-hidden="true">●</span> ${online ? l('online') : l('offline')}</p>
    ${ios}${isApp() ? '' : space}${persist}
    ${renderDraft()}
    ${draft ? '' : pick ? renderPick() : `<div class="actions"><button type="button" class="btn" data-offline="pickOpen"${online ? '' : ' disabled'}>${ic('download')} ${l('pickOpen')}</button>
      <button type="button" class="btn ghost" data-offline="saveView"${viewOk ? '' : ' disabled'}>${l('saveView')}</button></div>
      ${online && !viewOk ? `<p class="muted small">${l('zoomIn')}</p>` : ''}
      <p class="muted small">${l('hintPages')}</p>`}
    <h3>${l('saved')}</h3>
    ${savedAreas().length ? `<ul class="off-list">${savedAreas().map(renderArea).join('')}</ul>` : `<p class="muted">${l('none')}</p>`}
    <p class="muted small">${l('updateHint')}</p>`;
}

const districtLabel = (d: District) => `${l('districtNo')} ${esc(d.hunt_dist_nr)} <span class="muted">· ${esc(cap(d.county_name))}</span>`;
const ha = (v: number | null) => (v == null ? '' : `${fmtNum(Math.round(v))} ha`);

function pickRow(d: District, checked: boolean, full: boolean): string {
  const disabled = !checked && full;
  return `<li><label class="off-pick-row${disabled ? ' disabled' : ''}">
    <input type="checkbox" data-offline="pickToggle" data-id="${d.objectid}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''} />
    <span><strong>${districtLabel(d)}</strong>
    <span class="meta">${esc(d.lease_holder_name ?? '–')}${d.total_area != null ? ` · ${ha(d.total_area)}` : ''}${d.inspectorate_name ? ` · ${esc(d.inspectorate_name)}` : ''}</span></span>
  </label></li>`;
}

function renderPick(): string {
  if (!pick) return '';
  const all = host.districts();
  const byId = new Map(all.map((d) => [d.objectid, d]));
  const chosen = pick.ids.map((id) => byId.get(id)).filter((d): d is District => !!d);
  const full = pick.ids.length >= MAX_PICK;
  const terms = searchTerms(pick.q);
  let results: District[] = [];
  let more = false;
  let note = '';
  if (terms.length) {
    const found = all
      .filter((d) => districtMatches(d, terms))
      .sort((a, b) => (a.county_name ?? '').localeCompare(b.county_name ?? '', 'pl') || Number(a.hunt_dist_nr) - Number(b.hunt_dist_nr));
    more = found.length > PICK_RESULTS;
    results = found.slice(0, PICK_RESULTS);
    if (!found.length) note = l('pickNoResults');
  } else if (pick.inView === 'loading') note = l('pickInViewLoading');
  else if (pick.inViewError) note = pick.inViewError;
  else if (Array.isArray(pick.inView)) {
    results = pick.inView.map((id) => byId.get(id)).filter((d): d is District => !!d);
    if (!results.length) note = l('pickInViewNone');
  }
  const box = host.mapBox();
  const viewOk = !!box && boxKm2(box) <= PICK_VIEW_KM2;
  const selected = new Set(pick.ids);
  const clubsAll = matchingClubs(pick.q);
  const clubs = clubsAll.slice(0, PICK_CLUBS);
  const clubRow = (c: Club) => {
    const ids = c.districts.map((d) => d.objectid);
    const all = ids.every((i) => selected.has(i));
    const extra = ids.filter((i) => !selected.has(i)).length;
    const tooMany = !all && pick!.ids.length + extra > MAX_PICK;
    return `<li class="off-pick-club">
      <span><strong>${esc(c.name)}</strong>
      <span class="meta">${c.districts.length} ${l('districtsCount')} · ${ha(c.totalArea)}${c.voivodeships.length ? ` · ${esc(c.voivodeships.map(cap).join(', '))}` : ''}</span></span>
      <button type="button" class="btn small${all ? ' ghost' : ''}" data-offline="${all ? 'pickClubNone' : 'pickClubAll'}" data-key="${esc(c.key)}"${tooMany ? ' disabled' : ''}>${all ? l('pickClubNone') : tooMany ? l('pickClubTooMany') : `${l('pickClubAll')} (${c.districts.length})`}</button>
    </li>`;
  };
  return `<div class="card off-draft off-pick">
    <p class="eyebrow">${l('newArea')}</p>
    <h3>${l('pickTitle')}</h3>
    <p class="muted small">${l('pickHint')}</p>
    ${!all.length ? `<p class="muted">${l('pickLoadingList')}</p>` : `
    <div class="searchbar"><input type="search" data-offline-q placeholder="${esc(l('pickSearch'))}" value="${esc(pick.q)}" aria-label="${esc(l('pickSearch'))}" /></div>
    <div class="actions"><button type="button" class="btn small ghost" data-offline="pickInView"${viewOk ? '' : ' disabled'}>${ic('map', 16)} ${l('pickInView')}</button></div>
    ${box && !viewOk ? `<p class="muted small">${l('pickInViewTooBig')}</p>` : ''}
    ${clubs.length ? `<p class="off-pick-sub small">${l('pickClubs')}</p><ul class="off-pick-clubs">${clubs.map(clubRow).join('')}</ul>${clubsAll.length > clubs.length ? `<p class="muted small">${l('pickMoreClubs')} (${clubsAll.length})</p>` : ''}${results.length ? `<p class="off-pick-sub small">${l('pickDistrictsList')}</p>` : ''}` : ''}
    ${note && !clubs.length ? `<p class="muted small">${esc(note)}</p>` : ''}
    ${pick.tapNote ? `<p class="notice small">${esc(pick.tapNote)}</p>` : ''}
    ${results.length ? `<ul class="off-pick-list">${results.map((d) => pickRow(d, selected.has(d.objectid), full)).join('')}</ul>` : ''}
    ${more ? `<p class="muted small">${l('pickMoreResults')}</p>` : ''}`}
    <p class="off-pick-head small"><b>${l('pickSelected')}: ${pick.ids.length}</b>${pick.ids.length ? ` <button type="button" class="btn small ghost" data-offline="pickClear">${l('pickClear')}</button>` : ''}</p>
    ${chosen.length ? `<ul class="off-pick-chosen">${chosen
      .map((d) => `<li class="chip">${l('districtNo')} ${esc(d.hunt_dist_nr)} · ${esc(cap(d.county_name))}
        <button type="button" data-offline="pickToggle" data-id="${d.objectid}" aria-label="${esc(l('pickUnselect'))}">×</button></li>`)
      .join('')}</ul>` : `<p class="muted small">${l('pickNone')}</p>`}
    ${full ? `<p class="muted small">${l('pickMax')} ${MAX_PICK}.</p>` : ''}
    <div class="actions"><button type="button" class="btn" data-offline="pickSave"${pick.ids.length && navigator.onLine ? '' : ' disabled'}>${l('pickSave')}</button>
      <button type="button" class="btn ghost" data-offline="pickCancel">${l('cancel')}</button></div>
  </div>`;
}

/** Clubs whose name has every search word (from 3 letters typed), with most districts first; the first few are shown. */
function matchingClubs(q: string): Club[] {
  const terms = searchTerms(q);
  if (terms.join('').length < 3) return [];
  return host
    .clubs()
    .filter((c) => c.districts.length && terms.every((tm) => fold(c.name).includes(tm)))
    .sort((a, b) => b.districts.length - a.districts.length || a.name.localeCompare(b.name, 'pl'));
}

/** Typing in the picker's search field; true when handled. */
export function handleOfflineInput(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement) || !('offlineQ' in el.dataset) || !pick) return false;
  pick.q = el.value;
  const pos = el.selectionStart;
  host.rerender();
  const again = document.querySelector<HTMLInputElement>('input[data-offline-q]');
  if (again) {
    again.focus();
    again.setSelectionRange(pos, pos);
  }
  return true;
}

function loadInView() {
  if (!pick) return;
  const box = host.mapBox();
  if (!box || boxKm2(box) > PICK_VIEW_KM2) return;
  const p = pick;
  p.q = '';
  p.inView = 'loading';
  p.inViewError = null;
  const [s, w, n, e] = box;
  fetchOutlinesInBounds(s, w, n, e, 0.001, 1).then(
    (outlines) => {
      if (pick !== p) return;
      const known = new Set(host.districts().map((d) => d.objectid));
      p.inView = [...new Set(outlines.map((o) => o.objectid))].filter((id) => known.has(id));
      host.rerender();
    },
    (err: Error) => {
      if (pick !== p) return;
      p.inView = null;
      p.inViewError = err.message;
      host.rerender();
    },
  );
}

function renderDraft(): string {
  if (!draft) return '';
  const cancel = `<button type="button" class="btn ghost" data-offline="cancelDraft">${l('cancel')}</button>`;
  if (!navigator.onLine && draft.s !== 'ready')
    return `<div class="card off-draft"><p>${l('needOnline')}</p><div class="actions">${cancel}</div></div>`;
  if (draft.s === 'loading')
    return `<div class="card off-draft"><h3>${esc(draft.target.name)}</h3><p class="muted">${l('preparing')}</p><div class="actions">${cancel}</div></div>`;
  if (draft.s === 'error')
    return `<div class="card off-draft"><h3>${esc(draft.target.name)}</h3><div class="notice error"><strong>${l('error')}</strong><p>${esc(draft.msg)}</p></div><div class="actions">${cancel}</div></div>`;
  const d = draft.d;
  const free = storage?.quota != null && storage.usage != null ? storage.quota - storage.usage : null;
  const opt = (v: Detail) => {
    const e = draftEstimate(d, v);
    const bytes = e.mb * 1.048576e6;
    const off = v >= 18 && bytes > MAX_DEEP_BYTES;
    return `<label class="off-opt${off ? ' disabled' : ''}"><input type="radio" name="offDetail" data-offline="detail" value="${v}"${detail === v && !off ? ' checked' : ''}${off ? ' disabled' : ''} />
      <span>${l(`d${v}`)} <b>~${mb(bytes)}</b> <span class="muted">· ${mins(e.minutes)}</span>${off ? `<br><span class="muted small">${l('deepTooBig')}</span>` : ''}</span></label>`;
  };
  const need = draftEstimate(d, detail).mb * 1.048576e6;
  const tooBig = free != null && need > free * 0.9;
  return `<div class="card off-draft">
    <p class="eyebrow">${l('newArea')}</p>
    <h3>${esc(d.name)}</h3>
    <p class="muted small">${d.ids.length > 1 || d.kind === 'club' ? `${l('districtsN')}: ${d.ids.length} · ` : ''}${fmtNum(draftKm2(d))} km²</p>
    <fieldset class="off-detail"><legend>${l('detail')}</legend>${DETAILS.map(opt).join('')}<p class="muted small">${l('detailHint')}</p></fieldset>
    ${tooBig ? `<p class="notice error small">${l('tooBig')}</p>` : ''}
    <div class="actions"><button type="button" class="btn" data-offline="save"${tooBig || !navigator.onLine ? ' disabled' : ''}>${l('download')}</button>${cancel}</div>
  </div>`;
}

function renderArea(a: SavedArea): string {
  const pct = a.total ? Math.floor((a.done / a.total) * 100) : 0;
  const date = new Date(a.updated).toLocaleDateString(getLang() === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const running = isRunning(a.id);
  let status: string;
  if (a.status === 'downloading')
    status = `<p class="small">${running && a.total ? `${l('downloading')} ${pct}% (${fmtNum(a.done)} / ${fmtNum(a.total)})` : l('waiting')}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>`;
  else if (a.status === 'paused')
    status = `<p class="small">${l('paused')} · ${pct}%${a.total > a.done ? ` · ${fmtNum(a.total - a.done)} ${l('missing')}` : ''}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>`;
  else status = `<p class="muted small">${l('savedOn')} ${date} · ${mb(a.bytes)} · zoom ${a.detail}</p>`;
  const del =
    confirmDelete === a.id
      ? `<button type="button" class="btn small danger" data-offline="delete" data-id="${a.id}">${l('sure')}</button>
         <button type="button" class="btn small ghost" data-offline="unconfirm">${l('cancel')}</button>`
      : `<button type="button" class="btn small ghost" data-offline="askDelete" data-id="${a.id}">${l('remove')}</button>`;
  return `<li class="card">
    <p class="eyebrow">${l(a.kind === 'district' && a.ids.length > 1 ? 'kind_districts' : (`kind_${a.kind}` as keyof typeof L))}</p>
    <strong>${esc(a.name)}</strong>
    ${status}
    <div class="actions">
      <button type="button" class="btn small ghost" data-offline="show" data-id="${a.id}">${l('show')}</button>
      ${a.status === 'paused' && !running && navigator.onLine ? `<button type="button" class="btn small" data-offline="resume" data-id="${a.id}">${l('resume')}</button>` : ''}
      ${a.status === 'done' && navigator.onLine ? `<button type="button" class="btn small ghost" data-offline="update" data-id="${a.id}">${l('update')}</button>` : ''}
      ${del}
    </div>
  </li>`;
}

/** Handles clicks and changes on [data-offline] elements; true when handled. */
export function handleOfflineEvent(el: HTMLElement): boolean {
  const action = el.dataset.offline;
  if (!action) return false;
  const id = el.dataset.id ?? '';
  switch (action) {
    case 'saveView': {
      const box = host.mapBox();
      if (!box) break;
      const name = `${l('kind_view')} ${box[0].toFixed(3)}, ${box[1].toFixed(3)}`;
      startDraft({ kind: 'view', name, ids: [], box });
      break;
    }
    case 'pickOpen':
      pick = { q: '', ids: [], inView: null, inViewError: null, tapNote: null };
      // Start from what the map shows: usually the hunter is already looking at their area.
      loadInView();
      break;
    case 'pickInView':
      loadInView();
      break;
    case 'pickToggle':
      if (pick) pick.tapNote = null;
      toggle(Number(id));
      break;
    case 'pickClubAll':
    case 'pickClubNone': {
      const c = pick && host.clubs().find((x) => x.key === el.dataset.key);
      if (!pick || !c) break;
      const ids = c.districts.map((d) => d.objectid);
      if (action === 'pickClubNone') pick.ids = pick.ids.filter((i) => !ids.includes(i));
      else {
        const add = ids.filter((i) => !pick!.ids.includes(i));
        if (pick.ids.length + add.length <= MAX_PICK) pick.ids = [...pick.ids, ...add];
      }
      pick.tapNote = null;
      syncHighlight();
      break;
    }
    case 'pickClear':
      if (pick) pick.ids = [];
      syncHighlight();
      break;
    case 'pickCancel':
      pick = null;
      syncHighlight();
      break;
    case 'pickSave': {
      if (!pick?.ids.length) break;
      const byId = new Map(host.districts().map((d) => [d.objectid, d]));
      const ds = pick.ids.map((i) => byId.get(i)).filter((d): d is District => !!d);
      const ids = ds.map((d) => d.objectid);
      pick = null;
      // Exactly one club's districts are saved as that club, like from the club's page.
      const set = new Set(ids);
      const club = host.clubs().find((c) => c.districts.length === set.size && c.districts.every((d) => set.has(d.objectid)));
      // The outlines stay on the map while the size is shown.
      if (club) startDraft({ kind: 'club', name: club.name, ids });
      else if (ids.length) startDraft({ kind: 'district', name: pickName(ds), ids });
      break;
    }
    case 'detail':
      {
        const v = Number((el as HTMLInputElement).value);
        detail = isDetail(v) ? v : 16;
      }
      break;
    case 'save':
      if (draft?.s === 'ready') {
        const d = draft.d;
        draft = null;
        host.highlight([]);
        void saveDraft(d, detail).then(() => {
          refreshStorage();
          host.rerender();
        });
      }
      break;
    case 'cancelDraft':
      draft = null;
      host.highlight([]);
      break;
    case 'show': {
      const a = savedAreas().find((x) => x.id === id);
      if (a) host.showBoxes(a.boxes);
      return true;
    }
    case 'resume':
      resumeArea(id);
      break;
    case 'update':
      void updateArea(id);
      break;
    case 'askDelete':
      confirmDelete = id;
      break;
    case 'unconfirm':
      confirmDelete = null;
      break;
    case 'delete':
      confirmDelete = null;
      void removeArea(id).then(() => {
        storageAt = 0;
        refreshStorage();
      });
      break;
    case 'persist':
      void requestPersistence().then(() => {
        storageAt = 0;
        refreshStorage();
      });
      break;
    default:
      return false;
  }
  host.rerender();
  return true;
}
