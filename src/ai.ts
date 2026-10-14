import type { Rel } from './state';

export interface Customer {
  id: string;
  name: string;
  emoji: string; // legacy, kept for text-only fallbacks
  persona: string;
  color: number; // pin ring colour
  x: number; // drive-to zone (on the road)
  y: number;
}

export const CUSTOMERS: Customer[] = [
  { id: 'maple', name: 'Granny Maple', emoji: '', persona: 'a warm grandmother who bakes pies and loves gossip', color: 0xff8fab, x: 320, y: 450 },
  { id: 'rex', name: 'Rex the Builder', emoji: '', persona: 'a cheerful, always-in-a-hurry construction foreman', color: 0xffa94d, x: 1600, y: 450 },
  { id: 'pixel', name: 'Pixel', emoji: '', persona: 'a quirky teenage streamer who talks in playful slang', color: 0xb197fc, x: 320, y: 850 },
  { id: 'doc', name: 'Dr. Whiskers', emoji: '', persona: 'a cat veterinarian who makes gentle cat puns', color: 0x63e6be, x: 960, y: 1130 },
  { id: 'cap', name: 'Captain Nemo', emoji: '', persona: 'a retired sea captain who tells tiny sea stories', color: 0x74c0fc, x: 1600, y: 850 },
];

export type Tag = 'first' | 'crash' | 'fast' | 'rain' | 'night' | 'late' | 'milestone' | 'fond' | 'ok' | 'greet';

// Each character reacts to what they remember. Used offline and whenever the AI call fails.
const VOICE: Record<string, Record<Tag, string>> = {
  maple: {
    first: "Oh, a new face! I'm Maple. Come in, come in. Well, deliver in.",
    crash: "Heard you bumped a car, dear. Are you hurt? Have some pie.",
    fast: "Fast as a rolling pin, you! Harold would've been impressed.",
    rain: 'In this weather? Bless you. Dry off by the oven.',
    night: "Delivering by moonlight! Aren't you a night owl.",
    late: "A little late, dear, but the pie's still warm. Mostly.",
    milestone: "That's {n} deliveries to my door. I should charge rent in pie.",
    fond: "You're the only driver who gets the good jam.",
    ok: "Right on time, just like Harold's old truck.",
    greet: 'There you are! I saved you a slice.',
  },
  rex: {
    first: "G'day! Rex. I build things. You drive things. We'll get on.",
    crash: 'Dinged a car? Happens. Measure twice, brake once, mate.',
    fast: "Quicker than my cement mixer! The crew's gonna hear about this.",
    rain: 'Pouring rain and you still showed up? Legend.',
    night: "Night shift delivery! We'll put you on the payroll.",
    late: "Bit late, but the wall's still standing. Cheers, mate.",
    milestone: '{n} deliveries! I should name a beam after you.',
    fond: "Honestly? Best driver on the site. Don't tell the others.",
    ok: 'Right on schedule. Beautiful.',
    greet: "Oi! Wondered when you'd roll back through.",
  },
  pixel: {
    first: "New driver alert! Chat, say hi. I'm Pixel.",
    crash: "Ooh, bumped a car? That's content. Are you okay though?",
    fast: 'Speedrun any%! Chat is spamming flames.',
    rain: 'Rain delivery arc! Chat says you are built different.',
    night: 'Midnight run? Absolute main-character energy.',
    late: 'Little late, but no cap, still appreciated.',
    milestone: '{n} deliveries!? Chat is making you a custom emote.',
    fond: "You're literally my favourite NPC. Er, person. Driver!",
    ok: 'On time! Chat claps. Chat is mostly bots, but still.',
    greet: "Yooo it's you! Chat, it's the driver!",
  },
  doc: {
    first: "Purr-leased to meet you. I'm Dr. Whiskers.",
    crash: 'A bump? Let me check you over. Fur-ward, no sudden stops.',
    fast: 'Faster than a cat chasing a laser. Impressive!',
    rain: "Out in the rain? Don't catch a cold. Or a hairball.",
    night: "A night delivery. You're the cat's whiskers, truly.",
    late: 'Late, but fur-given. The patients are patient.',
    milestone: '{n} deliveries and not a single hiss. Paw-some.',
    fond: "You're my favourite human. Don't tell the cats.",
    ok: 'Right on time. Purr-fect.',
    greet: "Welcome back! The kettle's on. And the cat's asleep on it.",
  },
  cap: {
    first: 'Ahoy, new hand! Captain Nemo. Mind the deck.',
    crash: 'Scraped a car, eh? Even the best ships kiss the dock.',
    fast: "Fair winds and quick! You'd outsail the Bosun.",
    rain: "Rough weather and you came through. That's real seamanship.",
    night: "A night run! Reminds me of Darwin, '78. Same stars.",
    late: 'Late tide, but you made port. Well done.',
    milestone: "{n} deliveries! I'll carve a notch on the mast.",
    fond: "You're more crew than customer now, mate.",
    ok: 'Smooth sailing. Right on the tide.',
    greet: 'There she is! Come aboard and warm up.',
  },
};

export interface SayCtx {
  stars: number;
  session: number;
  rel: Rel;
  weather: 'clear' | 'rain' | 'fog';
  night: boolean;
  crashed: boolean;
}

/** Picks the most relevant memory and returns the character's line for it. */
export function memoryTag(ctx: SayCtx): Tag {
  const r = ctx.rel;
  if (r.met <= 1) return 'first';
  if (ctx.crashed) return 'crash';
  if (ctx.stars === 3 && r.fast >= 3 && r.met % 3 === 0) return 'fast';
  if (ctx.weather === 'rain') return 'rain';
  if (ctx.night) return 'night';
  if (ctx.stars === 1) return 'late';
  if ([5, 10, 20, 30, 50].includes(r.met)) return 'milestone';
  if (r.aff >= 60) return 'fond';
  return 'ok';
}

export function localLine(c: Customer, tag: Tag, rel: Rel): string {
  return (VOICE[c.id]?.[tag] ?? VOICE[c.id]?.ok ?? 'Thanks!').replace('{n}', String(rel.met));
}

export const greeting = (c: Customer): string => VOICE[c.id].greet;

/** Ask the PHP endpoint for a memory-aware line; fall back to the local voice. */
export async function customerSays(c: Customer, ctx: SayCtx): Promise<string> {
  const fb = localLine(c, memoryTag(ctx), ctx.rel);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = ctx.rel;
    const res = await fetch('/api/chat.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Gameplay facts only. No names, no free text.
      body: JSON.stringify({
        customer: c.id,
        stars: ctx.stars,
        weather: ctx.weather,
        night: ctx.night,
        crashed: ctx.crashed,
        session: ctx.session,
        mem: { met: r.met, aff: Math.round(r.aff), fast: r.fast, late: r.late, crashes: r.crashes, rain: r.rain, night: r.night, tags: r.tags.slice(-4) },
      }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return fb;
    const data = await res.json();
    return typeof data.line === 'string' && data.line ? data.line : fb;
  } catch {
    return fb;
  }
}
