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
import { boxKm2, type Box, type Detail } from './tiles';
import { isApp } from './platform';
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
    pl: 'Obwód, koło lub obwód polowania zbiorowego zapiszesz przyciskiem „Zapisz offline” na jego stronie.',
    en: 'To save a district, club or a group hunt’s district, use “Save offline” on its page.',
  },
  saved: { pl: 'Zapisane obszary', en: 'Saved areas' },
  none: { pl: 'Nic jeszcze nie zapisano.', en: 'Nothing saved yet.' },
  preparing: { pl: 'Wczytywanie granic obwodów…', en: 'Loading district borders…' },
  needOnline: { pl: 'Do zapisania mapy potrzebny jest internet.', en: 'Saving a map needs internet.' },
  newArea: { pl: 'Nowy obszar', en: 'New area' },
  districtsN: { pl: 'Obwody', en: 'Districts' },
  detail: { pl: 'Dokładność', en: 'Detail' },
  d16: { pl: 'Standardowa (zoom 16)', en: 'Standard (zoom 16)' },
  d17: { pl: 'Dokładniejsze zdjęcie lotnicze (zoom 17)', en: 'Closer aerial photo (zoom 17)' },
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
  kind_club: { pl: 'Koło', en: 'Club' },
  kind_view: { pl: 'Widok mapy', en: 'Map view' },
  kind_hunt: { pl: 'Polowanie', en: 'Hunt' },
  error: { pl: 'Nie udało się przygotować obszaru', en: 'Could not prepare the area' },
};
const l = (k: keyof typeof L) => tt(L[k]);
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mb = (bytes: number) => (bytes >= 1e9 ? `${fmtNum(bytes / 1e9, 1)} GB` : `${fmtNum(Math.max(bytes / 1e6, 0.1), bytes < 1e7 ? 1 : 0)} MB`);

export interface OfflineUiHost {
  rerender(): void;
  /** Visible map box, or null when the map is not shown. */
  mapBox(): Box | null;
  showBoxes(boxes: Box[]): void;
}

let host: OfflineUiHost = { rerender: () => {}, mapBox: () => null, showBoxes: () => {} };
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
    ${draft ? '' : `<div class="actions"><button type="button" class="btn" data-offline="saveView"${viewOk ? '' : ' disabled'}>${l('saveView')}</button></div>
      ${online && !viewOk ? `<p class="muted small">${l('zoomIn')}</p>` : ''}
      <p class="muted small">${l('hintPages')}</p>`}
    <h3>${l('saved')}</h3>
    ${savedAreas().length ? `<ul class="off-list">${savedAreas().map(renderArea).join('')}</ul>` : `<p class="muted">${l('none')}</p>`}
    <p class="muted small">${l('updateHint')}</p>`;
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
    return `<label class="off-opt"><input type="radio" name="offDetail" data-offline="detail" value="${v}"${detail === v ? ' checked' : ''} />
      <span>${l(v === 16 ? 'd16' : 'd17')} <b>~${mb(e.mb * 1e6 * 1.048576)}</b></span></label>`;
  };
  const need = draftEstimate(d, detail).mb * 1.048576e6;
  const tooBig = free != null && need > free * 0.9;
  return `<div class="card off-draft">
    <p class="eyebrow">${l('newArea')}</p>
    <h3>${esc(d.name)}</h3>
    <p class="muted small">${d.ids.length ? `${l('districtsN')}: ${d.ids.length} · ` : ''}${fmtNum(draftKm2(d))} km²</p>
    <fieldset class="off-detail"><legend>${l('detail')}</legend>${opt(16)}${opt(17)}</fieldset>
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
    <p class="eyebrow">${l(`kind_${a.kind}` as keyof typeof L)}</p>
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
    case 'detail':
      detail = Number((el as HTMLInputElement).value) === 17 ? 17 : 16;
      break;
    case 'save':
      if (draft?.s === 'ready') {
        const d = draft.d;
        draft = null;
        void saveDraft(d, detail).then(() => {
          refreshStorage();
          host.rerender();
        });
      }
      break;
    case 'cancelDraft':
      draft = null;
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
