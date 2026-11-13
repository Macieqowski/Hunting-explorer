/**
 * Pages written out as plain HTML at build time, so search engines can read them. The app
 * itself lives under /app/ and switches views with #/… addresses, which search engines treat
 * as one page; these pages carry the same knowledge at their own addresses and send the
 * visitor on to the matching view in the app.
 *
 * Everything comes from the data shipped with the app: SEASONS (src/seasons.ts), the atlas
 * (src/atlas*.ts), the exam banks (public/exams/) and the district list (public/data/).
 */
import { SEASONS, effective, formatRanges, isOpen, type Season } from '../../src/seasons';
import { SPECIES, GROUPS, seasonsFor, protectedLookalikes, speciesBySlug, type Species } from '../../src/atlas';
import { trackSvg } from '../../src/atlasTracks';
import { groupClubs, districtSlug, holderType, clubKey, type Club } from '../../src/data';
import type { District } from '../../src/bdl';
import type { Bank, Question, Answer } from '../../src/exam';
import { esc, slugify, ORIGIN, type Page } from './layout';

export interface Inputs {
  districts: District[];
  /** Day the district list was taken from BDL (YYYY-MM-DD). */
  listDate: string;
  photos: Record<string, { src: string; width: number; height: number; author: string; license: string; licenseUrl?: string; page: string }>;
  exams: Bank[];
  today: string;
}

const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const ha = (x: number | null | undefined) => (x == null ? '–' : `${nf0.format(x)} ha`);
const cap = (s: string) => s.charAt(0).toLocaleUpperCase('pl') + s.slice(1);
const plural = (n: number, one: string, few: string, many: string) => {
  const t = n % 10;
  const h = n % 100;
  return n === 1 ? one : t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const VOIV_LOC: Record<string, string> = {
  dolnośląskie: 'dolnośląskim',
  'kujawsko-pomorskie': 'kujawsko-pomorskim',
  lubelskie: 'lubelskim',
  lubuskie: 'lubuskim',
  mazowieckie: 'mazowieckim',
  małopolskie: 'małopolskim',
  opolskie: 'opolskim',
  podkarpackie: 'podkarpackim',
  podlaskie: 'podlaskim',
  pomorskie: 'pomorskim',
  'warmińsko-mazurskie': 'warmińsko-mazurskim',
  wielkopolskie: 'wielkopolskim',
  zachodniopomorskie: 'zachodniopomorskim',
  łódzkie: 'łódzkim',
  śląskie: 'śląskim',
  świętokrzyskie: 'świętokrzyskim',
};
const inVoiv = (v: string) => `w województwie ${VOIV_LOC[v] ?? v}`;

const appLink = (hash: string, label: string, cls = 'btn btn-primary') => `<a class="${cls}" href="/app/${hash}">${esc(label)}</a>`;
const cta = (text: string, hash: string, label: string) =>
  `<aside class="page-cta"><p>${text}</p>${appLink(hash, label)}</aside>`;

// ---------------------------------------------------------------- hunting seasons

function seasonWhen(s: Season, voiv: string | null = null): string {
  const eff = effective(s, voiv);
  return s.note && !eff.ranges.length && !eff.allYear ? s.note.pl : formatRanges(eff.ranges, eff.allYear, 'pl');
}

function variantLines(s: Season): string {
  return (s.variants ?? [])
    .map((v) => {
      const where = v.voivodeships?.length
        ? `W województwach: ${v.voivodeships.join(', ')}`
        : v.condition
          ? cap(v.condition.pl)
          : '';
      return `<br><small>${esc(where)}: ${esc(v.allYear ? 'cały rok' : formatRanges(v.ranges, !!v.allYear, 'pl'))}</small>`;
    })
    .join('');
}

function speciesLinkFor(s: Season): string {
  const sp = SPECIES.find((x) => x.season && (s.name.pl === x.season || s.name.pl.startsWith(x.season + ' –')));
  return sp ? `<a href="/atlas-zwierzyny/${sp.slug}/">${esc(s.name.pl)}</a>` : esc(s.name.pl);
}

/** SEASONS rows open on at least one day of the month (the default dates, without regional variants). */
function openInMonth(m: number): Season[] {
  const days = new Date(Date.UTC(2025, m, 0)).getUTCDate();
  return SEASONS.filter((s) => {
    for (let d = 1; d <= days; d++) if (isOpen(s, new Date(2025, m - 1, d, 12), null)) return true;
    return false;
  });
}

/** The hunting year (1 April – 31 March) a day falls in, e.g. "2026/2027". */
export function huntingYear(day: string): string {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}/${start + 1}`;
}

function seasonsPage(today: string): Page {
  const groups = [...new Set(SEASONS.map((s) => s.group.pl))];
  const tables = groups
    .map((g) => {
      const rows = SEASONS.filter((s) => s.group.pl === g)
        .map((s) => `<tr><th scope="row">${speciesLinkFor(s)}</th><td>${esc(seasonWhen(s))}${variantLines(s)}</td></tr>`)
        .join('');
      return `<h2 id="${slugify(g)}">${esc(g)}</h2>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Zwierzyna</th><th scope="col">Okres polowania</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join('\n');
  const months = MONTHS.map((name, i) => {
    const open = openInMonth(i + 1);
    const names = [...new Set(open.map((s) => s.name.pl.split(' – ')[0]))];
    return `<li id="${slugify(name)}"><strong>${cap(name)}</strong><span>${names.length ? esc(names.join(', ')) : 'okres ochronny dla większości zwierzyny'}</span></li>`;
  }).join('');
  const faq = [
    {
      q: 'Skąd pochodzą terminy okresów polowań?',
      a: 'Z rozporządzenia Ministra Środowiska w sprawie określenia okresów polowań na zwierzęta łowne (tekst jednolity Dz.U. 2023 poz. 99). W kilku województwach zachodnich obowiązują inne terminy dla jelenia, daniela i gęsi.',
    },
    {
      q: 'Czy na dzika można polować przez cały rok?',
      a: `Tak, okres polowań na dziki to: ${seasonWhen(SEASONS.find((s) => s.name.pl.startsWith('Dzik'))!)}.`,
    },
  ];
  return {
    path: '/okresy-polowan/',
    title: `Okresy polowań ${huntingYear(today)} – tabela terminów dla zwierzyny łownej`,
    description:
      'Aktualne okresy polowań na zwierzynę łowną w Polsce: jeleń, sarna, daniel, dzik, lis, zając, kaczki, gęsi i inne. Terminy według Dz.U. 2023 poz. 99, z wyjątkami dla województw.',
    crumbs: [{ name: 'Okresy polowań', path: '/okresy-polowan/' }],
    priority: 0.9,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
    body: `<article class="prose">
<h1>Okresy polowań na zwierzynę łowną</h1>
<p class="lead">Terminy, w których wolno polować na poszczególne gatunki w Polsce, według rozporządzenia w sprawie okresów polowań (Dz.U. 2023 poz. 99). Gdzie przepisy przewidują inne daty dla części województw, podajemy je pod terminem ogólnym.</p>
${cta('W aplikacji widać, na co polowanie jest otwarte <b>dziś</b>, z terminami dla Twojego województwa.', '#/seasons', 'Na co dziś polujemy')}
${tables}
<h2 id="kalendarz">Kalendarz: na co można polować w danym miesiącu</h2>
<p>Gatunki, na które polowanie jest otwarte choćby przez część miesiąca (terminy ogólne, bez wyjątków regionalnych).</p>
<ul class="months">${months}</ul>
<h2>Najczęstsze pytania</h2>
${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
<p class="src">Źródło: <a href="https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html" rel="noopener">Dz.U. 2023 poz. 99 – okresy polowań na zwierzęta łowne</a>. Przed polowaniem sprawdź też uchwały i plany łowieckie swojego koła.</p>
</article>`,
  };
}

