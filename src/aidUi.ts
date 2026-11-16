// The "Wypadek" section: the emergency screen (112, where you are, what to say), first-aid cards
// step by step, and practice questions. Content in aid.ts; pictures in aidArt.ts.
//
// #/wypadek            the emergency screen
// #/wypadek/<card>     one card, one step per screen
// #/wypadek/start      "Nie wiesz, od czego zacząć?"
// #/wypadek/sprawdzian practice questions
// #/wypadek/o-instrukcjach  sources, review, disclaimer
//
// Everything works offline: the texts are in the app, GPS needs no internet, a call and an SMS go
// over the mobile network. Only the forest address (nadleśnictwo, oddział) needs the internet,
// or the district saved offline. Visiting the section leaves a group hunt running (location
// sharing, alarms), like the role guides.

import { CARDS, FIRST, TRIAGE, KIT, QUIZ, SOURCES, REVIEW, cardBySlug, nextStep, type AidCard, type AidStep } from './aid';
import { aidArt } from './aidArt';
import { watchLocation, GeoError, type GeoFix } from './geo';
import { fetchDistrictsAtPoint, fetchForestAt } from './bdl';
import { fmtCoords } from './pokot';
import { mapsLink, smsLink } from './huntCrew';
import { distanceM } from './hunt';
import { canShare, shareLink, copyText, isApp } from './platform';
import { speak, hush, canSpeak } from './voice';
import { tick } from './native';
import { ic } from './icons';
import { getLang } from './i18n';
import { aidHuntBox, aidHuntWake, handleAidHuntClick } from './huntUi';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------------------------------------------------------------- stored on this device

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* no storage: it lasts until the page is closed */
    }
  },
};
/** When a tourniquet went on (ms), kept across reloads until cleared. */
let tqAt: number | null = store.get<number | null>('aidTq', null);
/** "Zapisz godzinę" per card (stroke, adrenaline, sugar). */
let notedAt: Record<string, number> = store.get<Record<string, number>>('aidTimes', {});
let voiceOn: boolean = store.get<boolean>('aidVoice', false);

// ---------------------------------------------------------------- state

let onChange: () => void = () => {};
let goHash: (hash: string) => void = (h) => (location.hash = h);
let page: string | null = null;
/** The steps on screen, the current one, and the way back. */
let flow: { key: string; steps: AidStep[]; i: number; hist: number[] } | null = null;
let showAll = false;
let quizAnswers: (number | null)[] = QUIZ.map(() => null);

// ---- where am I
let fix: GeoFix | null = null;
let geoProblem: 'denied' | 'off' | 'unavailable' | null = null;
let stopGeo: (() => void) | null = null;
interface Place {
  lat: number;
  lng: number;
  district: string | null;
  holder: string | null;
  inspectorate: string | null;
  range: string | null;
  compartment: string | null;
  county: string | null;
  voivodeship: string | null;
  offline: boolean;
}
let place: Place | null = null;
let placeBusy = false;
let placeTried: { lat: number; lng: number; at: number } | null = null;

// ---- screen on, metronome, clock
let wake: { release(): Promise<void> } | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let metro: { timer: ReturnType<typeof setInterval>; n: number; ctx: AudioContext | null } | null = null;

