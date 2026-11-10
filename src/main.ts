import './fonts.css';
import './tokens.css';
import './style.css';
import { fetchDistrictsAtPoint, fetchDistrictsByIds, BDL_WMS_DISTRICTS, type District } from './bdl';
import {
  groupClubs,
  statsBy,
  countByType,
  clubKey,
  fold,
  holderType,
  districtSlug,
  findBySlug,
  type Club,
  type HolderType,
} from './data';
import { createMap, type MapApi } from './map';
import { t, tt, getLang, setLang, fmtHa, fmtKm2, fmtNum, type Key } from './i18n';
import { ic } from './icons';
import { applyTheme, getThemePref, nextThemePref, setThemePref, watchSystemTheme, type ThemePref } from './theme';
import { AREAS, KNOW_PAGES, MAP_TABS, areaOf, knowPageOf, knowView, viewToHash, hashToView, type Area, type KnowPage, type MapTab, type Tab, type View } from './nav';
import { createSheet } from './sheet';
import { SEASONS, isOpen, effective, formatRanges, yearFrac, openOnlyIn, type Season } from './seasons';
import { renderExams, handleExamClick, handleExamChange, drillSpecies } from './examUi';
import { renderWeather, handleWeatherClick, handleWeatherInput, handleWeatherSubmit, showWeatherAt } from './weatherUi';
import { renderBallistics, handleBallisticsClick, handleBallisticsChange, handleBallisticsSubmit } from './ballisticsUi';
import { renderHunts, handleHuntClick, handleHuntInput, handleHuntSubmit, handleHuntChange, leaveHunts, mountHuntMap, huntBack, huntPhoneBack } from './huntUi';
import { renderAtlas, handleAtlasClick, handleAtlasInput, setAtlasVoivodeship } from './atlasUi';
import { speciesForSeason } from './atlas';
import { initOffline, onOfflineChange } from './offline';
import { initOfflineUi, renderOffline, handleOfflineEvent, startDraft } from './offlineUi';
import type { AreaTarget } from './offline';
import { loadDistrictList, checkDistrictUpdate, type DistrictList, type SnapshotMeta } from './districtData';
import { isApp, publicHref, copyText, initDeepLinks, appVersion, checkForAppUpdate, dismissUpdate, onBackButton, minimizeApp, APK_URL } from './platform';

// ---------------------------------------------------------------- helpers

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const typeKey = (h: HolderType) => `type_${h}` as Key;
const cap = (s: string | null) => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : '—');

const state = {
  districts: [] as District[],
  /** Which built-in or downloaded list is in use; null = loaded straight from BDL. */
  dataMeta: null as SnapshotMeta | null,
  clubs: [] as Club[],
  clubsByKey: new Map<string, Club>(),
  loaded: false,
  error: '' as string,
  progress: [0, 0] as [number, number],
  tab: 'clubs' as Tab,
  view: { kind: 'tab', tab: 'clubs' } as View,
  q: { clubs: '', districts: '' },
  voiv: '',
  board: '',
  type: '' as '' | HolderType,
  limit: 100,
  seasonVoiv: loadSeasonVoiv(),
};

