import { defineConfig, type Plugin } from 'vite';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { analyticsSnippet } from './landing/seo/analytics';

/**
 * Emits sw.js (from sw/service-worker.js) with the list of built files to keep for
 * offline use and a version that changes whenever any of them changes.
 */
function serviceWorker(): Plugin {
  return {
    name: 'hunting-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js');
      const hash = createHash('sha256');
      for (const f of files.sort()) {
        const item = bundle[f];
        hash.update(f);
        hash.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      // The built-in district list (scripts/snapshot-districts.mjs) can change without any code
      // change (weekly deploy), so it is part of the version too.
      const meta = new URL('./public/data/districts-meta.json', import.meta.url);
      const data = existsSync(meta) ? ['data/districts.json'] : [];
      if (data.length) hash.update(readFileSync(meta));
      const precache = ['./', ...files, ...data, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
      const template = readFileSync(new URL('./sw/service-worker.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const PRECACHE = ${JSON.stringify([...new Set(precache)])};\nconst VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 12))};\n${template}`,
      });
    },
  };
}

/** Starts every build from an empty dist/: the welcome page is built into its root afterwards. */
function cleanDist(): Plugin {
  return {
    name: 'hunting-clean-dist',
    apply: 'build',
    buildStart() {
      rmSync(new URL('./dist', import.meta.url), { recursive: true, force: true });
    },
  };
}

/** Cloudflare Web Analytics (repository variable CF_ANALYTICS_TOKEN); it only runs on www.polowanie.org, not in the Android app. */
function analytics(): Plugin {
  const tag = analyticsSnippet(process.env.VITE_CF_ANALYTICS_TOKEN);
  return { name: 'hunting-analytics', transformIndexHtml: (html) => html.replace('</head>', `${tag}\n  </head>`) };
}

// The app is built into dist/app/ and the welcome page (vite.landing.config.ts) into dist/, so
// the site serves the page at / and the app at /app/. The Android app packs dist/app/ only.
// Relative base so the build works under any address.
export default defineConfig({
  base: './',
  build: { outDir: 'dist/app' },
  plugins: [cleanDist(), serviceWorker(), analytics()],
  // rules/ holds the Firebase security rules tests, which need the emulator (npm run test:rules).
  // worker/ is its own package with its own tests (cd worker && npm test).
  test: { globals: true, environment: 'node', exclude: ['rules/**', 'worker/**', 'node_modules/**'] },
} as any);
