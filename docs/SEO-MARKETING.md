# DVN Haul: SEO, marketing and ads playbook

Written as a senior SEO / growth review of the project as it stands, with everything that could be done in code already done and committed. Where something needs your accounts, your domain or real-world data, it is marked **[you]**. Numbers marked *rule of thumb* are industry ballparks, **not measurements of this site and not guarantees**.

## 1. Verdict

| Area | Before | Now |
| --- | --- | --- |
| Indexable pages | 1 | 4 (home, how to play, for parents, privacy) + 404 |
| Title / description | brand line, no search words | keyword-led, length-checked (`npm run seo:check`) |
| Canonical, Open Graph, Twitter card | none | all pages, absolute URLs stamped at build |
| Structured data | none | `VideoGame`, `Organization`, `WebSite`, `FAQPage`, `BreadcrumbList` |
| `robots.txt`, `sitemap.xml` | none | generated every build |
| Fast-crawl tooling | none | IndexNow key file + `npm run indexnow`, Search Console steps below |
| Social preview image | none | `og.jpg` 1200x630 from the real game |
| Fonts | loaded from Google (3rd party, privacy + speed cost) | self-hosted |
| Analytics | none | cookie-less Plausible hook, off until configured |
| Privacy policy / parents page | none | written (draft: **have it legally reviewed [you]**) |
| Ads | none | rewarded-only, age-gated, off by default |