function loadSeasonVoiv(): string {
  try {
    return localStorage.getItem('seasonVoiv') ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- layout

document.documentElement.lang = getLang();
applyTheme();
watchSystemTheme(() => renderStatic());
const app = $('#app');
app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path class="bm-pin" d="M16 2c6.1 0 11 4.7 11 10.6 0 7.4-8.3 15.1-11 17.4-2.7-2.3-11-10-11-17.4C5 6.700 9.900 2 16 2Z"/><path class="bm-tree" d="M16 6l-5 7h2.600l-3.600 5h5v3h2v-3h5l-3.600-5H21z"/></svg>
      <div><h1><span data-t="title"></span><span class="cur-section" id="cursection"></span></h1><p data-t="subtitle"></p></div>
    </div>
    <nav class="sections" id="sections"></nav>
    <span class="netbadge" id="netbadge" hidden></span>
    <div class="topbar-tools" id="tools"></div>
  </header>
  <main class="layout">
    <aside class="panel" id="panel">
      <button class="sheet-handle" id="sheethandle" type="button"><span aria-hidden="true"></span></button>
      <nav class="tabs" id="tabs" role="tablist"></nav>
      <section class="content" id="content" aria-live="polite"></section>
    </aside>
    <div class="mapwrap">
      <div id="map"></div>
      <button id="locate" class="locate" type="button"></button>
      <details class="legend" id="legend"><summary data-t="legend"></summary>
        <img alt="" src="${BDL_WMS_DISTRICTS}?request=GetLegendGraphic&version=1.3.0&format=image/png&layer=0" />
      </details>
    </div>
  </main>
  <nav class="bottomnav" id="bottomnav"></nav>`;

const content = $('#content');
const mapApi: MapApi = createMap($('#map'), (lat, lng) => navigate({ kind: 'point', lat, lng }));

// The five destinations: a bar at the bottom on a phone, at the top on a computer (see nav.ts).
// "map" keeps the map with its lists; every other area is a full-width page without the map.
const AREA_LABEL: Record<Area, Key> = { map: 'sectionMap', hunt: 'areaHunt', weather: 'tabWeather', know: 'areaKnow', more: 'areaMore' };
const AREA_ICON = { map: 'map', hunt: 'users', weather: 'sunCloud', know: 'book', more: 'more' } as const;
const KNOW_LABEL: Record<KnowPage, Key> = { seasons: 'knowSeasons', atlas: 'knowAtlas', exams: 'knowExams', ballistics: 'knowBallistics' };
const KNOW_TITLE: Record<KnowPage, Key> = { seasons: 'tabSeasons', atlas: 'tabAtlas', exams: 'tabExams', ballistics: 'tabBallistics' };
const MAP_TAB_LABEL: Record<MapTab, Key> = { clubs: 'tabClubs', districts: 'tabDistricts', stats: 'tabStats', offline: 'tabOffline' };
let lastArea: Area = 'map';
/** Where each area was left, so coming back to it returns to the same place. */
const lastIn: Partial<Record<Area, View>> = {};
const areaHome = (a: Area): View =>
  a === 'map' ? { kind: 'tab', tab: 'clubs' } : a === 'know' ? { kind: 'tab', tab: 'seasons' } : a === 'more' ? { kind: 'tab', tab: 'more' } : { kind: 'tab', tab: a };

// On a phone the panel beside the map is a pull-up sheet over it.
const phone = matchMedia('(max-width: 760px)');
const sheet = createSheet($('#panel'), $('#sheethandle'), () => phone.matches && areaOf(state.view) === 'map');

// ---------------------------------------------------------------- routing

function navigate(v: View, push = true) {
  state.view = v;
  if (v.kind === 'tab') state.tab = v.tab;
  if (push) {
    const h = viewToHash(v);
    if (h !== location.hash) history.pushState(null, '', h || location.pathname + location.search);
  }
  // A tapped district, club or point opens the sheet half way: details below, the place above.
  if (v.kind === 'district' || v.kind === 'club' || v.kind === 'point') sheet.set('half');
  else if (v.kind === 'tab' && (MAP_TABS as readonly string[]).includes(v.tab) && v.tab !== 'clubs' && sheet.get() === 'peek') sheet.set('half');
  render();
  onViewMapEffects(v);
}
window.addEventListener('popstate', () => navigate(hashToView(location.hash), false));

// ---------------------------------------------------------------- map effects

let effectToken = 0;
async function onViewMapEffects(v: View) {
  const token = ++effectToken;
  if (v.kind === 'tab' || v.kind === 'hunt' || v.kind === 'atlas') return;
  try {
    if (v.kind === 'point') {
      pointResult = { status: 'loading' };
      render();
      const res = await fetchDistrictsAtPoint(v.lat, v.lng);
      if (token !== effectToken) return;
      pointResult = { status: 'done', items: res.map((r) => r.attributes) };
      mapApi.highlight(res, { marker: [v.lat, v.lng], padBottom: sheet.cover() });
      render();
    } else if (v.kind === 'district') {
      const d = findBySlug(state.districts, v.slug);
      if (!d) return;
      const res = await fetchDistrictsByIds([d.objectid], 0.00005);
      if (token === effectToken) mapApi.highlight(res, { fit: true, padBottom: sheet.cover() });
    } else if (v.kind === 'club') {
      const c = state.clubsByKey.get(v.key);
      if (!c) return;
      const res = await fetchDistrictsByIds(c.districts.map((d) => d.objectid));
      if (token === effectToken) mapApi.highlight(res, { fit: true, padBottom: sheet.cover() });
    }
  } catch (e) {
    if (token !== effectToken) return;
    if (v.kind === 'point') {
      pointResult = { status: 'error', message: (e as Error).message };
      render();
    } else toast((e as Error).message);
  }
}

let pointResult: { status: 'loading' } | { status: 'done'; items: District[] } | { status: 'error'; message: string } = {
  status: 'loading',
};

// ---------------------------------------------------------------- rendering

const THEME_LABEL: Record<ThemePref, Key> = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };
const THEME_ICON = { auto: 'themeAuto', light: 'sun', dark: 'moon' } as const;
/** Cycles automatic → light → dark. It sits with the sections: a small icon on a computer, a menu row on a phone. */
function themeButton(): string {
  const pref = getThemePref();
  const label = `${t('theme')}: ${t(THEME_LABEL[pref])}`;
  return `<button type="button" class="themebtn" id="themebtn" title="${label}" aria-label="${label}">${ic(THEME_ICON[pref], 20)}<span>${label}</span></button>`;
}

function areaButtons(area: Area, icons: boolean): string {
  return AREAS.map(
    (id) => `<button type="button" data-area="${id}" aria-current="${area === id ? 'page' : 'false'}">${icons ? ic(AREA_ICON[id], 24) : ''}<span>${t(AREA_LABEL[id])}</span></button>`,
  ).join('');
}

function renderStatic() {
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
  $('#locate').innerHTML = `${ic('locate')}<span>${t('locate')}</span>`;
  const nb = $('#netbadge');
  nb.hidden = navigator.onLine;
  nb.textContent = t('offlineBadge');
  document.title = t('title');
  const v = state.view;
  const area = areaOf(v);
  const know = knowPageOf(v);
  $('#sections').innerHTML = areaButtons(area, false);
  $('#sections').setAttribute('aria-label', t('mainNav'));
  $('#bottomnav').innerHTML = areaButtons(area, true);
  $('#bottomnav').setAttribute('aria-label', t('mainNav'));
  $('#tools').innerHTML = `<button class="lang" id="lang" type="button" aria-label="${t('language')}">${getLang() === 'pl' ? 'EN' : 'PL'}</button>${themeButton()}`;
  $('#sheethandle').setAttribute('aria-label', t('sheetToggle'));
  // Beside the app's name on a phone: where you are.
  const here: Key = know ? KNOW_TITLE[know] : area === 'hunt' ? 'tabHunt' : v.kind === 'tab' && v.tab === 'about' ? 'tabAbout' : AREA_LABEL[area];
  $('#cursection').textContent = t(here);
  app.classList.toggle('page-mode', area !== 'map');
  for (const a of AREAS) app.classList.toggle(`area-${a}`, a === area);
  if (area !== lastArea) {
    lastArea = area;
    content.scrollTop = 0;
    // Leaflet needs a size refresh after its container was hidden.
    if (area === 'map') setTimeout(() => mapApi.map.invalidateSize(), 0);
  }
  lastIn[area] = v;
  $('#tabs').innerHTML =
    area === 'map'
      ? MAP_TABS.map(
          (id) => `<button role="tab" type="button" data-tab="${id}" aria-selected="${v.kind === 'tab' && state.tab === id}">${t(MAP_TAB_LABEL[id])}</button>`,
        ).join('')
      : area === 'know'
        ? KNOW_PAGES.map((id) => `<button role="tab" type="button" data-know="${id}" aria-selected="${know === id}">${t(KNOW_LABEL[id])}</button>`).join('')
        : '';
}

function render() {
  renderStatic();
  const v = state.view;
  if (v.kind === 'point') return void (content.innerHTML = renderPoint());
  if (v.kind === 'tab' && v.tab === 'exams') return void (content.innerHTML = renderExams(render));
  if (v.kind === 'tab' && v.tab === 'weather') return void (content.innerHTML = renderWeather(render));
  if (v.kind === 'tab' && v.tab === 'ballistics') return void (content.innerHTML = renderBallistics(render));
  if (v.kind === 'atlas') {
    setAtlasVoivodeship(state.seasonVoiv);
    leaveHunts();
    content.innerHTML = renderAtlas(v.slug, render);
    return;
  }
  if (v.kind === 'hunt' || (v.kind === 'tab' && v.tab === 'hunt')) return renderHuntSection(v.kind === 'hunt' ? v.id : null, v.kind === 'hunt' ? v.invite : undefined);
  leaveHunts();
  if (v.kind === 'tab' && v.tab === 'offline') return void (content.innerHTML = renderOffline());
  if (v.kind === 'tab' && (v.tab === 'seasons' || v.tab === 'about' || v.tab === 'more')) {
    content.innerHTML = v.tab === 'seasons' ? renderSeasons() : v.tab === 'about' ? renderAbout() : renderMore();
    return;
  }
  if (!state.loaded) return void (content.innerHTML = renderLoading());
  switch (v.kind) {
    case 'tab':
      content.innerHTML = v.tab === 'clubs' ? renderClubList() : v.tab === 'districts' ? renderDistrictList() : renderStats();
      break;
    case 'district': {
      const d = findBySlug(state.districts, v.slug);
      content.innerHTML = d ? renderDistrict(d) : `<p class="muted">${t('noResults')}</p>`;
      break;
    }
    case 'club': {
      const c = state.clubsByKey.get(v.key);
      content.innerHTML = c ? renderClub(c) : `<p class="muted">${t('noResults')}</p>`;
      break;
    }
  }
}

function renderHuntSection(id: string | null, invite?: string) {
  const goTo = (to: string | null) => navigate(to ? { kind: 'hunt', id: to } : { kind: 'tab', tab: 'hunt' });
  // Keep the focused field and caret when live updates re-render the page while someone types.
  const active = document.activeElement as HTMLInputElement | null;
  const focusName = active && content.contains(active) && active.name ? active.name : null;
  const caret = focusName ? [active!.selectionStart, active!.selectionEnd] : null;
  content.innerHTML = renderHunts(id, invite, {
    onChange: render,
    go: goTo,
    districts: () => ({ list: state.loaded ? state.districts : null, error: state.error }),
    saveOffline: (d) => saveOffline({ kind: 'hunt', name: d.label, ids: [d.id] }),
  });
  mountHuntMap();
  if (focusName) {
    const again = content.querySelector<HTMLInputElement>(`[name="${focusName}"]`);
    if (again && again !== document.activeElement) {
      again.focus();
      try {
        if (caret && caret[0] != null) again.setSelectionRange(caret[0], caret[1]);
      } catch {
        /* not a text field */
      }
    }
  }
}

function renderLoading() {
  if (state.error)
    return `<div class="notice error"><strong>${t('loadError')}</strong><p>${esc(state.error)}</p>
      <button type="button" class="btn" data-action="retry">${t('retry')}</button></div>`;
  const [a, b] = state.progress;
  const pct = b ? Math.round((a / b) * 100) : 0;
  return `<div class="notice"><p>${t('loading')}</p><div class="progress"><span style="width:${pct}%"></span></div>
    <p class="muted small">${b ? `${fmtNum(a)} / ${fmtNum(b)}` : ''}</p><p class="muted small">${t('clickHint')}</p></div>`;
}

function filterSelects(includeType: boolean) {
  const voivs = [...new Set(state.districts.map((d) => d.county_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pl'));
  const boards = [
    ...new Set(
      state.districts.filter((d) => !state.voiv || d.county_name === state.voiv).map((d) => d.reg_mng_board_name).filter(Boolean) as string[],
    ),
  ].sort((a, b) => a.localeCompare(b, 'pl'));
  const opt = (v: string, label: string, sel: string) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`;
  const types: HolderType[] = ['club', 'pzl', 'pgl', 'other'];
  return `<div class="filters">
    <select data-filter="voiv" aria-label="${t('voivodeship')}">${opt('', t('allVoivodeships'), state.voiv)}${voivs.map((v) => opt(v, cap(v), state.voiv)).join('')}</select>
    <select data-filter="board" aria-label="${t('pzlBoard')}">${opt('', t('allBoards'), state.board)}${boards.map((v) => opt(v, v, state.board)).join('')}</select>
    ${includeType ? `<select data-filter="type" aria-label="${t('holderType')}">${opt('', t('allTypes'), state.type)}${types.map((v) => opt(v, t(typeKey(v)), state.type)).join('')}</select>` : ''}
  </div>`;
}

function matchFilters(d: District) {
  return (
    (!state.voiv || d.county_name === state.voiv) &&
    (!state.board || d.reg_mng_board_name === state.board) &&
    (!state.type || holderType(d.lease_group_name) === state.type)
  );
}

function badge(h: HolderType) {
  return `<span class="badge b-${h}">${t(typeKey(h))}</span>`;
}

function renderClubList() {
  const q = fold(state.q.clubs.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  const list = state.clubs.filter(
    (c) =>
      c.districts.some(matchFilters) &&
      (!terms.length || terms.every((tm) => fold(c.name + ' ' + c.forestDistricts.join(' ') + ' ' + c.powiats.join(' ')).includes(tm))),
  );
  return `<div class="searchbar"><input type="search" data-q="clubs" placeholder="${esc(t('searchClubs'))}" value="${esc(state.q.clubs)}" aria-label="${esc(t('searchClubs'))}" /></div>
    ${filterSelects(true)}
    <p class="muted small">${fmtNum(list.length)} ${t('results')}</p>
    <ul class="list">${list
      .slice(0, state.limit)
      .map(
        (c) => `<li><a href="${viewToHash({ kind: 'club', key: c.key })}" data-nav="club" data-key="${esc(c.key)}">
          <strong>${esc(c.name)}</strong>
          <span class="meta">${c.districts.length} ${t('districts')} · ${fmtHa(c.totalArea)} · ${esc(c.voivodeships.map(cap).join(', '))}</span>
          ${c.type !== 'club' ? badge(c.type) : ''}
        </a></li>`,
      )
      .join('')}</ul>
    ${list.length > state.limit ? `<button type="button" class="btn ghost" data-action="more">${t('showMore')}</button>` : ''}
    ${!list.length ? `<p class="muted">${t('noResults')}</p>` : ''}`;
}

function renderDistrictList() {
  const q = fold(state.q.districts.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  const list = state.districts
    .filter(matchFilters)
    .filter(
      (d) =>
        !terms.length ||
        terms.every((tm) =>
          (d.hunt_dist_nr === tm) ||
          fold([d.lease_holder_name, d.inspectorate_name, d.district_name, d.county_name, d.reg_mng_board_name].join(' ')).includes(tm),
        ),
    )
    .sort((a, b) => (a.county_name ?? '').localeCompare(b.county_name ?? '', 'pl') || Number(a.hunt_dist_nr) - Number(b.hunt_dist_nr));
  return `<div class="searchbar"><input type="search" data-q="districts" placeholder="${esc(t('searchDistricts'))}" value="${esc(state.q.districts)}" aria-label="${esc(t('searchDistricts'))}" /></div>
    ${filterSelects(true)}
    <p class="muted small">${fmtNum(list.length)} ${t('results')}</p>
    <ul class="list">${list
      .slice(0, state.limit)
      .map(
        (d) => `<li><a href="${viewToHash({ kind: 'district', slug: districtSlug(d) })}" data-nav="district" data-slug="${esc(districtSlug(d))}">
          <strong>${t('districtNo')} ${esc(d.hunt_dist_nr)} <span class="muted">· ${esc(cap(d.county_name))}</span></strong>
          <span class="meta">${esc(d.lease_holder_name ?? t('type_unknown'))} · ${fmtHa(d.total_area)} · ${t('nadlesnictwo')} ${esc(d.inspectorate_name)}</span>
        </a></li>`,
      )
      .join('')}</ul>
    ${list.length > state.limit ? `<button type="button" class="btn ghost" data-action="more">${t('showMore')}</button>` : ''}`;
}

function dl(rows: [string, string][]) {
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function addr(name: string | null, a: string | null) {
  return `${esc(name ?? '—')}${a ? `<br><span class="muted small">${esc(a)}</span>` : ''}`;
}

function openSeasonsFor(voiv: string | null) {
  const now = new Date();
  const open = SEASONS.filter((s) => isOpen(s, now, voiv));
  return `<h3>${t('openToday')}</h3><div class="chips">${open.map((s) => `<span class="chip">${esc(tt(s.name))}</span>`).join('')}</div>
    <p class="small"><a href="#/seasons" data-nav="tab" data-tab="seasons">${t('allSeasons')} ${ic('chevron', 14)}</a></p>`;
}

function backButton() {
  return `<button type="button" class="btn ghost back" data-action="back">${ic('back', 18)} ${t('back')}</button>`;
}

function districtCard(d: District, withHolderLink = true) {
  const h = holderType(d.lease_group_name);
  const club = d.lease_holder_name ? state.clubsByKey.get(clubKey(d.lease_holder_name)) : undefined;
  const holder = d.lease_holder_name
    ? withHolderLink && club
      ? `<a href="${viewToHash({ kind: 'club', key: club.key })}" data-nav="club" data-key="${esc(club.key)}">${esc(d.lease_holder_name)}</a>`
      : esc(d.lease_holder_name)
    : '—';
  const forestPct = d.total_area && d.forest_area != null ? ` (${fmtNum((d.forest_area / d.total_area) * 100)}%)` : '';
  return `<article class="card">
    <h2>${t('districtNo')} ${esc(d.hunt_dist_nr)} <span class="muted">· ${esc(cap(d.county_name))}</span></h2>
    ${badge(h)}
    ${dl([
      [t('holder'), `<strong>${holder}</strong>${d.lease_holder_adr ? `<br><span class="muted small">${esc(d.lease_holder_adr)}</span>` : ''}`],
      [t('totalArea'), fmtHa(d.total_area)],
      [t('huntArea'), fmtHa(d.after_exclusion_area)],
      [t('forestArea'), fmtHa(d.forest_area) + forestPct],
      [t('powiat'), esc(d.district_name)],
      [t('nadlesnictwo'), addr(d.inspectorate_name, d.inspectorate_adr)],
      [t('rdlp'), addr(d.region_name, d.region_adr)],
      [t('pzlBoard'), addr(d.reg_mng_board_name, d.reg_mng_board_adr)],
      [t('year'), esc(d.a_year)],
    ])}
    <div class="actions">
      <a class="btn ghost" href="${viewToHash({ kind: 'district', slug: districtSlug(d) })}" data-nav="district" data-slug="${esc(districtSlug(d))}">${t('showOnMap')}</a>
      ${d.lease_holder_name ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(d.lease_holder_name + ' koło łowieckie')}">${t('searchWeb')} ↗</a>` : ''}
    </div>
  </article>`;
}

function renderDistrict(d: District) {
  return `${backButton()}${districtCard(d)}
    <div class="actions"><button type="button" class="btn ghost" data-action="copy">${t('copyLink')}</button>
      <button type="button" class="btn ghost" data-action="saveOffline">${ic('download')} ${t('saveOffline')}</button></div>
    ${openSeasonsFor(d.county_name)}`;
}

function renderPoint() {
  const head = `${backButton()}<button type="button" class="btn ghost w-point-btn" data-action="weatherHere">${ic('cloud')} ${t('weatherHere')}</button>`;
  if (pointResult.status === 'loading') return `${head}<p class="muted">${t('identifying')}</p>`;
  if (pointResult.status === 'error') return `${head}<div class="notice error">${esc(pointResult.message)}</div>`;
  if (!pointResult.items.length) return `${head}<p class="muted">${t('outside')}</p>`;
  const first = pointResult.items[0];
  return `${head}${pointResult.items.map((d) => districtCard(d)).join('')}${openSeasonsFor(first.county_name)}`;
}

function renderClub(c: Club) {
  const boards = new Map<string, string | null>();
  for (const d of c.districts) if (d.reg_mng_board_name) boards.set(d.reg_mng_board_name, d.reg_mng_board_adr);
  return `${backButton()}<article class="card">
    <p class="eyebrow">${c.type === 'club' ? t('clubOf') : t(typeKey(c.type))}</p>
    <h2>${esc(c.name)}</h2>
    <div class="kpis small-kpis">
      <div><b>${c.districts.length}</b><span>${t('districts')}</span></div>
      <div><b>${fmtKm2(c.totalArea)}</b><span>km²</span></div>
      <div><b>${c.totalArea ? fmtNum((c.forestArea / c.totalArea) * 100) : '—'}%</b><span>${t('forestShare')}</span></div>
    </div>
    ${dl([
      [t('voivodeship'), esc(c.voivodeships.map(cap).join(', '))],
      [t('powiat'), esc(c.powiats.join(', '))],
      [t('nadlesnictwo'), esc(c.forestDistricts.join(', '))],
      [t('pzlBoard'), [...boards].map(([n, a]) => addr(n, a)).join('<br>')],
    ])}
    <div class="actions">
      <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(c.name + ' koło łowieckie')}">${t('searchWeb')} ↗</a>
      <button type="button" class="btn ghost" data-action="copy">${t('copyLink')}</button>
      <button type="button" class="btn ghost" data-action="saveOffline">${ic('download')} ${t('saveOffline')}</button>
    </div>
  </article>
  <h3>${t('districtsCap')}</h3>
  <ul class="list">${c.districts
    .map(
      (d) => `<li><a href="${viewToHash({ kind: 'district', slug: districtSlug(d) })}" data-nav="district" data-slug="${esc(districtSlug(d))}">
        <strong>${t('districtNo')} ${esc(d.hunt_dist_nr)} <span class="muted">· ${esc(cap(d.county_name))}</span></strong>
        <span class="meta">${fmtHa(d.total_area)} · ${t('nadlesnictwo')} ${esc(d.inspectorate_name)} · ${t('powiat')} ${esc(d.district_name)}</span></a></li>`,
    )
    .join('')}</ul>
  ${openSeasonsFor(c.voivodeships[0] ?? null)}`;
}

function bar(frac: number) {
  return `<span class="bar"><span style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></span></span>`;
}

function renderStats() {
  const ds = state.districts;
  const total = ds.reduce((s, d) => s + (d.total_area ?? 0), 0);
  const types = countByType(ds);
  const year = Math.max(...ds.map((d) => d.a_year ?? 0));
  const holders = state.clubs.length;
  const typeRows = (['club', 'pzl', 'pgl', 'other', 'unknown'] as HolderType[]).filter((k) => types[k].districts);
  const voiv = statsBy(ds, 'county_name');
  const boards = statsBy(ds, 'reg_mng_board_name');
  const maxV = Math.max(...voiv.map((v) => v.totalArea));
  const maxB = Math.max(...boards.map((v) => v.totalArea));
  const top = state.clubs.filter((c) => c.type === 'club').sort((a, b) => b.totalArea - a.totalArea).slice(0, 10);
  const table = (rows: typeof voiv, max: number, field: 'county_name' | 'reg_mng_board_name') => `<table class="tbl">
    <thead><tr><th>${t('colName')}</th><th class="num">${t('colDistricts')}</th><th class="num">${t('colHolders')}</th><th class="num">${t('colArea')}</th><th class="num">${t('colAvg')}</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr><td><a href="#" data-action="filter" data-field="${field}" data-value="${esc(r.name)}">${esc(field === 'county_name' ? cap(r.name) : r.name)}</a>${bar(r.totalArea / max)}</td>
        <td class="num">${fmtNum(r.districts)}</td><td class="num">${fmtNum(r.holders)}</td><td class="num">${fmtKm2(r.totalArea)}</td><td class="num">${fmtNum(r.totalArea / r.districts / 100, 1)}</td></tr>`,
      )
      .join('')}</tbody></table>`;
  return `<p class="muted small">${t('dataAsOf')} ${year}/${year + 1}</p>
  <div class="kpis">
    <div><b>${fmtNum(ds.length)}</b><span>${t('kDistricts')}</span></div>
    <div><b>${fmtNum(holders)}</b><span>${t('kHolders')}</span></div>
    <div><b>${fmtKm2(total)}</b><span>${t('kArea')}</span></div>
    <div><b>${fmtNum((types.club.area / total) * 100)}%</b><span>${t('kClubShare')}</span></div>
  </div>
  <h3>${t('byType')}</h3>
  <table class="tbl"><tbody>${typeRows
    .map(
      (k) => `<tr><td>${badge(k)}${bar(types[k].area / total)}</td><td class="num">${fmtNum(types[k].districts)}</td><td class="num">${fmtNum((types[k].area / total) * 100, 1)}%</td></tr>`,
    )
    .join('')}</tbody></table>
  <h3>${t('topClubs')}</h3>
  <ol class="toplist">${top
    .map(
      (c) => `<li><a href="${viewToHash({ kind: 'club', key: c.key })}" data-nav="club" data-key="${esc(c.key)}">${esc(c.name)}</a>
      <span class="muted small">${c.districts.length} ${t('districts')} · ${fmtKm2(c.totalArea)} km²</span></li>`,
    )
    .join('')}</ol>
  <h3>${t('byVoiv')}</h3>${table(voiv, maxV, 'county_name')}
  <h3>${t('byBoard')}</h3>${table(boards, maxB, 'reg_mng_board_name')}`;
}

const VOIVODESHIPS = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie',
];

function atlasLink(s: Season) {
  const sps = speciesForSeason(s);
  const link = (slug: string, label: string) => `<a class="atlas-link" href="#/atlas/${slug}" data-atlas="go" data-slug="${slug}">${esc(label)}</a>`;
  if (sps.length === 1) return ' ' + link(sps[0].slug, t('inAtlas'));
  return sps.length ? ` <span class="atlas-link">${t('inAtlas')}:</span> ${sps.map((sp) => link(sp.slug, tt(sp.name).toLocaleLowerCase(getLang()))).join(', ')}` : '';
}

function seasonRow(s: Season, voiv: string, now: Date) {
  const e = effective(s, voiv || null);
  const open = isOpen(s, now, voiv || null);
  const segs = e.allYear
    ? `<span class="seg" style="left:0;width:100%"></span>`
    : e.ranges
        .flatMap((r) => {
          const a = yearFrac(r.from);
          const b = yearFrac(r.to) + 1 / 365;
          return a <= b ? [[a, b]] : [[a, 1], [0, b]];
        })
        .map(([a, b]) => `<span class="seg" style="left:${a * 100}%;width:${(b - a) * 100}%"></span>`)
        .join('');
  const variants = (s.variants ?? [])
    .filter((v) => !(voiv && v.voivodeships?.includes(voiv)))
    .map((v) => `${v.voivodeships ? v.voivodeships.map(cap).join(', ') : tt(v.condition!)}: ${formatRanges(v.ranges, !!v.allYear, getLang())}`);
  const notes = [...variants, ...(s.note ? [tt(s.note)] : [])];
  const regional = voiv ? [] : openOnlyIn(s, now);
  const cls = open ? 'open' : regional.length ? 'partly' : !e.ranges.length && !e.allYear ? 'closed' : '';
  const flag = open
    ? ` <span class="in-season">${t('inSeason')}</span>`
    : regional.length
      ? ` <span class="in-season partly" title="${esc(regional.map(cap).join(', '))}">${t('inSeasonSome')}</span>`
      : '';
  return `<tr class="${cls}">
    <td><strong>${esc(tt(s.name))}</strong>${flag}${atlasLink(s)}${notes.length ? `<div class="muted small">${notes.map(esc).join('<br>')}</div>` : ''}</td>
    <td class="period">${esc(formatRanges(e.ranges, e.allYear, getLang()))}<div class="timeline">${segs}<span class="now" style="left:${yearFrac([now.getMonth() + 1, now.getDate()]) * 100}%"></span></div></td>
  </tr>`;
}

function renderSeasons() {
  const now = new Date();
  const voiv = state.seasonVoiv;
  let lastGroup = '';
  const rows = SEASONS.map((s) => {
    const g = tt(s.group);
    const head = g !== lastGroup ? `<tr class="group"><th colspan="2">${esc(g)}</th></tr>` : '';
    lastGroup = g;
    return head + seasonRow(s, voiv, now);
  }).join('');
  const months = (getLang() === 'pl' ? 'SLMKMCLSWPLG' : 'JFMAMJJASOND').split('');
  const openNow = SEASONS.filter((s) => isOpen(s, now, voiv || null));
  const dateStr = now.toLocaleDateString(getLang() === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<h2>${t('tabSeasons')}</h2>
    <p class="small">${t('seasonsIntro')}</p>
    <div class="filters"><select data-filter="seasonVoiv" aria-label="${t('voivodeship')}">
      <option value="">${t('allVoivodeships')}</option>${VOIVODESHIPS.map((v) => `<option value="${v}"${v === voiv ? ' selected' : ''}>${cap(v)}</option>`).join('')}
    </select></div>
    <section class="today-box">
      <h3>${t('openToday')} <span class="muted small">· ${esc(dateStr)}${voiv ? ` · ${esc(cap(voiv))}` : ''}</span></h3>
      <div class="chips">${openNow.map((s) => `<span class="chip">${esc(tt(s.name))}</span>`).join('')}</div>
      ${voiv ? '' : `<p class="muted small">${t('pickVoivHint')}</p>`}
    </section>
    <table class="tbl seasons"><thead><tr><th>${t('species')}</th><th>${t('period')}<div class="months">${months.map((m) => `<span>${m}</span>`).join('')}<span class="now-label" style="left:${yearFrac([now.getMonth() + 1, now.getDate()]) * 100}%">${t('inSeason')}</span></div></th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="muted small">${t('seasonsRule')}</p>
    <p class="muted small"><a href="https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html" target="_blank" rel="noopener">Dz.U. 2023 poz. 99 ↗</a></p>`;
}

let installedVersion: string | null = null;

/** A bar at the bottom: a newer APK is out. Dismissing it hides this version for good. */
function showUpdateBanner(version: string, url: string) {
  const pl = getLang() === 'pl';
  document.getElementById('app-update')?.remove();
  const el = document.createElement('div');
  el.id = 'app-update';
  el.className = 'app-update';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${pl ? `Jest nowa wersja aplikacji (${esc(version)}).` : `A new version of the app is out (${esc(version)}).`}</span>
    <a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">${pl ? 'Pobierz' : 'Download'}</a>
    <button type="button" class="btn small ghost" aria-label="${pl ? 'Zamknij' : 'Close'}">${ic('x', 16)}</button>`;
  el.querySelector('button')!.addEventListener('click', () => {
    dismissUpdate(version);
    el.remove();
  });
  document.body.append(el);
}

/** About page: the app's version in the app, the APK download with install steps on the website. */
function renderAppBox(pl: boolean) {
  if (isApp())
    return `<section class="app-box"><h2>${pl ? 'Aplikacja' : 'App'}</h2>
      <p>${pl ? 'Wersja' : 'Version'} ${esc(installedVersion ?? '…')}${
        state.dataMeta ? `<br><span class="muted small">${pl ? 'Lista kół i obwodów: stan na' : 'Club and district list as of'} ${esc(state.dataMeta.date)}</span>` : ''
      }</p>
      <p><button type="button" class="btn ghost" data-action="appUpdate">${pl ? 'Sprawdź aktualizację' : 'Check for updates'}</button></p></section>`;
  return pl
    ? `<section class="app-box"><h2>Aplikacja na Androida</h2>
      <p>Ta sama aplikacja do zainstalowania na telefonie z Androidem 9 lub nowszym. Na razie nie ma jej w Google Play, instaluje się ją z pliku.</p>
      <p><a class="btn" href="${APK_URL}">Pobierz aplikację (APK)</a></p>
      <ol class="small"><li>Otwórz ten link na telefonie i pobierz plik.</li>
      <li>Otwórz pobrany plik. Android zapyta, czy przeglądarka może instalować aplikacje: wybierz <b>Ustawienia</b> i włącz <b>Zezwalaj z tego źródła</b>.</li>
      <li>Wróć i wybierz <b>Zainstaluj</b>. Jeśli Play Protect ostrzeże o nieznanej aplikacji, wybierz <b>Więcej szczegółów → Zainstaluj mimo to</b>.</li>
      <li>Nowe wersje aplikacja zgłosi sama, na dole ekranu.</li></ol></section>`
    : `<section class="app-box"><h2>Android app</h2>
      <p>The same app, installable on Android 9 or newer. It is not in Google Play yet; it installs from a file.</p>
      <p><a class="btn" href="${APK_URL}">Download the app (APK)</a></p>
      <ol class="small"><li>Open this link on the phone and download the file.</li>
      <li>Open the downloaded file. When Android asks whether the browser may install apps, choose <b>Settings</b> and allow it.</li>
      <li>Go back and tap <b>Install</b>. If Play Protect warns about an unknown app, choose <b>More details → Install anyway</b>.</li>
      <li>The app announces new versions itself, at the bottom of the screen.</li></ol></section>`;
}

/** "Więcej": the settings kept on this device, and the pages that are not part of everyday use. */
function renderMore() {
  const pref = getThemePref();
  const seg = (action: string, value: string, label: string, on: boolean, icon = '') =>
    `<button type="button" data-action="${action}" data-value="${value}" aria-pressed="${on}">${icon}${label}</button>`;
  const row = (href: string, tab: Tab, icon: string, title: string, hint: string) =>
    `<li><a href="${href}" data-nav="tab" data-tab="${tab}">${icon}<span><strong>${title}</strong><small class="muted">${hint}</small></span>${ic('chevron', 20)}</a></li>`;
  return `<div class="more">
    <h2>${t('areaMore')}</h2>
    <h3>${t('settings')}</h3>
    <div class="set-row"><span id="set-theme">${t('theme')}</span>
      <div class="seg" role="group" aria-labelledby="set-theme">
        ${seg('theme', 'auto', cap(t('themeAuto')), pref === 'auto', ic('themeAuto', 18))}
        ${seg('theme', 'light', cap(t('themeLight')), pref === 'light', ic('sun', 18))}
        ${seg('theme', 'dark', cap(t('themeDark')), pref === 'dark', ic('moon', 18))}
      </div></div>
    <div class="set-row"><span id="set-lang">${t('language')}</span>
      <div class="seg" role="group" aria-labelledby="set-lang">
        ${seg('lang', 'pl', 'Polski', getLang() === 'pl')}
        ${seg('lang', 'en', 'English', getLang() === 'en')}
      </div></div>
    <h3>${t('moreSection')}</h3>
    <ul class="more-list">
      ${row('#/offline', 'offline', ic('download', 22), t('moreOffline'), t('moreOfflineHint'))}
      ${isApp() ? '' : row('#/about', 'about', ic('android', 22), t('moreApp'), t('moreAppHint'))}
      ${row('#/about', 'about', ic('info', 22), t('moreAbout'), t('moreAboutHint'))}
    </ul>
    ${isApp() && installedVersion ? `<p class="muted small">${getLang() === 'pl' ? 'Wersja' : 'Version'} ${esc(installedVersion)}</p>` : ''}
  </div>`;
}

function renderAbout() {
  const pl = getLang() === 'pl';
  return `<article class="prose">
    <a class="btn ghost back" href="#/wiecej" data-nav="tab" data-tab="more">${ic('back', 18)} ${t('areaMore')}</a>
    ${renderAppBox(pl)}
    ${
      pl
        ? `<h2>Skąd pochodzą dane?</h2>
      <p>Granice obwodów łowieckich oraz informacje o dzierżawcach i zarządcach pochodzą z publicznej usługi
      <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie" target="_blank" rel="noopener">Banku Danych o Lasach</a> (BDL), prowadzonego przez
      Biuro Urządzania Lasu i Geodezji Leśnej na zlecenie Ministra Klimatu i Środowiska. Granice obwodów pochodzą z uchwał sejmików województw
      (urzędów marszałkowskich), a dane o dzierżawcach z Polskiego Związku Łowieckiego i Lasów Państwowych. BDL aktualizuje je raz w roku wraz z rocznymi planami łowieckimi.</p>
      <p>Granice na mapie są pobierane z BDL na bieżąco. Listę kół i obwodów (dzierżawcy, numery, powierzchnie) strona i aplikacja mają zapisaną u siebie i odświeżają ją z BDL co tydzień${
        state.dataMeta ? `; obecna lista jest ze stanu na ${esc(state.dataMeta.date)}` : ''
      }.</p>
      <p>„Koła” w aplikacji to dzierżawcy obwodów zgrupowani po nazwie. Ta sama nazwa zapisana na różne sposoby może pojawić się jako osobne pozycje.</p>
      <h2>Warstwy dodatkowe</h2>
      <ul><li><b>Nadleśnictwa</b> – granice nadleśnictw Lasów Państwowych.</li>
      <li><b>Zakazy wstępu do lasu</b> – aktualne okresowe zakazy wprowadzone przez nadleśniczych.</li>
      <li><b>Zagrożenie pożarowe</b> – bieżący stopień zagrożenia pożarowego lasów.</li></ul>
      <h2>Przydatne linki</h2>`
        : `<h2>Where does the data come from?</h2>
      <p>Hunting district boundaries and leaseholder information come from the public service of the
      <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie" target="_blank" rel="noopener">Forest Data Bank (BDL)</a>, run by the Forest Management and Geodesy Bureau
      for the Polish Ministry of Climate and Environment. Boundaries come from voivodeship assembly resolutions (marshal offices); leaseholder data comes from the
      Polish Hunting Association (PZŁ) and State Forests. BDL refreshes it once a year with the annual hunting plans.</p>
      <p>Map boundaries are loaded from BDL as you go. The club and district list (leaseholders, numbers, areas) is kept by the website and the app and refreshed from BDL weekly${
        state.dataMeta ? `; the current list is as of ${esc(state.dataMeta.date)}` : ''
      }.</p>
      <p>“Clubs” in this app are leaseholders grouped by name. The same club spelled differently may appear twice.</p>
      <h2>Extra layers</h2>
      <ul><li><b>Forest districts</b> – State Forests forest district (nadleśnictwo) boundaries.</li>
      <li><b>Forest entry bans</b> – current temporary bans issued by forest district managers.</li>
      <li><b>Fire danger</b> – current forest fire danger level.</li></ul>
      <h2>Useful links</h2>`
    }
    <ul>
      <li><a href="https://www.pzlow.pl/" target="_blank" rel="noopener">Polski Związek Łowiecki (PZŁ)</a></li>
      <li><a href="https://www.bdl.lasy.gov.pl/portal/mapy" target="_blank" rel="noopener">${pl ? 'Mapa łowiectwa w BDL' : 'BDL hunting map'}</a></li>
      <li><a href="https://www.gov.pl/web/klimat/obwody-lowieckie-i-ich-zasiegi" target="_blank" rel="noopener">${pl ? 'Obwody łowieckie i ich zasięgi (gov.pl)' : 'Hunting districts (gov.pl)'}</a></li>
      <li><a href="https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19951470713" target="_blank" rel="noopener">${pl ? 'Ustawa Prawo łowieckie' : 'Hunting Law Act'}</a></li>
      <li><a href="https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html" target="_blank" rel="noopener">${pl ? 'Rozporządzenie w sprawie okresów polowań' : 'Hunting seasons regulation'}</a></li>
    </ul>
    <p class="muted small">${pl ? 'Kroje pisma' : 'Fonts'}: Inter, Barlow Semi Condensed, Manrope, JetBrains Mono (<a href="./licenses/fonts-OFL.txt" target="_blank" rel="noopener">SIL Open Font License 1.1</a>). ${pl ? 'Ikony w stylu' : 'Icons in the style of'} Lucide.</p>
    <p class="muted small">${
      pl
        ? 'Aplikacja ma charakter informacyjny. Wiążące są dokumenty źródłowe: uchwały sejmików, umowy dzierżawy i przepisy prawa.'
        : 'For information only. Source documents (assembly resolutions, lease agreements and the law) are authoritative.'
    }</p>
  </article>`;
}

// ---------------------------------------------------------------- events

function toast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function changeLang(to: 'pl' | 'en') {
  if (to === getLang()) return;
  setLang(to);
  document.documentElement.lang = to;
  mapApi.rebuildLayerControl();
  render();
}
function changeTheme(pref: ThemePref, announce: boolean) {
  setThemePref(pref);
  render();
  if (announce) toast(`${t('theme')}: ${t(THEME_LABEL[pref])}`);
}

// Language and look: buttons in the top bar on a computer, rows in "Więcej" on a phone.
$('#tools').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('#lang')) {
    changeLang(getLang() === 'pl' ? 'en' : 'pl');
    $('#lang').focus();
  } else if (el.closest('#themebtn')) {
    changeTheme(nextThemePref(getThemePref()), true);
    $('#themebtn').focus();
  }
});

