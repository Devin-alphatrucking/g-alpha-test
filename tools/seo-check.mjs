// Audits dist/ like a crawler would. Run after `npm run build`:  npm run seo:check
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const problems = [];
const notes = [];
const bad = (page, msg) => problems.push(`${page}: ${msg}`);
const pages = readdirSync(dist).filter((f) => f.endsWith('.html'));

for (const page of pages) {
  const html = readFileSync(join(dist, page), 'utf8');
  const indexable = page !== '404.html';
  const get = (re) => (html.match(re) || [])[1];
  const title = get(/<title>([^<]*)<\/title>/);
  const desc = get(/<meta name="description" content="([^"]*)"/);
  if (/__SITE_URL__|__CONTACT__|__BUILD_DATE__|%SITE_URL%/.test(html)) bad(page, 'unreplaced placeholder (build with SITE_URL / CONTACT_EMAIL)');
  if (/YOUR-DOMAIN\.example/.test(html)) notes.push(`${page}: still using the placeholder domain (set SITE_URL)`);
  if (/add a contact email/.test(html)) notes.push(`${page}: contact email placeholder still present (set CONTACT_EMAIL)`);
  if (!title) bad(page, 'missing <title>');
  else if (title.length > 65) bad(page, `title is ${title.length} chars (keep <= 60-65)`);
  if (indexable) {
    if (!desc) bad(page, 'missing meta description');
    else if (desc.length < 70 || desc.length > 160) bad(page, `description is ${desc.length} chars (aim 120-155)`);
    if (!/<link rel="canonical" href="https?:\/\//.test(html)) bad(page, 'missing absolute canonical');
    if (!/<meta property="og:image" content="https?:\/\//.test(html)) bad(page, 'missing absolute og:image');
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) bad(page, `${h1s} <h1> tags (need exactly 1)`);
    if (/noindex/.test(html)) bad(page, 'accidentally noindex');
  }
  if (!/<html lang="/.test(html)) bad(page, 'missing html lang');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad(page, `<img> without alt: ${m[0].slice(0, 60)}`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      notes.push(`${page}: JSON-LD ok (${[].concat(j['@graph'] ?? j).map((x) => x['@type']).join(', ')})`);
    } catch (e) {
      bad(page, 'invalid JSON-LD: ' + e.message);
    }
  }
  // internal links must resolve to files in dist
  for (const m of html.matchAll(/(?:href|src)="(\.\/[^"#?]*|\/[^"#?]*)"/g)) {
    const rel = m[1].replace(/^\.\//, '').replace(/^\//, '');
    if (!rel || rel.startsWith('api/') || rel === '') continue;
    if (!existsSync(join(dist, rel))) bad(page, `broken internal link/asset: ${m[1]}`);
  }
}
// robots + sitemap
const robots = existsSync(join(dist, 'robots.txt')) ? readFileSync(join(dist, 'robots.txt'), 'utf8') : '';
if (!/Sitemap:\s*https?:\/\//.test(robots)) bad('robots.txt', 'missing absolute Sitemap line');
if (/Disallow:\s*\/\s*$/m.test(robots)) bad('robots.txt', 'blocks the whole site');
const sm = existsSync(join(dist, 'sitemap.xml')) ? readFileSync(join(dist, 'sitemap.xml'), 'utf8') : '';
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) bad('sitemap.xml', 'no URLs');
for (const f of pages.filter((p) => p !== '404.html')) {
  const path = f === 'index.html' ? '/' : '/' + f;
  if (!locs.some((l) => l.endsWith(path))) bad('sitemap.xml', `missing ${path}`);
}
console.log(notes.map((n) => '  · ' + n).join('\n'));
if (problems.length) {
  console.error('\nSEO problems:\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`\nSEO check passed: ${pages.length} pages, ${locs.length} sitemap URLs.`);
