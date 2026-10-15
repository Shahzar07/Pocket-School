import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/payments/**/*.test.ts'],
    environment: 'node',
  },
});
