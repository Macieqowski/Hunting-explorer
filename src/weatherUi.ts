// Weather section: current location and saved places, sun/twilight, moon and
// hunter-oriented hints. Rendered as a string like the other sections; main.ts
// forwards clicks, input and form submits here.

import { getLang, tt, fmtNum } from './i18n';
import { sunTimes, sunAltitude, moonIllumination, moonTimes, moonPhaseName, nextMoonPhase, moonAltitudeDeg, type MoonPhaseName } from './astro';
import {
  fetchForecast,
  searchPlaces,
  parseCoords,
  hourIndex,
  pressureTrend,
  compass,
  directionName,
  beaufort,
  hunterTips,
  weatherDesc,
  type Forecast,
  type Place,
  type Tip,
  type Trend,
} from './weather';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  here: { pl: 'Moja lokalizacja', en: 'My location' },
  add: { pl: '+ Dodaj miejsce', en: '+ Add place' },
  searchPh: { pl: 'Miejscowość lub współrzędne, np. 52.23, 21.01', en: 'Town or coordinates, e.g. 52.23, 21.01' },
  searching: { pl: 'Szukanie…', en: 'Searching…' },
  noPlaces: { pl: 'Nic nie znaleziono.', en: 'Nothing found.' },
  coordsHit: { pl: 'Współrzędne', en: 'Coordinates' },
  locating: { pl: 'Ustalanie położenia…', en: 'Finding your location…' },
  locDenied: {
    pl: 'Nie udało się ustalić położenia. Zezwól przeglądarce na dostęp do lokalizacji albo dodaj miejsce ręcznie.',
    en: 'Could not get your location. Allow location access in the browser or add a place by hand.',
  },
  loading: { pl: 'Wczytywanie prognozy…', en: 'Loading forecast…' },
  loadError: { pl: 'Nie udało się pobrać prognozy.', en: 'Could not load the forecast.' },
  retry: { pl: 'Spróbuj ponownie', en: 'Retry' },
  save: { pl: 'Zapisz miejsce', en: 'Save place' },
  rename: { pl: 'Zmień nazwę', en: 'Rename' },
  remove: { pl: 'Usuń', en: 'Remove' },
  name: { pl: 'Nazwa, np. „Ambona przy olszynie”', en: 'Name, e.g. “High seat by the alders”' },
  ok: { pl: 'Zapisz', en: 'Save' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  onMap: { pl: 'Obwód na mapie', en: 'District on map' },
  refresh: { pl: 'Odśwież', en: 'Refresh' },
  updated: { pl: 'Aktualizacja', en: 'Updated' },
  now: { pl: 'Teraz', en: 'Now' },
  feels: { pl: 'odczuwalna', en: 'feels like' },
  wind: { pl: 'Wiatr', en: 'Wind' },
  from: { pl: 'z kierunku', en: 'from' },
  gusts: { pl: 'porywy', en: 'gusts' },
  pressure: { pl: 'Ciśnienie', en: 'Pressure' },
  humidity: { pl: 'Wilgotność', en: 'Humidity' },
  clouds: { pl: 'Zachmurzenie', en: 'Cloud cover' },
  visibility: { pl: 'Widzialność', en: 'Visibility' },
  precip: { pl: 'Opad', en: 'Precipitation' },
  dew: { pl: 'Punkt rosy', en: 'Dew point' },
  hints: { pl: 'Na polowanie', en: 'For the hunt' },
  light: { pl: 'Słońce i światło', en: 'Sun and light' },
  astroDawn: { pl: 'Świt astronomiczny', en: 'Astronomical dawn' },
  nauticalDawn: { pl: 'Świt żeglarski', en: 'Nautical dawn' },
  civilDawn: { pl: 'Świt cywilny', en: 'Civil dawn' },
  sunrise: { pl: 'Wschód słońca', en: 'Sunrise' },
  noon: { pl: 'Górowanie', en: 'Solar noon' },
  sunset: { pl: 'Zachód słońca', en: 'Sunset' },
  civilDusk: { pl: 'Zmierzch cywilny', en: 'Civil dusk' },
  nauticalDusk: { pl: 'Zmierzch żeglarski', en: 'Nautical dusk' },
  astroDusk: { pl: 'Zmierzch astronomiczny', en: 'Astronomical dusk' },
  dayLength: { pl: 'Długość dnia', en: 'Day length' },
  twilightNote: {
    pl: 'Świt i zmierzch cywilny (słońce 6° pod horyzontem) to umowna granica naturalnego światła, przy której da się jeszcze rozpoznać zwierzynę gołym okiem. Godziny polowania określają przepisy – sprawdź aktualne rozporządzenie.',
    en: 'Civil dawn and dusk (sun 6° below the horizon) are the usual limit of natural light for recognising game with the naked eye. Legal hunting hours are set by regulation – check the current rules.',
  },
  lightNow: { pl: 'Teraz', en: 'Now' },
  lDay: { pl: 'dzień', en: 'daylight' },
  lCivil: { pl: 'zmierzch/świt cywilny', en: 'civil twilight' },
  lNautical: { pl: 'zmierzch/świt żeglarski', en: 'nautical twilight' },
  lAstro: { pl: 'zmierzch/świt astronomiczny', en: 'astronomical twilight' },
  lNight: { pl: 'noc', en: 'night' },
  moon: { pl: 'Księżyc', en: 'Moon' },
  illum: { pl: 'Oświetlenie tarczy', en: 'Illumination' },
  moonrise: { pl: 'Wschód Księżyca', en: 'Moonrise' },
  moonset: { pl: 'Zachód Księżyca', en: 'Moonset' },
  moonTonight: { pl: 'Nad horyzontem tej nocy', en: 'Up during tonight' },
  ofDark: { pl: 'z', en: 'of' },
  darkHours: { pl: 'h ciemności', en: 'h of darkness' },
  nextFull: { pl: 'Najbliższa pełnia', en: 'Next full moon' },
  nextNew: { pl: 'Najbliższy nów', en: 'Next new moon' },
  noRise: { pl: 'brak tego dnia', en: 'none that day' },
  hourly: { pl: 'Najbliższe 24 godziny', en: 'Next 24 hours' },
  daily: { pl: 'Prognoza na 7 dni', en: '7-day forecast' },
  today: { pl: 'Dziś', en: 'Today' },
  sun: { pl: 'Słońce', en: 'Sun' },
  attribution: {
    pl: 'Dane pogodowe: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0). Godziny Słońca i Księżyca liczone w przeglądarce dla wybranego punktu.',
    en: 'Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0). Sun and moon times are calculated in the browser for the chosen point.',
  },
  h: { pl: 'h', en: 'h' },
  min: { pl: 'min', en: 'min' },
};
const l = (k: keyof typeof L) => tt(L[k]);

