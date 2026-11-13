import { defineConfig, type Plugin } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seoPages } from './landing/seo/plugin';
import { analyticsSnippet } from './landing/seo/analytics';

/**
 * The welcome page (landing/), built into the root of dist/ after the app has been built into
 * dist/app/ (vite.config.ts). `npm run build` runs both.
 *
 * Besides the page, the root keeps a few files that phones in the field still ask for at their
 * old addresses, from the time the app itself lived at the root:
 *   data/           the district list: the Android app (0.1.x) checks it for updates here
 *   icons, manifest apps added to the home screen from the old address
 *   sw.js           landing/public/sw.js: retires the old root service worker
 *
 * Next to it the build writes plain HTML pages for search engines (landing/seo/): hunting
 * seasons, the game atlas, the exams and every hunting district and club, with sitemap.xml,
 * robots.txt and 404.html.
 */
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const json = (p: string): any => (existsSync(at(p)) ? JSON.parse(readFileSync(at(p), 'utf8')) : null);

/** Numbers quoted on the page come from the data shipped with the app, so they cannot go stale. */
function facts(): Plugin {
  return {
    name: 'landing-facts',
    transformIndexHtml(html) {
      const districts: number | undefined = json('./public/data/districts-meta.json')?.count;
      const exam = json('./public/exams/mysliwy.json');
      const questions: number | undefined = exam?.questions?.length;
      return html
        .replaceAll('%DISTRICTS%', districts ? String(districts) : '4800')
        .replaceAll('%QUESTIONS%', questions ? String(questions) : '800');
    },
  };
}

/** Cloudflare Web Analytics on the welcome page (repository variable CF_ANALYTICS_TOKEN). */
const ANALYTICS = analyticsSnippet(process.env.VITE_CF_ANALYTICS_TOKEN);
function analytics(): Plugin {
  return { name: 'landing-analytics', transformIndexHtml: (html) => html.replace('</head>', `${ANALYTICS}\n  </head>`) };
}

function rootCopies(): Plugin {
  const files = ['data/districts.json', 'data/districts-meta.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
  return {
    name: 'landing-root-copies',
    apply: 'build',
    closeBundle() {
      for (const f of files) {
        const from = at(`./public/${f}`);
        if (!existsSync(from)) continue;
        const to = at(`./dist/${f}`);
        mkdirSync(at(`./dist/${f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : ''}`), { recursive: true });
        copyFileSync(from, to);
      }
    },
  };
}

export default defineConfig({
  root: 'landing',
  base: './',
  // .env files and VITE_… variables are read from the repository root, as for the app.
  envDir: '..',
  plugins: [facts(), analytics(), rootCopies(), seoPages(ANALYTICS)],
  build: { outDir: '../dist', emptyOutDir: false },
});
