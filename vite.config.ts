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
});