function onAreaClick(e: Event) {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-area]');
  if (!b) return;
  const a = b.dataset.area as Area;
  // A second tap on the current destination goes to its start (the hunt list, the map lists…).
  if (a === areaOf(state.view)) {
    if (a === 'map') sheet.set(sheet.get() === 'peek' ? 'half' : 'peek');
    else navigate(areaHome(a));
    return;
  }
  navigate(lastIn[a] ?? areaHome(a));
}
$('#sections').addEventListener('click', onAreaClick);
$('#bottomnav').addEventListener('click', onAreaClick);

$('#tabs').addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-know]');
  if (k) return navigate(knowView(k.dataset.know as KnowPage));
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
  if (!b) return;
  state.limit = 100;
  mapApi.clearHighlight();
  if (sheet.get() === 'peek') sheet.set('half');
  navigate({ kind: 'tab', tab: b.dataset.tab as Tab });
});
// Escape closes what is on top: the hunt's field-mode list, then field mode itself.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && areaOf(state.view) === 'hunt' && !document.querySelector('.hs-sheet, .hmsg-sheet, #pp-root') && huntBack()) e.preventDefault();
});
// Typing in a search field needs the room: the sheet opens fully.
content.addEventListener('focusin', (e) => {
  if (sheet.active() && (e.target as HTMLElement).matches('input[type="search"]')) sheet.set('full');
});
phone.addEventListener('change', () => {
  renderStatic();
  setTimeout(() => mapApi.map.invalidateSize(), 0);
});

