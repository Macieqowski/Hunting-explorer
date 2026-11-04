import { defineConfig } from 'vitest/config';

// Security rules tests; needs the database emulator (npm run test:rules).
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['rules/**/*.test.ts'], fileParallelism: false },
});
