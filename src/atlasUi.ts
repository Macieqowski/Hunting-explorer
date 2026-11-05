// Atlas zwierzyny: species list and species pages. Rendered as strings like the other
// sections; main.ts routes #/atlas and #/atlas/<slug> here and forwards [data-atlas] clicks.

import { getLang, tt } from './i18n';
import { SPECIES, GROUPS, speciesBySlug, seasonsFor, type Species, type Tx } from './atlas';
import { hoofSvg } from './atlasTracks';
import { isOpen, effective, formatRanges } from './seasons';
import photoCredits from './atlasPhotos.json';

interface Credit {
  src: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string;
  page: string;
}
const CREDITS = photoCredits as Record<string, Credit>;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  title: { pl: 'Atlas zwierzyny', en: 'Game atlas' },
  intro: {
    pl: 'Gatunki łowne: jak rozpoznać płeć i wiek, tropy, ślady bytowania i aktualny okres polowań.',
    en: 'Game species: telling sex and age, tracks, signs and the current hunting season.',
  },
  search: { pl: 'Szukaj gatunku', en: 'Search species' },
  none: { pl: 'Brak gatunku o tej nazwie.', en: 'No species with that name.' },
  soon: {
    pl: 'Drapieżniki, zwierzyna drobna i ptactwo pojawią się w kolejnej wersji.',
    en: 'Predators, small game and birds come in the next version.',
  },
  back: { pl: '← Wszystkie gatunki', en: '← All species' },
  facts: { pl: 'W skrócie', en: 'At a glance' },
  terms: { pl: 'Nazwy łowieckie', en: 'Hunting terms' },
  sex: { pl: 'Jak rozpoznać płeć', en: 'Telling the sex' },
  age: { pl: 'Jak ocenić wiek', en: 'Telling the age' },
  track: { pl: 'Trop', en: 'Track' },
  trackLabel: { pl: 'Rysunek tropu, w skali', en: 'Track drawing, to scale' },
  dewSoft: { pl: 'racice boczne: tylko w miękkim gruncie', en: 'dewclaws: only in soft ground' },
  dewAlways: { pl: 'racice boczne: prawie zawsze', en: 'dewclaws: nearly always' },
  signs: { pl: 'Ślady bytowania', en: 'Signs' },
  season: { pl: 'Okres polowań', en: 'Hunting season' },
  open: { pl: 'dziś otwarty', en: 'open today' },
  closed: { pl: 'dziś zamknięty', en: 'closed today' },
  allSeasons: { pl: 'Wszystkie okresy polowań', en: 'All hunting seasons' },
  voivHint: {
    pl: 'Okresy mogą się różnić w niektórych województwach – wybierz swoje w zakładce Okresy polowań.',
    en: 'Some voivodeships have different dates – pick yours in the Seasons tab.',
  },
  sources: { pl: 'Źródła', en: 'Sources' },
  review: {
    pl: 'Opisy przygotowane dla aplikacji na podstawie podanych źródeł. Przed polowaniem sprawdź aktualne przepisy i zasady selekcji w swoim okręgu.',
    en: 'Texts written for this app from the sources listed. Check the current law and your region’s selection rules before hunting.',
  },
  photos: { pl: 'Autorzy zdjęć', en: 'Photo credits' },
  photosIntro: {
    pl: 'Wszystkie zdjęcia pochodzą z Wikimedia Commons, na wolnych licencjach. Zostały zmniejszone na potrzeby aplikacji.',
    en: 'All photos come from Wikimedia Commons under free licences. They were resized for the app.',
  },
  photoBy: { pl: 'Fot.', en: 'Photo:' },
};

const tl = (x: Tx) => (getLang() === 'pl' ? x.pl : x.en);

/** Our own texts may contain <b> only; everything else from data is escaped. */
const rich = (x: Tx) => tl(x);

const fold = (s: string) =>
  s
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

let query = '';