content.addEventListener('click', (e) => {
  const off = (e.target as HTMLElement).closest<HTMLElement>('[data-offline]');
  if (off && handleOfflineEvent(off)) return;
  const ex = (e.target as HTMLElement).closest<HTMLElement>('[data-exam]');
  if (ex && handleExamClick(ex)) return;
  const at = (e.target as HTMLElement).closest<HTMLElement>('[data-atlas]');
  if (at) {
    e.preventDefault();
    const handled = handleAtlasClick(
      at,
      (slug) => navigate({ kind: 'atlas', slug }),
      () => navigate({ kind: 'tab', tab: 'seasons' }),
      (slug) => {
        drillSpecies(slug, render);
        navigate({ kind: 'tab', tab: 'exams' });
      },
    );
    if (handled) {
      content.scrollTop = 0;
      window.scrollTo(0, 0);
      return;
    }
  }
  const wx = (e.target as HTMLElement).closest<HTMLElement>('[data-weather]');
  if (wx && handleWeatherClick(wx)) return;
  const ba = (e.target as HTMLElement).closest<HTMLElement>('[data-ball]');
  if (ba && handleBallisticsClick(ba)) return;
  const hu = (e.target as HTMLElement).closest<HTMLElement>('[data-hunt]');
  if (hu) {
    e.preventDefault();
    if (handleHuntClick(hu)) return;
  }
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-action]');
  if (!el) return;
  const nav = el.dataset.nav;
  if (nav) {
    e.preventDefault();
    if (nav === 'club') navigate({ kind: 'club', key: el.dataset.key! });
    if (nav === 'district') navigate({ kind: 'district', slug: el.dataset.slug! });
    if (nav === 'tab') navigate({ kind: 'tab', tab: el.dataset.tab as Tab });
    $('#panel').scrollTop = 0;
    content.scrollTop = 0;
    return;
  }
  switch (el.dataset.action) {
    case 'theme':
      changeTheme(el.dataset.value as ThemePref, false);
      break;
    case 'lang':
      changeLang(el.dataset.value as 'pl' | 'en');
      break;
    case 'more':
      state.limit += 200;
      render();
      break;
    case 'back':
      if (history.length > 1 && location.hash) history.back();
      else navigate({ kind: 'tab', tab: state.tab });
      break;
    case 'retry':
      load();
      break;
    case 'appUpdate': {
      el.setAttribute('disabled', '');
      const pl = getLang() === 'pl';
      void Promise.all([
        checkForAppUpdate(showUpdateBanner, true),
        updateDistricts(true).then(
          (changed) => (changed ? 'newer' : 'current'),
          () => 'error' as const,
        ),
      ]).then(([app, data]) => {
        el.removeAttribute('disabled');
        if (app === 'error' || data === 'error') toast(pl ? 'Nie udało się sprawdzić. Brak internetu?' : 'Could not check. No internet?');
        else if (app === 'current' && data === 'current')
          toast(pl ? 'Masz najnowszą wersję aplikacji i danych.' : 'You have the latest app and data.');
      });
      break;
    }
    case 'weatherHere':
      if (state.view.kind === 'point') {
        showWeatherAt(state.view.lat, state.view.lng);
        navigate({ kind: 'tab', tab: 'weather' });
      }
      break;
    case 'saveOffline': {
      const v = state.view;
      if (v.kind === 'district') {
        const d = findBySlug(state.districts, v.slug);
        if (d) saveOffline({ kind: 'district', name: `${t('districtNo')} ${d.hunt_dist_nr} · ${d.lease_holder_name ?? cap(d.county_name)}`, ids: [d.objectid] });
      } else if (v.kind === 'club') {
        const c = state.clubsByKey.get(v.key);
        if (c) saveOffline({ kind: 'club', name: c.name, ids: c.districts.map((d) => d.objectid) });
      }
      break;
    }
    case 'copy':
      copyText(publicHref()).then(() => toast(t('copied')), () => toast(publicHref()));
      break;
    case 'filter':
      e.preventDefault();
      if (el.dataset.field === 'county_name') {
        state.voiv = el.dataset.value!;
        state.board = '';
      } else state.board = el.dataset.value!;
      navigate({ kind: 'tab', tab: 'clubs' });
      break;
  }
});

