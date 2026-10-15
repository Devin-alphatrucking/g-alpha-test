import { defineConfig } from 'vite';

// In dev, /api/* goes to a PHP server (rooms + AI lines): run `npm run dev:api` or use the dvn-api launch config.
// Override the target with API_TARGET (e.g. when using XAMPP/Apache).
const target = process.env.API_TARGET || 'http://127.0.0.1:8099';
export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api': {
        target,
        rewrite: (p) => (process.env.API_TARGET ? '/dvn-alpha-g/public' + p : p),
      },
    },
  },
  build: {
    // Phaser is big but rarely changes: keep it in its own long-cached chunk, loaded only when the player presses Start.
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    chunkSizeWarningLimit: 1500,
  },
});