const now = () => Date.now();
const clock = (ms: number) => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const minsAgo = (ms: number) => {
  const m = Math.max(0, Math.floor((now() - ms) / 60e3));
  return m < 1 ? 'przed chwilą' : m < 60 ? `${m} min temu` : `${Math.floor(m / 60)} h ${m % 60} min temu`;
};
const fmtAcc = (a: number | null) => (a == null ? '' : a < 1000 ? `±${Math.round(a)} m` : `±${(a / 1000).toFixed(1)} km`);
/** "52,23417° N, 21,01102° E": easy to read out over the phone. */
export function readCoords(lat: number, lng: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(5).replace('.', ',')}° ${v < 0 ? neg : pos}`;
  return `${f(lat, 'N', 'S')}, ${f(lng, 'E', 'W')}`;
}

// ---------------------------------------------------------------- lifecycle

/** Called by main.ts when the section opens (and on every visit). */
function enter() {
  if (!stopGeo) {
    geoProblem = null;
    stopGeo = watchLocation(
      (f) => {
        const first = !fix;
        // Keep the better of two positions measured within a few seconds of each other.
        if (!fix || f.time >= fix.time || (f.acc ?? 1e9) < (fix.acc ?? 1e9)) fix = f;
        geoProblem = null;
        lookUpPlace();
        if (first) onChange();
        else paintWhere();
      },
      {
        maxAgeMs: 10 * 60e3,
        onError: (e) => {
          stopGeo = null;
          geoProblem = e instanceof GeoError && e.code !== 'cancelled' ? e.code : 'unavailable';
          paintWhere();
        },
      },
    );
  }
  void keepScreenOn();
  ticker ??= setInterval(paintClocks, 20_000);
}

/** Called when another section opens: GPS, metronome, speech and the screen lock go back to normal. */
export function leaveAid(): void {
  if (page === null && !stopGeo && !ticker && !metro && !wake) return;
  stopGeo?.();
  stopGeo = null;
  stopMetro();
  hush();
  if (ticker) clearInterval(ticker);
  ticker = null;
  void wake?.release().catch(() => {});
  wake = null;
}

async function keepScreenOn() {
  const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
  if (!wl || wake || document.visibilityState !== 'visible') return;
  try {
    wake = await wl.request('screen');
  } catch {
    wake = null;
  }
}
document.addEventListener('visibilitychange', () => {
  // The screen lock is dropped when the page is hidden; take it again on the way back.
  if (document.visibilityState === 'visible' && stopGeo) {
    wake = null;
    void keepScreenOn();
  }
});

function lookUpPlace() {
  if (!fix || placeBusy) return;
  const p = { lat: fix.lat, lng: fix.lng };
  // Again only after moving 150 m, or after 3 minutes when the last try failed.
  if (place && distanceM(place, p) < 150) return;
  if (placeTried && distanceM(placeTried, p) < 150 && now() - placeTried.at < 3 * 60e3) return;
  placeTried = { ...p, at: now() };
  placeBusy = true;
  const district = fetchDistrictsAtPoint(p.lat, p.lng).then(
    (r) => r[0]?.attributes ?? null,
    () => undefined,
  );
  const forest = fetchForestAt(p.lat, p.lng).catch(() => null);
  void Promise.all([district, forest]).then(([d, f]) => {
    placeBusy = false;
    if (d === undefined && !f) return paintWhere();
    place = {
      ...p,
      district: d?.hunt_dist_nr ?? null,
      holder: d?.lease_holder_name ?? null,
      inspectorate: f?.inspectorate ?? d?.inspectorate_name ?? null,
      range: f?.range ?? null,
      compartment: f?.compartment ?? null,
      county: d?.district_name ?? null,
      voivodeship: d?.county_name ?? null,
      offline: !f,
    };
    paintWhere();
  });
}

// ---------------------------------------------------------------- rendering

/** What main.ts gives the section. */
export interface AidContext {
  /** Redraw the whole page (after a step, an answer…). */
  change(): void;
  /** Main render: a live update from the hunt, which only repaints the parts that change (refreshAid). */
  live(): void;
  /** Go to an address (#/wypadek/…). */
  go(hash: string): void;
  /** Open a hunt page (alarm on the map). */
  goHunt(id: string | null): void;
}

/** The page for `#/wypadek[/<p>]`. */
export function renderAid(p: string | null, ctx: AidContext): string {
  onChange = ctx.change;
  goHash = ctx.go;
  if (p !== page) {
    stopMetro();
    hush();
    showAll = false;
    flow = null;
  }
  page = p;
  enter();
  aidHuntWake(ctx.live, ctx.goHunt);
  const en = getLang() === 'en' ? `<p class="notice small aid-en">First-aid instructions are in Polish only. Emergency number in Poland and the EU: <b>112</b>.</p>` : '';
  let body: string;
  if (p === null) body = renderHome();
  else if (p === 'start') body = renderFlow('start', 'Od czego zacząć?', TRIAGE, null);
  else if (p === 'sprawdzian') body = renderQuiz();
  else if (p === 'o-instrukcjach') body = renderAbout();
  else {
    const c = cardBySlug(p);
    body = c ? renderFlow(c.slug, c.title, c.steps, c) : `<p class="muted">Nie ma takiej instrukcji.</p>${backLink()}`;
  }
  return `<div class="aid">${en}${body}</div>`;
}