**The honest summary:** the site is now technically *ready to be found*. Rankings are earned over weeks to months, by backlinks, content and real usage, and nobody can guarantee a position or an indexing date. The two biggest remaining levers are things only you can do: **publish on a real domain** and **get links and plays from real places** (Alpha Trucking's own channels first).

## 2. Positioning

**What it is, in one line:** a free, cozy, top-down truck-delivery game you play in the browser, with a story, weather and friends.

**Audiences, in order of likely value**
1. **Casual browser gamers (16-45)** searching "free driving game", "truck game online", "cozy games". Largest volume, lowest intent.
2. **Parents / families** searching "safe browser games for kids", "driving game for kids". Smaller, higher trust needs: the *For parents* page exists for this.
3. **Alpha Trucking's own customers, drivers and staff.** Tiny volume but **free, warm and brand-relevant**: this is the best first audience (see section 7).

**Differentiators to repeat everywhere:** real day-night and weather, neighbours who *remember* you (AI), friends rooms without open chat, no download / no account.

## 3. Keyword strategy

*Search volumes and difficulty are not included because no keyword-data tool was available while writing this. Validate every cluster in Google Search Console (Performance → Queries) after launch and in Google Keyword Planner before spending on ads.*

| Cluster | Example phrases | Intent | Where it lives |
| --- | --- | --- | --- |
| **Primary** | free truck delivery game · delivery driving game online · browser driving game | Play now | Home `<title>`, H1 eyebrow, hero paragraph, JSON-LD |
| **Cozy / casual** | cozy driving game · relaxing delivery game · story driving game | Play now | Home copy, FAQ ("What is the game about?") |
| **Kids / family** | truck game for kids · safe browser games for kids | Trust + play | `/parents.html`, FAQ |
| **No-friction** | play truck game no download · no sign up driving game | Play now | `<title>`, hero, FAQ |
| **Multiplayer** | driving game with friends · multiplayer truck game browser | Play now | Home chapter 3, FAQ, how-to-play |
| **Help / how-to** | how to get 3 stars delivery game · truck game controls · drive with arrow keys | Learn | `/how-to-play.html` |
| **Brand** | DVN Haul · Alpha Trucking game | Navigate | everywhere, `Organization` schema |

**Notes**
- `<meta name="keywords">` is ignored by Google and unused by Bing: it is deliberately *not* added. Keywords go where engines read them: title, H1, headings, body copy, alt text, schema and URLs.
- Do not stuff. Each page targets one cluster and reads like a human wrote it.
- Use Australian spelling and `en-AU` (already set). If you want US/UK traffic too, add `hreflang` pages later.

## 4. What is implemented (so you can verify it)

- **On page:** `index.html` head, a keyword-bearing H1 (`Free truck delivery game · play in your browser` + the brand line), FAQ with 7 real questions mirrored in `FAQPage` JSON-LD, descriptive alt text on the characters, a no-JavaScript fallback that still shows all the copy.
- **Supporting pages:** `how-to-play.html` (controls, stars, tips: matches the game's real numbers), `parents.html`, `privacy.html`, `404.html`.
- **Technical:** canonical URLs, `robots.txt` (allows all, blocks `/api/`), `sitemap.xml` with `lastmod`, `.htaccess` (404, caching, compression, HTTPS/host redirects ready to enable), LCP image preloaded, image dimensions set (no layout shift), modules code-split so the landing page is about 60 KB gzipped and Phaser only loads on *Start*.
- **Safety net:** `npm run build` then `npm run seo:check` fails the release if a title/description is too long, a canonical or og:image is missing, JSON-LD is invalid, a page has no or two H1s, an image has no alt, a link is broken or the sitemap misses a page.

## 5. Fast crawl and indexing: do these in order **[you]**

1. **Build with your real values:** `SITE_URL=https://your-domain.com CONTACT_EMAIL=you@your-domain.com INDEXNOW_KEY=<random-key> npm run build`, then `npm run seo:check`. Upload `dist/`.
2. **Enable HTTPS and one canonical host** (uncomment the two blocks in `.htaccess`).
3. **Google Search Console** → add the property (DNS TXT verification is the most robust) → *Sitemaps* → submit `https://your-domain.com/sitemap.xml`.
4. In Search Console → **URL Inspection**, paste each of the 4 URLs → *Request indexing*. This is the fastest official route for Google. (Google's Indexing API is for job and livestream pages only, not for games.)
5. **Bing Webmaster Tools** → *Import from Google Search Console* (one click). Then run `SITE_URL=... INDEXNOW_KEY=... npm run indexnow` after every deploy to notify Bing, Yandex and other IndexNow engines.
6. **Give crawlers a reason to come:** link to the site from every place you control: alphatrucking.com.au footer or a news post, LinkedIn company page, email signatures, social bios. Links from a real, established domain are the biggest speed-up for first discovery.
7. **Watch Search Console → Pages** for "Discovered/Crawled, not indexed" and fix what it names. Typical first indexing: days to a few weeks; ranking for competitive phrases: months.

## 6. Content plan (what to add next, in priority order)

1. **`/play-with-friends.html`**: a landing page for room invites and the "multiplayer truck game browser" cluster. Include a screenshot and a 4-step guide.
2. **"How to get three stars" guide**: long-tail, helpful, links to the game. (Start from `how-to-play.html`.)
3. **"Meet the neighbours"** character pages (5 short pages): good for branded and long-tail searches, and for sharing.
4. **A devlog / "how we built it" post** on the Alpha Trucking site: earns links from developer and local-business communities.
5. **Seasonal events** (e.g. a festival night) to give people a reason to return and to post.
6. Add screenshots and a 30-second gameplay video (record with the in-app browser or OBS). Video earns YouTube and Shorts traffic *and* can be embedded with `VideoObject` schema.

## 7. Distribution: where the first players come from

**Own channels first (free, high trust)**
- **Alpha Trucking real world:** a **QR code** on trucks, delivery receipts, invoices and the office door → `https://your-domain.com/?utm_source=truck&utm_medium=qr&utm_campaign=launch`. This turns real deliveries into players and ties directly to the live-feed feature.
- Website banner, newsletter, email signature, LinkedIn page, staff and driver networks.

**Earned and community (free, needs effort)**
- Game portals: **itch.io** (easy, free), CrazyGames and Poki (apply; they bring real traffic and share ad revenue; each requires their SDK), Newgrounds. Check each site's current rules.
- Reddit (read each subreddit's self-promotion rules first), Hacker News "Show HN" for the tech story, Product Hunt, Indie Hackers, local Australian business and tech groups.
- Short video: record a 15-30 s clip of golden hour → storm → a friendly NPC line; post to YouTube Shorts, Instagram Reels and TikTok.
- **Invite loop:** every Play Room invite link is a free ad. Keep the room flow frictionless; the landing page already says "You're invited to room ABCD".

## 8. Measurement **[you]**

Turn analytics on in `public/analytics.config.json` (Plausible, cookie-less):

```json
{ "enabled": true, "provider": "plausible", "domain": "your-domain.com" }
```

In Plausible → Goals, add these custom events (already fired by the code): `Start Game`, `First Delivery`, `Story Beat`, `Room Created`, `Room Joined`, `Share Card`, `Ad Watched`, `Daily Quest Done`, `Invite Landing`. Analytics never load for players who say they are under 13.

**KPIs and rough targets** (*rules of thumb for casual web games: use them as a starting point, then replace with your own baseline*)

| KPI | How | Healthy-looking range |
| --- | --- | --- |
| Visit → Start Game | `Start Game` / visitors | 25-50% (landing is the whole pitch) |
| Start → First Delivery | `First Delivery` / `Start Game` | 70%+ (if lower, onboarding is the problem) |
| Return rate | Plausible returning visitors | day-1 return of 20-30% is decent for a browser game |
| Room creation | `Room Created` / starters | 3-10% |
| Search clicks / impressions | Search Console | rises over months; track top queries |
| Core Web Vitals | Search Console → Core Web Vitals | LCP < 2.5 s, CLS < 0.1, INP < 200 ms |

## 9. Paid ads: how to manage them (acquisition)

**Be realistic first.** A free browser game that earns from optional rewarded ads usually earns **cents per player**. Paid clicks often cost more than that, so **paid acquisition rarely pays for itself directly**. Use paid ads for (a) a small test to learn what messaging converts, (b) brand awareness for Alpha Trucking, and (c) a launch burst: not as a standing profit engine. Do not start before analytics is on and you have an organic baseline.

**Test plan (2 weeks, small budget, e.g. AUD 10-20/day)**
1. **Goal event:** `First Delivery` (not clicks). Judge every channel by cost per *First Delivery*.
2. **Google Search**, phrase/exact match: *free truck game*, *delivery driving game online*, *driving game with friends*. Negative keywords: *download, apk, steam, simulator pro, free money, hack, mod*. Send to `/` with UTMs.
3. **YouTube Shorts / Demand Gen** with the 15 s gameplay clip.
4. **Meta (Facebook/Instagram):** target **adults / parents (25-45)**, never minors. The game is kid-friendly, but advertising platforms restrict targeting under-18s; keep it adult-targeted.
5. Pause anything with cost per First Delivery above your ceiling after ~50 clicks. Scale what works by 20% steps.

**UTM convention** (so Plausible reports are readable): `utm_source` (google, youtube, meta, truck, newsletter) · `utm_medium` (cpc, social, qr, email) · `utm_campaign` (launch, rain-night, friends) · `utm_content` (creative id).

**Creative hooks to test:** "The sun sets, the storm rolls in, the delivery isn't done." · "A cozy truck game where the neighbours remember you." · "Drive with up to 5 friends. No download." · "Beat the rain. Win three stars." · "Free. No sign-up. Works on your phone."

## 10. Making money from the game (ads management)

- The code ships **rewarded ads only** (player taps "watch an ad: +coins"), **off by default**, behind an under-13 / 13+ gate, with a mock provider for testing. No ads on the landing page (protects Core Web Vitals and complies with game-ad policies).
- **To go live [you]:** publish on your domain with the privacy page → apply for **Google AdSense for Games / H5 Games Ads** (approval is not guaranteed and may need traffic and content) → add your `ca-pub-…` id in `public/ads.config.json` → put your line in `public/ads.txt` → mark the site as possibly child-directed / use non-personalised settings as the network requires → add a consent banner (a Google-certified CMP is required for EEA/UK visitors) → test with the network's test mode before real ads. **The AdSense code path is untested** (no account was available).
- **Manage it:** watch the `Ad Watched` event against `First Delivery`; if few players tap it, improve the offer (e.g. show it when coins are short for an upgrade) before adding more ad placements. Never show ads to under-13s or interrupt play.
- **Other earnings, no ad network:** a sponsored truck paint or customer from a partner brand; a "Book a delivery with Alpha Trucking" link; game-portal revenue share. For a trucking company, **leads and brand awareness are probably worth more than ad pennies.**

## 11. Launch checklist (in order)

1. **[you]** Domain + hosting with PHP and a writable temp directory (rooms).
2. **[you]** Set `ANTHROPIC_API_KEY` (AI lines) as in the README.
3. **[you]** Build with `SITE_URL`, `CONTACT_EMAIL`, `INDEXNOW_KEY`; run `npm run seo:check`; upload `dist/`.
4. **[you]** HTTPS + canonical host in `.htaccess`.
5. **[you]** Legal review of `privacy.html` / `parents.html`; confirm the contact address.
6. **[you]** Search Console + Bing Webmaster: submit sitemap, request indexing, run `npm run indexnow`.
7. **[you]** Plausible on; add the goals; test one full run (landing → Start → First Delivery).
8. **[you]** Real-device playtest (phone and laptop) and a Lighthouse run on the live URL.
9. Announce on your own channels (QR codes, newsletter, LinkedIn), then portals and communities.

## 12. 30 / 60 / 90 days

- **Days 1-30:** go live, index, own-channel launch, fix whatever analytics shows in the first-minute funnel.
- **Days 31-60:** add the friends page and the three-star guide; post 2 short clips a week; apply to one or two portals; decide on ads based on real traffic.
- **Days 61-90:** character pages, a seasonal event, first small paid test if the funnel is healthy, review Search Console queries and double down on the ones getting impressions.

## 13. What this review could not verify

- **No live domain**, so nothing is indexed, no real Core Web Vitals, no backlinks. Canonical/OG URLs use a placeholder until you build with `SITE_URL` (the build prints a warning).
- **No keyword volume or competitor data**; the keyword table is reasoned, not measured.
- **No Lighthouse score** was produced here (the build is small and well-structured, but measure it on the live site).
- **Ad network code and the privacy policy's legal sufficiency are untested / unreviewed.**
- Real-time feel and sound of the game still need a human playtest on phone and laptop.