content.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (handleWeatherInput(el)) return;
  if (el instanceof HTMLInputElement && handleAtlasInput(el, render)) return;
  if (handleHuntInput(el)) return;
  const k = el.dataset.q as 'clubs' | 'districts' | undefined;
  if (!k) return;
  state.q[k] = el.value;
  state.limit = 100;
  const pos = el.selectionStart;
  render();
  const again = $<HTMLInputElement>(`[data-q="${k}"]`, content);
  again.focus();
  again.setSelectionRange(pos, pos);
});

content.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (handleExamChange(el)) return;
  if (handleBallisticsChange(el)) return;
  if (handleHuntChange(el)) return;
  const f = el.dataset.filter;
  if (!f) return;
  if (f === 'voiv') {
    state.voiv = el.value;
    state.board = '';
  } else if (f === 'board') state.board = el.value;
  else if (f === 'type') state.type = el.value as HolderType | '';
  else if (f === 'seasonVoiv') {
    state.seasonVoiv = el.value;
    try {
      localStorage.setItem('seasonVoiv', el.value);
    } catch {
      /* storage unavailable */
    }
  }
  state.limit = 100;
  render();
});

content.addEventListener('submit', (e) => {
  if (handleWeatherSubmit(e.target as HTMLFormElement)) e.preventDefault();
  else if (handleBallisticsSubmit(e.target as HTMLFormElement)) e.preventDefault();
  else if (handleHuntSubmit(e.target as HTMLFormElement)) e.preventDefault();
});