export function renderAtlas(slug: string | null): string {
  if (slug === 'zdjecia') return renderCredits();
  const sp = slug ? speciesBySlug(slug) : undefined;
  return sp ? renderSpecies(sp) : renderList();
}

function photoUrl(file: string): string | null {
  const c = CREDITS[file];
  return c ? import.meta.env.BASE_URL + c.src : null;
}

function renderList(): string {
  const q = fold(query.trim());
  const match = (sp: Species) => !q || [sp.name.pl, sp.name.en, sp.latin, sp.terms.pl].some((s) => fold(s.replace(/<[^>]+>/g, '')).includes(q));
  const groups = Object.values(GROUPS)
    .map((g) => {
      const items = SPECIES.filter((sp) => sp.group.id === g.id && match(sp));
      if (!items.length) return '';
      return `<h3 class="atlas-group">${esc(tl(g.name))}</h3>
        <ul class="atlas-grid">${items.map(card).join('')}</ul>`;
    })
    .join('');
  return `<div class="atlas">
    <h2>${tl(L.title)}</h2>
    <p class="small">${tl(L.intro)}</p>
    <div class="searchbar"><input type="search" class="atlas-search" data-atlas-input="q" value="${esc(query)}" placeholder="${tl(L.search)}" aria-label="${tl(L.search)}"></div>
    ${groups || `<p class="muted">${tl(L.none)}</p>`}
    <p class="muted small">${tl(L.soon)}</p>
    <p class="muted small"><a href="#/atlas/zdjecia" data-atlas="go" data-slug="zdjecia">${tl(L.photos)}</a></p>
  </div>`;
}

function card(sp: Species): string {
  const p = sp.photos[0];
  const url = p ? photoUrl(p.file) : null;
  return `<li><a class="atlas-card" href="#/atlas/${sp.slug}" data-atlas="go" data-slug="${sp.slug}">
    ${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : '<span class="atlas-noimg"></span>'}
    <span class="atlas-card-name">${esc(tl(sp.name))}</span>
    <span class="atlas-card-latin">${esc(sp.latin)}</span>
  </a></li>`;
}

function renderPhotos(sp: Species): string {
  const figs = sp.photos
    .map((p) => {
      const c = CREDITS[p.file];
      if (!c) return '';
      return `<figure class="atlas-photo">
        <img src="${esc(import.meta.env.BASE_URL + c.src)}" width="${c.width}" height="${c.height}" alt="${esc(tl(p.caption))}" loading="lazy">
        <figcaption><span>${esc(tl(p.caption))}</span>
          <small>${tl(L.photoBy)} <a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.author)}</a>,
          ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</small></figcaption>
      </figure>`;
    })
    .join('');
  return figs ? `<div class="atlas-photos">${figs}</div>` : '';
}

function renderSeason(sp: Species, voiv: string): string {
  const now = new Date();
  const lang = getLang();
  const rows = seasonsFor(sp)
    .map((s) => {
      const eff = effective(s, voiv || null);
      const open = isOpen(s, now, voiv || null);
      const part = s.name.pl.includes(' – ') ? tt(s.name).split(' – ').slice(1).join(' – ') : tt(s.name);
      const label = part.charAt(0).toLocaleUpperCase('pl') + part.slice(1);
      const when = s.note && !eff.ranges.length && !eff.allYear ? tt(s.note) : formatRanges(eff.ranges, eff.allYear, lang);
      return `<tr><td>${esc(label)}</td><td>${esc(when)}${s.variants?.length ? ' *' : ''}</td>
        <td><span class="atlas-pill ${open ? 'on' : 'off'}">${open ? tl(L.open) : tl(L.closed)}</span></td></tr>`;
    })
    .join('');
  const hasVariants = seasonsFor(sp).some((s) => s.variants?.length);
  return `<section class="atlas-sec"><h3>${tl(L.season)}</h3>
    <table class="tbl atlas-season"><tbody>${rows}</tbody></table>
    ${hasVariants ? `<p class="muted small">* ${tl(L.voivHint)}</p>` : ''}
    <p class="small"><a href="#/seasons" data-atlas="seasons">${tl(L.allSeasons)} →</a></p></section>`;
}