/** Live parts redrawn in place (position, hunt alarm, clocks), without touching the rest. */
export function refreshAid(): void {
  paintWhere();
  const box = document.getElementById('aid-hunt');
  // Not while the alarm note is being typed: the field would lose the keyboard.
  const typing = document.activeElement instanceof HTMLInputElement && box?.contains(document.activeElement);
  if (box && !typing) box.innerHTML = aidHuntBox(fix);
  paintClocks();
}

const backLink = () => `<a class="btn ghost back" href="#/wypadek" data-aid="go" data-page="">${ic('back', 18)} Wypadek</a>`;
const call112 = (cls = '') => `<a class="aid-112${cls}" href="tel:112">${ic('phone', cls ? 18 : 30)}<span>Zadzwoń <b>112</b></span></a>`;

function reviewNote(): string {
  return REVIEW.by
    ? ''
    : `<p class="aid-draft small">Wersja robocza: treść czeka na sprawdzenie przez lekarza lub ratownika medycznego.</p>`;
}

function renderHome(): string {
  const tiles = CARDS.filter((c) => c.tile)
    .map((c) => `<a class="aid-tile" href="#/wypadek/${c.slug}" data-aid="go" data-page="${c.slug}">${aidArt(c.art)}<span>${esc(c.tile)}</span></a>`)
    .join('');
  const others = CARDS.filter((c) => !c.tile)
    .map((c) => `<li><a href="#/wypadek/${c.slug}" data-aid="go" data-page="${c.slug}"><span>${esc(c.title)}</span>${ic('chevron', 18)}</a></li>`)
    .join('');
  return `<header class="aid-head"><h2>${ic('aid', 26)} Wypadek</h2>
      <p class="muted small">Pierwsza pomoc do przyjazdu ratowników. Nie zastępuje kursu ani lekarza.</p></header>
    ${call112()}
    <section class="aid-where" id="aid-where">${whereHtml()}</section>
    <div id="aid-hunt">${aidHuntBox(fix)}</div>
    <div id="aid-tq">${tqBanner()}</div>
    <details class="aid-say"><summary>Co powiedzieć dyspozytorowi</summary>${sayHtml()}</details>
    <h3 class="aid-h">Co się stało?</h3>
    <div class="aid-tiles">${tiles}</div>
    <a class="aid-startlink" href="#/wypadek/start" data-aid="go" data-page="start">${ic('info', 20)}<span><strong>Nie wiesz, od czego zacząć?</strong><small>Krwotok, przytomność, oddech: po kolei</small></span>${ic('chevron', 18)}</a>
    <h3 class="aid-h">Inne sytuacje</h3>
    <ul class="aid-list">${others}</ul>
    <details class="aid-kit"><summary>${esc(KIT.h)}</summary><ul>${KIT.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <p class="small muted">Według Wytycznych ERC 2025 (apteczki pierwszej pomocy).</p></details>
    <ul class="aid-list aid-more">
      <li><a href="#/wypadek/sprawdzian" data-aid="go" data-page="sprawdzian">${ic('check', 20)}<span>Sprawdź się: ${QUIZ.length} pytań</span>${ic('chevron', 18)}</a></li>
      <li><a href="#/wypadek/o-instrukcjach" data-aid="go" data-page="o-instrukcjach">${ic('book', 20)}<span>Źródła i zastrzeżenia</span>${ic('chevron', 18)}</a></li>
    </ul>
    ${reviewNote()}
    <p class="aid-disc small muted">Instrukcje pomagają udzielić pierwszej pomocy do przyjazdu ratowników. Nie zastępują kursu ani porady lekarza. Zawsze najpierw dzwoń 112 i wykonuj polecenia dyspozytora.</p>`;
}