$('#locate').addEventListener('click', () => {
  if (!navigator.geolocation) return toast(t('locateFail'));
  toast(t('locating'));
  navigator.geolocation.getCurrentPosition(
    (p) => {
      mapApi.map.flyTo([p.coords.latitude, p.coords.longitude], 12, { duration: 0.6 });
      navigate({ kind: 'point', lat: p.coords.latitude, lng: p.coords.longitude });
    },
    () => toast(t('locateFail')),
    { enableHighAccuracy: true, timeout: 15000 },
  );
});

// ---------------------------------------------------------------- boot

function useDistricts(list: DistrictList) {
  // Also a check for the app's smoke test (android workflow), which reads the log.
  console.info(`[polowanie] districts ${list.districts.length} ${list.source} ${list.meta?.date ?? ''}`);
  state.districts = list.districts;
  state.dataMeta = list.meta;
  state.clubs = groupClubs(state.districts);
  state.clubsByKey = new Map(state.clubs.map((c) => [c.key, c]));
}

async function load() {
  state.error = '';
  state.progress = [0, 0];
  render();
  try {
    useDistricts(
      await loadDistrictList((a, b) => {
        state.progress = [a, b];
        if (!state.loaded) render();
      }),
    );
    state.loaded = true;
    render();
    // Re-run map effects for deep links that needed the data.
    if (state.view.kind === 'district' || state.view.kind === 'club') onViewMapEffects(state.view);
    void updateDistricts(false).catch(() => {
      /* no internet: the built-in list stays */
    });
  } catch (e) {
    state.error = (e as Error).message;
    render();
  }
}