function list(items: Tx[]): string {
  return `<ul class="atlas-list">${items.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>`;
}

let seasonVoiv = '';
/** main.ts passes the voivodeship chosen in the Seasons tab so both views agree. */
export function setAtlasVoivodeship(v: string) {
  seasonVoiv = v;
}

function renderSpecies(sp: Species): string {
  const p = sp.track.print;
  return `<article class="atlas atlas-species">
    <a href="#/atlas" class="btn ghost back" data-atlas="go" data-slug="">${tl(L.back)}</a>
    <h2>${esc(tl(sp.name))} <span class="atlas-latin">${esc(sp.latin)}</span></h2>
    <p>${rich(sp.terms)}</p>
    ${renderPhotos(sp)}
    <div class="atlas-cols">
      <section class="atlas-sec"><h3>${tl(L.facts)}</h3>
        <dl class="atlas-facts">${sp.facts.map(([k, v]) => `<dt>${esc(tl(k))}</dt><dd>${rich(v)}</dd>`).join('')}</dl>
      </section>
      ${renderSeason(sp, seasonVoiv)}
    </div>
    <section class="atlas-sec"><h3>${tl(L.sex)}</h3>${list(sp.sex)}</section>
    <section class="atlas-sec"><h3>${tl(L.age)}</h3>${list(sp.age)}</section>
    <section class="atlas-sec atlas-trackbox"><h3>${tl(L.track)}</h3>
      <figure>${hoofSvg(p, tl(L.trackLabel))}
        <figcaption class="muted small">${tl(L.trackLabel)} · ${p.dew === 'always' ? tl(L.dewAlways) : tl(L.dewSoft)}</figcaption></figure>
      ${list(sp.track.text)}
    </section>
    <section class="atlas-sec"><h3>${tl(L.signs)}</h3>${list(sp.signs)}</section>
    <section class="atlas-sec"><h3>${tl(L.sources)}</h3>
      <ul class="atlas-sources">${sp.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a></li>`).join('')}</ul>
      <p class="muted small">${tl(L.review)}</p>
    </section>
  </article>`;
}

function renderCredits(): string {
  const rows = SPECIES.flatMap((sp) =>
    sp.photos
      .filter((p) => CREDITS[p.file])
      .map((p) => {
        const c = CREDITS[p.file];
        return `<li><a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(p.file)}</a> – ${esc(tl(sp.name))}<br>
          <span class="muted small">${tl(L.photoBy)} ${esc(c.author)} · ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</span></li>`;
      }),
  ).join('');
  return `<article class="atlas">
    <a href="#/atlas" class="btn ghost back" data-atlas="go" data-slug="">${tl(L.back)}</a>
    <h2>${tl(L.photos)}</h2><p class="small">${tl(L.photosIntro)}</p>
    <ul class="atlas-credits">${rows}</ul></article>`;
}

/** Click handler for [data-atlas] elements. Returns true when handled. */
export function handleAtlasClick(el: HTMLElement, go: (slug: string | null) => void, toSeasons: () => void): boolean {
  if (el.dataset.atlas === 'go') {
    go(el.dataset.slug || null);
    return true;
  }
  if (el.dataset.atlas === 'seasons') {
    toSeasons();
    return true;
  }
  return false;
}

/** Input handler for the search box. Returns true when handled. */
export function handleAtlasInput(el: HTMLInputElement, rerender: () => void): boolean {
  if (el.dataset.atlasInput !== 'q') return false;
  query = el.value;
  rerender();
  const again = document.querySelector<HTMLInputElement>('[data-atlas-input="q"]');
  if (again) {
    again.focus();
    again.setSelectionRange(query.length, query.length);
  }
  return true;
}
