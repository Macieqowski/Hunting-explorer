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
} from './hunt';
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
  mapSoon: {
    pl: 'Wkrótce: mapa z położeniem uczestników podczas polowania.',
    en: 'Coming next: a live map of participants during the hunt.',
  },
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

/** Role symbols, the same shapes the live map will use: star = leader, crosshair = hunter, flag triangle = beater. */
export function roleIcon(role: Role, size = 20): string {
  const svg = (body: string) =>
    `<svg class="h-icon h-icon-${role}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  switch (role) {
    case 'leader':
      return svg(
        '<circle cx="12" cy="12" r="11" fill="#166534" stroke="#fff" stroke-width="1.5"/><path fill="#fff" d="m12 5 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L5.2 10l4.7-.7z"/>',
      );
    case 'hunter':
      return svg(
        '<circle cx="12" cy="12" r="11" fill="#b91c1c" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2"/><path stroke="#fff" stroke-width="2" d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
      );
    case 'beater':
      return svg('<path d="M12 1.5 23 21.5H1z" fill="#ea580c" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path stroke="#fff" stroke-width="2" d="M7 17h10"/>');
  }
}

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

export function renderHunts(id: string | null, onChange: () => void, navigateTo: (id: string | null) => void): string {
  rerender = onChange;
  go = navigateTo;
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
        <dt>${l('leader')}</dt><dd>${roleIcon('leader', 16)} ${esc(h.leaderName)}</dd>
      </dl>
      ${h.notes ? `<p class="h-notes">${esc(h.notes).replace(/\n/g, '<br>')}</p>` : ''}
    </article>`;
  if (editing && isLeader) return `${back}${renderHuntForm('edit')}`;
  if (!membersLoaded) return `${back}${info}<p class="muted">${l('loading')}</p>`;
  if (!me) return `${back}${info}${renderJoin(h)}`;
  return `${back}${info}${renderMe(me, isLeader)}${isLeader ? renderInvite(h) : ''}${renderMembers(uid, isLeader)}${isLeader ? renderManage(h) : ''}
    <p class="muted small">${l('mapSoon')}</p>`;
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
      if (id) run((be) => be.updateHunt(id, { status: el.dataset.to as HuntStatus }));
      return true;
    case 'share':
      if (id && hunt)
        navigator.share?.({ title: hunt.name, text: `${hunt.name} – ${fmtDate(hunt.date)} ${hunt.start}`, url: inviteUrl(id) }).catch(() => {});
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
  return true;
}

export function handleHuntSubmit(form: HTMLFormElement): boolean {
  const kind = form.dataset.huntForm;
  if (!kind) return false;
  const v = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  formError = '';
  badFields = new Set();
  if (kind === 'create' || kind === 'edit') {
    const input: HuntInput = { name: v('name'), date: v('date'), start: v('start'), end: v('end'), place: v('place'), notes: v('notes') };
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
