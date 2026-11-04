import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/ and anywhere else.
export default defineConfig({
  base: './',
  // rules/ holds the Firebase security rules tests, which need the emulator (npm run test:rules).
  test: { globals: true, environment: 'node', exclude: ['rules/**', 'node_modules/**'] },
} as any);