/** App only: takes a newer district list from www.polowanie.org. True when it changed. */
async function updateDistricts(force: boolean): Promise<boolean> {
  const list = await checkDistrictUpdate(state.dataMeta, force);
  if (!list) return false;
  useDistricts(list);
  render();
  toast(getLang() === 'pl' ? `Zaktualizowano listę kół i obwodów (stan na ${list.meta!.date}).` : `Club and district list updated (as of ${list.meta!.date}).`);
  return true;
}

// ---------------------------------------------------------------- offline

function saveOffline(target: AreaTarget) {
  startDraft(target);
  navigate({ kind: 'tab', tab: 'offline' });
  $('#panel').scrollTop = 0;
  content.scrollTop = 0;
}

initOfflineUi({
  rerender: () => {
    if (state.view.kind === 'tab' && state.view.tab === 'offline') render();
  },
  mapBox: () => {
    if (areaOf(state.view) !== 'map') return null;
    const b = mapApi.map.getBounds();
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  },
  showBoxes: (boxes) => {
    let s = 90, w = 180, n = -90, e = -180;
    for (const b of boxes) {
      s = Math.min(s, b[0]); w = Math.min(w, b[1]); n = Math.max(n, b[2]); e = Math.max(e, b[3]);
    }
    if (s < n) mapApi.map.flyToBounds([[s, w], [n, e]], { duration: 0.6 });
  },
});
let offlineRenderTimer: ReturnType<typeof setTimeout> | undefined;
onOfflineChange(() => {
  // Progress arrives often; redraw at most a few times a second.
  if (offlineRenderTimer) return;
  offlineRenderTimer = setTimeout(() => {
    offlineRenderTimer = undefined;
    if (state.view.kind === 'tab' && state.view.tab === 'offline') render();
    else renderStatic();
  }, 300);
});
mapApi.map.on('moveend', () => {
  if (state.view.kind === 'tab' && state.view.tab === 'offline') render();
});
window.addEventListener('online', () => {
  renderStatic();
  if (!state.loaded) load();
});
window.addEventListener('offline', () => renderStatic());

// The app ships its files inside the APK, so only the website needs the service worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* the app still works online */
    });
  });
}

void initOffline();
navigate(hashToView(location.hash), false);
load();
// App only: links to www.polowanie.org opened on the phone land here, and new APKs are announced.
void initDeepLinks((hash) => navigate(hashToView(hash)));
// App only: the phone's back button closes what is on top, then goes one screen back. On the first
// screen it puts the app aside instead of closing it, so location sharing on a hunt goes on.
void onBackButton((canGoBack) => {
  if (huntPhoneBack()) return;
  if (sheet.active() && areaOf(state.view) === 'map' && sheet.get() === 'full') return sheet.set('half');
  if (canGoBack) history.back();
  else void minimizeApp();
});
void appVersion().then((v) => {
  installedVersion = v;
  if (v) void checkForAppUpdate(showUpdateBanner);
});