// ---------------------------------------------------------------- atlas

function atlasIndex(inp: Inputs): Page {
  const groups = Object.values(GROUPS)
    .map((g) => {
      const items = SPECIES.filter((sp) => sp.group.id === g.id);
      if (!items.length) return '';
      return `<h2>${esc(g.name.pl)}</h2><ul class="tiles">${items
        .map((sp) => {
          const c = sp.photos[0] && inp.photos[sp.photos[0].file];
          return `<li><a href="/atlas-zwierzyny/${sp.slug}/">${c ? `<img src="/app/${esc(c.src)}" width="${c.width}" height="${c.height}" alt="" loading="lazy">` : ''}<strong>${esc(sp.name.pl)}</strong><em>${esc(sp.latin)}</em></a></li>`;
        })
        .join('')}</ul>`;
    })
    .join('\n');
  return {
    path: '/atlas-zwierzyny/',
    title: 'Atlas zwierzyny łownej – rozpoznawanie, tropy, okresy polowań',
    description:
      'Atlas zwierzyny łownej w Polsce: jak rozpoznać płeć i wiek, tropy, ślady bytowania, gwara łowiecka i okresy polowań. Także gatunki chronione mylone ze zwierzyną.',
    crumbs: [{ name: 'Atlas zwierzyny', path: '/atlas-zwierzyny/' }],
    priority: 0.8,
    body: `<article class="prose">
<h1>Atlas zwierzyny łownej</h1>
<p class="lead">${SPECIES.length} gatunków: zwierzyna gruba, drapieżniki, zwierzyna drobna i ptactwo, a także gatunki chronione, z którymi łatwo je pomylić. Przy każdym: jak rozpoznać płeć i wiek, trop, ślady i okres polowań.</p>
${groups}
<p class="src">Zdjęcia pochodzą z Wikimedia Commons, na wolnych licencjach (autorzy przy każdym zdjęciu).</p>
</article>`,
  };
}

const ul = (xs: { pl: string }[]) => `<ul>${xs.map((x) => `<li>${x.pl}</li>`).join('')}</ul>`;
const strip = (s: string) => s.replace(/<[^>]+>/g, '');