function whereHtml(): string {
  if (!fix) {
    const why =
      geoProblem === 'denied'
        ? 'Aplikacja nie ma dostępu do położenia. Włącz go w ustawieniach telefonu, a dyspozytorowi opisz drogę słowami.'
        : geoProblem === 'off'
          ? 'Lokalizacja w telefonie jest wyłączona. Włącz ją, a dyspozytorowi opisz drogę słowami.'
          : geoProblem
            ? 'Nie udało się ustalić położenia. Opisz dyspozytorowi drogę słowami.'
            : 'Szukam położenia (GPS). Na otwartym terenie idzie szybciej.';
    return `<p class="aid-where-h">Gdzie jesteś</p><p class="${geoProblem ? 'aid-geo-bad' : 'muted'}">${esc(why)}</p>`;
  }
  const c = fmtCoords(fix.lat, fix.lng);
  const old = now() - fix.time > 2 * 60e3;
  const acc = fmtAcc(fix.acc);
  const lines: string[] = [];
  if (place && distanceM(place, fix) < 500) {
    if (place.district) lines.push(`Obwód łowiecki nr ${esc(place.district)}${place.holder ? ` (${esc(place.holder)})` : ''}`);
    const forest = [place.inspectorate && `Nadleśnictwo ${place.inspectorate}`, place.range && `leśnictwo ${place.range}`, place.compartment && `oddział ${place.compartment}`]
      .filter(Boolean)
      .join(', ');
    if (forest) lines.push(esc(forest));
    const admin = [place.county && `powiat ${place.county}`, place.voivodeship && `woj. ${place.voivodeship}`].filter(Boolean).join(', ');
    if (admin) lines.push(esc(admin));
  }
  const addr = lines.length
    ? `<ul class="aid-addr">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`
    : placeBusy
      ? '<p class="muted small">Sprawdzam obwód i oddział leśny…</p>'
      : '';
  return `<p class="aid-where-h">Gdzie jesteś <span class="muted small">${esc(acc)} · ${old ? `pomiar z ${clock(fix.time)}` : 'teraz'}</span></p>
    <p class="aid-coords" aria-label="Współrzędne">${esc(readCoords(fix.lat, fix.lng))}</p>
    <p class="muted small aid-dms">${esc(c.dms)}</p>
    ${addr}
    <div class="aid-share">
      <a class="btn small" href="${esc(smsLink('', shareText()))}">${ic('message', 16)} SMS z pozycją</a>
      ${canShare() ? `<button type="button" class="btn small ghost" data-aid="share">${ic('upload', 16)} Udostępnij</button>` : ''}
      <button type="button" class="btn small ghost" data-aid="copy">${ic('edit', 16)} Kopiuj</button>
    </div>
    ${old ? '<p class="small aid-geo-bad">To ostatni znany pomiar. Telefon szuka nowego.</p>' : ''}`;
}

/** The text for SMS and sharing: coordinates (with dots, for maps), accuracy, forest address. */
export function shareText(): string {
  if (!fix) return 'WYPADEK. Potrzebna pomoc. Dzwoń 112.';
  const parts = [`WYPADEK. Moja pozycja: ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${fix.acc != null ? ` (${fmtAcc(fix.acc)})` : ''}`, mapsLink(fix)];
  if (place && distanceM(place, fix) < 500) {
    const extra = [
      place.district && `obwód ${place.district}`,
      place.inspectorate && `Nadl. ${place.inspectorate}`,
      place.range && `leśn. ${place.range}`,
      place.compartment && `oddz. ${place.compartment}`,
    ]
      .filter(Boolean)
      .join(', ');
    if (extra) parts.push(extra);
  }
  return parts.join('\n');
}

function sayHtml(): string {
  const where = fix ? `Współrzędne: <b>${esc(readCoords(fix.lat, fix.lng))}</b>${place?.compartment ? `, oddział leśny ${esc(place.compartment)}` : ''}` : 'Gdzie jesteście: najbliższa miejscowość, droga, charakterystyczne miejsce';
  return `<ol class="aid-say-list">
    <li><b>Co się stało</b>, np. „postrzał w udo, silny krwotok”.</li>
    <li><b>Ile osób</b> jest rannych, czy są <b>przytomne</b> i czy <b>oddychają</b>.</li>
    <li>${where}.</li>
    <li><b>Kto czeka przy drodze</b>, żeby poprowadzić karetkę, i gdzie.</li>
    <li>Swój numer telefonu. <b>Nie rozłączaj się pierwszy</b>, dyspozytor może prowadzić Cię przez pomoc.</li>
  </ol>`;
}

function tqBanner(): string {
  if (!tqAt) return '';
  return `<div class="aid-tqbar" role="status">${ic('clock', 20)}<span>Opaska uciskowa założona o <b>${clock(tqAt)}</b> · <span data-ago="${tqAt}">${minsAgo(tqAt)}</span></span>
    <button type="button" class="btn small ghost" data-aid="tqClear">Wyczyść</button></div>`;
}

