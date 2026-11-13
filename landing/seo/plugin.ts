import type { Plugin } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeDistricts } from './decode';
import { render, ORIGIN, type Page } from './layout';
import { contentPages, dataPages, notFoundPage, type Inputs } from './pages';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const json = (p: string): any => (existsSync(at(p)) ? JSON.parse(readFileSync(at(p), 'utf8')) : null);

/** Everything the subpages are made from, read from the files shipped with the app. */
export function readInputs(): Inputs {
  const raw = json('../../public/data/districts.json');
  const today = new Date().toISOString().slice(0, 10);
  return {
    districts: raw ? decodeDistricts(raw) : [],
    listDate: raw?.date ?? today,
    photos: json('../../src/atlasPhotos.json') ?? {},
    exams: ['mysliwy', 'selekcjoner'].map((id) => json(`../../public/exams/${id}.json`)).filter(Boolean),
    today,
  };
}

export function allPages(inp: Inputs = readInputs()): Page[] {
  return [...contentPages(inp), ...dataPages(inp)];
}

const home: Page = { path: '/', title: '', description: '', body: '', priority: 1 };
const app: Page = { path: '/app/', title: '', description: '', body: '', priority: 0.9 };

/** lastmod only where the day is known (the district list); a made-up date teaches search engines to ignore it. */
export function sitemap(pages: Page[]): string {
  const urls = [home, app, ...pages]
    .filter((p) => !p.noindex)
    .map(
      (p) =>
        `<url><loc>${ORIGIN}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}${p.priority != null ? `<priority>${p.priority.toFixed(1)}</priority>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;

/**
 * Writes the subpages, sitemap.xml, robots.txt and 404.html next to the welcome page. They use
 * the welcome page's stylesheet, so they look the same and need no script of their own.
 */
export function seoPages(analytics: string): Plugin {
  return {
    name: 'landing-seo-pages',
    apply: 'build',
    generateBundle(_options, bundle) {
      const css = Object.values(bundle)
        .filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'))
        .map((f) => '/' + f.fileName);
      const inp = readInputs();
      const pages = allPages(inp);
      const shell = { css, analytics };
      for (const p of pages) this.emitFile({ type: 'asset', fileName: p.path.slice(1) + 'index.html', source: render(p, shell) });
      this.emitFile({ type: 'asset', fileName: '404.html', source: render(notFoundPage(), shell) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(pages) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS });
    },
  };
}
