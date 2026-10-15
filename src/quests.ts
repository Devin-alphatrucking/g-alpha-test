import { CUSTOMERS } from './ai';
import { persist, type Quest, type Save } from './state';

const today = () => new Date().toISOString().slice(0, 10);

/** Tiny seeded RNG so every player gets the same three quests on the same day. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function describe(q: Quest): string {
  const who = CUSTOMERS.find((c) => c.id === q.target)?.name ?? '';
  switch (q.kind) {
    case 'deliver': return `Complete ${q.goal} deliveries`;
    case 'fast': return `Earn 3 stars ${q.goal} time${q.goal > 1 ? 's' : ''}`;
    case 'clean': return `${q.goal} deliveries without a crash`;
    case 'night': return `Deliver at night ${q.goal > 1 ? `${q.goal} times` : 'once'}`;
    case 'friend': return `Deliver to ${who} ${q.goal} times`;
  }
}

/** Makes sure the save holds today's quests (3 distinct kinds, deterministic per date). */
export function ensureQuests(s: Save): Quest[] {
  const day = today();
  if (s.quests?.day === day) return s.quests.list;
  const r = rng(day);
  const kinds: Quest['kind'][] = ['deliver', 'fast', 'clean', 'night', 'friend'];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const make = (kind: Quest['kind']): Quest => {
    const base = { id: `${day}-${kind}`, kind, prog: 0, done: false };
    switch (kind) {
      case 'deliver': return { ...base, goal: 4 + Math.floor(r() * 3), reward: 80 };
      case 'fast': return { ...base, goal: 2 + Math.floor(r() * 2), reward: 110 };
      case 'clean': return { ...base, goal: 3, reward: 90 };
      case 'night': return { ...base, goal: 1 + Math.floor(r() * 2), reward: 120 };
      case 'friend': return { ...base, goal: 2, target: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)].id, reward: 100 };
    }
  };
  s.quests = { day, list: kinds.slice(0, 3).map(make) };
  persist(s);
  return s.quests.list;
}

/** Advances quest progress after a delivery. Returns the quests completed by it (rewards already paid). */
export function recordDelivery(s: Save, d: { stars: number; crashed: boolean; night: boolean; customer: string }): Quest[] {
  const finished: Quest[] = [];
  for (const q of ensureQuests(s)) {
    if (q.done) continue;
    if (q.kind === 'deliver') q.prog++;
    else if (q.kind === 'fast' && d.stars === 3) q.prog++;
    else if (q.kind === 'night' && d.night) q.prog++;
    else if (q.kind === 'friend' && q.target === d.customer) q.prog++;
    else if (q.kind === 'clean') {
      q.prog = d.crashed ? 0 : q.prog + 1; // must be consecutive
    }
    if (q.prog >= q.goal) {
      q.done = true;
      s.coins += q.reward;
      s.xp += 25;
      finished.push(q);
    }
  }
  persist(s);
  return finished;
}