// ---- a card, one step per screen

function renderFlow(key: string, title: string, steps: AidStep[], card: AidCard | null): string {
  if (!flow || flow.key !== key) flow = { key, steps, i: 0, hist: [] };
  const f = flow;
  const done = f.i >= steps.length;
  const top = `<div class="aid-bar">${backLink()}${call112(' small')}
    ${canSpeak() ? `<button type="button" class="btn small ghost" data-aid="voice" aria-pressed="${voiceOn}">${ic(voiceOn ? 'play' : 'mic', 16)} ${voiceOn ? 'Czytam na głos' : 'Czytaj na głos'}</button>` : ''}</div>`;
  const head = `<h2 class="aid-title">${card ? aidArt(card.art) : ''}<span>${esc(title)}</span></h2>`;
  // Before the first step: the hunt stops, guns are unloaded, someone calls 112.
  const first =
    card && f.i === 0 && !showAll
      ? `<div class="aid-first"><p class="aid-first-h">Najpierw</p><ol>${FIRST.map((s) => `<li><b>${esc(s.t)}</b></li>`).join('')}</ol>
          <details><summary class="small">Jak?</summary><ul class="small">${FIRST.map((s) => `<li>${esc(s.d ?? '')}</li>`).join('')}</ul></details></div>`
      : '';
  const when = card ? `<details class="aid-when"${showAll ? ' open' : ''}><summary>Jak rozpoznać</summary><ul>${card.when.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : '';
  const toggle = `<button type="button" class="btn small ghost aid-all" data-aid="all" aria-pressed="${showAll}">${showAll ? 'Krok po kroku' : 'Pokaż wszystkie kroki'}</button>`;
  if (showAll) return `${top}${head}${reviewNote()}${when}${toggle}${allSteps(steps)}${card ? endHtml(card) : ''}`;
  if (done) return `${top}${head}${card ? `<section class="aid-step aid-done"><h3>Zostań przy rannym do przyjazdu ratowników</h3>
      <p>Obserwuj, czy reaguje i oddycha. Gdy przestanie oddychać prawidłowo, zacznij <a href="#/wypadek/rko" data-aid="go" data-page="rko">RKO</a>. Chroń go przed zimnem.</p>
      <div class="aid-nav"><button type="button" class="btn ghost" data-aid="back">${ic('back', 18)} Wstecz</button><button type="button" class="btn ghost" data-aid="restart">Od początku</button></div></section>${endHtml(card)}` : ''}${toggle}`;
  return `${top}${head}${reviewNote()}${first}${when}<section class="aid-step" aria-live="polite">${stepHtml(steps, f.i)}</section>${toggle}`;
}

function stepHtml(steps: AidStep[], i: number): string {
  const s = steps[i];
  const nav = s.ask
    ? `<div class="aid-nav aid-yn">
        <button type="button" class="btn aid-yes" data-aid="ans" data-v="1">Tak</button>
        <button type="button" class="btn aid-no" data-aid="ans" data-v="0">Nie</button></div>
        ${flow && flow.hist.length ? `<button type="button" class="btn small ghost" data-aid="back">${ic('back', 16)} Wstecz</button>` : ''}`
    : `<div class="aid-nav">${flow && flow.hist.length ? `<button type="button" class="btn ghost" data-aid="back">${ic('back', 18)} Wstecz</button>` : '<span></span>'}
        <button type="button" class="btn aid-next" data-aid="next">Dalej ${ic('chevron', 18)}</button></div>`;
  return `<p class="aid-n">Krok ${i + 1} z ${steps.length}</p>
    ${aidArt(s.art)}
    <h3>${esc(s.ask ? s.ask.q : s.t)}</h3>
    ${s.d ? `<p class="aid-d">${esc(s.d)}</p>` : ''}
    ${toolHtml(s)}
    ${nav}`;
}

function toolHtml(s: AidStep): string {
  if (s.tool === 'tq')
    return `<div class="aid-tool" id="aid-tool">${
      tqAt
        ? `<p>${ic('clock', 18)} Założona o <b>${clock(tqAt)}</b> · <span data-ago="${tqAt}">${minsAgo(tqAt)}</span></p>
           <button type="button" class="btn small ghost" data-aid="tqNow">Zmień na teraz</button> <button type="button" class="btn small ghost" data-aid="tqClear">Wyczyść</button>`
        : `<button type="button" class="btn aid-time" data-aid="tqNow">${ic('clock', 18)} Zapisz godzinę założenia opaski</button>`
    }</div>`;
  if (s.tool === 'time') {
    const key = flow?.key ?? '';
    const at = notedAt[key];
    return `<div class="aid-tool" id="aid-tool">${
      at
        ? `<p>${ic('clock', 18)} Zapisano: <b>${clock(at)}</b> · <span data-ago="${at}">${minsAgo(at)}</span></p><button type="button" class="btn small ghost" data-aid="timeClear">Wyczyść</button>`
        : `<button type="button" class="btn aid-time" data-aid="timeNow">${ic('clock', 18)} Zapisz godzinę</button>`
    }</div>`;
  }
  if (s.tool === 'cpr')
    return `<div class="aid-tool aid-metro" id="aid-tool">${
      metro
        ? `<p class="aid-beat" aria-live="off"><b id="aid-count">${metro.n || '–'}</b> / 30</p><p class="small muted" id="aid-breath">${metro.n >= 30 ? '2 oddechy (albo uciskaj dalej)' : '110 uciśnięć na minutę'}</p>
           <button type="button" class="btn ghost" data-aid="metro">${ic('x', 18)} Zatrzymaj metronom</button>`
        : `<button type="button" class="btn aid-time" data-aid="metro">${ic('play', 18)} Metronom: tempo uciśnięć</button>`
    }</div>`;
  return '';
}

/** All steps on one page, with where each answer leads (for reading ahead or learning). */
function allSteps(steps: AidStep[]): string {
  const target = (go: string) => {
    if (go.startsWith('card:')) {
      const c = cardBySlug(go.slice(5));
      return c ? `<a href="#/wypadek/${c.slug}" data-aid="go" data-page="${c.slug}">${esc(c.title)}</a>` : '';
    }
    const j = steps.findIndex((s) => s.id === go);
    return j >= 0 ? `krok ${j + 1}` : '';
  };
  return `<ol class="aid-steps">${steps
    .map(
      (s) => `<li>${aidArt(s.art)}<div><strong>${esc(s.ask ? s.ask.q : s.t)}</strong>${s.d ? `<p>${esc(s.d)}</p>` : ''}${
        s.ask ? `<p class="small"><b>Tak</b> → ${target(s.ask.yes)} · <b>Nie</b> → ${target(s.ask.no)}</p>` : ''
      }${s.last ? '<p class="small muted">Koniec tej ścieżki.</p>' : ''}</div></li>`,
    )
    .join('')}</ol>`;
}

function endHtml(c: AidCard): string {
  const extra = (c.extra ?? []).map((x) => `<section class="aid-extra"><h4>${esc(x.h)}</h4><ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
  return `${extra}
    <section class="aid-dont"><h4>${ic('x', 18)} Czego nie robić</h4><ul>${c.dont.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>
    <p class="aid-src small muted">Źródło: ${c.src.map((s) => `<a href="${SOURCES[s].url}" target="_blank" rel="noopener">${esc(SOURCES[s].label)}</a>`).join('; ')}.</p>`;
}

