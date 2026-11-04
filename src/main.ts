import './style.css';
import { fetchAllDistricts, fetchDistrictsAtPoint, fetchDistrictsByIds, BDL_WMS_DISTRICTS, type District } from './bdl';
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
import { SEASONS, isOpen, effective, formatRanges, yearFrac, openOnlyIn, type Season } from './seasons';
import { renderExams, handleExamClick, handleExamChange } from './examUi';
import { renderWeather, handleWeatherClick, handleWeatherInput, handleWeatherSubmit, showWeatherAt } from './weatherUi';

// ---------------------------------------------------------------- helpers

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const typeKey = (h: HolderType) => `type_${h}` as Key;
const cap = (s: string | null) => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : '—');

type Tab = 'clubs' | 'districts' | 'stats' | 'seasons' | 'exams' | 'weather' | 'about';
type View = { kind: 'tab'; tab: Tab } | { kind: 'district'; slug: string } | { kind: 'club'; key: string } | { kind: 'point'; lat: number; lng: number };

const state = {
  districts: [] as District[],
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
const app = $('#app');
app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2 4 14h4l-3 5h6v3h2v-3h6l-3-5h4z"/></svg>
      <div><h1 data-t="title"></h1><p data-t="subtitle"></p></div>
    </div>
    <nav class="sections" id="sections" aria-label="Sections"></nav>
    <button class="lang" id="lang" type="button" aria-label="Language"></button>
  </header>
  <main class="layout">
    <aside class="panel" id="panel">
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
  </main>`;

const content = $('#content');
const mapApi: MapApi = createMap($('#map'), (lat, lng) => navigate({ kind: 'point', lat, lng }));

// Top-level sections. The map section holds the panel tabs; every other section is a
// full-width page without the map (add new features here).
type Section = 'map' | 'seasons' | 'exams' | 'weather';
const SECTIONS: [Section, Key][] = [
  ['map', 'sectionMap'],
  ['seasons', 'tabSeasons'],
  ['exams', 'tabExams'],
  ['weather', 'tabWeather'],
];
const PAGE_SECTIONS: Tab[] = ['seasons', 'exams', 'weather'];
const sectionOf = (v: View): Section => (v.kind === 'tab' && PAGE_SECTIONS.includes(v.tab) ? (v.tab as Section) : 'map');
let lastSection: Section = 'map';
let lastMapView: View = { kind: 'tab', tab: 'clubs' };

// ---------------------------------------------------------------- routing

function viewToHash(v: View): string {
  switch (v.kind) {
    case 'tab':
      return v.tab === 'clubs' ? '' : `#/${v.tab}`;
    case 'district':
      return `#/obwod/${v.slug}`;
    case 'club':
      return `#/kolo/${encodeURIComponent(v.key)}`;
    case 'point':
      return `#/punkt/${v.lat.toFixed(5)},${v.lng.toFixed(5)}`;
  }
}

