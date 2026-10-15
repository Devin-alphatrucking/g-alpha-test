// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver...) that your pages changed, right after you deploy.
// Google does not use IndexNow: for Google, submit sitemap.xml once in Search Console (see docs/SEO-MARKETING.md).
//
//   SITE_URL=https://your-domain.com INDEXNOW_KEY=yourkey node tools/indexnow.mjs
//
// The same INDEXNOW_KEY must be set when you build, so dist/<key>.txt exists on your site.
const site = (process.env.SITE_URL || '').replace(/\/$/, '');
const key = process.env.INDEXNOW_KEY || '';
if (!site || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error('Set SITE_URL and INDEXNOW_KEY (8-128 letters, numbers or dashes).');
  process.exit(1);
}
const urlList = ['/', '/how-to-play.html', '/parents.html', '/privacy.html'].map((p) => site + p);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});
console.log(`IndexNow responded ${res.status} (${res.status === 200 || res.status === 202 ? 'accepted' : 'check the key file is live at ' + site + '/' + key + '.txt'})`);