// ---- practice questions

function renderQuiz(): string {
  const answered = quizAnswers.filter((a) => a != null).length;
  const right = quizAnswers.filter((a, i) => a === QUIZ[i].a).length;
  const items = QUIZ.map((q, i) => {
    const a = quizAnswers[i];
    const opts = q.opts
      .map((o, j) => {
        const cls = a == null ? '' : j === q.a ? ' right' : j === a ? ' wrong' : '';
        return `<button type="button" class="aid-opt${cls}" data-aid="quiz" data-q="${i}" data-o="${j}"${a != null ? ' disabled' : ''}>${esc(o)}</button>`;
      })
      .join('');
    const c = cardBySlug(q.card);
    const why =
      a == null
        ? ''
        : `<p class="aid-why ${a === q.a ? 'ok' : 'bad'}">${a === q.a ? 'Dobrze.' : 'Nie.'} ${esc(q.why)}${c ? ` <a href="#/wypadek/${c.slug}" data-aid="go" data-page="${c.slug}">Karta: ${esc(c.title)}</a>` : ''}</p>`;
    return `<li class="aid-qz"><p><b>${i + 1}.</b> ${esc(q.q)}</p><div class="aid-opts">${opts}</div>${why}</li>`;
  }).join('');
  const score =
    answered === QUIZ.length
      ? `<div class="notice aid-score"><b>Wynik: ${right} z ${QUIZ.length}.</b> ${right === QUIZ.length ? 'Świetnie.' : 'Przejrzyj karty, przy których się pomyliłeś.'} <button type="button" class="btn small ghost" data-aid="quizReset">Jeszcze raz</button></div>`
      : '';
  return `${backLink()}<h2>Sprawdź się</h2><p class="muted">${QUIZ.length} pytań o pierwszej pomocy na polowaniu. Odpowiedzi według Wytycznych ERC 2025.</p>
    ${score}<ol class="aid-quiz">${items}</ol>${score}`;
}

