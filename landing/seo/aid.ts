/**
 * "Pierwsza pomoc na polowaniu": the app's first-aid cards (src/aid.ts) as plain pages, one for
 * the list and one per card, so the steps can be read and found without the app.
 *
 * While the content is a draft (no review date in REVIEW, src/aid.ts), the pages say "Wersja
 * robocza" and ask search engines not to list them, so they stay out of the sitemap.
 */
import { CARDS, FIRST, KIT, SOURCES, reviewLine, type AidCard, type AidSource, type AidStep } from '../../src/aid';
import { aidArt } from '../../src/aidArt';
import { esc, type Page } from './layout';

export const AID_PATH = '/pierwsza-pomoc/';
const cardPath = (c: AidCard) => `${AID_PATH}${c.slug}/`;
const review = reviewLine();
const draft = !review;

const appLink = (hash: string, label: string) => `<a class="btn btn-primary" href="/app/${hash}">${esc(label)}</a>`;

function reviewNote(): string {
  return draft
    ? `<p class="aid-draft"><strong>Wersja robocza.</strong> Instrukcje czekają na sprawdzenie przez lekarza lub ratownika medycznego. Opierają się na wytycznych Europejskiej Rady Resuscytacji 2025.</p>`
    : `<p class="src">${esc(review)}</p>`;
}

const DISCLAIMER = `<p class="aid-disc">Instrukcje pomagają udzielić pierwszej pomocy do czasu przyjazdu ratowników. Nie zastępują kursu pierwszej pomocy ani porady lekarza. Zawsze najpierw dzwoń <a href="tel:112">112</a> i wykonuj polecenia dyspozytora.</p>`;

function sources(src: AidSource[]): string {
  return `<p class="src">Źródło: ${src.map((s) => `<a href="${esc(SOURCES[s].url)}" rel="noopener">${esc(SOURCES[s].label)}</a>`).join('; ')}.</p>`;
}

function firstList(): string {
  return `<ol class="aid-first">${FIRST.map((s) => `<li><strong>${esc(s.t)}.</strong>${s.d ? ` ${esc(s.d)}` : ''}</li>`).join('')}</ol>`;
}

/** The step's text may name a button of the app; say where it is. */
const TOOL: Record<NonNullable<AidStep['tool']>, string> = {
  tq: 'W aplikacji: przycisk zapisuje godzinę założenia opaski i pokazuje, ile minęło.',
  time: 'W aplikacji: przycisk zapisuje godzinę.',
  cpr: 'W aplikacji: metronom podaje rytm uciśnięć (100–120 na minutę).',
};

/** The steps, with each question's answers pointing at a step number or another card. */
function stepList(steps: AidStep[]): string {
  const target = (go: string) => {
    if (go.startsWith('card:')) {
      const c = CARDS.find((x) => x.slug === go.slice(5));
      return c ? `<a href="${cardPath(c)}">${esc(c.title)}</a>` : '';
    }
    const j = steps.findIndex((s) => s.id === go);
    return j >= 0 ? `krok ${j + 1}` : '';
  };
  return `<ol class="aid-steps">${steps
    .map(
      (s) => `<li>${aidArt(s.art)}<div><strong>${esc(s.ask ? s.ask.q : s.t)}</strong>${s.d ? `<p>${esc(s.d)}</p>` : ''}${
        s.ask ? `<p class="aid-go"><b>Tak</b> → ${target(s.ask.yes)} · <b>Nie</b> → ${target(s.ask.no)}</p>` : ''
      }${s.tool ? `<p class="aid-go">${TOOL[s.tool]}</p>` : ''}${s.last ? '<p class="aid-go">Koniec tej ścieżki.</p>' : ''}</div></li>`,
    )
    .join('')}</ol>`;
}

function hubPage(): Page {
  const tiles = CARDS.map((c) => `<li><a href="${cardPath(c)}">${aidArt(c.art)}<strong>${esc(c.title)}</strong></a></li>`).join('');
  return {
    path: AID_PATH,
    title: 'Pierwsza pomoc na polowaniu – co robić krok po kroku',
    description:
      'Postrzał, silny krwotok, złamanie, wychłodzenie, upadek z ambony: co robić krok po kroku do przyjazdu karetki. Instrukcje z wytycznych ERC 2025, także w aplikacji bez internetu.',
    crumbs: [{ name: 'Pierwsza pomoc', path: AID_PATH }],
    priority: 0.6,
    noindex: draft,
    body: `<article class="prose">
<h1>Pierwsza pomoc na polowaniu</h1>
<p class="lead">Co robić krok po kroku przy wypadku w łowisku, do przyjazdu ratowników. Te same instrukcje są w aplikacji Polowanie i działają bez zasięgu.</p>
${reviewNote()}
<section class="aid-box">
<h2>Najpierw, przy każdym wypadku</h2>
${firstList()}
</section>
<aside class="page-cta"><p>Ekran „Wypadek” w aplikacji: przycisk 112, Twoje współrzędne do przeczytania dyspozytorowi, najbliższy adres leśny i alarm do prowadzącego polowania zbiorowego.</p>${appLink('#/wypadek', 'Otwórz ekran Wypadek')}</aside>
<h2>Instrukcje</h2>
<ul class="aid-tiles">${tiles}</ul>
<h2>${esc(KIT.h)}</h2>
<ul>${KIT.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
${DISCLAIMER}
${sources(['ercFa', 'ercBls', 'ercSc', 'prr'])}
</article>`,
  };
}

function cardPage(c: AidCard): Page {
  const path = cardPath(c);
  const extra = (c.extra ?? []).map((x) => `<section class="aid-box"><h2>${esc(x.h)}</h2><ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
  const others = CARDS.filter((x) => x !== c);
  return {
    path,
    title: `${c.title}: pierwsza pomoc na polowaniu`,
    description: `Pierwsza pomoc krok po kroku: ${c.title.toLocaleLowerCase('pl')}. Jak rozpoznać, co robić do przyjazdu karetki i czego nie robić. Wg wytycznych ERC 2025.`.slice(0, 300),
    crumbs: [
      { name: 'Pierwsza pomoc', path: AID_PATH },
      { name: c.title, path },
    ],
    priority: 0.5,
    noindex: draft,
    body: `<article class="prose">
<div class="aid-head">${aidArt(c.art)}<h1>${esc(c.title)}</h1></div>
${reviewNote()}
<section class="aid-box"><h2>Jak rozpoznać</h2><ul>${c.when.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></section>
<section class="aid-box aid-call"><h2>Najpierw</h2>${firstList()}</section>
<h2>Co robić krok po kroku</h2>
${stepList(c.steps)}
${extra}
<section class="aid-box aid-dont"><h2>Czego nie robić</h2><ul>${c.dont.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>
<aside class="page-cta"><p>W aplikacji ta instrukcja prowadzi krok po kroku, czyta kroki na głos, liczy czas od założenia opaski i podaje rytm uciśnięć. Działa bez internetu.</p>${appLink(`#/wypadek/${c.slug}`, 'Otwórz w aplikacji')}</aside>
${DISCLAIMER}
${sources(c.src)}
<h2>Inne instrukcje</h2>
<ul class="cols">${others.map((x) => `<li><a href="${cardPath(x)}">${esc(x.title)}</a></li>`).join('')}</ul>
</article>`,
  };
}

export function aidPages(): Page[] {
  return [hubPage(), ...CARDS.map(cardPage)];
}
