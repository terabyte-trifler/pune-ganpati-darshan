import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // `server-only` is a build-time guard with no runtime: importing it
      // outside a bundler throws, which would make every server module
      // untestable. Stubbed rather than dropped from those modules — the
      // guard is what keeps them out of a client bundle, and that matters
      // more than the inconvenience here.
      'server-only': path.resolve(import.meta.dirname, './src/test/server-only-stub.ts'),
    },
  },
});
