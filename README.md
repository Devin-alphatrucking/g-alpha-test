# DVN Haul

A cozy delivery-driving game for every age. Chase golden hour, beat the storm, and win over a town of characters who remember how you drive.

**Stack:** Vite + TypeScript, Phaser 3 (game), GSAP (landing page), PHP (AI proxy + optional live feed). No audio or image files: art and sound are generated in code.

## Run it

```bash
npm install
npm run dev -- --port 5180 --strictPort   # http://localhost:5180  (add ?play to skip the landing page)
```

The `/api/*` routes are proxied to Apache (XAMPP) at `http://localhost/dvn-alpha-g/public/api/`. Without Apache or an API key the game still works: characters speak from their built-in memory lines.

## Controls

| Action | Keys |
| --- | --- |
| Drive / brake / reverse | ↑ ↓ or W S |
| Steer | ← → or A D |
| Horn | Space |
| Pause | P or Esc |
| Story dialogue | Space / click to advance, 1 / 2 to choose, Esc to skip |

Touch screens get an on-screen D-pad automatically.

## Deploy to your domain

1. `npm run build`
2. Upload the **contents of `dist/`** to the web root (or a sub-folder such as `/haul/`).
3. For AI lines, give the server your Anthropic key in one of these ways (the key must never be in a public folder):
   - set the `ANTHROPIC_API_KEY` environment variable (best), or
   - copy `config.sample.php` to **`dvn-haul-config.php` in the folder *above* your web root** (e.g. `/home/you/dvn-haul-config.php` when the site is in `/home/you/public_html`) and add the key, or
   - for local XAMPP only: `config.php` in the project root.
4. PHP 7.4+ with cURL is required for `api/chat.php`. `public/.htaccess` (copied into `dist/`) adds compression and caching on Apache.

The game bundle loads only when a player presses Start: landing page ≈ 52 KB gzipped, game logic ≈ 21 KB, Phaser ≈ 340 KB in its own long-cached chunk.

## AI memory & safety

Each character remembers gameplay facts only (deliveries, late runs, crashes, rain/night runs, story choices). The browser sends those facts, never free text or names, to `api/chat.php`, which validates every field against whitelists before building the prompt. Calls are rate-limited per session (30 / 10 min). If the API fails, the local voice lines are used.

## Optional: live Alpha Trucking feed

Create `public/data/live.json` (copy `live.sample.json`) and set `"enabled": true` with real numbers exported from your dispatch system, e.g. by a scheduled job:

```json
{ "enabled": true, "date": "2026-10-14", "deliveries": 128, "onTimePct": 96.5 }
```

The game then shows an "Alpha today" pill and gives a small coin bonus (+1% per 4 real deliveries, max 25%). Leave the file out and the feature stays hidden. `live.json` is git-ignored so real figures are never committed.

## Accessibility

Respects `prefers-reduced-motion` (no camera sweep, shake, flashes or lightning), full keyboard play, focus moves into dialogs and Esc closes them, status messages use ARIA live regions, auto-pause when the tab is hidden, and the sound toggle exposes its state.

## Project layout

```
index.html          landing page + game UI shell
src/landing.ts      scroll story, title reveal, start transition (lazy-loads the game)
src/game.ts         scene: driving, lighting, weather, traffic, jobs, journal
src/world.ts        procedural city + lights
src/story.ts        15 story beats, choices, chapters
src/ai.ts           character voices + memory-aware request
src/dialog.ts       visual-novel style scene player
src/avatars.ts      procedural character portraits
src/sfx.ts          synthesized sound, engine, score, rain
src/weather.ts      rain / fog / lightning overlay
public/api/         chat.php (AI proxy), live.php (optional feed)
```

## Progression & sharing

- **Paint shop (Garage):** two paints are bought with coins; five more are unlocked by finishing each character's story arc.
- **Daily quests:** three new goals every day (same for everyone, seeded by the date); rewards pay out automatically.
- **Share my progress (Journal):** renders a 1080×1350 card with your stats, chapter and friendships, then opens the native share sheet or downloads a PNG. It contains game stats only.