const PHASES: Record<MoonPhaseName, { pl: string; en: string; icon: string }> = {
  new: { pl: 'Nów', en: 'New moon', icon: '🌑' },
  waxingCrescent: { pl: 'Przybywający sierp', en: 'Waxing crescent', icon: '🌒' },
  firstQuarter: { pl: 'Pierwsza kwadra', en: 'First quarter', icon: '🌓' },
  waxingGibbous: { pl: 'Przybywający garb', en: 'Waxing gibbous', icon: '🌔' },
  full: { pl: 'Pełnia', en: 'Full moon', icon: '🌕' },
  waningGibbous: { pl: 'Ubywający garb', en: 'Waning gibbous', icon: '🌖' },
  lastQuarter: { pl: 'Ostatnia kwadra', en: 'Last quarter', icon: '🌗' },
  waningCrescent: { pl: 'Ubywający sierp', en: 'Waning crescent', icon: '🌘' },
};

const TREND: Record<Trend, { pl: string; en: string; arrow: string }> = {
  risingFast: { pl: 'szybko rośnie', en: 'rising fast', arrow: '⇈' },
  rising: { pl: 'rośnie', en: 'rising', arrow: '↑' },
  steady: { pl: 'stałe', en: 'steady', arrow: '→' },
  falling: { pl: 'spada', en: 'falling', arrow: '↓' },
  fallingFast: { pl: 'szybko spada', en: 'falling fast', arrow: '⇊' },
};

// ---------------------------------------------------------------- state

type Status<T> = { status: 'loading' } | { status: 'done'; data: T; at: number } | { status: 'error'; message: string };

const HERE = 'here';
const LS_PLACES = 'weather.places';
const LS_SEL = 'weather.selected';
const LS_HERE = 'weather.here';
const STALE_MS = 15 * 60e3;

function readLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

let saved: Place[] = readLS<Place[]>(LS_PLACES, []).filter((p) => p && isFinite(p.lat) && isFinite(p.lng));
/** Selected place: HERE, a saved place's id, or a temporary place (from the map or search). */
let selected: string = readLS<string>(LS_SEL, HERE);
let temp: Place | null = null;
let here: { lat: number; lng: number } | null = readLS(LS_HERE, null);
let geo: 'idle' | 'locating' | 'done' | 'denied' = 'idle';
const forecasts = new Map<string, Status<Forecast>>();
let adding = false;
let naming = false;
let query = '';
let results: Status<Place[]> | null = null;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let rerender: () => void = () => {};

if (selected !== HERE && !saved.some((p) => p.id === selected)) selected = HERE;

const keyOf = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
// Always with a decimal point: a Polish decimal comma would make "52,2297, 21,0122" ambiguous.
const coordsText = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

function currentPlace(): Place | null {
  if (selected === HERE) return here ? { id: HERE, name: l('here'), lat: here.lat, lng: here.lng } : null;
  if (temp && temp.id === selected) return temp;
  return saved.find((p) => p.id === selected) ?? null;
}

