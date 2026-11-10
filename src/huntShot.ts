// After a shot: what happened (killed, wounded, missed) and, for game that was hit,
// which animal. A full-screen sheet with big buttons, like the sighting report.

import { GAMES, GAME_GROUPS, type GameGroup, type Outcome } from './pokot';
import { ic } from './icons';

export interface ShotText {
  title: string; // "Shot logged. Result?"
  outcomes: Record<Exclude<Outcome, 'unknown'>, string>;
  later: string; // "Fill in later"
  gameTitle: (o: Outcome) => string; // "What is down?"
  groups: Record<GameGroup, string>;
  game: (key: string) => string;
  unknownGame: string; // "Not sure"
  offSeason: string; // "outside the season"
  back: string;
  saving: string;
}

export interface ShotChoice {
  outcome: Outcome;
  game: string | null;
}

let sheet: HTMLElement | null = null;

export const shotSheetOpen = () => !!sheet;

/** Open the sheet; onSave resolves when stored (the sheet then closes) or rejects (it shows the error). */
export function openShotSheet(text: ShotText, isOffSeason: (key: string) => boolean, onSave: (c: ShotChoice) => Promise<void>) {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'hs-sheet hp-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', text.title);
  document.body.append(sheet);
  const el = sheet;
  let outcome: Outcome = 'unknown';

  const close = () => {
    el.remove();
    if (sheet === el) sheet = null;
  };

  const stepOutcome = () => {
    el.innerHTML = `<div class="hs-top"><strong>${text.title}</strong><button type="button" class="hs-x" data-p="later" aria-label="${text.later}">${ic('x', 22)}</button></div>
      <div class="hp-outcomes">
        <button type="button" class="hp-o hp-o-kill" data-p="o" data-v="kill">${text.outcomes.kill}</button>
        <button type="button" class="hp-o hp-o-wound" data-p="o" data-v="wound">${text.outcomes.wound}</button>
        <button type="button" class="hp-o hp-o-miss" data-p="o" data-v="miss">${text.outcomes.miss}</button>
      </div>
      <button type="button" class="btn ghost" data-p="later">${text.later}</button>
      <p class="hs-err" role="alert" hidden></p>`;
  };

  const stepGame = () => {
    const groups = GAME_GROUPS.map((gr) => {
      const items = GAMES.filter((x) => x.group === gr)
        .map((x) => {
          const off = isOffSeason(x.key);
          return `<button type="button" class="hp-g${off ? ' hp-off' : ''}" data-p="g" data-v="${x.key}">${text.game(x.key)}${off ? `<small>${text.offSeason}</small>` : ''}</button>`;
        })
        .join('');
      return `<h4>${text.groups[gr]}</h4><div class="hp-games">${items}</div>`;
    }).join('');
    el.innerHTML = `<div class="hs-top"><button type="button" class="hs-x" data-p="back" aria-label="${text.back}">←</button><strong>${text.gameTitle(outcome)}</strong></div>
      <div class="hp-gamelist">${groups}</div>
      ${outcome === 'wound' ? `<button type="button" class="btn ghost" data-p="g" data-v="">${text.unknownGame}</button>` : ''}
      <p class="hs-err" role="alert" hidden></p>`;
  };

  const save = (c: ShotChoice) => {
    const err = el.querySelector<HTMLElement>('.hs-err');
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
    if (err) {
      err.hidden = false;
      err.className = 'hs-err hs-saving';
      err.textContent = text.saving;
    }
    onSave(c).then(close, (e: Error) => {
      if (sheet !== el) return;
      el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false));
      if (err) {
        err.className = 'hs-err';
        err.textContent = e.message;
      }
    });
  };

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-p]');
    if (!b || b.disabled) return;
    switch (b.dataset.p) {
      case 'later':
        return close();
      case 'back':
        return stepOutcome();
      case 'o':
        outcome = b.dataset.v as Outcome;
        if (outcome === 'miss') return save({ outcome, game: null });
        return stepGame();
      case 'g':
        return save({ outcome, game: b.dataset.v || null });
    }
  });
  stepOutcome();
}

export function closeShotSheet() {
  sheet?.remove();
  sheet = null;
}