// ---- sources and disclaimer

function renderAbout(): string {
  return `${backLink()}<article class="prose aid-about"><h2>Źródła i zastrzeżenia</h2>
    <p><b>Instrukcje pomagają udzielić pierwszej pomocy do czasu przyjazdu ratowników. Nie zastępują kursu pierwszej pomocy ani porady lekarza. Zawsze najpierw dzwoń 112 i wykonuj polecenia dyspozytora.</b></p>
    <p>Treść napisaliśmy własnymi słowami na podstawie wytycznych Europejskiej Rady Resuscytacji (ERC) z 2025 roku, obowiązujących na kursach od stycznia 2026, z polskim nazewnictwem z tłumaczenia Polskiej Rady Resuscytacji. Tematy, których ERC 2025 już nie obejmuje (złamania, odmrożenia, pogryzienia), opisujemy według źródeł podanych przy karcie.</p>
    <h3>Przegląd medyczny</h3>
    <p>${
      REVIEW.by
        ? `Treść sprawdził(a): ${esc(REVIEW.by)}${REVIEW.date ? `, ${esc(REVIEW.date)}` : ''}.`
        : 'Ta wersja czeka na sprawdzenie przez lekarza lub ratownika medycznego.'
    } Treść przeglądamy co roku i po każdej nowej wersji wytycznych ERC.</p>
    <h3>Źródła</h3>
    <ul>${Object.values(SOURCES)
      .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`)
      .join('')}</ul>
    <h3>Twoje położenie</h3>
    <p>Współrzędne liczy telefon (GPS), bez internetu. Nikomu ich nie wysyłamy, chyba że sam wyślesz SMS, udostępnisz je albo wyślesz alarm na polowaniu zbiorowym. Nadleśnictwo, leśnictwo i oddział pochodzą z Banku Danych o Lasach i wymagają internetu (obwód łowiecki także z obwodu zapisanego offline).</p>
    <p>Automatyczne przekazywanie położenia przy połączeniu z 112 (AML) ma w Polsce ruszyć dopiero w 2027 roku, dlatego warto przeczytać dyspozytorowi współrzędne.</p>
  </article>`;
}

// ---------------------------------------------------------------- live updates in place

function paintWhere() {
  const el = document.getElementById('aid-where');
  if (el) el.innerHTML = whereHtml();
  const say = document.querySelector('.aid-say');
  if (say) {
    const open = (say as HTMLDetailsElement).open;
    say.innerHTML = `<summary>Co powiedzieć dyspozytorowi</summary>${sayHtml()}`;
    (say as HTMLDetailsElement).open = open;
  }
}

function paintClocks() {
  document.querySelectorAll<HTMLElement>('[data-ago]').forEach((el) => (el.textContent = minsAgo(+el.dataset.ago!)));
  const bar = document.getElementById('aid-tq');
  if (bar && !tqAt && bar.innerHTML) bar.innerHTML = '';
}

function repaintTool() {
  const el = document.getElementById('aid-tool');
  if (el && flow && flow.i < flow.steps.length) el.outerHTML = toolHtml(flow.steps[flow.i]);
}

// ---------------------------------------------------------------- metronome

const BEAT_MS = Math.round(60000 / 110);

function startMetro() {
  let ctx: AudioContext | null = null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch {
    ctx = null;
  }
  const beat = () => {
    if (!metro) return;
    metro.n = metro.n >= 30 ? 1 : metro.n + 1;
    const c = metro.ctx;
    if (c) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = metro.n === 1 ? 1200 : 880;
      g.gain.setValueAtTime(0.25, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.08);
    }
    if (isApp()) tick();
    const n = document.getElementById('aid-count');
    if (n) n.textContent = String(metro.n);
    const b = document.getElementById('aid-breath');
    if (b) b.textContent = metro.n >= 30 ? '2 oddechy (albo uciskaj dalej)' : '110 uciśnięć na minutę';
  };
  metro = { timer: setInterval(beat, BEAT_MS), n: 0, ctx };
}

function stopMetro() {
  if (!metro) return;
  clearInterval(metro.timer);
  void metro.ctx?.close().catch(() => {});
  metro = null;
}

// ---------------------------------------------------------------- events

function sayStep() {
  if (!voiceOn || !flow) return;
  const s = flow.steps[flow.i];
  if (!s) return hush();
  speak((s.ask ? [s.ask.q, s.d] : [s.t, s.d]).filter(Boolean).join('. '));
}

function go(next: ReturnType<typeof nextStep>, from: number) {
  if (!flow) return;
  stopMetro();
  if ('card' in next) {
    goHash(`#/wypadek/${next.card}`);
    return;
  }
  flow.hist.push(from);
  flow.i = 'step' in next ? next.step : flow.steps.length;
  onChange();
  sayStep();
  document.querySelector('.aid-step')?.scrollIntoView({ block: 'start' });
}

