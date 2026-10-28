import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  base: '/automaton-vis/',
  plugins: [react()],
  // elkjs (~1.5 MB) can't be split further; it is loaded lazily on the first Tidy.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', '.claude/**', '.superpowers/**', 'docs/**'],
  },
});