function speciesPage(sp: Species, inp: Inputs): Page {
  const photos = sp.photos
    .map((p) => {
      const c = inp.photos[p.file];
      if (!c) return '';
      return `<figure><img src="/app/${esc(c.src)}" width="${c.width}" height="${c.height}" alt="${esc(p.caption.pl)}" loading="lazy">
<figcaption>${esc(p.caption.pl)} <small>Fot. <a href="${esc(c.page)}" rel="noopener">${esc(c.author)}</a>, ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" rel="noopener license">${esc(c.license)}</a>` : esc(c.license)}</small></figcaption></figure>`;
    })
    .join('');
  const seasons = seasonsFor(sp);
  const seasonBox = sp.protection
    ? `<h2>Ochrona</h2><p><strong>${sp.protection === 'partial' ? 'Gatunek pod ochroną częściową' : 'Gatunek pod ochroną ścisłą'}</strong>. Nie jest zwierzyną łowną, polowanie na niego jest zabronione.</p>${
        sp.lookalikes?.length
          ? `<p>Bywa mylony z: ${sp.lookalikes
              .map((s) => speciesBySlug(s))
              .filter((x): x is Species => !!x)
              .map((x) => `<a href="/atlas-zwierzyny/${x.slug}/">${esc(x.name.pl)}</a>`)
              .join(', ')}.</p>`
          : ''
      }`
    : seasons.length
      ? `<h2>Okres polowań</h2><div class="tbl-wrap"><table class="tbl"><tbody>${seasons
          .map((s) => {
            const part = s.name.pl.includes(' – ') ? s.name.pl.split(' – ').slice(1).join(' – ') : s.name.pl;
            return `<tr><th scope="row">${esc(cap(part))}</th><td>${esc(seasonWhen(s))}${variantLines(s)}</td></tr>`;
          })
          .join('')}</tbody></table></div><p><a href="/okresy-polowan/">Wszystkie okresy polowań</a></p>`
      : '';
  const prot = protectedLookalikes(sp);
  const firstPhoto = sp.photos[0] && inp.photos[sp.photos[0].file];
  const kind = sp.protection ? 'gatunek chroniony' : 'zwierzyna łowna';
  return {
    path: `/atlas-zwierzyny/${sp.slug}/`,
    title: `${sp.name.pl} (${sp.latin}) – rozpoznawanie, trop, okres polowań`,
    description: `${sp.name.pl}, ${kind}: ${strip(sp.terms.pl)} Jak rozpoznać płeć i wiek, trop, ślady${sp.protection ? '' : ' i okres polowań'}.`.slice(0, 300),
    crumbs: [
      { name: 'Atlas zwierzyny', path: '/atlas-zwierzyny/' },
      { name: sp.name.pl, path: `/atlas-zwierzyny/${sp.slug}/` },
    ],
    priority: 0.7,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${sp.name.pl} (${sp.latin})`,
        inLanguage: 'pl',
        about: { '@type': 'Taxon', name: sp.latin, alternateName: sp.name.pl, taxonRank: 'species' },
        ...(firstPhoto ? { image: `${ORIGIN}/app/${firstPhoto.src}` } : {}),
        publisher: { '@type': 'Organization', name: 'Polowanie', url: ORIGIN + '/' },
      },
    ],
    body: `<article class="prose species">
<h1>${esc(sp.name.pl)} <span class="latin">${esc(sp.latin)}</span></h1>
<p class="lead">${sp.terms.pl}</p>
${photos ? `<div class="photos">${photos}</div>` : ''}
<h2>Najważniejsze fakty</h2>
<dl class="facts">${sp.facts.map(([k, v]) => `<dt>${esc(k.pl)}</dt><dd>${v.pl}</dd>`).join('')}</dl>
${seasonBox}
${sp.identify?.length ? `<h2>Jak odróżnić</h2>${ul(sp.identify)}` : ''}
${prot.length ? `<h2>Gatunki chronione, z którymi łatwo pomylić</h2><p>${prot.map((x) => `<a href="/atlas-zwierzyny/${x.slug}/">${esc(x.name.pl)}</a>`).join(', ')}</p>` : ''}
<h2>Rozpoznawanie płci</h2>${ul(sp.sex)}
${sp.age?.length ? `<h2>Ocena wieku</h2>${ul(sp.age)}` : ''}
<h2>Trop</h2>
<figure class="track">${trackSvg(sp.track.print, `Trop: ${sp.name.pl}`)}</figure>
${ul(sp.track.text)}
<h2>Ślady bytowania</h2>${ul(sp.signs)}
${cta(`Pytania egzaminacyjne o tym gatunku i pełny atlas są w aplikacji.`, `#/atlas/${sp.slug}`, 'Otwórz w aplikacji')}
<h2>Źródła</h2>
<ul class="src">${sp.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
</article>`,
  };
}

// ---------------------------------------------------------------- exams

const answerText = (a: Answer) => (typeof a === 'string' ? a : a.text ?? '');
const hasImage = (q: Question) => !!q.image || q.answers.some((a) => typeof a !== 'string' && !!a.image);
const correctSet = (q: Question) => new Set(Array.isArray(q.correct) ? q.correct : [q.correct]);

/** A fixed sample of questions (the same on every build while the bank does not change). */
function sample(bank: Bank, n: number, topic?: string): Question[] {
  const pool = bank.questions.filter((q) => !hasImage(q) && (!topic || q.topic === topic)).sort((a, b) => a.id.localeCompare(b.id));
  const step = Math.max(1, Math.floor(pool.length / n));
  return pool.filter((_, i) => i % step === 0).slice(0, n);
}

function questionList(qs: Question[]): string {
  return `<ol class="quiz">${qs
    .map((q) => {
      const ok = correctSet(q);
      return `<li><p>${esc(q.q.replace(/\s+/g, ' ').trim())}</p><ul>${q.answers
        .map((a, i) => `<li${ok.has(i) ? ' class="ok"' : ''}>${esc(answerText(a))}${ok.has(i) ? ' <span class="ok-tag">poprawna</span>' : ''}</li>`)
        .join('')}</ul></li>`;
    })
    .join('')}</ol>`;
}

function examPage(bank: Bank): Page {
  const hunter = bank.id === 'mysliwy';
  const path = hunter ? '/egzamin-na-mysliwego/' : '/egzamin-selekcjonerski/';
  const name = hunter ? 'Egzamin na myśliwego' : 'Egzamin selekcjonerski';
  const n = bank.questions.length;
  const qs = hunter ? [...sample(bank, 6, 'Bezpieczeństwo'), ...sample(bank, 9, 'Wiedza ogólna')] : sample(bank, 12);
  const format = hunter
    ? `<ul>
<li><strong>${bank.count} pytań</strong> testowych: najpierw ${bank.sections?.[0]?.count ?? 30} z bezpieczeństwa, potem ${bank.sections?.[1]?.count ?? 70} z wiedzy ogólnej.</li>
<li>Aby zdać, trzeba odpowiedzieć poprawnie na co najmniej <strong>${bank.passPct}%</strong> wszystkich pytań i co najmniej ${bank.sections?.[0]?.minPct ?? 80}% pytań z bezpieczeństwa.</li>
<li>Na test jest <strong>${bank.minutes} minut</strong>.</li>
<li>Po teście jest część praktyczna na strzelnicy.</li>
</ul>`
    : `<ul>
<li><strong>${bank.count} pytań</strong> testowych o biologii, ocenie wieku i odstrzale selekcyjnym zwierzyny grubej.</li>
<li>Próg zdawalności w aplikacji: <strong>${bank.passPct}%</strong>, czas: <strong>${bank.minutes} minut</strong>.</li>
<li>Do egzaminu może przystąpić myśliwy z co najmniej 3-letnim stażem w posiadaniu uprawnień podstawowych.</li>
</ul>`;
  return {
    path,
    title: hunter ? `Egzamin na myśliwego – ${n} pytań testowych z odpowiedziami` : `Egzamin selekcjonerski – ${n} pytań testowych z odpowiedziami`,
    description: hunter
      ? `Przygotuj się do egzaminu na myśliwego: ${n} pytań z bazy PZŁ, test próbny 100 pytań, tryb nauki i powtórki błędów. Za darmo, bez zakładania konta.`
      : `Pytania na egzamin selekcjonerski: ${n} pytań z bazy PZŁ, test próbny 50 pytań i tryb nauki. Za darmo, bez zakładania konta.`,
    crumbs: [{ name, path }],
    priority: 0.9,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Quiz',
        name: `${name} – test próbny`,
        inLanguage: 'pl',
        educationalLevel: hunter ? 'uprawnienia podstawowe' : 'uprawnienia selekcjonerskie',
        about: { '@type': 'Thing', name },
        url: ORIGIN + path,
      },
    ],
    body: `<article class="prose">
<h1>${esc(name)}: pytania i test próbny</h1>
<p class="lead">${esc(n)} pytań z bazy Polskiego Związku Łowieckiego („Sprawdź wiedzę”) z poprawnymi odpowiedziami. W aplikacji rozwiążesz pełny test na czas, uczysz się po kolei, a pytania, z którymi masz kłopot, wracają częściej.</p>
${cta('Test próbny, nauka i powtórka błędów. Za darmo, bez konta, postęp zostaje w telefonie.', '#/exams', 'Rozwiąż test próbny')}
<h2>Jak wygląda egzamin</h2>
${format}
<h2>Przykładowe pytania z odpowiedziami</h2>
<p>Kilka pytań z bazy, w której jest ich ${esc(n)}. Poprawna odpowiedź jest zaznaczona.</p>
${questionList(qs)}
<p>${appLink('#/exams', 'Pozostałe pytania w aplikacji', 'btn btn-ghost')}</p>
<h2>Jak się przygotować</h2>
<ul>
<li>Zacznij od trybu nauki, a potem rozwiązuj pełne testy na czas.</li>
<li>Pytania o zwierzynę powtarzaj razem z <a href="/atlas-zwierzyny/">atlasem zwierzyny</a>: płeć, wiek, tropy.</li>
<li>Terminy polowań sprawdzaj w <a href="/okresy-polowan/">tabeli okresów polowań</a>.</li>
${hunter ? '<li>Gdy zdasz, przyda się <a href="/egzamin-selekcjonerski/">egzamin selekcjonerski</a>.</li>' : '<li>Podstawy powtórzysz w <a href="/egzamin-na-mysliwego/">pytaniach na egzamin na myśliwego</a>.</li>'}
</ul>
<p class="src">Pytania: ${bank.origin?.url ? `<a href="${esc(bank.origin.url)}" rel="noopener">${esc(bank.origin.name)}</a>` : esc(bank.origin?.name ?? 'PZŁ')}, wykorzystane za zgodą PZŁ. Egzamin państwowy przeprowadza komisja PZŁ; ta strona służy do nauki.</p>
</article>`,
  };
}

// ---------------------------------------------------------------- districts and clubs

interface Voiv {
  name: string;
  slug: string;
  districts: District[];
}

const voivName = (d: District) => d.county_name ?? 'inne';

function holderLabel(t: ReturnType<typeof holderType>): string {
  return t === 'club' ? 'dzierżawa (koło łowieckie)' : t === 'pzl' ? 'w zarządzie PZŁ' : t === 'pgl' ? 'w zarządzie Lasów Państwowych' : t === 'other' ? 'w zarządzie innym' : 'brak danych';
}

export function dataPages(inp: Inputs): Page[] {
  const pages: Page[] = [];
  const date = inp.listDate;
  const byVoiv = new Map<string, Voiv>();
  for (const d of inp.districts) {
    const n = voivName(d);
    let v = byVoiv.get(n);
    if (!v) byVoiv.set(n, (v = { name: n, slug: slugify(n), districts: [] }));
    v.districts.push(d);
  }
  const voivs = [...byVoiv.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const num = (d: District) => parseInt(String(d.hunt_dist_nr ?? ''), 10) || 0;
  for (const v of voivs) v.districts.sort((a, b) => num(a) - num(b) || a.objectid - b.objectid);

  // Stable addresses: /obwody-lowieckie/<voivodeship>/<number>/, /kolo-lowieckie/<name>/.
  const dPath = new Map<number, string>();
  for (const v of voivs) {
    const seen = new Set<string>();
    for (const d of v.districts) {
      let s = slugify(String(d.hunt_dist_nr ?? '')) || `id${d.objectid}`;
      if (seen.has(s)) s = `${s}-${d.objectid}`;
      seen.add(s);
      dPath.set(d.objectid, `/obwody-lowieckie/${v.slug}/${s}/`);
    }
  }
  const clubs = groupClubs(inp.districts);
  const cPath = new Map<string, string>();
  const taken = new Set<string>();
  for (const c of [...clubs].sort((a, b) => a.key.localeCompare(b.key))) {
    let s = slugify(c.name) || 'kolo';
    if (taken.has(s)) {
      let i = 2;
      while (taken.has(`${s}-${i}`)) i++;
      s = `${s}-${i}`;
    }
    taken.add(s);
    cPath.set(c.key, `/kolo-lowieckie/${s}/`);
  }
  const clubOf = (d: District) => (d.lease_holder_name ? cPath.get(clubKey(d.lease_holder_name)) : undefined);
  const holderLink = (d: District) => {
    const p = clubOf(d);
    return d.lease_holder_name ? (p ? `<a href="${p}">${esc(d.lease_holder_name)}</a>` : esc(d.lease_holder_name)) : '–';
  };
  const totalArea = inp.districts.reduce((s, d) => s + (d.total_area ?? 0), 0);
  const srcNote = `<p class="src">Dane: <a href="https://www.bdl.lasy.gov.pl/portal/" rel="noopener">Bank Danych o Lasach</a> (stan z ${esc(date)}). Granice obwodów zobaczysz na mapie w aplikacji.</p>`;

  // Index of voivodeships.
  pages.push({
    path: '/obwody-lowieckie/',
    title: 'Obwody łowieckie i koła łowieckie w Polsce – mapa i wykaz',
    description: `Wykaz ${inp.districts.length} obwodów łowieckich w Polsce według województw: numer, dzierżawca (koło łowieckie), nadleśnictwo, powierzchnia. Granice obwodów na mapie, także offline.`,
    crumbs: [{ name: 'Obwody łowieckie', path: '/obwody-lowieckie/' }],
    priority: 0.9,
    lastmod: date,
    body: `<article class="prose">
<h1>Obwody łowieckie w Polsce</h1>
<p class="lead">${nf0.format(inp.districts.length)} obwodów łowieckich o łącznej powierzchni ${ha(totalArea)} i ${nf0.format(clubs.length)} dzierżawców, głównie kół łowieckich. Wybierz województwo, aby zobaczyć listę obwodów, albo otwórz mapę z granicami.</p>
${cta('Granice obwodów, oddziały leśne i ortofotomapa na jednej mapie. Zapisz obszar i korzystaj w lesie bez zasięgu.', '', 'Otwórz mapę obwodów')}
<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Województwo</th><th scope="col">Obwody</th><th scope="col">Koła i dzierżawcy</th><th scope="col">Powierzchnia</th></tr></thead><tbody>
${voivs
  .map((v) => {
    const holders = new Set(v.districts.filter((d) => d.lease_holder_name).map((d) => clubKey(d.lease_holder_name!)));
    return `<tr><th scope="row"><a href="/obwody-lowieckie/${v.slug}/">${esc(v.name)}</a></th><td>${v.districts.length}</td><td><a href="/kola-lowieckie/${v.slug}/">${holders.size}</a></td><td>${ha(v.districts.reduce((s, d) => s + (d.total_area ?? 0), 0))}</td></tr>`;
  })
  .join('\n')}
</tbody></table></div>
${srcNote}
</article>`,
  });

  pages.push({
    path: '/kola-lowieckie/',
    title: 'Koła łowieckie w Polsce – wykaz według województw',
    description: `Wykaz ${nf0.format(clubs.length)} kół łowieckich i innych dzierżawców obwodów łowieckich w Polsce, według województw: dzierżawione obwody, powierzchnia, nadleśnictwa.`,
    crumbs: [{ name: 'Koła łowieckie', path: '/kola-lowieckie/' }],
    priority: 0.8,
    lastmod: date,
    body: `<article class="prose">
<h1>Koła łowieckie w Polsce</h1>
<p class="lead">Koła łowieckie i inni dzierżawcy obwodów łowieckich, według województw. Przy każdym kole: obwody, które dzierżawi, ich powierzchnia, nadleśnictwa i zarząd okręgowy PZŁ.</p>
<ul class="cols">${voivs.map((v) => `<li><a href="/kola-lowieckie/${v.slug}/">Koła łowieckie ${esc(inVoiv(v.name))}</a></li>`).join('')}</ul>
${srcNote}
</article>`,
  });

  for (const v of voivs) {
    const loc = inVoiv(v.name);
    pages.push({
      path: `/obwody-lowieckie/${v.slug}/`,
      title: `Obwody łowieckie – województwo ${v.name}: wykaz i mapa`,
      description: `${v.districts.length} obwodów łowieckich ${loc}: numer obwodu, koło łowieckie, nadleśnictwo, powiat i powierzchnia. Granice na mapie w aplikacji Polowanie.`,
      crumbs: [
        { name: 'Obwody łowieckie', path: '/obwody-lowieckie/' },
        { name: `Województwo ${v.name}`, path: `/obwody-lowieckie/${v.slug}/` },
      ],
      priority: 0.7,
      lastmod: date,
      body: `<article class="prose wide">
<h1>Obwody łowieckie ${esc(loc)}</h1>
<p class="lead">${v.districts.length} ${plural(v.districts.length, 'obwód', 'obwody', 'obwodów')}, razem ${ha(v.districts.reduce((s, d) => s + (d.total_area ?? 0), 0))}. Numery obwodów są nadawane w obrębie województwa. <a href="/kola-lowieckie/${v.slug}/">Koła łowieckie ${esc(loc)}</a>.</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Nr</th><th scope="col">Dzierżawca</th><th scope="col">Nadleśnictwo</th><th scope="col">Powiat</th><th scope="col">Powierzchnia</th></tr></thead><tbody>
${v.districts
  .map((d) => `<tr><th scope="row"><a href="${dPath.get(d.objectid)}">${esc(d.hunt_dist_nr ?? '–')}</a></th><td>${holderLink(d)}</td><td>${esc(d.inspectorate_name ?? '–')}</td><td>${esc(d.district_name ?? '–')}</td><td>${ha(d.total_area)}</td></tr>`)
  .join('\n')}
</tbody></table></div>
${srcNote}
</article>`,
    });

    const vClubs = clubs.filter((c) => c.districts.some((d) => voivName(d) === v.name));
    pages.push({
      path: `/kola-lowieckie/${v.slug}/`,
      title: `Koła łowieckie – województwo ${v.name}: wykaz i obwody`,
      description: `${vClubs.length} kół łowieckich i dzierżawców ${loc}: dzierżawione obwody łowieckie, powierzchnia i nadleśnictwa.`,
      crumbs: [
        { name: 'Koła łowieckie', path: '/kola-lowieckie/' },
        { name: `Województwo ${v.name}`, path: `/kola-lowieckie/${v.slug}/` },
      ],
      priority: 0.7,
      lastmod: date,
      body: `<article class="prose">
<h1>Koła łowieckie ${esc(loc)}</h1>
<p class="lead">${vClubs.length} ${plural(vClubs.length, 'dzierżawca', 'dzierżawców', 'dzierżawców')} obwodów łowieckich ${esc(loc)}. <a href="/obwody-lowieckie/${v.slug}/">Wszystkie obwody ${esc(loc)}</a>.</p>
<ul class="clubs">${vClubs
        .map((c) => {
          const nrs = c.districts.filter((d) => voivName(d) === v.name).map((d) => d.hunt_dist_nr);
          return `<li><a href="${cPath.get(c.key)}">${esc(c.name)}</a> <span>${plural(nrs.length, 'obwód', 'obwody', 'obwody')} ${esc(nrs.join(', '))}</span></li>`;
        })
        .join('')}</ul>
${srcNote}
</article>`,
    });
  }

  for (const c of clubs) pages.push(clubPage(c, cPath.get(c.key)!, dPath, date, srcNote, voivs));

  // Districts in the same forest district, for links between neighbours.
  const byForest = new Map<string, District[]>();
  for (const d of inp.districts) {
    const k = `${d.inspectorate_name}|${voivName(d)}`;
    const arr = byForest.get(k);
    if (arr) arr.push(d);
    else byForest.set(k, [d]);
  }
  for (const v of voivs)
    for (const d of v.districts) {
      const near = (byForest.get(`${d.inspectorate_name}|${voivName(d)}`) ?? [])
        .filter((x) => x !== d)
        .sort((a, b) => num(a) - num(b))
        .slice(0, 12);
      pages.push(districtPage(d, v, dPath.get(d.objectid)!, holderLink(d), near, dPath, date, srcNote));
    }
  return pages;
}

function clubPage(c: Club, path: string, dPath: Map<number, string>, date: string, srcNote: string, voivs: Voiv[]): Page {
  const isClub = c.type === 'club';
  const adr = c.districts.find((d) => d.lease_holder_adr)?.lease_holder_adr;
  const first = voivs.find((v) => v.name === voivName(c.districts[0]))!;
  const nrs = c.districts.map((d) => `nr ${d.hunt_dist_nr}`).join(', ');
  return {
    path,
    title: `${c.name} – ${isClub ? 'koło łowieckie, ' : ''}obwody łowieckie i mapa`,
    description: `${c.name}${isClub ? ', koło łowieckie' : ''}: ${c.districts.length === 1 ? 'obwód łowiecki' : 'obwody łowieckie'} ${nrs} (${c.voivodeships.join(', ')}), razem ${ha(c.totalArea)}. ${c.forestDistricts.length === 1 ? 'Nadleśnictwo' : 'Nadleśnictwa'}: ${c.forestDistricts.join(', ')}.`.slice(0, 300),
    crumbs: [
      { name: 'Koła łowieckie', path: '/kola-lowieckie/' },
      { name: `Województwo ${first.name}`, path: `/kola-lowieckie/${first.slug}/` },
      { name: c.name, path },
    ],
    priority: 0.5,
    lastmod: date,
    ld: isClub
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'SportsOrganization',
            name: c.name,
            sport: 'Łowiectwo',
            url: ORIGIN + path,
            ...(adr ? { address: { '@type': 'PostalAddress', streetAddress: adr, addressCountry: 'PL' } } : {}),
            ...(c.pzlBoards.length ? { memberOf: { '@type': 'Organization', name: `Polski Związek Łowiecki, ${c.pzlBoards[0]}` } } : {}),
          },
        ]
      : [],
    body: `<article class="prose">
<h1>${esc(c.name)}</h1>
<p class="lead">${c.districts.length === 1 ? (isClub ? 'Dzierżawiony obwód łowiecki' : 'Obwód łowiecki w zarządzie') : isClub ? 'Dzierżawione obwody łowieckie' : 'Obwody łowieckie w zarządzie'}: nr ${esc(c.districts.map((d) => d.hunt_dist_nr).join(', '))} (województwo ${esc(c.voivodeships.join(', '))}). Łączna powierzchnia ${ha(c.totalArea)}, w tym ${ha(c.forestArea)} lasów.</p>
${cta('Granice obwodów koła na mapie, do zapisania w telefonie i użycia bez zasięgu.', `#/kolo/${encodeURIComponent(c.key)}`, 'Pokaż na mapie')}
<dl class="facts">
<dt>Status</dt><dd>${esc(holderLabel(c.type))}</dd>
${adr ? `<dt>Adres</dt><dd>${esc(adr)}</dd>` : ''}
<dt>Zarząd okręgowy PZŁ</dt><dd>${esc(c.pzlBoards.join(', ') || '–')}</dd>
<dt>Nadleśnictwa</dt><dd>${esc(c.forestDistricts.join(', ') || '–')}</dd>
<dt>Powiaty</dt><dd>${esc(c.powiats.join(', ') || '–')}</dd>
</dl>
<h2>Obwody łowieckie</h2>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Nr</th><th scope="col">Województwo</th><th scope="col">Nadleśnictwo</th><th scope="col">Powierzchnia</th><th scope="col">Lasy</th></tr></thead><tbody>
${c.districts
  .map((d) => `<tr><th scope="row"><a href="${dPath.get(d.objectid)}">${esc(d.hunt_dist_nr)}</a></th><td>${esc(voivName(d))}</td><td>${esc(d.inspectorate_name ?? '–')}</td><td>${ha(d.total_area)}</td><td>${ha(d.forest_area)}</td></tr>`)
  .join('\n')}
</tbody></table></div>
${srcNote}
</article>`,
  };
}

function districtPage(d: District, v: Voiv, path: string, holder: string, near: District[], dPath: Map<number, string>, date: string, srcNote: string): Page {
  const nr = d.hunt_dist_nr ?? '–';
  const forestPct = d.total_area && d.forest_area != null ? ` (${Math.round((d.forest_area / d.total_area) * 100)}%)` : '';
  return {
    path,
    title: `Obwód łowiecki nr ${nr} (${v.name}) – ${d.lease_holder_name ?? 'mapa'}`.slice(0, 90),
    description: `Obwód łowiecki nr ${nr} ${inVoiv(v.name)}, powiat ${d.district_name ?? '–'}, nadleśnictwo ${d.inspectorate_name ?? '–'}. Dzierżawca: ${d.lease_holder_name ?? 'brak danych'}. Powierzchnia ${ha(d.total_area)}, granice na mapie.`,
    crumbs: [
      { name: 'Obwody łowieckie', path: '/obwody-lowieckie/' },
      { name: `Województwo ${v.name}`, path: `/obwody-lowieckie/${v.slug}/` },
      { name: `Nr ${nr}`, path },
    ],
    priority: 0.4,
    lastmod: date,
    body: `<article class="prose">
<h1>Obwód łowiecki nr ${esc(nr)} <span class="latin">woj. ${esc(v.name)}</span></h1>
<p class="lead">${d.lease_holder_name ? `Obwód ${holderType(d.lease_group_name) === 'club' ? 'dzierżawi' : 'zarządza nim'} ${holder}. ` : ''}Leży na terenie nadleśnictwa ${esc(d.inspectorate_name ?? '–')} (powiat ${esc(d.district_name ?? '–')}), ma ${ha(d.total_area)} powierzchni.</p>
${cta('Granice obwodu, oddziały leśne, wiatr i ortofotomapa. Zapisz obwód w telefonie na wyjazd bez zasięgu.', `#/obwod/${districtSlug(d)}`, 'Pokaż granice na mapie')}
<dl class="facts">
<dt>Numer obwodu</dt><dd>${esc(nr)}</dd>
<dt>Województwo</dt><dd><a href="/obwody-lowieckie/${v.slug}/">${esc(v.name)}</a></dd>
<dt>Powiat</dt><dd>${esc(d.district_name ?? '–')}</dd>
<dt>Dzierżawca lub zarządca</dt><dd>${holder}</dd>
<dt>Status</dt><dd>${esc(holderLabel(holderType(d.lease_group_name)))}</dd>
<dt>Powierzchnia</dt><dd>${ha(d.total_area)}${d.after_exclusion_area != null ? `, po wyłączeniach ${ha(d.after_exclusion_area)}` : ''}</dd>
<dt>Lasy</dt><dd>${ha(d.forest_area)}${forestPct}</dd>
<dt>Nadleśnictwo</dt><dd>${esc(d.inspectorate_name ?? '–')}${d.inspectorate_adr ? `<br><small>${esc(d.inspectorate_adr)}</small>` : ''}</dd>
<dt>RDLP</dt><dd>${esc(d.region_name ?? '–')}</dd>
<dt>Zarząd okręgowy PZŁ</dt><dd>${esc(d.reg_mng_board_name ?? '–')}${d.reg_mng_board_adr ? `<br><small>${esc(d.reg_mng_board_adr)}</small>` : ''}</dd>
${d.a_year ? `<dt>Rok łowiecki danych</dt><dd>${esc(d.a_year)}</dd>` : ''}
</dl>
${
  near.length
    ? `<h2>Inne obwody w nadleśnictwie ${esc(d.inspectorate_name ?? '')}</h2><ul class="cols">${near
        .map((x) => `<li><a href="${dPath.get(x.objectid)}">Obwód nr ${esc(x.hunt_dist_nr)}</a> <span>${esc(x.lease_holder_name ?? '')}</span></li>`)
        .join('')}</ul>`
    : ''
}
${srcNote}
</article>`,
  };
}

export function contentPages(inp: Inputs): Page[] {
  return [
    seasonsPage(inp.today),
    atlasIndex(inp),
    ...SPECIES.map((sp) => speciesPage(sp, inp)),
    ...inp.exams.map(examPage),
  ];
}

export function notFoundPage(): Page {
  return {
    path: '/404.html',
    title: 'Nie ma takiej strony – Polowanie',
    description: 'Ta strona nie istnieje.',
    noindex: true,
    body: `<article class="prose">
<h1>Nie ma takiej strony</h1>
<p class="lead">Adres mógł się zmienić. Spróbuj jednej z tych stron:</p>
<ul>
<li><a href="/app/">Aplikacja: mapa obwodów i polowania zbiorowe</a></li>
<li><a href="/obwody-lowieckie/">Obwody łowieckie</a> i <a href="/kola-lowieckie/">koła łowieckie</a></li>
<li><a href="/okresy-polowan/">Okresy polowań</a></li>
<li><a href="/atlas-zwierzyny/">Atlas zwierzyny</a></li>
<li><a href="/egzamin-na-mysliwego/">Egzamin na myśliwego</a></li>
</ul>
</article>`,
  };
}