/** Clicks on [data-aid]. True when handled. */
export function handleAidClick(el: HTMLElement): boolean {
  const a = el.dataset.aid;
  if (!a) return false;
  switch (a) {
    case 'go': {
      const p = el.dataset.page || '';
      goHash(p ? `#/wypadek/${p}` : '#/wypadek');
      window.scrollTo(0, 0);
      return true;
    }
    case 'next':
      if (flow) go(nextStep(flow.steps, flow.i), flow.i);
      return true;
    case 'ans':
      if (flow) go(nextStep(flow.steps, flow.i, el.dataset.v === '1'), flow.i);
      return true;
    case 'back':
      if (flow && flow.hist.length) {
        stopMetro();
        flow.i = flow.hist.pop()!;
        onChange();
        sayStep();
      }
      return true;
    case 'restart':
      if (flow) {
        flow.i = 0;
        flow.hist = [];
        onChange();
      }
      return true;
    case 'all':
      showAll = !showAll;
      stopMetro();
      hush();
      onChange();
      return true;
    case 'voice':
      voiceOn = !voiceOn;
      store.set('aidVoice', voiceOn);
      if (voiceOn) sayStep();
      else hush();
      onChange();
      return true;
    case 'tqNow':
      tqAt = now();
      store.set('aidTq', tqAt);
      repaintTool();
      return true;
    case 'tqClear':
      tqAt = null;
      store.set('aidTq', null);
      repaintTool();
      paintClocks();
      return true;
    case 'timeNow':
      if (flow) {
        notedAt = { ...notedAt, [flow.key]: now() };
        store.set('aidTimes', notedAt);
        repaintTool();
      }
      return true;
    case 'timeClear':
      if (flow) {
        const { [flow.key]: _, ...rest } = notedAt;
        notedAt = rest;
        store.set('aidTimes', notedAt);
        repaintTool();
      }
      return true;
    case 'metro':
      if (metro) stopMetro();
      else startMetro();
      repaintTool();
      return true;
    case 'copy':
      void copyText(shareText()).then(
        () => flash(el, 'Skopiowano'),
        () => flash(el, 'Nie udało się skopiować'),
      );
      return true;
    case 'share':
      void shareLink({ title: 'Wypadek', text: shareText(), url: fix ? mapsLink(fix) : '' }).catch(() => {});
      return true;
    case 'quiz': {
      const q = +el.dataset.q!;
      if (quizAnswers[q] == null) {
        quizAnswers = quizAnswers.map((v, i) => (i === q ? +el.dataset.o! : v));
        onChange();
      }
      return true;
    }
    case 'quizReset':
      quizAnswers = QUIZ.map(() => null);
      onChange();
      window.scrollTo(0, 0);
      return true;
  }
  return handleAidHuntClick(el, fix);
}

function flash(el: HTMLElement, text: string) {
  const old = el.innerHTML;
  el.textContent = text;
  setTimeout(() => (el.innerHTML = old), 1500);
}

/** For tests: the stored tourniquet time. */
export const _tq = () => tqAt;
