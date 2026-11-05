// Balistyka section: pick a calibre and a factory load (or enter your own), see the
// trajectory, energy and scope corrections, and check the Polish legal energy floors.
// Rendered as a string like the other sections; main.ts forwards clicks and changes here.

import { getLang, tt, fmtNum } from './i18n';
import {
  trajectory,
  range,
  correctionMrad,
  reachWithEnergy,
  zeroForHeight,
  verdict,
  FLOORS,
  LEGAL_SOURCE,
  MRAD_PER_MOA,
  type DragModel,
  type Point,
  type Shot,
  type Verdict,
} from './ballistics';

/** One factory load as stored in ammo.json (short keys keep the file small). */
export interface Load {
  id: string;
  /** Calibre, display name. */
  c: string;
  /** Maker. */
  mk: string;
  /** Product name. */
  n: string;
  /** Bullet type / product line. */
  b: string;
  /** 1 = lead-free. */
  lf: 0 | 1;
  /** Bullet mass, g. */
  m: number;
  /** G1 ballistic coefficient. */
  g1: number;
  /** G7 ballistic coefficient (Sellier & Bellot publish and use it). */
  g7?: number;
  /** Maker's test barrel length, mm. */
  bl?: number;
  /** Maker's velocity at 0, 100, 200, 300 m (m/s). */
  v: (number | null)[];
  /** Maker's energy at 0, 100, 200, 300 m (J). */
  e: (number | null)[];
  /** Source page. */
  u: string;
}

interface AmmoFile {
  checked: string;
  loads: Load[];
}

interface Custom {
  mass: number;
  v0: number;
  bc: number;
  model: DragModel;
}

interface Rifle {
  id: string;
  name: string;
  cal: string;
  load: string;
  ownV: number | null;
  custom: Custom;
  zero: Zero;
  sight: number;
}

type Zero = '50' | '100' | '150' | '200' | 'gee';

