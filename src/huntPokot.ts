// The pokot panel on the hunt page (game by drive, shots per hunter, the leader's
// corrections and lock) and its printable version, which the browser saves as PDF.
// Rendering only; state and events live in huntUi.ts.

import { getLang, tt } from './i18n';
import { isLeader as leads, type Drive, type Hunt, type Participant } from './hunt';
import { GAMES, GAME_GROUPS, NO_SHOOTER, NOTE_MAX, OUTCOMES, fmtCoords, isBoar, bagBySpecies, gameByKey, hunterTotals, huntKing, huntMisser, outOfSeason, shotsByDrive, voivodeshipOf, type GameGroup, type Outcome, type Shot } from './pokot';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const PL = {
  pokot: { pl: 'Pokot', en: 'Results (pokot)' },
  pokotIntro: {
    pl: 'Strzały i strzelona zwierzyna z całego polowania. Każdy myśliwy uzupełnia swoje strzały, prowadzący poprawia i zatwierdza pokot.',
    en: 'Shots and game from the whole hunt. Each hunter fills in their own shots; the leader corrects and confirms the results.',
  },
  draft: { pl: 'Roboczy', en: 'Draft' },
  locked: { pl: 'Zatwierdzony', en: 'Confirmed' },
  bag: { pl: 'Pokot', en: 'Bag' },
  bagEmpty: { pl: 'Na razie nie ma strzelonej zwierzyny.', en: 'No game taken yet.' },
  noShots: { pl: 'Nikt jeszcze nie zapisał strzału.', en: 'Nobody has logged a shot yet.' },
  outsideDrive: { pl: 'Poza miotem', en: 'Outside a drive' },
  hunters: { pl: 'Myśliwi', en: 'Hunters' },
  hunter: { pl: 'Myśliwy', en: 'Hunter' },
  cShots: { pl: 'Strzały', en: 'Shots' },
  cKill: { pl: 'Leży', en: 'Down' },
  cWound: { pl: 'Postrz.', en: 'Wounded' },
  cMiss: { pl: 'Pudła', en: 'Misses' },
  cUnknown: { pl: 'Bez opisu', en: 'Not filled in' },
  o_kill: { pl: 'Zwierzyna leży', en: 'Game down' },
  o_wound: { pl: 'Postrzał', en: 'Wounded' },
  o_miss: { pl: 'Pudło', en: 'Miss' },
  o_unknown: { pl: 'Bez opisu', en: 'Not filled in' },
  g_deer: { pl: 'Jeleniowate', en: 'Deer' },
  g_other: { pl: 'Dziki i muflony', en: 'Boar and mouflon' },
  g_pred: { pl: 'Drapieżniki', en: 'Predators' },
  g_small: { pl: 'Zwierzyna drobna', en: 'Small game' },
  g_birds: { pl: 'Ptactwo', en: 'Game birds' },
  noGame: { pl: '— nie wiem —', en: '— not sure —' },
  noShooter: { pl: 'nieznany (znaleziona)', en: 'unknown (found)' },
  king: { pl: 'Król polowania', en: 'Hunt king' },
  misser: { pl: 'Pudłarz', en: 'Most misses' },
  titlesToggle: { pl: 'Pokaż króla polowania i pudłarza', en: 'Show the hunt king and most misses' },
  edit: { pl: 'Popraw', en: 'Edit' },
  save: { pl: 'Zapisz', en: 'Save' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  del: { pl: 'Usuń', en: 'Delete' },
  delSure: { pl: 'Tak, usuń', en: 'Yes, delete' },
  fOutcome: { pl: 'Efekt', en: 'Result' },
  fGame: { pl: 'Zwierzyna', en: 'Game' },
  fDrive: { pl: 'Miot', en: 'Drive' },
  fShooter: { pl: 'Strzelał', en: 'Shooter' },
  fNote: { pl: 'Uwagi', en: 'Notes' },
  fNotePh: { pl: 'np. dochodzenie z psem', en: 'e.g. tracked with a dog' },
  add: { pl: '+ Dodaj zwierzynę', en: '+ Add game' },
  addTitle: { pl: 'Dodaj zwierzynę do pokotu', en: 'Add game to the results' },
  lock: { pl: 'Zatwierdź pokot', en: 'Confirm results' },
  lockHint: { pl: 'Po zatwierdzeniu nikt nie może zmieniać strzałów.', en: 'After confirming, nobody can change the shots.' },
  unlock: { pl: 'Odblokuj do poprawek', en: 'Unlock for corrections' },
  lockAfterEnd: { pl: 'Pokot można zatwierdzić po zakończeniu polowania.', en: 'The results can be confirmed after the hunt has ended.' },
  pdf: { pl: '⤓ Pobierz pokot (PDF)', en: '⤓ Download results (PDF)' },
  pdfHint: { pl: 'W oknie drukowania wybierz „Zapisz jako PDF”.', en: 'In the print dialog choose “Save as PDF”.' },
  offSeason: { pl: 'poza okresem polowań', en: 'outside the season' },
  retention: {
    pl: 'Miejsca strzałów są usuwane razem ze śladami 7 dni po polowaniu; sam pokot zostaje.',
    en: 'Shot locations are deleted with the tracks 7 days after the hunt; the results stay.',
  },
  // printout
  pTitle: { pl: 'Pokot', en: 'Hunt results' },
  pDate: { pl: 'Data', en: 'Date' },
  pPlace: { pl: 'Zbiórka', en: 'Meeting point' },
  pDistrict: { pl: 'Obwód', en: 'District' },
  pLeader: { pl: 'Prowadzący', en: 'Leader' },
  pPeople: { pl: 'Uczestnicy', en: 'Participants' },
  pHunters: { pl: 'myśliwych', en: 'hunters' },
  pBeaters: { pl: 'naganiaczy', en: 'beaters' },
  pHunter1: { pl: 'myśliwy', en: 'hunter' },
  pBeater1: { pl: 'naganiacz', en: 'beater' },
  pTotal: { pl: 'Razem', en: 'Total' },
  pNo: { pl: 'Lp.', en: 'No.' },
  pTime: { pl: 'Godz.', en: 'Time' },
  pDraft: { pl: 'WERSJA ROBOCZA – pokot nie został zatwierdzony przez prowadzącego', en: 'DRAFT – the leader has not confirmed these results' },
  pLockedAt: { pl: 'Zatwierdzony', en: 'Confirmed' },
  pSign: { pl: 'Podpis prowadzącego polowanie', en: "Hunt leader's signature" },
  pMade: { pl: 'Wygenerowano w aplikacji Polowanie', en: 'Generated with Polowanie' },
  pClose: { pl: 'Zamknij podgląd', en: 'Close preview' },
  asf: { pl: 'Dziki – miejsca odstrzału (ASF)', en: 'Wild boar – kill sites (ASF)' },
  asfHint: {
    pl: 'Współrzędne do dokumentów ASF: miejsce, w którym leży tusza (jeśli zaznaczono je w „Tusze do zabrania”), inaczej miejsce strzału albo stanowisko strzelca. Popraw je przed pobraniem PDF.',
    en: 'Coordinates for the ASF paperwork: where the carcass lies (if marked under “Carcasses to collect”), else where the shot was fired or the shooter’s stand. Correct them before downloading the PDF.',
  },
  asfKeep: {
    pl: 'Pobierz PDF w ciągu 7 dni po polowaniu: potem miejsca strzałów i tusz są usuwane.',
    en: 'Download the PDF within 7 days of the hunt: shot and carcass locations are deleted after that.',
  },
  cCoords: { pl: 'Współrzędne (WGS84)', en: 'Coordinates (WGS84)' },
  cSrc: { pl: 'Źródło', en: 'Source' },
  src_mark: { pl: 'miejsce tuszy', en: 'carcass location' },
  src_shot: { pl: 'miejsce strzału', en: 'where the shot was fired' },
  src_seat: { pl: 'stanowisko strzelca', en: "shooter's stand" },
  src_none: { pl: 'brak – zaznacz miejsce tuszy na mapie', en: 'missing – mark the carcass on the map' },
  pPrint: { pl: 'Drukuj / zapisz PDF', en: 'Print / save PDF' },
} as const;
export const pl = (k: keyof typeof PL) => tt(PL[k]);

export const gameName = (key: string | null) => {
  const x = gameByKey(key);
  return x ? (getLang() === 'pl' ? x.pl : x.en) : '';
};
export const outcomeName = (o: Outcome) => pl(`o_${o}`);
export const groupName = (g: GameGroup) => pl(`g_${g}`);

export interface PokotCtx {
  hunt: Hunt;
  shots: Shot[];
  drives: Drive[];
  members: Participant[];
  myUid: string;
  /** Shot id being edited, 'new' for the leader's add form, `del:<id>` while asking to delete. */
  editing: string | null;
  busy: boolean;
  error: string;
  clock: (ms: number) => string;
  /** Where each killed boar lies (shot id → best known position), for the ASF paperwork. */
  boarAt: Map<string, { at: { lat: number; lng: number } | null; src: 'mark' | 'shot' | 'seat' | null }>;
}

const shooterName = (c: PokotCtx, uid: string) => (uid === NO_SHOOTER ? pl('noShooter') : c.members.find((p) => p.uid === uid)?.name ?? '?');
const shooters = (c: PokotCtx) => c.members.filter((p) => p.role !== 'beater');
const isLeader = (c: PokotCtx) => leads(c.hunt, c.myUid);
const locked = (c: PokotCtx) => c.hunt.pokotLockedAt != null;
const canEdit = (c: PokotCtx, s: Shot) =>
  !locked(c) && (c.hunt.status === 'live' || c.hunt.status === 'ended') && (isLeader(c) || s.uid === c.myUid);
const voiv = (c: PokotCtx) => voivodeshipOf(c.hunt.district?.label);
const busyAttr = (c: PokotCtx) => (c.busy ? ' disabled aria-busy="true"' : '');

function shotLine(c: PokotCtx, s: Shot): string {
  const g = gameName(s.game);
  const what = s.outcome === 'kill' || s.outcome === 'wound' ? `${g || outcomeName(s.outcome)}${s.outcome === 'wound' ? ` · ${outcomeName('wound')}` : ''}` : outcomeName(s.outcome);
  const off = s.outcome === 'kill' && s.game && outOfSeason(s.game, c.hunt.date, voiv(c));
  return `<span class="hp-what"><strong>${esc(what)}</strong>${off ? ` <span class="hp-warn">${pl('offSeason')}</span>` : ''}</span>
    <span class="muted small">${esc(shooterName(c, s.uid))} · ${c.clock(s.ts)}${s.note ? ` · ${esc(s.note)}` : ''}</span>`;
}

function gameOptions(sel: string | null): string {
  return (
    `<option value="">${pl('noGame')}</option>` +
    GAME_GROUPS.map(
      (gr) => `<optgroup label="${esc(groupName(gr))}">${GAMES.filter((x) => x.group === gr)
        .map((x) => `<option value="${x.key}"${x.key === sel ? ' selected' : ''}>${esc(getLang() === 'pl' ? x.pl : x.en)}</option>`)
        .join('')}</optgroup>`,
    ).join('')
  );
}

function shotForm(c: PokotCtx, s: Shot | null): string {
  const lead = isLeader(c);
  const outcome = s?.outcome ?? 'kill';
  const sel = (name: string, label: string, opts: string) =>
    `<label class="h-field"><span>${label}</span><select name="${name}">${opts}</select></label>`;
  const outcomes = OUTCOMES.map((o) => `<option value="${o}"${o === outcome ? ' selected' : ''}>${esc(outcomeName(o))}</option>`).join('');
  const drivesSel = [`<option value="">${esc(pl('outsideDrive'))}</option>`, ...c.drives.map((d) => `<option value="${esc(d.id)}"${d.id === s?.driveId ? ' selected' : ''}>${esc(d.name)}</option>`)].join('');
  const who = s?.uid ?? '';
  const shooterSel = [
    ...shooters(c).map((p) => `<option value="${esc(p.uid)}"${p.uid === who ? ' selected' : ''}>${esc(p.name)}</option>`),
    `<option value="${NO_SHOOTER}"${who === NO_SHOOTER ? ' selected' : ''}>${esc(pl('noShooter'))}</option>`,
  ].join('');
  const asking = c.editing === `del:${s?.id}`;
  return `<form class="hp-form" data-hunt-form="shot" data-sid="${esc(s?.id ?? '')}" novalidate>
    ${s ? '' : `<strong>${pl('addTitle')}</strong>`}
    <div class="h-row">
      ${sel('outcome', pl('fOutcome'), outcomes)}
      ${sel('game', pl('fGame'), gameOptions(s?.game ?? null))}
      ${lead ? sel('driveId', pl('fDrive'), drivesSel) : ''}
      ${lead ? sel('uid', pl('fShooter'), shooterSel) : ''}
    </div>
    <label class="h-field"><span>${pl('fNote')}</span><input name="note" maxlength="${NOTE_MAX}" value="${esc(s?.note ?? '')}" placeholder="${esc(pl('fNotePh'))}" /></label>
    ${c.error ? `<p class="h-error" role="alert">${esc(c.error)}</p>` : ''}
    <div class="h-actions">
      <button type="submit" class="btn small"${busyAttr(c)}>${pl('save')}</button>
      <button type="button" class="btn small ghost" data-hunt="shotCancel">${pl('cancel')}</button>
      ${
        s
          ? asking
            ? `<button type="button" class="btn small danger" data-hunt="shotDelete" data-sid="${esc(s.id)}"${busyAttr(c)}>${pl('delSure')}</button>`
            : `<button type="button" class="btn small ghost" data-hunt="askShotDelete" data-sid="${esc(s.id)}">${pl('del')}</button>`
          : ''
      }
    </div>
  </form>`;
}

function totalsTable(c: PokotCtx, forPrint: boolean): string {
  const t = hunterTotals(c.shots, shooters(c).map((p) => p.uid));
  if (!t.length) return '';
  const king = c.hunt.pokotTitles ? huntKing(t) : null;
  const misser = c.hunt.pokotTitles ? huntMisser(t) : null;
  const rows = t
    .map((x) => {
      const badge = [x.uid === king ? `<span class="hp-title">${pl('king')}</span>` : '', x.uid === misser ? `<span class="hp-title hp-title-m">${pl('misser')}</span>` : ''].join(' ');
      return `<tr${x.uid === c.myUid && !forPrint ? ' class="hp-me"' : ''}><th scope="row">${esc(shooterName(c, x.uid))} ${badge}</th><td>${x.shots}</td><td>${x.kill}</td><td${x.wound ? ' class="hp-wound"' : ''}>${x.wound}</td><td>${x.miss}</td>${forPrint ? '' : `<td>${x.unknown || ''}</td>`}</tr>`;
    })
    .join('');
  const sum = (k: 'shots' | 'kill' | 'wound' | 'miss') => t.reduce((a, x) => a + x[k], 0);
  return `<table class="hp-table"><thead><tr><th scope="col">${pl('hunter')}</th><th scope="col">${pl('cShots')}</th><th scope="col">${pl('cKill')}</th><th scope="col">${pl('cWound')}</th><th scope="col">${pl('cMiss')}</th>${forPrint ? '' : `<th scope="col">${pl('cUnknown')}</th>`}</tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><th scope="row">${pl('pTotal')}</th><td>${sum('shots')}</td><td>${sum('kill')}</td><td>${sum('wound')}</td><td>${sum('miss')}</td>${forPrint ? '' : '<td></td>'}</tr></tfoot></table>`;
}

const bagLine = (c: PokotCtx) => {
  const bag = bagBySpecies(c.shots, getLang());
  return bag.length ? bag.map(([k, n]) => `<span class="hp-bag-item"><strong>${esc(k)}</strong> ${n}</span>`).join('') : `<span class="muted">${pl('bagEmpty')}</span>`;
};

/** Killed boar with where they lie, in shot order. */
const boars = (c: PokotCtx) =>
  c.shots
    .filter((s) => s.outcome === 'kill' && isBoar(s.game))
    .map((s) => ({ s, ...(c.boarAt.get(s.id) ?? { at: null, src: null }) }));

function asfTable(c: PokotCtx, forPrint: boolean): string {
  const list = boars(c);
  if (!list.length) return '';
  const drive = (id: string | null) => c.drives.find((d) => d.id === id)?.name ?? pl('outsideDrive');
  const rows = list
    .map(({ s, at, src }, i) => {
      const xy = at ? fmtCoords(at.lat, at.lng) : null;
      const where = xy
        ? `<strong>${xy.dec}</strong><br><small>${xy.dms}</small>`
        : `<span class="hp-warn">${pl('src_none')}</span>`;
      return `<tr><td>${i + 1}</td><td>${esc(gameName(s.game))}</td><td>${esc(shooterName(c, s.uid))}</td><td>${esc(drive(s.driveId))}, ${c.clock(s.ts)}</td><td>${where}</td><td>${src ? pl(`src_${src}`) : ''}</td></tr>`;
    })
    .join('');
  if (!forPrint)
    // On a phone a six-column table does not fit: one line per boar instead.
    return `<ol class="hp-asf">${list
      .map(({ s, at, src }) => {
        const xy = at ? fmtCoords(at.lat, at.lng) : null;
        return `<li><strong>${esc(gameName(s.game))}</strong> <span class="muted small">· ${esc(shooterName(c, s.uid))} · ${esc(drive(s.driveId))}, ${c.clock(s.ts)}</span><br>${
          xy ? `<span class="hp-xy">${xy.dec}</span> <span class="muted small">(${pl(`src_${src!}`)})</span><br><small class="muted">${xy.dms}</small>` : `<span class="hp-warn">${pl('src_none')}</span>`
        }</li>`;
      })
      .join('')}</ol>`;
  return `<table class="pp-table"><thead><tr><th>${pl('pNo')}</th><th>${pl('fGame')}</th><th>${pl('fShooter')}</th><th>${pl('fDrive')}, ${pl('pTime').toLocaleLowerCase()}</th><th>${pl('cCoords')}</th><th>${pl('cSrc')}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const driveTimes = (c: PokotCtx, d: Drive) => (d.startedAt != null ? `${c.clock(d.startedAt)}–${d.endedAt != null ? c.clock(d.endedAt) : '…'}` : `${d.start}–${d.end}`);

/** The panel under the live map. */
export function renderPokot(c: PokotCtx): string {
  const lead = isLeader(c);
  const groups = shotsByDrive(c.shots, c.drives);
  const list = groups.length
    ? groups
        .map(
          (gr) => `<h4 class="hp-drive">${esc(gr.drive?.name ?? pl('outsideDrive'))}${gr.drive ? ` <small class="muted">${driveTimes(c, gr.drive)}</small>` : ''}</h4>
      <ul class="hp-list">${gr.shots
        .map((s) =>
          c.editing === s.id || c.editing === `del:${s.id}`
            ? `<li class="hp-editing">${shotForm(c, s)}</li>`
            : `<li class="hp-row hp-${s.outcome}"><span class="hp-dot" aria-hidden="true"></span><span class="hp-info">${shotLine(c, s)}</span>${
                canEdit(c, s) ? `<button type="button" class="btn small ghost" data-hunt="shotEdit" data-sid="${esc(s.id)}">${pl('edit')}</button>` : ''
              }</li>`,
        )
        .join('')}</ul>`,
        )
        .join('')
    : `<p class="muted small">${pl('noShots')}</p>`;
  const st = locked(c) ? `<span class="h-status hp-st-locked">${pl('locked')} ${c.clock(c.hunt.pokotLockedAt!)}</span>` : `<span class="h-status h-st-closed">${pl('draft')}</span>`;
  let leaderCtl = '';
  if (lead) {
    const add =
      !locked(c) && (c.hunt.status === 'live' || c.hunt.status === 'ended')
        ? c.editing === 'new'
          ? shotForm(c, null)
          : `<button type="button" class="btn small ghost" data-hunt="pokotAdd">${pl('add')}</button>`
        : '';
    const lock =
      c.hunt.status !== 'ended'
        ? `<p class="muted small">${pl('lockAfterEnd')}</p>`
        : locked(c)
          ? `<button type="button" class="btn small ghost" data-hunt="pokotUnlock"${busyAttr(c)}>${pl('unlock')}</button>`
          : `<button type="button" class="btn small" data-hunt="pokotLock"${busyAttr(c)}>${pl('lock')}</button> <small class="muted">${pl('lockHint')}</small>`;
    leaderCtl = `<div class="hp-lead">${add}
      <label class="hp-check"><input type="checkbox" data-hunt="pokotTitles"${c.hunt.pokotTitles ? ' checked' : ''}${busyAttr(c)} /> ${pl('titlesToggle')}</label>
      <div class="h-actions">${lock}</div>${c.editing === null && c.error ? `<p class="h-error" role="alert">${esc(c.error)}</p>` : ''}</div>`;
  }
  return `<section class="card hp-box" aria-labelledby="hp-h">
    <div class="h-title"><h3 id="hp-h">${pl('pokot')}</h3>${st}</div>
    <p class="small muted">${pl('pokotIntro')}</p>
    <div class="hp-bag">${bagLine(c)}</div>
    ${list}
    <h4>${pl('hunters')}</h4>${totalsTable(c, false)}
    ${boars(c).length ? `<h4>${pl('asf')}</h4><p class="small muted">${pl('asfHint')}</p>${asfTable(c, false)}<p class="small">${pl('asfKeep')}</p>` : ''}
    ${leaderCtl}
    <div class="h-actions"><button type="button" class="btn small ghost" data-hunt="pokotPdf">${pl('pdf')}</button></div>
    <p class="muted small">${pl('pdfHint')} ${pl('retention')}</p>
  </section>`;
}

/** Printable pokot: the browser's print dialog turns it into a PDF. */
export function renderPokotPrint(c: PokotCtx, fmtDate: (d: string) => string): string {
  const h = c.hunt;
  const nH = c.members.filter((p) => p.role !== 'beater').length;
  const nB = c.members.filter((p) => p.role === 'beater').length;
  const groups = shotsByDrive(
    c.shots.filter((s) => s.outcome === 'kill' || s.outcome === 'wound'),
    c.drives,
  );
  let n = 0;
  const rows = groups
    .map(
      (gr) =>
        `<tr class="pp-drive"><th colspan="5">${esc(gr.drive?.name ?? pl('outsideDrive'))}${gr.drive ? ` <span>${driveTimes(c, gr.drive)}</span>` : ''}</th></tr>` +
        gr.shots
          .map(
            (s) =>
              `<tr><td>${++n}</td><td>${esc(gameName(s.game) || outcomeName('kill'))}${s.outcome === 'wound' ? ` <em>(${esc(outcomeName('wound'))})</em>` : ''}</td><td>${esc(shooterName(c, s.uid))}</td><td>${c.clock(s.ts)}</td><td>${esc(s.note)}</td></tr>`,
          )
          .join(''),
    )
    .join('');
  const bag = bagBySpecies(c.shots, getLang());
  return `<div class="pp-tools"><button type="button" class="btn" data-pp="print">${pl('pPrint')}</button><button type="button" class="btn ghost" data-pp="close">${pl('pClose')}</button></div>
  <article class="pp-page">
    <h1>${pl('pTitle')}: ${esc(h.name)}</h1>
    ${h.pokotLockedAt == null ? `<p class="pp-draft">${pl('pDraft')}</p>` : ''}
    <dl class="pp-meta">
      <dt>${pl('pDate')}</dt><dd>${esc(fmtDate(h.date))}, ${esc(h.start)}–${esc(h.end)}</dd>
      ${h.place ? `<dt>${pl('pPlace')}</dt><dd>${esc(h.place)}</dd>` : ''}
      ${h.district ? `<dt>${pl('pDistrict')}</dt><dd>${esc(h.district.label)}</dd>` : ''}
      <dt>${pl('pLeader')}</dt><dd>${esc(h.leaderName)}</dd>
      <dt>${pl('pPeople')}</dt><dd>${nH} ${pl(nH === 1 ? 'pHunter1' : 'pHunters')}, ${nB} ${pl(nB === 1 ? 'pBeater1' : 'pBeaters')}</dd>
      ${h.pokotLockedAt != null ? `<dt>${pl('pLockedAt')}</dt><dd>${c.clock(h.pokotLockedAt)}</dd>` : ''}
    </dl>
    <h2>${pl('bag')}</h2>
    ${bag.length ? `<p class="pp-bag">${bag.map(([k, v]) => `<strong>${esc(k)}</strong> ${v}`).join(' · ')} · ${pl('pTotal')}: ${bag.reduce((a, [, v]) => a + v, 0)}</p>` : `<p>${pl('bagEmpty')}</p>`}
    ${rows ? `<table class="pp-table"><thead><tr><th>${pl('pNo')}</th><th>${pl('fGame')}</th><th>${pl('fShooter')}</th><th>${pl('pTime')}</th><th>${pl('fNote')}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    <h2>${pl('hunters')}</h2>
    ${totalsTable(c, true)}
    ${boars(c).length ? `<h2>${pl('asf')}</h2>${asfTable(c, true)}` : ''}
    <div class="pp-sign"><span></span>${pl('pSign')}</div>
    <p class="pp-foot">${pl('pMade')} · ${esc(new Date().toLocaleString(getLang() === 'pl' ? 'pl-PL' : 'en-GB'))}</p>
  </article>`;
}
