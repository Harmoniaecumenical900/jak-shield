import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['security/**/*.test.ts'],
    testTimeout: 10_000,
    environment: 'node',
  },
});