interface Settings {
  cal: string;
  load: string;
  ownV: number | null;
  custom: Custom;
  zero: Zero;
  sight: number;
  temp: number;
  pressure: number;
  wind: number;
  max: number;
  leadFree: boolean;
  rifle: string;
  rifles: Rifle[];
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  intro: {
    pl: 'Wybierz kaliber i amunicję, a zobaczysz tor lotu, energię i poprawki na lunecie oraz czy nabój spełnia wymogi prawne dla danego gatunku.',
    en: 'Pick a calibre and a load to see the trajectory, energy and scope corrections, and whether the cartridge meets the legal minimum for each species.',
  },
  loading: { pl: 'Wczytywanie danych amunicji…', en: 'Loading ammunition data…' },
  loadError: { pl: 'Nie udało się wczytać danych amunicji.', en: 'Could not load ammunition data.' },
  ammo: { pl: 'Amunicja', en: 'Ammunition' },
  calibre: { pl: 'Kaliber', en: 'Calibre' },
  load: { pl: 'Nabój', en: 'Load' },
  custom: { pl: 'Własny nabój (elaboracja)…', en: 'Own load (handload)…' },
  leadFree: { pl: 'Tylko bezołowiowe', en: 'Lead-free only' },
  noneLeadFree: { pl: 'Brak naboi bezołowiowych w tym kalibrze.', en: 'No lead-free loads in this calibre.' },
  mass: { pl: 'Masa pocisku [g]', en: 'Bullet mass [g]' },
  v0: { pl: 'Prędkość początkowa V0 [m/s]', en: 'Muzzle velocity V0 [m/s]' },
  bc: { pl: 'Współczynnik balistyczny (BC)', en: 'Ballistic coefficient (BC)' },
  model: { pl: 'Model oporu', en: 'Drag model' },
  ownV: { pl: 'Twoja zmierzona V0 [m/s]', en: 'Your measured V0 [m/s]' },
  ownVHint: {
    pl: 'Producent mierzy V0 w lufie {bl} mm. Krótsza lufa zwykle daje 15–40 m/s mniej – wpisz wynik z chronografu, jeśli go znasz.',
    en: 'The maker measures V0 in a {bl} mm barrel. A shorter barrel is usually 15–40 m/s slower – enter your chronograph reading if you have one.',
  },
  ownVHintNoBl: {
    pl: 'Wpisz wynik z chronografu, jeśli go znasz – V0 z Twojej lufy może być niższa niż w tabeli producenta.',
    en: 'Enter your chronograph reading if you have one – your barrel may be slower than the maker’s table.',
  },
  maker: { pl: 'Dane producenta', en: 'Maker’s data' },
  barrel: { pl: 'lufa', en: 'barrel' },
  source: { pl: 'źródło', en: 'source' },
  rifle: { pl: 'Broń i warunki', en: 'Rifle and conditions' },
  zero: { pl: 'Przystrzelanie', en: 'Zero' },
  zeroAt: { pl: 'na {d} m', en: 'at {d} m' },
  gee: { pl: 'GEE (+4 cm na 100 m)', en: 'GEE (+4 cm at 100 m)' },
  geeIs: { pl: 'GEE wypada na {d} m', en: 'GEE zero falls at {d} m' },
  geeNone: { pl: 'Ten nabój nie osiąga +4 cm na 100 m – liczę dla 100 m.', en: 'This load can’t reach +4 cm at 100 m – using a 100 m zero.' },
  sight: { pl: 'Wysokość lunety nad osią lufy [cm]', en: 'Scope height over bore [cm]' },
  temp: { pl: 'Temperatura [°C]', en: 'Temperature [°C]' },
  pressure: { pl: 'Ciśnienie w miejscu strzału [hPa]', en: 'Pressure where you shoot [hPa]' },
  wind: { pl: 'Wiatr boczny [m/s]', en: 'Crosswind [m/s]' },
  maxRange: { pl: 'Tabela do', en: 'Table up to' },
  legal: { pl: 'Wymogi prawne (energia na 100 m)', en: 'Legal minimum (energy at 100 m)' },
  legalNote: {
    pl: 'Przepis mówi wyłącznie o energii pocisku 100 m od wylotu lufy. Zasięg „do … m” to tylko wskazówka, nie wymóg prawny. Na zwierzynę grubą nie wolno używać pocisków pełnopłaszczowych.',
    en: 'The law only sets the energy 100 m from the muzzle. The “up to … m” range is guidance, not law. Full metal jacket bullets are not allowed for big game.',
  },
  legalSource: { pl: 'Dz.U. 2022 poz. 2323', en: 'Dz.U. 2022 item 2323' },
  game: { pl: 'Zwierzyna', en: 'Game' },
  min: { pl: 'min.', en: 'min.' },
  yours: { pl: 'Twój E100', en: 'Your E100' },
  reach: { pl: 'Próg do', en: 'Floor kept to' },
  ok: { pl: 'spełnia', en: 'meets' },
  borderline: { pl: 'na granicy', en: 'borderline' },
  below: { pl: 'za słaby', en: 'too weak' },
  borderlineNote: {
    pl: '„Na granicy” – mniej niż 10% zapasu. Krótsza lufa lub inna partia amunicji może zejść poniżej progu.',
    en: '“Borderline” – less than 10% margin. A shorter barrel or another lot may fall below the floor.',
  },
  chart: { pl: 'Tor lotu względem linii celowania', en: 'Bullet path relative to line of sight' },
  table: { pl: 'Tabela balistyczna', en: 'Ballistic table' },
  dist: { pl: 'Odl. [m]', en: 'Dist. [m]' },
  path: { pl: 'Tor [cm]', en: 'Path [cm]' },
  mrad: { pl: 'MRAD', en: 'MRAD' },
  moa: { pl: 'MOA', en: 'MOA' },
  clicks: { pl: 'kl.', en: 'cl.' },
  drift: { pl: 'Znos [cm]', en: 'Drift [cm]' },
  vel: { pl: 'V [m/s]', en: 'V [m/s]' },
  en: { pl: 'E [J]', en: 'E [J]' },
  tableNote: {
    pl: 'Poprawka: o ile podnieść (+) lub obniżyć (−) punkt trafienia. Kliknięcia dla 0,1 MRAD i ¼ MOA. Znos przy wietrze bocznym {w} m/s.',
    en: 'Correction: how much to dial up (+) or down (−). Clicks for 0.1 MRAD and ¼ MOA. Drift for a {w} m/s full-value crosswind.',
  },
  rowHint: { pl: 'Wiersze na czerwono: energia poniżej progu dla wybranej zwierzyny', en: 'Red rows: energy below the floor for the selected game' },
  highlight: { pl: 'Zaznacz próg dla', en: 'Mark the floor for' },
  rifles: { pl: 'Moja broń', en: 'My rifles' },
  saveRifle: { pl: '+ Zapisz broń', en: '+ Save rifle' },
  rifleName: { pl: 'Nazwa, np. „Sztucer 30-06”', en: 'Name, e.g. “.30-06 bolt action”' },
  saveName: { pl: 'Zapisz', en: 'Save' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  update: { pl: 'Zapisz zmiany', en: 'Save changes' },
  remove: { pl: 'Usuń', en: 'Remove' },
  disclaimer: {
    pl: 'Wyniki to obliczenia na podstawie danych producentów (model G1/G7, atmosfera standardowa, jeśli nie zmienisz warunków). Prawdziwa broń i partia amunicji mogą się różnić – zawsze sprawdź przystrzelanie na strzelnicy. Dane amunicji sprawdzone {d}.',
    en: 'Results are calculated from the makers’ data (G1/G7 drag model, standard atmosphere unless you change it). Your rifle and ammunition lot may differ – always confirm your zero on the range. Ammunition data checked {d}.',
  },
  pbFree: { pl: 'bezołowiowy', en: 'lead-free' },
  loadsCount: { pl: '{n} naboi', en: '{n} loads' },
} satisfies Record<string, { pl: string; en: string }>;
const l = (k: keyof typeof L, vars: Record<string, string | number> = {}) =>
  tt(L[k]).replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));

