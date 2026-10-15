import { defineConfig, type Plugin } from 'vite';

// ---- environment (set when building for production) ----
//   SITE_URL        https://your-domain.com   (no trailing slash) used for canonical, social tags, sitemap
//   CONTACT_EMAIL   hello@your-domain.com     shown on the privacy and parents pages
//   INDEXNOW_KEY    any 8-128 char key        enables the IndexNow key file (see tools/indexnow.mjs)
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const CONTACT = process.env.CONTACT_EMAIL || '[add a contact email before launch]';
const PAGES = [
  { file: 'index.html', path: '/', priority: '1.0', change: 'weekly' },
  { file: 'how-to-play.html', path: '/how-to-play.html', priority: '0.8', change: 'monthly' },
  { file: 'parents.html', path: '/parents.html', priority: '0.6', change: 'monthly' },
  { file: 'privacy.html', path: '/privacy.html', priority: '0.3', change: 'yearly' },
];

/** SEO build step: stamps the real domain into every page and emits sitemap.xml, robots.txt and the IndexNow key file. */
function seo(): Plugin {
  let build = false;
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: 'dvn-seo',
    configResolved(c) {
      build = c.command === 'build';
      if (build && !SITE) console.warn('\n\x1b[33m[seo] SITE_URL is not set: canonical, Open Graph and sitemap URLs will use a placeholder.\n      Build with:  SITE_URL=https://your-domain.com npm run build\x1b[0m\n');
    },
    transformIndexHtml(html) {
      // in dev the placeholders become empty so /og.jpg etc. resolve locally
      return html.replaceAll('__SITE_URL__', build ? SITE || 'https://YOUR-DOMAIN.example' : '').replaceAll('__CONTACT__', CONTACT).replaceAll('__BUILD_DATE__', today);
    },
    generateBundle() {
      const base = SITE || 'https://YOUR-DOMAIN.example';
      const urls = PAGES.map((p) => `  <url><loc>${base}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.change}</changefreq><priority>${p.priority}</priority></url>`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n` });
      const key = process.env.INDEXNOW_KEY;
      if (key && /^[A-Za-z0-9-]{8,128}$/.test(key)) this.emitFile({ type: 'asset', fileName: `${key}.txt`, source: key });
    },
  };
}

// In dev, /api/* goes to a PHP server (rooms + AI lines): run `npm run dev:api` or use the dvn-api launch config.
// Override the target with API_TARGET (e.g. when using XAMPP/Apache).
const target = process.env.API_TARGET || 'http://127.0.0.1:8099';

export default defineConfig({
  base: './',
  plugins: [seo()],
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
    rollupOptions: {
      input: Object.fromEntries([...PAGES.map((p) => [p.file.replace('.html', ''), p.file]), ['notfound', '404.html']]),
      output: { manualChunks: { phaser: ['phaser'] } },
    },
    chunkSizeWarningLimit: 1500,
  },
});
