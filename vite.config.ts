import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
      const precache = ['./', ...files, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
      const template = readFileSync(new URL('./sw/service-worker.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const PRECACHE = ${JSON.stringify([...new Set(precache)])};\nconst VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 12))};\n${template}`,
      });
    },
  };
}

// Relative base so the build works on GitHub Pages under /<repo>/ and anywhere else.
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  // rules/ holds the Firebase security rules tests, which need the emulator (npm run test:rules).
  test: { globals: true, environment: 'node', exclude: ['rules/**', 'node_modules/**'] },
} as any);