// ---------------------------------------------------------------- state

const KEY = 'ballistics';
const DEFAULTS: Settings = {
  cal: '.308 Win.',
  load: '',
  ownV: null,
  custom: { mass: 11.7, v0: 800, bc: 0.35, model: 'G1' },
  zero: '100',
  sight: 5,
  temp: 15,
  pressure: 1013,
  wind: 3,
  max: 300,
  leadFree: false,
  rifle: '',
  rifles: [],
};

let settings: Settings = loadSettings();
let ammo: { status: 'idle' | 'loading' | 'error' } | { status: 'done'; data: AmmoFile } = { status: 'idle' };
let rerender: () => void = () => {};
let naming = false;
let highlight = 'deer';

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s === 'object') return { ...DEFAULTS, ...s, custom: { ...DEFAULTS.custom, ...s.custom } };
  } catch {
    /* storage unavailable or corrupt */
  }
  return { ...DEFAULTS };
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

function ensureAmmo() {
  if (ammo.status !== 'idle') return;
  ammo = { status: 'loading' };
  import('./ammo.json')
    .then((m) => {
      ammo = { status: 'done', data: (m.default ?? m) as AmmoFile };
      rerender();
    })
    .catch(() => {
      ammo = { status: 'error' };
      rerender();
    });
}

