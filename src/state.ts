/** What one character remembers about the player. Gameplay facts only – no personal data. */
export interface Rel {
  aff: number; // friendship 0..100
  met: number; // deliveries made to them
  fast: number; // 3-star runs
  late: number; // 1-star runs
  crashes: number; // collisions on the way to them
  rain: number; // deliveries in the rain
  night: number; // deliveries at night
  beats: number; // story beats completed (0..3)
  tags: string[]; // story choices made
}

export const newRel = (): Rel => ({ aff: 0, met: 0, fast: 0, late: 0, crashes: 0, rain: 0, night: 0, beats: 0, tags: [] });

export interface Save {
  coins: number;
  xp: number;
  engine: number; // speed upgrade level
  contract: number; // reward upgrade level
  streak: number;
  lastPlayDay: string;
  deliveries: number;
  muted: boolean;
  tutorial: boolean; // coach-mark already seen
  rel: Record<string, Rel>;
  keepsakes: string[];
  epilogue: boolean;
  paidRooms: string[]; // room codes whose convoy-goal reward was already paid out
  ageBand: '' | 'u13' | '13+'; // asked only when ads are switched on; under-13s never see ads
  skin: string; // equipped truck paint
  owned: string[]; // purchased paints (story paints are unlocked by finishing a story arc)
  quests: { day: string; list: Quest[] } | null;
}

export interface Quest {
  id: string;
  kind: 'deliver' | 'fast' | 'clean' | 'night' | 'friend';
  goal: number;
  prog: number;
  target?: string; // customer id for 'friend'
  reward: number;
  done: boolean;
}

const KEY = 'dvn-haul-save-v1';

const fresh = (): Save => ({ coins: 0, xp: 0, engine: 0, contract: 0, streak: 0, lastPlayDay: '', deliveries: 0, muted: false, tutorial: false, rel: {}, keepsakes: [], epilogue: false, paidRooms: [], ageBand: '', skin: 'classic', owned: [], quests: null });

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return fresh();
}

export function persist(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** The memory for one character (created on first use). */
export function relOf(s: Save, id: string): Rel {
  return (s.rel[id] ??= newRel());
}

export const totalBeats = (s: Save): number => Object.values(s.rel).reduce((n, r) => n + r.beats, 0);

const xpAt = (lvl: number): number => 50 * (lvl - 1) * (lvl - 1);
export const levelOf = (xp: number): number => 1 + Math.floor(Math.sqrt(xp / 50));
export const levelProgress = (xp: number): number => {
  const l = levelOf(xp);
  return (xp - xpAt(l)) / (xpAt(l + 1) - xpAt(l));
};
export const speedOf = (s: Save): number => 230 * (1 + 0.12 * s.engine);
export const rewardMul = (s: Save): number => 1 + 0.1 * s.contract;
export const upgradeCost = (lvl: number): number => Math.round(60 * Math.pow(1.6, lvl));

/** Daily streak: +1 if last play was yesterday, reset if older, unchanged if today. Returns bonus coins. */
export function touchStreak(s: Save): number {
  const today = new Date().toISOString().slice(0, 10);
  if (s.lastPlayDay === today) return 0;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  s.streak = s.lastPlayDay === y ? s.streak + 1 : 1;
  s.lastPlayDay = today;
  const bonus = 10 * Math.min(s.streak, 7);
  s.coins += bonus;
  persist(s);
  return bonus;
}