function hashToView(h: string): View {
  const [, kind, arg] = h.replace(/^#/, '').split('/');
  if (kind === 'obwod' && arg) return { kind: 'district', slug: arg };
  if (kind === 'kolo' && arg) return { kind: 'club', key: decodeURIComponent(arg) };
  if (kind === 'punkt' && arg) {
    const [lat, lng] = arg.split(',').map(Number);
    if (isFinite(lat) && isFinite(lng)) return { kind: 'point', lat, lng };
  }
  if (['districts', 'stats', 'seasons', 'exams', 'weather', 'about'].includes(kind)) return { kind: 'tab', tab: kind as Tab };
  return { kind: 'tab', tab: 'clubs' };
}

function navigate(v: View, push = true) {
  state.view = v;
  if (v.kind === 'tab') state.tab = v.tab;
  if (push) {
    const h = viewToHash(v);
    if (h !== location.hash) history.pushState(null, '', h || location.pathname + location.search);
  }
  render();
  onViewMapEffects(v);
}
window.addEventListener('popstate', () => navigate(hashToView(location.hash), false));

// ---------------------------------------------------------------- map effects

let effectToken = 0;
async function onViewMapEffects(v: View) {
  const token = ++effectToken;
  if (v.kind === 'tab') return;
  try {
    if (v.kind === 'point') {
      pointResult = { status: 'loading' };
      render();
      const res = await fetchDistrictsAtPoint(v.lat, v.lng);
      if (token !== effectToken) return;
      pointResult = { status: 'done', items: res.map((r) => r.attributes) };
      mapApi.highlight(res, { marker: [v.lat, v.lng] });
      render();
    } else if (v.kind === 'district') {
      const d = findBySlug(state.districts, v.slug);
      if (!d) return;
      const res = await fetchDistrictsByIds([d.objectid], 0.00005);
      if (token === effectToken) mapApi.highlight(res, { fit: true });
    } else if (v.kind === 'club') {
      const c = state.clubsByKey.get(v.key);
      if (!c) return;
      const res = await fetchDistrictsByIds(c.districts.map((d) => d.objectid));
      if (token === effectToken) mapApi.highlight(res, { fit: true });
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

function renderStatic() {
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
  $('#lang').textContent = getLang() === 'pl' ? 'EN' : 'PL';
  $('#locate').textContent = '◎ ' + t('locate');
  document.title = t('title');
  const section = sectionOf(state.view);
  $('#sections').innerHTML = SECTIONS.map(
    ([id, k]) => `<button type="button" data-section="${id}" aria-current="${section === id ? 'page' : 'false'}">${t(k)}</button>`,
  ).join('');
  app.classList.toggle('page-mode', section !== 'map');
  if (section !== lastSection) {
    lastSection = section;
    content.scrollTop = 0;
    // Leaflet needs a size refresh after its container was hidden.
    if (section === 'map') setTimeout(() => mapApi.map.invalidateSize(), 0);
  }
  if (section === 'map') lastMapView = state.view;
  const tabs: [Tab, Key][] = [
    ['clubs', 'tabClubs'],
    ['districts', 'tabDistricts'],
    ['stats', 'tabStats'],
    ['about', 'tabAbout'],
  ];
  $('#tabs').innerHTML = tabs
    .map(
      ([id, k]) =>
        `<button role="tab" type="button" data-tab="${id}" aria-selected="${state.view.kind === 'tab' && state.tab === id}">${t(k)}</button>`,
    )
    .join('');
}

function render() {
  renderStatic();
  const v = state.view;
  if (v.kind === 'point') return void (content.innerHTML = renderPoint());
  if (v.kind === 'tab' && v.tab === 'exams') return void (content.innerHTML = renderExams(render));
  if (v.kind === 'tab' && v.tab === 'weather') return void (content.innerHTML = renderWeather(render));
  if (v.kind === 'tab' && (v.tab === 'seasons' || v.tab === 'about')) {
    content.innerHTML = v.tab === 'seasons' ? renderSeasons() : renderAbout();
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
    <p class="small"><a href="#/seasons" data-nav="tab" data-tab="seasons">${t('allSeasons')} →</a></p>`;
}

function backButton() {
  return `<button type="button" class="btn ghost back" data-action="back">${t('back')}</button>`;
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
    <div class="actions"><button type="button" class="btn ghost" data-action="copy">${t('copyLink')}</button></div>
    ${openSeasonsFor(d.county_name)}`;
}

function renderPoint() {
  const head = `${backButton()}<button type="button" class="btn ghost w-point-btn" data-action="weatherHere">☁ ${t('weatherHere')}</button>`;
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
    <td><strong>${esc(tt(s.name))}</strong>${flag}${notes.length ? `<div class="muted small">${notes.map(esc).join('<br>')}</div>` : ''}</td>
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
    <table class="tbl seasons"><thead><tr><th>${t('species')}</th><th>${t('period')}<div class="months">${months.map((m) => `<span>${m}</span>`).join('')}</div></th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="muted small">${t('seasonsRule')}</p>
    <p class="muted small"><a href="https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html" target="_blank" rel="noopener">Dz.U. 2023 poz. 99 ↗</a></p>`;
}

function renderAbout() {
  const pl = getLang() === 'pl';
  return `<article class="prose">
    ${
      pl
        ? `<h2>Skąd pochodzą dane?</h2>
      <p>Granice obwodów łowieckich oraz informacje o dzierżawcach i zarządcach pobierane są na żywo z publicznej usługi
      <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie" target="_blank" rel="noopener">Banku Danych o Lasach</a> (BDL), prowadzonego przez
      Biuro Urządzania Lasu i Geodezji Leśnej na zlecenie Ministra Klimatu i Środowiska. Granice obwodów pochodzą z uchwał sejmików województw
      (urzędów marszałkowskich), a dane o dzierżawcach z Polskiego Związku Łowieckiego i Lasów Państwowych. BDL aktualizuje je raz w roku wraz z rocznymi planami łowieckimi.</p>
      <p>„Koła” w aplikacji to dzierżawcy obwodów zgrupowani po nazwie. Ta sama nazwa zapisana na różne sposoby może pojawić się jako osobne pozycje.</p>
      <h2>Warstwy dodatkowe</h2>
      <ul><li><b>Nadleśnictwa</b> – granice nadleśnictw Lasów Państwowych.</li>
      <li><b>Zakazy wstępu do lasu</b> – aktualne okresowe zakazy wprowadzone przez nadleśniczych.</li>
      <li><b>Zagrożenie pożarowe</b> – bieżący stopień zagrożenia pożarowego lasów.</li></ul>
      <h2>Przydatne linki</h2>`
        : `<h2>Where does the data come from?</h2>
      <p>Hunting district boundaries and leaseholder information are loaded live from the public service of the
      <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie" target="_blank" rel="noopener">Forest Data Bank (BDL)</a>, run by the Forest Management and Geodesy Bureau
      for the Polish Ministry of Climate and Environment. Boundaries come from voivodeship assembly resolutions (marshal offices); leaseholder data comes from the
      Polish Hunting Association (PZŁ) and State Forests. BDL refreshes it once a year with the annual hunting plans.</p>
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

$('#lang').addEventListener('click', () => {
  setLang(getLang() === 'pl' ? 'en' : 'pl');
  mapApi.rebuildLayerControl();
  render();
});

$('#sections').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-section]');
  if (!b || b.dataset.section === sectionOf(state.view)) return;
  const s = b.dataset.section as Section;
  navigate(s === 'map' ? lastMapView : { kind: 'tab', tab: s });
});

$('#tabs').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
  if (!b) return;
  state.limit = 100;
  mapApi.clearHighlight();
  navigate({ kind: 'tab', tab: b.dataset.tab as Tab });
});

content.addEventListener('click', (e) => {
  const ex = (e.target as HTMLElement).closest<HTMLElement>('[data-exam]');
  if (ex && handleExamClick(ex)) return;
  const wx = (e.target as HTMLElement).closest<HTMLElement>('[data-weather]');
  if (wx && handleWeatherClick(wx)) return;
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
    case 'weatherHere':
      if (state.view.kind === 'point') {
        showWeatherAt(state.view.lat, state.view.lng);
        navigate({ kind: 'tab', tab: 'weather' });
      }
      break;
    case 'copy':
      navigator.clipboard?.writeText(location.href).then(() => toast(t('copied')), () => toast(location.href));
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

async function load() {
  state.error = '';
  state.progress = [0, 0];
  render();
  try {
    state.districts = await fetchAllDistricts((a, b) => {
      state.progress = [a, b];
      if (!state.loaded) render();
    });
    state.clubs = groupClubs(state.districts);
    state.clubsByKey = new Map(state.clubs.map((c) => [c.key, c]));
    state.loaded = true;
    render();
    // Re-run map effects for deep links that needed the data.
    if (state.view.kind === 'district' || state.view.kind === 'club') onViewMapEffects(state.view);
  } catch (e) {
    state.error = (e as Error).message;
    render();
  }
}

navigate(hashToView(location.hash), false);
load();
