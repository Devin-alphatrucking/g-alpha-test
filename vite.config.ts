import { defineConfig } from 'vite';

// In dev, /api/* is forwarded to the PHP endpoint served by XAMPP (Apache).
export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost',
        rewrite: (p) => '/dvn-alpha-g/public' + p,
      },
    },
  },
  build: {
    // Phaser is big but rarely changes: keep it in its own long-cached chunk, loaded only when the player presses Start.
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    chunkSizeWarningLimit: 1500,
  },
});
