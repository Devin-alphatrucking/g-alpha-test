// Optional, OFF-by-default, cookie-less analytics (Plausible). Needed to manage ad spend: without numbers you are guessing.
// Enable in public/analytics.config.json. Never loads for players who said they are under 13.
//
// Define these as "Custom event goals" in the Plausible dashboard so they appear as conversions:
//   Start Game, First Delivery, Story Beat, Room Created, Room Joined, Share Card, Ad Watched, Daily Quest Done, Invite Landing
type Props = Record<string, string | number>;
interface Config {
  enabled: boolean;
  provider: 'none' | 'plausible';
  domain?: string; // your site's domain as registered in Plausible, e.g. "your-domain.com"
  src?: string; // self-hosted script URL if you run Plausible yourself
}
type Plausible = ((name: string, o?: { props?: Props }) => void) & { q?: unknown[] };

let on = false;
const w = window as unknown as { plausible?: Plausible };

export async function initAnalytics(): Promise<void> {
  try {
    if (JSON.parse(localStorage.getItem('dvn-haul-save-v1') ?? '{}').ageBand === 'u13') return;
    const r = await fetch('./analytics.config.json', { cache: 'no-store' });
    if (!r.ok) return;
    const cfg: Config = await r.json();
    if (!cfg.enabled || cfg.provider !== 'plausible' || !cfg.domain) return;
    w.plausible = w.plausible || Object.assign((...a: unknown[]) => (w.plausible!.q = w.plausible!.q || []).push(a), {});
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.domain = cfg.domain;
    s.src = cfg.src || 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
    on = true;
  } catch {
    /* analytics must never break the game */
  }
}

/** Stops tracking immediately (used when a player says they are under 13). */
export const stopAnalytics = (): void => {
  on = false;
};

export function track(name: string, props?: Props): void {
  if (on) w.plausible?.(name, props ? { props } : undefined);
}
