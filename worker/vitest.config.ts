import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The Durable Object base class only exists inside Workers; tests replace the counters.
    alias: { 'cloudflare:workers': new URL('./test/cloudflare-workers.stub.ts', import.meta.url).pathname },
  },
});