function select(id: string) {
  selected = id;
  naming = false;
  if (id === HERE || saved.some((p) => p.id === id)) writeLS(LS_SEL, id);
}

function persist() {
  writeLS(LS_PLACES, saved);
}

function locate() {
  if (!navigator.geolocation) {
    geo = 'denied';
    return;
  }
  geo = 'locating';
  navigator.geolocation.getCurrentPosition(
    (p) => {
      here = { lat: p.coords.latitude, lng: p.coords.longitude };
      writeLS(LS_HERE, here);
      geo = 'done';
      rerender();
    },
    () => {
      geo = 'denied';
      rerender();
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60e3 },
  );
}

function ensureForecast(p: Place, force = false) {
  const k = keyOf(p.lat, p.lng);
  const cur = forecasts.get(k);
  if (!force && cur && (cur.status === 'loading' || (cur.status === 'done' && Date.now() - cur.at < STALE_MS))) return;
  // Keep showing stale data while refreshing.
  if (!cur || cur.status !== 'done') forecasts.set(k, { status: 'loading' });
  fetchForecast(p.lat, p.lng).then(
    (data) => {
      forecasts.set(k, { status: 'done', data, at: Date.now() });
      rerender();
    },
    (e: Error) => {
      if (forecasts.get(k)?.status !== 'done') forecasts.set(k, { status: 'error', message: e.message });
      rerender();
    },
  );
}

/** Open the weather for a point picked elsewhere (e.g. on the map). */
export function showWeatherAt(lat: number, lng: number, name?: string) {
  const existing = saved.find((p) => keyOf(p.lat, p.lng) === keyOf(lat, lng));
  if (existing) return select(existing.id);
  temp = { id: `t${keyOf(lat, lng)}`, name: name || coordsText(lat, lng), lat, lng };
  select(temp.id);
}

// ---------------------------------------------------------------- formatting

