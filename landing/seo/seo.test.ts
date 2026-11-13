import { analyticsSnippet } from './analytics';
import { render, slugify, ORIGIN } from './layout';
import { allPages, readInputs, sitemap, ROBOTS } from './plugin';
import { huntingYear, notFoundPage } from './pages';
import { SPECIES } from '../../src/atlas';

const inp = readInputs();
const pages = allPages(inp);
const shell = { css: ['/assets/x.css'], analytics: '' };

describe('pages for search engines', () => {
  it('gives every page its own address, title and description', () => {
    const paths = pages.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of pages) {
      expect(p.path).toMatch(/^\/[a-z0-9/-]+\/$/);
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.description.length).toBeGreaterThan(40);
      expect(p.description.length).toBeLessThanOrEqual(300);
    }
    const titles = pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('has a page for every district, every species, the seasons and both exams', () => {
    const paths = new Set(pages.map((p) => p.path));
    expect(inp.districts.length).toBeGreaterThan(4000);
    expect(pages.filter((p) => /^\/obwody-lowieckie\/[^/]+\/[^/]+\/$/.test(p.path)).length).toBe(inp.districts.length);
    expect(pages.filter((p) => /^\/obwody-lowieckie\/[^/]+\/$/.test(p.path)).length).toBe(16);
    for (const sp of SPECIES) expect(paths.has(`/atlas-zwierzyny/${sp.slug}/`)).toBe(true);
    for (const p of ['/okresy-polowan/', '/egzamin-na-mysliwego/', '/egzamin-selekcjonerski/', '/obwody-lowieckie/', '/kola-lowieckie/']) expect(paths.has(p)).toBe(true);
  });

  it('links only to pages that exist', () => {
    const paths = new Set(['/', '/404.html', ...pages.map((p) => p.path)]);
    const broken = new Set<string>();
    for (const p of [...pages, notFoundPage()])
      for (const m of render(p, shell).matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
        const href = m[1];
        if (href.startsWith('/app/') || href.startsWith('/assets/') || /\.(png|xml)$/.test(href)) continue;
        if (!paths.has(href)) broken.add(`${p.path} → ${href}`);
      }
    expect([...broken]).toEqual([]);
  });

  it('writes a canonical address, breadcrumbs and one h1 on each page', () => {
    const p = pages.find((x) => x.path === '/atlas-zwierzyny/sarna/')!;
    const html = render(p, shell);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/atlas-zwierzyny/sarna/" />`);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('<html lang="pl">');
    expect(render(notFoundPage(), shell)).toContain('<meta name="robots" content="noindex" />');
  });

  it('opens the matching view of the app from district and club pages', () => {
    const d = pages.find((x) => x.path === '/obwody-lowieckie/lubuskie/128/')!;
    expect(d.body).toContain('href="/app/#/obwod/08-128"');
    const club = pages.find((x) => x.path.startsWith('/kolo-lowieckie/'))!;
    expect(club.body).toMatch(/href="\/app\/#\/kolo\/[^"]+"/);
  });

  it('lists every page once in the sitemap', () => {
    const xml = sitemap(pages);
    expect(xml.match(/<url>/g)).toHaveLength(pages.length + 2);
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/okresy-polowan/</loc>`);
    expect(xml).not.toContain('404.html');
    expect(ROBOTS).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('names the hunting year, which starts on 1 April', () => {
    expect(huntingYear('2026-11-13')).toBe('2026/2027');
    expect(huntingYear('2027-03-31')).toBe('2026/2027');
    expect(huntingYear('2027-04-01')).toBe('2027/2028');
  });

  it('makes plain addresses from Polish names', () => {
    expect(slugify('Koło Łowieckie „Ryś” Żółwin')).toBe('kolo-lowieckie-rys-zolwin');
    expect(slugify('warmińsko-mazurskie')).toBe('warminsko-mazurskie');
  });
});

describe('visitor statistics', () => {
  it('adds nothing without a token or with a malformed one', () => {
    expect(analyticsSnippet(undefined)).toBe('');
    expect(analyticsSnippet('')).toBe('');
    expect(analyticsSnippet('"><script>alert(1)</script>')).toBe('');
  });

  it('loads the beacon only on the public address', () => {
    const tag = analyticsSnippet('0123456789abcdef0123456789abcdef');
    expect(tag).toContain("location.hostname!==\"www.polowanie.org\"");
    expect(tag).toContain('static.cloudflareinsights.com/beacon.min.js');
    expect(tag).toContain('0123456789abcdef0123456789abcdef');
  });
});
