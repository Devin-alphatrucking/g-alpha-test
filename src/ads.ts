// Optional, OFF-by-default advertising. DVN Haul is for all ages, so:
//  - nothing loads unless public/ads.config.json sets "enabled": true
//  - players are asked "under 13 or 13+?" first; under-13s never see or load ads
//  - ads are opt-in rewarded breaks ("watch to double your coins"), never forced interstitials
import type { Save } from './state';

export interface AdsConfig {
  enabled: boolean;
  provider: 'none' | 'mock' | 'adsense-h5';
  client?: string; // e.g. "ca-pub-1234567890123456" for adsense-h5
}

let cfg: AdsConfig = { enabled: false, provider: 'none' };
let loaded: Promise<boolean> | null = null;

export async function initAds(): Promise<void> {
  try {
    const r = await fetch('./ads.config.json', { cache: 'no-store' });
    if (r.ok) cfg = { ...cfg, ...(await r.json()) };
  } catch {
    /* no config: ads stay off */
  }
}

export const adsEnabled = (): boolean => cfg.enabled && cfg.provider !== 'none';
/** The age question must be answered before any ad can run. */
export const needsAgeGate = (s: Save): boolean => adsEnabled() && !s.ageBand;
export const adsAllowed = (s: Save): boolean => adsEnabled() && s.ageBand === '13+';

type AdBreak = (o: Record<string, unknown>) => void;
const w = window as unknown as { adsbygoogle?: unknown[]; adBreak?: AdBreak; adConfig?: AdBreak };

function loadAdSense(): Promise<boolean> {
  return (loaded ??= new Promise((res) => {
    if (!cfg.client) return res(false);
    w.adsbygoogle = w.adsbygoogle || [];
    w.adBreak = w.adConfig = (o) => (w.adsbygoogle as unknown[]).push(o);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`;
    s.setAttribute('data-ad-client', cfg.client);
    s.onload = () => {
      w.adConfig?.({ preloadAdBreaks: 'on', sound: 'on' });
      res(true);
    };
    s.onerror = () => res(false);
    document.head.appendChild(s);
  }));
}

/** Test provider: a fake 3-second ad so the whole reward flow can be exercised without an ad account. */
function mockAd(): Promise<boolean> {
  return new Promise((res) => {
    const box = document.getElementById('adMock')!;
    const left = document.getElementById('adLeft')!;
    let n = 3;
    left.textContent = String(n);
    box.classList.add('on');
    const t = window.setInterval(() => {
      left.textContent = String(--n);
      if (n <= 0) {
        window.clearInterval(t);
        box.classList.remove('on');
        res(true);
      }
    }, 1000);
  });
}

/** Resolves true only if the player actually watched the ad to the end. */
export async function showRewarded(): Promise<boolean> {
  if (cfg.provider === 'mock') return mockAd();
  if (cfg.provider === 'adsense-h5') {
    if (!(await loadAdSense())) return false;
    return new Promise((res) => {
      let viewed = false;
      w.adBreak?.({
        type: 'reward',
        name: 'double-coins',
        beforeReward: (show: () => void) => show(),
        adViewed: () => (viewed = true),
        adDismissed: () => (viewed = false),
        adBreakDone: () => res(viewed),
      });
    });
  }
  return false;
}