const calibres = (loads: Load[]) => {
  const count = new Map<string, number>();
  for (const x of loads) count.set(x.c, (count.get(x.c) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => a[0].replace(/^\./, '').localeCompare(b[0].replace(/^\./, ''), 'pl', { numeric: true }));
};

function loadsFor(loads: Load[]) {
  return loads.filter((x) => x.c === settings.cal && (!settings.leadFree || x.lf));
}

/** The load in use, or null for an own load. Falls back to the first load of the calibre. */
function currentLoad(loads: Load[]): Load | null {
  if (settings.load === 'custom') return null;
  const list = loadsFor(loads);
  return list.find((x) => x.id === settings.load) ?? list[0] ?? null;
}

const pickModel = (x: Load): [DragModel, number] => (x.g7 ? ['G7', x.g7] : ['G1', x.g1]);

/** Shot parameters without the zero. */
function baseShot(x: Load | null): Omit<Shot, 'zero'> {
  const c = settings.custom;
  const [model, bc] = x ? pickModel(x) : [c.model, c.bc];
  return {
    v0: x ? settings.ownV || x.v[0]! : c.v0,
    mass: x ? x.m : c.mass,
    bc,
    model,
    sightHeight: settings.sight,
    temp: settings.temp,
    pressure: settings.pressure,
    wind: settings.wind,
  };
}

function zeroDistance(base: Omit<Shot, 'zero'>): { zero: number; gee: boolean; geeFailed: boolean } {
  if (settings.zero !== 'gee') return { zero: Number(settings.zero), gee: false, geeFailed: false };
  const z = zeroForHeight(base, 100, 4);
  return z ? { zero: z, gee: true, geeFailed: false } : { zero: 100, gee: true, geeFailed: true };
}

// ---------------------------------------------------------------- render

export function renderBallistics(onChange: () => void): string {
  rerender = onChange;
  ensureAmmo();
  if (ammo.status === 'error') return `<div class="ball"><p class="notice error">${l('loadError')}</p></div>`;
  if (ammo.status !== 'done') return `<div class="ball"><p class="muted">${l('loading')}</p></div>`;
  const { loads, checked } = ammo.data;
  if (!loads.some((x) => x.c === settings.cal)) settings.cal = DEFAULTS.cal;
  const x = currentLoad(loads);
  const base = baseShot(x);
  const z = zeroDistance(base);
  const shot: Shot = { ...base, zero: z.zero };
  const step = settings.max > 300 ? 50 : 25;
  const table = trajectory(shot, range(settings.max, step));
  const dense = trajectory(shot, range(1000, 5));
  const e100 = trajectory(shot, [100])[0]?.e ?? 0;
  return `<div class="ball">
    <p class="muted">${l('intro')}</p>
    ${renderRifles()}
    ${renderAmmo(loads, x)}
    ${renderConditions(z)}
    ${renderLegal(e100, dense)}
    ${renderChart(table)}
    ${renderTable(table)}
    <p class="muted small">${l('disclaimer', { d: fmtDate(checked) })}</p>
  </div>`;
}

const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(getLang() === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function renderRifles() {
  const chip = (r: Rifle) =>
    `<button type="button" class="w-chip" data-ball="rifle" data-id="${esc(r.id)}" aria-pressed="${settings.rifle === r.id}">${esc(r.name)}</button>`;
  const active = settings.rifles.find((r) => r.id === settings.rifle);
  const nameForm = naming
    ? `<form class="ball-name" data-ball-form="name">
        <input name="ballRifleName" data-ball-name maxlength="60" placeholder="${esc(l('rifleName'))}" value="${esc(active?.name ?? '')}" aria-label="${esc(l('rifleName'))}" required />
        <button type="submit" class="btn">${l('saveName')}</button>
        <button type="button" class="btn ghost" data-ball="cancelName">${l('cancel')}</button>
      </form>`
    : '';
  const actions = active
    ? `<button type="button" class="btn ghost" data-ball="updateRifle">${l('update')}</button>
       <button type="button" class="btn ghost" data-ball="removeRifle">${l('remove')}</button>`
    : '';
  return `<section class="ball-rifles" aria-label="${esc(l('rifles'))}">
    <div class="w-places">${settings.rifles.map(chip).join('')}
      <button type="button" class="w-chip add" data-ball="saveRifle" aria-expanded="${naming}">${l('saveRifle')}</button>
    </div>
    ${actions ? `<div class="actions ball-rifle-actions">${actions}</div>` : ''}
    ${nameForm}
  </section>`;
}

const opt = (v: string, label: string, sel: string) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`;
const field = (label: string, input: string, cls = '') => `<label class="ball-field ${cls}"><span>${label}</span>${input}</label>`;
const numInput = (name: string, value: number | null | string, attrs: string) =>
  `<input type="number" inputmode="decimal" data-ball-field="${name}" value="${value ?? ''}" ${attrs} />`;

function renderAmmo(loads: Load[], x: Load | null) {
  const cals = calibres(loads);
  const list = loadsFor(loads);
  const loadLabel = (y: Load) => `${y.mk} · ${y.n} · ${fmtNum(y.m, 1)} g · ${y.v[0]} m/s${y.lf ? ` · ${l('pbFree')}` : ''}`;
  const sel = settings.load === 'custom' ? 'custom' : x?.id ?? '';
  const loadSelect = `<select data-ball-field="load" aria-label="${esc(l('load'))}">
      ${list.map((y) => opt(y.id, loadLabel(y), sel)).join('')}
      ${opt('custom', l('custom'), sel)}
    </select>`;
  let detail = '';
  if (x) {
    const [model, bc] = pickModel(x);
    const facts = [
      `${fmtNum(x.m, 1)} g`,
      `V0 ${x.v[0]} m/s`,
      x.e[0] ? `E0 ${fmtNum(x.e[0])} J` : '',
      x.e[1] ? `E100 ${fmtNum(x.e[1])} J` : '',
      `BC ${model} ${bc}`,
      x.bl ? `${l('barrel')} ${x.bl} mm` : '',
      x.lf ? l('pbFree') : '',
    ].filter(Boolean);
    detail = `<p class="small ball-facts"><strong>${l('maker')}:</strong> ${esc(x.b)} · ${facts.map(esc).join(' · ')} · <a href="${esc(x.u)}" target="_blank" rel="noopener">${l('source')} ↗</a></p>
      <div class="ball-grid">${field(
        l('ownV'),
        numInput('ownV', settings.ownV, `min="200" max="1400" step="1" placeholder="${x.v[0]}"`),
      )}</div>
      <p class="muted small">${x.bl ? l('ownVHint', { bl: x.bl }) : l('ownVHintNoBl')}</p>`;
  } else {
    const c = settings.custom;
    detail = `<div class="ball-grid">
      ${field(l('mass'), numInput('cMass', c.mass, 'min="1" max="60" step="0.1"'))}
      ${field(l('v0'), numInput('cV0', c.v0, 'min="200" max="1400" step="1"'))}
      ${field(l('bc'), numInput('cBc', c.bc, 'min="0.05" max="1.2" step="0.001"'))}
      ${field(l('model'), `<select data-ball-field="cModel">${opt('G1', 'G1', c.model)}${opt('G7', 'G7', c.model)}</select>`)}
    </div>`;
  }
  return `<section class="card">
    <h2>${l('ammo')}</h2>
    <div class="ball-grid">
      ${field(l('calibre'), `<select data-ball-field="cal">${cals.map(([c, n]) => opt(c, `${c} (${n})`, settings.cal)).join('')}</select>`)}
      ${field(l('load'), loadSelect, 'wide')}
    </div>
    <label class="ball-check"><input type="checkbox" data-ball-field="leadFree"${settings.leadFree ? ' checked' : ''} /> ${l('leadFree')}</label>
    ${settings.leadFree && !list.length ? `<p class="muted small">${l('noneLeadFree')}</p>` : ''}
    <p class="muted small">${l('loadsCount', { n: list.length })}</p>
    ${detail}
  </section>`;
}

function renderConditions(z: { zero: number; gee: boolean; geeFailed: boolean }) {
  const zeros: [Zero, string][] = [
    ['50', l('zeroAt', { d: 50 })],
    ['100', l('zeroAt', { d: 100 })],
    ['150', l('zeroAt', { d: 150 })],
    ['200', l('zeroAt', { d: 200 })],
    ['gee', l('gee')],
  ];
  const geeNote = z.gee ? `<p class="muted small">${z.geeFailed ? l('geeNone') : l('geeIs', { d: fmtNum(z.zero) })}</p>` : '';
  return `<section class="card">
    <h2>${l('rifle')}</h2>
    <div class="ball-grid">
      ${field(l('zero'), `<select data-ball-field="zero">${zeros.map(([v, t]) => opt(v, t, settings.zero)).join('')}</select>`)}
      ${field(l('sight'), numInput('sight', settings.sight, 'min="0" max="15" step="0.1"'))}
      ${field(l('temp'), numInput('temp', settings.temp, 'min="-40" max="50" step="1"'))}
      ${field(l('pressure'), numInput('pressure', settings.pressure, 'min="700" max="1100" step="1"'))}
      ${field(l('wind'), numInput('wind', settings.wind, 'min="0" max="30" step="0.5"'))}
      ${field(l('maxRange'), `<select data-ball-field="max">${[200, 300, 400, 500].map((d) => opt(String(d), `${d} m`, String(settings.max))).join('')}</select>`)}
    </div>
    ${geeNote}
  </section>`;
}

const VERDICT_KEY: Record<Verdict, 'ok' | 'borderline' | 'below'> = { ok: 'ok', borderline: 'borderline', below: 'below' };

function renderLegal(e100: number, dense: Point[]) {
  const rows = FLOORS.map((f) => {
    const v = verdict(e100, f);
    const reach = reachWithEnergy(dense, f.e100);
    const last = dense[dense.length - 1]?.x ?? 0;
    return `<tr>
      <td>${esc(tt(f.name))}<span class="muted small ball-min">${l('min')} ${fmtNum(f.e100)} J</span></td>
      <td class="num"><span class="ball-v ball-${v}">${l(VERDICT_KEY[v])}</span></td>
      <td class="num">${reach ? `${reach >= last ? '> ' : ''}${fmtNum(reach)} m` : '—'}</td>
    </tr>`;
  }).join('');
  const any = FLOORS.some((f) => verdict(e100, f) === 'borderline');
  return `<section class="card">
    <h2>${l('legal')}</h2>
    <p class="ball-e100">${l('yours')}: <strong>${fmtNum(e100)} J</strong></p>
    <table class="tbl ball-legal">
      <thead><tr><th>${l('game')}</th><th class="num"></th><th class="num">${l('reach')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${any ? `<p class="muted small">${l('borderlineNote')}</p>` : ''}
    <p class="muted small">${l('legalNote')} <a href="${LEGAL_SOURCE}" target="_blank" rel="noopener">${l('legalSource')} ↗</a></p>
  </section>`;
}

function renderChart(pts: Point[]) {
  // Size the drawing to the space it gets, so labels keep a readable size on phones.
  const avail = (document.querySelector('#content')?.clientWidth ?? 700) - 64;
  const W = Math.round(Math.max(280, Math.min(640, avail)));
  const H = Math.round(W < 420 ? 200 : 220);
  const pad = { l: 44, r: 40, t: 28, b: 28 };
  const maxX = pts[pts.length - 1]?.x || 1;
  const drops = pts.map((p) => p.drop);
  let hi = Math.max(5, ...drops);
  let lo = Math.min(-5, ...drops);
  const span = niceStep((hi - lo) / 4);
  hi = Math.ceil(hi / span) * span;
  lo = Math.floor(lo / span) * span;
  const sx = (x: number) => pad.l + (x / maxX) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + ((hi - y) / (hi - lo)) * (H - pad.t - pad.b);
  const yTicks: number[] = [];
  for (let y = lo; y <= hi + 1e-9; y += span) yTicks.push(Math.round(y));
  const xStep = maxX > 300 || W < 420 ? 100 : 50;
  const xTicks = range(maxX, xStep);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.drop).toFixed(1)}`).join('');
  const dots = pts
    .filter((p) => p.x > 0 && p.x % 100 === 0)
    .map(
      (p) =>
        `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.drop).toFixed(1)}" r="3.5" class="ball-dot"/><text x="${sx(p.x).toFixed(1)}" y="${(sy(p.drop) - 8).toFixed(1)}" text-anchor="middle" class="ball-lbl">${fmtSigned(p.drop, 1)}</text>`,
    )
    .join('');
  return `<section class="card">
    <h2>${l('chart')}</h2>
    <svg class="ball-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(l('chart'))}">
      ${yTicks.map((y) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${sy(y)}" y2="${sy(y)}" class="${y === 0 ? 'ball-los' : 'ball-grid-line'}"/><text x="${pad.l - 6}" y="${sy(y) + 4}" text-anchor="end" class="ball-axis">${y}</text>`).join('')}
      ${xTicks.map((x, i) => `<text x="${sx(x)}" y="${H - 8}" text-anchor="middle" class="ball-axis">${x}${i === xTicks.length - 1 ? ' m' : ''}</text>`).join('')}
      <text x="${pad.l - 6}" y="12" text-anchor="end" class="ball-axis">cm</text>
      <path d="${path}" class="ball-path"/>
      ${dots}
    </svg>
  </section>`;
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}

const fmtSigned = (n: number, d = 0) => {
  const r = Number(n.toFixed(d));
  return (r > 0 ? '+' : r < 0 ? '−' : '') + fmtNum(Math.abs(r), d);
};

function renderTable(pts: Point[]) {
  const floor = FLOORS.find((f) => f.id === highlight);
  const rows = pts
    .map((p) => {
      const mrad = correctionMrad(p);
      const moa = mrad / MRAD_PER_MOA;
      const weak = floor && p.e < floor.e100;
      const corr = (v: number, click: number) =>
        p.x === 0 ? '—' : `${fmtSigned(v, 1)} <span class="muted">(${fmtSigned(Math.round(v / click))} ${l('clicks')})</span>`;
      return `<tr${weak ? ' class="ball-weak"' : ''}>
        <td class="num">${p.x}</td>
        <td class="num">${p.x === 0 ? fmtSigned(-settings.sight, 1) : fmtSigned(p.drop, 1)}</td>
        <td class="num">${corr(mrad, 0.1)}</td>
        <td class="num">${corr(moa, 0.25)}</td>
        <td class="num">${fmtNum(Math.abs(p.drift), 1)}</td>
        <td class="num">${fmtNum(p.v)}</td>
        <td class="num">${fmtNum(p.e)}</td>
      </tr>`;
    })
    .join('');
  return `<section class="card">
    <h2>${l('table')}</h2>
    <label class="ball-field ball-inline"><span>${l('highlight')}</span>
      <select data-ball-field="highlight">${FLOORS.map((f) => opt(f.id, `${tt(f.name)} (${fmtNum(f.e100)} J)`, highlight)).join('')}</select>
    </label>
    <div class="ball-tblwrap">
      <table class="tbl ball-table">
        <thead><tr><th class="num">${l('dist')}</th><th class="num">${l('path')}</th><th class="num">${l('mrad')}</th><th class="num">${l('moa')}</th><th class="num">${l('drift')}</th><th class="num">${l('vel')}</th><th class="num">${l('en')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small">${l('tableNote', { w: fmtNum(settings.wind, 1) })} ${l('rowHint')}.</p>
  </section>`;
}

// ---------------------------------------------------------------- events

function applyRifle(r: Rifle) {
  Object.assign(settings, { cal: r.cal, load: r.load, ownV: r.ownV, custom: { ...r.custom }, zero: r.zero, sight: r.sight, rifle: r.id });
}

function rifleFromSettings(id: string, name: string): Rifle {
  return { id, name, cal: settings.cal, load: settings.load, ownV: settings.ownV, custom: { ...settings.custom }, zero: settings.zero, sight: settings.sight };
}

export function handleBallisticsClick(el: HTMLElement): boolean {
  const action = el.dataset.ball;
  if (!action) return false;
  switch (action) {
    case 'rifle': {
      const r = settings.rifles.find((x) => x.id === el.dataset.id);
      if (r) {
        if (settings.rifle === r.id) settings.rifle = '';
        else applyRifle(r);
      }
      naming = false;
      break;
    }
    case 'saveRifle':
      naming = !naming;
      if (naming) settings.rifle = '';
      rerender();
      if (naming) document.querySelector<HTMLInputElement>('[data-ball-name]')?.focus();
      persist();
      return true;
    case 'cancelName':
      naming = false;
      break;
    case 'updateRifle': {
      const i = settings.rifles.findIndex((x) => x.id === settings.rifle);
      if (i >= 0) settings.rifles[i] = rifleFromSettings(settings.rifles[i].id, settings.rifles[i].name);
      break;
    }
    case 'removeRifle':
      settings.rifles = settings.rifles.filter((x) => x.id !== settings.rifle);
      settings.rifle = '';
      break;
    default:
      return false;
  }
  persist();
  rerender();
  return true;
}

const num = (v: string, lo: number, hi: number, fallback: number) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function handleBallisticsChange(el: HTMLElement): boolean {
  const name = el.dataset.ballField;
  if (!name) return false;
  const value = (el as HTMLInputElement).value;
  const c = settings.custom;
  switch (name) {
    case 'cal':
      settings.cal = value;
      settings.load = '';
      settings.ownV = null;
      break;
    case 'load':
      settings.load = value;
      settings.ownV = null;
      break;
    case 'leadFree':
      settings.leadFree = (el as HTMLInputElement).checked;
      if (settings.load !== 'custom') settings.load = '';
      break;
    case 'ownV':
      settings.ownV = value.trim() ? num(value, 200, 1400, 0) || null : null;
      break;
    case 'cMass':
      c.mass = num(value, 1, 60, c.mass);
      break;
    case 'cV0':
      c.v0 = num(value, 200, 1400, c.v0);
      break;
    case 'cBc':
      c.bc = num(value, 0.05, 1.2, c.bc);
      break;
    case 'cModel':
      c.model = value === 'G7' ? 'G7' : 'G1';
      break;
    case 'zero':
      settings.zero = (['50', '100', '150', '200', 'gee'].includes(value) ? value : '100') as Zero;
      break;
    case 'sight':
      settings.sight = num(value, 0, 15, settings.sight);
      break;
    case 'temp':
      settings.temp = num(value, -40, 50, settings.temp);
      break;
    case 'pressure':
      settings.pressure = num(value, 700, 1100, settings.pressure);
      break;
    case 'wind':
      settings.wind = num(value, 0, 30, settings.wind);
      break;
    case 'max':
      settings.max = num(value, 100, 500, 300);
      break;
    case 'highlight':
      highlight = value;
      break;
    default:
      return false;
  }
  persist();
  rerender();
  return true;
}

export function handleBallisticsSubmit(form: HTMLFormElement): boolean {
  if (form.dataset.ballForm !== 'name') return false;
  const name = form.querySelector<HTMLInputElement>('[data-ball-name]')!.value.trim();
  if (name) {
    const r = rifleFromSettings(`r${Date.now().toString(36)}`, name);
    settings.rifles.push(r);
    settings.rifle = r.id;
    persist();
  }
  naming = false;
  rerender();
  return true;
}
