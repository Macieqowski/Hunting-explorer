/**
 * The shell shared by the welcome page's subpages (okresy polowań, atlas, egzaminy, obwody i koła):
 * head with title, description, canonical address, Open Graph and structured data, then the
 * same header and footer as the welcome page.
 */
export const ORIGIN = 'https://www.polowanie.org';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Lower-case ASCII slug: "Koło Łowieckie Ryś" → "kolo-lowieckie-rys". */
export function slugify(s: string): string {
  return s
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Crumb {
  name: string;
  path: string;
}

export interface Page {
  /** Site path with a trailing slash, e.g. /okresy-polowan/. */
  path: string;
  title: string;
  description: string;
  body: string;
  crumbs?: Crumb[];
  /** Extra JSON-LD objects. */
  ld?: object[];
  /** Data pages refresh with the weekly district list. */
  lastmod?: string;
  priority?: number;
  noindex?: boolean;
}

export interface Shell {
  css: string[];
  analytics: string;
}

const MARK = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path class="bm-pin" d="M16 2c6.1 0 11 4.7 11 10.6 0 7.4-8.3 15.1-11 17.4-2.7-2.3-11-10-11-17.4C5 6.7 9.9 2 16 2Z" /><path class="bm-tree" d="M16 6l-5 7h2.6l-3.6 5h5v3h2v-3h5l-3.6-5H21z" /></svg>`;
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%231e5a3a' d='M16 2c6.1 0 11 4.7 11 10.6 0 7.4-8.3 15.1-11 17.4-2.7-2.3-11-10-11-17.4C5 6.7 9.9 2 16 2Z'/%3E%3Cpath fill='%23fff' d='M16 6l-5 7h2.6l-3.6 5h5v3h2v-3h5l-3.6-5H21z'/%3E%3C/svg%3E";

export const NAV: Crumb[] = [
  { name: 'Obwody i koła', path: '/obwody-lowieckie/' },
  { name: 'Okresy polowań', path: '/okresy-polowan/' },
  { name: 'Atlas zwierzyny', path: '/atlas-zwierzyny/' },
  { name: 'Egzamin', path: '/egzamin-na-mysliwego/' },
];

const THEME = `<script>(function(){var d=false;try{var p=localStorage.getItem('theme');d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){}document.documentElement.setAttribute('data-theme',d?'dark':'light');if(d)document.querySelector('meta[name="theme-color"]').setAttribute('content','#101412');})();</script>`;

const json = (o: object) => JSON.stringify(o).replace(/</g, '\\u003c');

export function render(p: Page, shell: Shell): string {
  const url = ORIGIN + p.path;
  const crumbs = p.crumbs ?? [];
  const all = [{ name: 'Polowanie', path: '/' }, ...crumbs];
  const ld = [
    ...(crumbs.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: ORIGIN + c.path })),
          },
        ]
      : []),
    ...(p.ld ?? []),
  ];
  const navHere = (path: string) => (p.path.startsWith(path) || (path === '/obwody-lowieckie/' && /^\/kol[ao]-lowieckie\//.test(p.path)) ? ' aria-current="page"' : '');
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}" />
${p.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${esc(url)}" />`}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Polowanie" />
<meta property="og:locale" content="pl_PL" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${ORIGIN}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="${FAVICON}" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#f3f2ec" />
${THEME}
${shell.css.map((h) => `<link rel="stylesheet" href="${esc(h)}" />`).join('\n')}
${ld.map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
${shell.analytics}
</head>
<body>
<a class="skip" href="#tresc">Przejdź do treści</a>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="Polowanie, strona główna">${MARK}<span>Polowanie</span></a>
    <a class="btn btn-primary btn-s" href="/app/">Otwórz aplikację</a>
  </div>
  <nav class="wrap sub-nav" aria-label="Działy">${NAV.map((n) => `<a href="${n.path}"${navHere(n.path)}>${esc(n.name)}</a>`).join('')}</nav>
</header>
<main id="tresc" class="wrap page">
${
  crumbs.length
    ? `<nav class="crumbs" aria-label="Okruszki"><ol>${all
        .map((c, i) => (i === all.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.path}">${esc(c.name)}</a></li>`))
        .join('')}</ol></nav>`
    : ''
}
${p.body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div>
      <span class="foot-name">Polowanie</span>
      <p>Dane o obwodach łowieckich: Bank Danych o Lasach.</p>
    </div>
    <nav aria-label="Stopka">
      <a href="/app/">Otwórz aplikację</a>
      ${NAV.map((n) => `<a href="${n.path}">${esc(n.name)}</a>`).join('\n      ')}
      <a href="/#pobierz">Pobierz na Androida</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;
}
