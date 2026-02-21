import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.js'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
