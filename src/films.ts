// Instructional films with a voiceover, one per role plus one hunt seen on three phones at once.
// The files live on the website (landing/public/filmy/), so the Android app streams them from
// there too; nothing is downloaded until the play button is pressed.

import { isApp, PUBLIC_URL } from './platform';
import type { GuideRole } from './nav';

export type Film = { slug: string; title: string; about: string; length: string; mb: number };

export const ROLE_FILMS: Record<GuideRole, Film> = {
  leader: { slug: 'prowadzacy', title: 'Prowadzący w aplikacji Polowanie', about: 'Od przygotowania polowania na komputerze po pokot i przekazanie prowadzenia.', length: '5:21', mb: 17 },
  hunter: { slug: 'mysliwy', title: 'Myśliwy w aplikacji Polowanie', about: 'Zapis, stanowisko, alarm o zwierzynie, strzał i pokot.', length: '3:20', mb: 8 },
  beater: { slug: 'naganiacz', title: 'Naganiacz w aplikacji Polowanie', about: 'Trasa ze strzałką, zgłaszanie zwierzyny, ostrzeżenie przed linią myśliwych i zbiórka.', length: '3:04', mb: 7 },
};

export const THREE_PHONES: Film = {
  slug: 'trzy-telefony',
  title: 'Jedno polowanie, trzy telefony',
  about: 'Ten sam miot u prowadzącego, myśliwego i naganiacza naraz.',
  length: '3:20',
  mb: 12,
};

/**
 * Address of a film file ('mp4', or the 'jpg' poster): next to the app on the website
 * (so a test build serves its own copy), on www.polowanie.org in the Android app.
 */
export const filmUrl = (f: Film, ext: 'mp4' | 'jpg'): string =>
  new URL(`../filmy/${f.slug}.${ext}`, isApp() || typeof location === 'undefined' ? PUBLIC_URL : location.href).href;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A player that loads nothing until played. The subtitles are part of the picture, so there is no captions track. */
export function filmPlayer(f: Film): string {
  return `<video class="film-video" controls preload="none" playsinline poster="${filmUrl(f, 'jpg')}" width="1920" height="1080" aria-label="${esc(f.title)}">
      <source src="${filmUrl(f, 'mp4')}" type="video/mp4" />
    </video>`;
}
