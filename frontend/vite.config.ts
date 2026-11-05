// Vite settings: the dev server, the /api forwarder, and the test runner.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The page asks /api/health; FastAPI receives /health.
      // The browser only ever talks to one address (5173), so no CORS is needed.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom', // a pretend browser, so tests run without opening one
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