const locale = () => (getLang() === 'pl' ? 'pl-PL' : 'en-GB');
function fmt(f: Forecast) {
  const tz = f.timezone;
  const opt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale(), { ...o, timeZone: tz });
    } catch {
      return new Intl.DateTimeFormat(locale(), o);
    }
  };
  const time = opt({ hour: '2-digit', minute: '2-digit' });
  const hour = opt({ hour: '2-digit' });
  const day = opt({ weekday: 'short', day: 'numeric', month: 'numeric' });
  const date = opt({ weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return {
    time: (d: Date | number | null) => (d == null ? '—' : time.format(d)),
    hour: (d: number) => hour.format(d).replace(/^(\d+).*$/, '$1'),
    day: (d: number) => day.format(d),
    date: (d: Date) => date.format(d),
  };
}
const deg = (n: number) => `${fmtNum(n)}°`;
const duration = (ms: number) => `${Math.floor(ms / 36e5)} ${l('h')} ${Math.round((ms % 36e5) / 6e4)} ${l('min')}`;
/** Arrow showing where the wind blows TO (direction is where it comes FROM). */
const windArrow = (from: number) => `<span class="w-arrow" style="transform:rotate(${Math.round(from)}deg)" aria-hidden="true">↓</span>`;

// ---------------------------------------------------------------- rendering

export function renderWeather(onChange: () => void): string {
  rerender = onChange;
  if (selected === HERE && geo === 'idle') locate();
  const p = currentPlace();
  if (p) ensureForecast(p);
  return `<div class="weather">${renderPlaces()}${adding ? renderSearch() : ''}${renderBody(p)}
    <p class="muted small w-attrib">${l('attribution')}</p></div>`;
}

function renderPlaces() {
  const chip = (id: string, label: string) =>
    `<button type="button" class="w-chip" data-weather="select" data-id="${esc(id)}" aria-pressed="${selected === id}">${label}</button>`;
  const list = [chip(HERE, `◎ ${esc(l('here'))}`), ...saved.map((p) => chip(p.id, esc(p.name)))];
  if (temp && !saved.some((p) => p.id === temp!.id)) list.push(chip(temp.id, `📍 ${esc(temp.name)}`));
  list.push(`<button type="button" class="w-chip add" data-weather="add" aria-expanded="${adding}">${l('add')}</button>`);
  return `<div class="w-places">${list.join('')}</div>`;
}

function renderSearch() {
  let list = '';
  const coords = parseCoords(query);
  if (coords)
    list = `<li><button type="button" data-weather="pick" data-lat="${coords.lat}" data-lng="${coords.lng}" data-name="${esc(coordsText(coords.lat, coords.lng))}">
      <strong>${l('coordsHit')}</strong> <span class="muted">${esc(coordsText(coords.lat, coords.lng))}</span></button></li>`;
  else if (results?.status === 'loading') list = `<li class="muted small">${l('searching')}</li>`;
  else if (results?.status === 'error') list = `<li class="muted small">${esc(results.message)}</li>`;
  else if (results?.status === 'done')
    list = results.data.length
      ? results.data
          .map(
            (r) => `<li><button type="button" data-weather="pick" data-lat="${r.lat}" data-lng="${r.lng}" data-name="${esc(r.name)}" data-detail="${esc(r.detail ?? '')}">
          <strong>${esc(r.name)}</strong> <span class="muted">${esc(r.detail ?? '')}</span></button></li>`,
          )
          .join('')
      : `<li class="muted small">${l('noPlaces')}</li>`;
  return `<form class="w-search searchbar" data-weather-form="search">
    <input type="search" data-weather-q value="${esc(query)}" placeholder="${esc(l('searchPh'))}" autocomplete="off" enterkeyhint="search" />
    <ul class="w-results">${list}</ul></form>`;
}

function renderBody(p: Place | null): string {
  if (!p) {
    if (geo === 'denied') return `<div class="notice">${l('locDenied')}</div>`;
    return `<p class="muted">${l('locating')}</p>`;
  }
  const st = forecasts.get(keyOf(p.lat, p.lng));
  const head = renderHeader(p, st?.status === 'done' ? st.at : null);
  if (!st || st.status === 'loading') return `${head}<p class="muted">${l('loading')}</p>`;
  if (st.status === 'error')
    return `${head}<div class="notice error"><strong>${l('loadError')}</strong><p class="small">${esc(st.message)}</p>
      <button type="button" class="btn" data-weather="refresh">${l('retry')}</button></div>`;
  const f = st.data;
  const now = Date.now();
  const astro = astroFor(f, p, now);
  return `${head}${renderNow(f, now)}${renderTips(f, now, astro)}${renderSun(f, p, now, astro)}${renderMoon(f, now, astro)}${renderHourly(f, p, now)}${renderDaily(f, p, now)}`;
}

function renderHeader(p: Place, at: number | null) {
  const isSaved = saved.some((s) => s.id === p.id);
  const locatingNote = p.id === HERE && geo === 'locating' ? ` · ${l('locating')}` : '';
  const nameForm = naming
    ? `<form class="w-name" data-weather-form="name">
        <input type="text" data-weather-name value="${esc(isSaved || p.id !== HERE ? p.name : '')}" placeholder="${esc(l('name'))}" maxlength="60" required />
        <button type="submit" class="btn">${l('ok')}</button>
        <button type="button" class="btn ghost" data-weather="cancelName">${l('cancel')}</button></form>`
    : '';
  const updated = at ? ` · ${l('updated')} ${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(at)}` : '';
  return `<div class="w-head">
    <div><h2>${esc(p.name)}</h2><p class="muted small">${esc(p.detail ? p.detail + ' · ' : '')}${coordsText(p.lat, p.lng)}${updated}${locatingNote}</p></div>
    <div class="actions">
      ${isSaved ? `<button type="button" class="btn ghost" data-weather="rename">${l('rename')}</button><button type="button" class="btn ghost" data-weather="remove">${l('remove')}</button>` : `<button type="button" class="btn ghost" data-weather="save">${l('save')}</button>`}
      <a class="btn ghost" href="#/punkt/${p.lat.toFixed(5)},${p.lng.toFixed(5)}">${l('onMap')}</a>
      <button type="button" class="btn ghost" data-weather="refresh" aria-label="${esc(l('refresh'))}">↻</button>
    </div></div>${nameForm}`;
}

function renderNow(f: Forecast, now: number) {
  const c = f.current;
  const lang = getLang();
  const d = weatherDesc(c.code, lang, !c.isDay);
  const i = hourIndex(f.hours, now);
  const h = f.hours[i];
  const p = pressureTrend(f.hours, now);
  const tr = TREND[p.trend];
  const vis = h.visibility == null ? '—' : h.visibility >= 10000 ? `> 10 km` : `${fmtNum(h.visibility / 1000, 1)} km`;
  return `<section class="card w-now">
    <p class="eyebrow">${l('now')}</p>
    <div class="w-big"><span class="w-icon" aria-hidden="true">${d.icon}</span><b>${deg(c.temp)}</b>
      <div><strong>${esc(d.text)}</strong><span class="muted small">${l('feels')} ${deg(c.feels)}</span></div></div>
    <div class="kpis w-kpis">
      <div><span>${l('wind')}</span><b>${windArrow(c.windDir)} ${fmtNum(c.wind)} <small>km/h</small></b>
        <span>${l('from')} ${compass(c.windDir)} (${esc(directionName(c.windDir, lang))}) · ${l('gusts')} ${fmtNum(c.gust)} km/h · ${beaufort(c.wind)}°B</span></div>
      <div><span>${l('pressure')}</span><b>${fmtNum(c.pressure)} <small>hPa</small></b>
        <span>${tr.arrow} ${esc(tt(tr))} (${p.change > 0 ? '+' : ''}${fmtNum(p.change, 1)} hPa / 3 h)</span></div>
    </div>
    <dl class="kv w-kv">
      <dt>${l('humidity')}</dt><dd>${fmtNum(c.humidity)}%</dd>
      <dt>${l('dew')}</dt><dd>${deg(h.dew)}</dd>
      <dt>${l('clouds')}</dt><dd>${fmtNum(c.cloud)}%</dd>
      <dt>${l('visibility')}</dt><dd>${vis}</dd>
      <dt>${l('precip')}</dt><dd>${fmtNum(c.precip, 1)} mm</dd>
    </dl></section>`;
}

interface Astro {
  sun: ReturnType<typeof sunTimes>;
  dayStart: number;
  moon: { fraction: number; phase: number };
  moonToday: ReturnType<typeof moonTimes>;
  /** Moon-above-horizon hours during tonight's darkness (civil dusk → civil dawn), and whether it is up at all. */
  moonNightHours: number;
  nightHours: number;
}

/** Local midnight (in the forecast's timezone) of the day containing `t`. */
const localMidnight = (t: number, offsetS: number) => Math.floor((t + offsetS * 1000) / 864e5) * 864e5 - offsetS * 1000;

function astroFor(f: Forecast, p: Place, now: number): Astro {
  const dayStart = localMidnight(now, f.utcOffset);
  const sun = sunTimes(new Date(dayStart + 12 * 36e5), p.lat, p.lng);
  const tomorrow = sunTimes(new Date(dayStart + 36 * 36e5), p.lat, p.lng);
  const moon = moonIllumination(new Date(now));
  // Tonight: from today's civil dusk (or now, if later) until tomorrow's civil dawn.
  const start = Math.max(now, sun.civilDusk?.valueOf() ?? dayStart + 20 * 36e5);
  const end = tomorrow.civilDawn?.valueOf() ?? dayStart + 30 * 36e5;
  let up = 0;
  let total = 0;
  for (let t = start; t < end; t += 15 * 60e3) {
    total++;
    if (moonAltitudeDeg(new Date(t), p.lat, p.lng) > 0) up++;
  }
  return { sun, dayStart, moon, moonToday: moonTimes(new Date(dayStart), p.lat, p.lng), moonNightHours: up / 4, nightHours: total / 4 };
}

const TIP_TEXT: Record<Tip['kind'], (t: never, f: ReturnType<typeof fmt>) => string> = {
  scent: (t: { to: number }) =>
    tt({
      pl: `Wiatr niesie zapach na ${compass(t.to)}. Stań po stronie ${compass(t.to)} od miejsca, gdzie spodziewasz się zwierzyny, i podchodź pod wiatr – tak, by wiał od zwierzyny do ciebie.`,
      en: `The wind carries scent towards ${compass(t.to)}. Sit on the ${compass(t.to)} side of where you expect game and stalk into the wind, so it blows from the game to you.`,
    }),
  calm: () =>
    tt({
      pl: 'Prawie bezwietrznie – zapach rozchodzi się we wszystkich kierunkach, a każdy dźwięk niesie się daleko.',
      en: 'Almost calm – scent spreads in every direction and every sound carries far.',
    }),
  gusty: (t: { gust: number }) =>
    tt({
      pl: `Porywy do ${fmtNum(t.gust)} km/h – zmienny wiatr utrudnia podchód, zwierzyna jest czujniejsza.`,
      en: `Gusts up to ${fmtNum(t.gust)} km/h – shifting wind makes stalking harder and game more alert.`,
    }),
  pressureFalling: (t: { change: number }) =>
    tt({
      pl: `Ciśnienie spada (${fmtNum(t.change, 1)} hPa w 3 h) – zbliża się zmiana pogody; zwierzyna często żeruje intensywniej przed frontem.`,
      en: `Pressure is falling (${fmtNum(t.change, 1)} hPa in 3 h) – a change in the weather is coming; game often feeds more before a front.`,
    }),
  pressureRising: () =>
    tt({
      pl: 'Ciśnienie rośnie – pogoda się stabilizuje, po przejściu frontu zwierzyna zwykle wraca do normalnej aktywności.',
      en: 'Pressure is rising – the weather is settling; after a front game usually returns to normal activity.',
    }),
  freshSnow: (t: { cm: number }) =>
    tt({
      pl: `Świeży śnieg (${fmtNum(t.cm, 1)} cm w ciągu doby) – dobre warunki do tropienia i liczenia zwierzyny.`,
      en: `Fresh snow (${fmtNum(t.cm, 1)} cm in the last day) – good conditions for tracking and counting game.`,
    }),
  fog: (t: { at: number }, f) =>
    tt({
      pl: `Mgła lub słaba widzialność od ok. ${f.time(t.at)} – pewna identyfikacja celu może być niemożliwa.`,
      en: `Fog or poor visibility from about ${f.time(t.at)} – positive target identification may be impossible.`,
    }),
  frost: (t: { min: number }) =>
    tt({
      pl: `Przymrozek do ${deg(t.min)} – zmarznięte poszycie hałasuje przy podchodzie; ubierz się na długie siedzenie.`,
      en: `Frost down to ${deg(t.min)} – frozen ground cover is noisy when stalking; dress for a long sit.`,
    }),
  rainSoon: (t: { at: number }, f) =>
    tt({ pl: `Opady spodziewane od ok. ${f.time(t.at)}.`, en: `Rain expected from about ${f.time(t.at)}.` }),
  brightMoon: (t: { fraction: number }) =>
    tt({
      pl: `Jasna noc – Księżyc oświetlony w ${fmtNum(t.fraction * 100)}% i nad horyzontem; dobre warunki do zasiadki na dziki.`,
      en: `Bright night – the moon is ${fmtNum(t.fraction * 100)}% lit and above the horizon; good for a night sit for wild boar.`,
    }),
  darkNight: () =>
    tt({
      pl: 'Ciemna noc – Księżyc słaby lub pod horyzontem; nocna obserwacja bez optyki będzie trudna.',
      en: 'Dark night – the moon is faint or below the horizon; night observation without optics will be hard.',
    }),
};

function renderTips(f: Forecast, now: number, a: Astro) {
  const tips = hunterTips(f, now, { fraction: a.moon.fraction, upTonight: a.moonNightHours >= 1 });
  const fm = fmt(f);
  return `<section class="card"><p class="eyebrow">${l('hints')}</p>
    <ul class="w-tips">${tips.map((t) => `<li class="tip-${t.kind}">${(TIP_TEXT[t.kind] as (t: Tip, f: ReturnType<typeof fmt>) => string)(t, fm)}</li>`).join('')}</ul></section>`;
}

type LightKind = 'day' | 'civil' | 'nautical' | 'astro' | 'night';
const lightOf = (alt: number): LightKind => (alt > -0.833 ? 'day' : alt > -6 ? 'civil' : alt > -12 ? 'nautical' : alt > -18 ? 'astro' : 'night');
const LIGHT_COLOR: Record<LightKind, string> = {
  day: 'var(--w-day)',
  civil: 'var(--w-civil)',
  nautical: 'var(--w-nautical)',
  astro: 'var(--w-astro)',
  night: 'var(--w-night)',
};
const LIGHT_LABEL: Record<LightKind, keyof typeof L> = { day: 'lDay', civil: 'lCivil', nautical: 'lNautical', astro: 'lAstro', night: 'lNight' };

/** 24-hour light bar for the local day as a CSS gradient with hard stops. */
function lightBar(dayStart: number, p: Place, now: number) {
  const steps = 288; // 5-minute resolution
  const stops: string[] = [];
  let prev: LightKind | null = null;
  for (let i = 0; i <= steps; i++) {
    const k = lightOf(sunAltitude(new Date(dayStart + (i * 864e5) / steps), p.lat, p.lng));
    if (k !== prev) {
      const pos = ((i / steps) * 100).toFixed(2);
      if (prev) stops.push(`${LIGHT_COLOR[prev]} ${pos}%`);
      stops.push(`${LIGHT_COLOR[k]} ${pos}%`);
      prev = k;
    }
  }
  stops.push(`${LIGHT_COLOR[prev!]} 100%`);
  const nowPos = ((now - dayStart) / 864e5) * 100;
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${h}</span>`).join('');
  return `<div class="w-light" style="background:linear-gradient(90deg, ${stops.join(', ')})">
      ${nowPos >= 0 && nowPos <= 100 ? `<i class="w-now-mark" style="left:${nowPos.toFixed(2)}%"></i>` : ''}</div>
    <div class="w-ticks">${ticks}</div>`;
}

function renderSun(f: Forecast, p: Place, now: number, a: Astro) {
  const fm = fmt(f);
  const s = a.sun;
  const k = lightOf(sunAltitude(new Date(now), p.lat, p.lng));
  const row = (key: keyof typeof L, d: Date | null, strong = false) =>
    d ? `<dt>${l(key)}</dt><dd>${strong ? `<strong>${fm.time(d)}</strong>` : fm.time(d)}</dd>` : '';
  const length = s.sunrise && s.sunset ? duration(s.sunset.valueOf() - s.sunrise.valueOf()) : '—';
  return `<section class="card"><p class="eyebrow">${l('light')}</p>
    ${lightBar(a.dayStart, p, now)}
    <p class="small w-light-now"><span class="w-dot" style="background:${LIGHT_COLOR[k]}"></span>${l('lightNow')}: <strong>${l(LIGHT_LABEL[k])}</strong></p>
    <dl class="kv w-kv">
      ${row('astroDawn', s.astroDawn)}${row('nauticalDawn', s.nauticalDawn)}${row('civilDawn', s.civilDawn, true)}
      ${row('sunrise', s.sunrise, true)}${row('noon', s.noon)}${row('sunset', s.sunset, true)}
      ${row('civilDusk', s.civilDusk, true)}${row('nauticalDusk', s.nauticalDusk)}${row('astroDusk', s.astroDusk)}
      <dt>${l('dayLength')}</dt><dd>${length}</dd>
    </dl>
    <p class="muted small">${l('twilightNote')}</p></section>`;
}

function renderMoon(f: Forecast, now: number, a: Astro) {
  const fm = fmt(f);
  const ph = PHASES[moonPhaseName(a.moon.phase)];
  const nf = nextMoonPhase(new Date(now), 0.5);
  const nn = nextMoonPhase(new Date(now), 0);
  const mt = a.moonToday;
  const riseSet = (d: Date | null) => (d ? fm.time(d) : mt.alwaysUp || mt.alwaysDown ? '—' : l('noRise'));
  return `<section class="card"><p class="eyebrow">${l('moon')}</p>
    <div class="w-big"><span class="w-icon" aria-hidden="true">${ph.icon}</span>
      <div><strong>${esc(tt(ph))}</strong><span class="muted small">${l('illum')} ${fmtNum(a.moon.fraction * 100)}%</span></div></div>
    <dl class="kv w-kv">
      <dt>${l('moonrise')}</dt><dd>${riseSet(mt.rise)}</dd>
      <dt>${l('moonset')}</dt><dd>${riseSet(mt.set)}</dd>
      <dt>${l('moonTonight')}</dt><dd>${fmtNum(a.moonNightHours, 1)} ${l('h')} ${l('ofDark')} ${fmtNum(a.nightHours, 1)} ${l('darkHours')}</dd>
      <dt>${l('nextFull')}</dt><dd>${fm.date(nf)}</dd>
      <dt>${l('nextNew')}</dt><dd>${fm.date(nn)}</dd>
    </dl></section>`;
}

function renderHourly(f: Forecast, p: Place, now: number) {
  const fm = fmt(f);
  const lang = getLang();
  const i = hourIndex(f.hours, now);
  const hours = f.hours.slice(i, i + 24);
  return `<section class="card"><p class="eyebrow">${l('hourly')}</p>
    <div class="w-hours">${hours
      .map((h) => {
        const alt = sunAltitude(new Date(h.time + 30 * 60e3), p.lat, p.lng);
        const k = lightOf(alt);
        const d = weatherDesc(h.code, lang, k !== 'day');
        return `<div class="w-hour light-${k}" title="${esc(d.text)}">
          <span class="muted small">${fm.hour(h.time)}</span>
          <span class="w-icon-s" aria-label="${esc(d.text)}">${d.icon}</span>
          <b>${deg(h.temp)}</b>
          <span class="small">${windArrow(h.windDir)} ${fmtNum(h.wind)}</span>
          <span class="muted small">↯${fmtNum(h.gust)}</span>
          <span class="small w-rain">${h.precipProb != null ? `${fmtNum(h.precipProb)}%` : ''}</span>
        </div>`;
      })
      .join('')}</div>
    <p class="muted small">${tt({ pl: 'Wiatr i porywy w km/h; strzałka pokazuje, dokąd wieje wiatr. Ciemniejsze kolumny – po zmroku.', en: 'Wind and gusts in km/h; the arrow shows where the wind blows to. Darker columns – after dark.' })}</p>
  </section>`;
}

function renderDaily(f: Forecast, p: Place, now: number) {
  const fm = fmt(f);
  const lang = getLang();
  const today = localMidnight(now, f.utcOffset);
  const days = f.days.filter((d) => d.time >= today - 36e5).slice(0, 7);
  return `<section class="card"><p class="eyebrow">${l('daily')}</p>
    <div class="w-scroll"><table class="tbl w-days"><thead><tr>
      <th></th><th></th><th class="num">°C</th><th>${l('wind')}</th><th class="num">${l('precip')}</th><th>${l('sun')}</th><th>${l('moon')}</th>
    </tr></thead><tbody>${days
      .map((d, idx) => {
        const s = sunTimes(new Date(d.time + 12 * 36e5), p.lat, p.lng);
        const m = moonIllumination(new Date(d.time + 22 * 36e5));
        const w = weatherDesc(d.code, lang);
        return `<tr>
          <td>${idx === 0 && d.time <= now ? l('today') : fm.day(d.time)}</td>
          <td title="${esc(w.text)}">${w.icon}</td>
          <td class="num"><b>${fmtNum(d.tmax)}°</b> <span class="muted">${fmtNum(d.tmin)}°</span></td>
          <td class="w-nowrap">${windArrow(d.windDir)} ${compass(d.windDir)} ${fmtNum(d.windMax)}<span class="muted w-gust">/${fmtNum(d.gustMax)}</span></td>
          <td class="num">${fmtNum(d.precip, 1)} mm${d.precipProb != null ? `<span class="muted small w-prob"> ${fmtNum(d.precipProb)}%</span>` : ''}${d.snow > 0 ? `<br><span class="small">❄ ${fmtNum(d.snow, 1)} cm</span>` : ''}</td>
          <td class="w-nowrap small">${fm.time(s.sunrise)}–${fm.time(s.sunset)}</td>
          <td class="w-nowrap">${PHASES[moonPhaseName(m.phase)].icon} <span class="small">${fmtNum(m.fraction * 100)}%</span></td>
        </tr>`;
      })
      .join('')}</tbody></table></div></section>`;
}

// ---------------------------------------------------------------- events

/** Re-render and keep the caret in the search box while typing. */
function rerenderKeepingFocus() {
  const el = document.activeElement as HTMLInputElement | null;
  const sel = el?.matches?.('[data-weather-q]') ? '[data-weather-q]' : el?.matches?.('[data-weather-name]') ? '[data-weather-name]' : null;
  const pos = el?.selectionStart ?? null;
  rerender();
  if (!sel) return;
  const again = document.querySelector<HTMLInputElement>(sel);
  if (!again) return;
  again.focus();
  if (pos != null) again.setSelectionRange(pos, pos);
}

function runSearch(q: string) {
  if (q.trim().length < 2 || parseCoords(q)) {
    results = null;
    return rerenderKeepingFocus();
  }
  results = { status: 'loading' };
  rerenderKeepingFocus();
  searchPlaces(q.trim(), getLang()).then(
    (data) => {
      if (q !== query) return;
      results = { status: 'done', data, at: Date.now() };
      rerenderKeepingFocus();
    },
    (e: Error) => {
      if (q !== query) return;
      results = { status: 'error', message: e.message };
      rerenderKeepingFocus();
    },
  );
}

function pick(lat: number, lng: number, name: string, detail?: string) {
  const existing = saved.find((p) => keyOf(p.lat, p.lng) === keyOf(lat, lng));
  if (existing) select(existing.id);
  else {
    const place: Place = { id: `p${Date.now().toString(36)}`, name, detail: detail || undefined, lat, lng };
    saved.push(place);
    persist();
    select(place.id);
  }
  adding = false;
  query = '';
  results = null;
}

export function handleWeatherClick(el: HTMLElement): boolean {
  const action = el.dataset.weather;
  if (!action) return false;
  const p = currentPlace();
  switch (action) {
    case 'select':
      select(el.dataset.id!);
      if (selected === HERE) locate();
      break;
    case 'add':
      adding = !adding;
      rerender();
      if (adding) document.querySelector<HTMLInputElement>('[data-weather-q]')?.focus();
      return true;
    case 'pick':
      pick(Number(el.dataset.lat), Number(el.dataset.lng), el.dataset.name || '', el.dataset.detail);
      break;
    case 'save':
    case 'rename':
      naming = true;
      rerender();
      document.querySelector<HTMLInputElement>('[data-weather-name]')?.select();
      return true;
    case 'cancelName':
      naming = false;
      break;
    case 'remove':
      saved = saved.filter((s) => s.id !== selected);
      persist();
      select(HERE);
      break;
    case 'refresh':
      if (p) ensureForecast(p, true);
      if (selected === HERE) locate();
      break;
  }
  rerender();
  return true;
}

export function handleWeatherInput(el: HTMLElement): boolean {
  if (!el.matches('[data-weather-q]')) return el.matches('[data-weather-name]');
  query = (el as HTMLInputElement).value;
  clearTimeout(searchTimer);
  if (parseCoords(query)) {
    results = null;
    rerenderKeepingFocus();
  } else searchTimer = setTimeout(() => runSearch(query), 350);
  return true;
}

export function handleWeatherSubmit(form: HTMLFormElement): boolean {
  const kind = form.dataset.weatherForm;
  if (!kind) return false;
  if (kind === 'search') {
    const c = parseCoords(query);
    if (c) pick(c.lat, c.lng, coordsText(c.lat, c.lng));
    else if (results?.status === 'done' && results.data[0]) {
      const r = results.data[0];
      pick(r.lat, r.lng, r.name, r.detail);
    } else {
      clearTimeout(searchTimer);
      runSearch(query);
      return true;
    }
  } else if (kind === 'name') {
    const name = form.querySelector<HTMLInputElement>('[data-weather-name]')!.value.trim();
    const p = currentPlace();
    if (name && p) {
      const existing = saved.find((s) => s.id === p.id);
      if (existing) existing.name = name;
      else {
        const place: Place = { id: `p${Date.now().toString(36)}`, name, lat: p.lat, lng: p.lng, detail: p.detail };
        saved.push(place);
        if (temp?.id === p.id) temp = null;
        select(place.id);
      }
      persist();
    }
    naming = false;
  }
  rerender();
  return true;
}
