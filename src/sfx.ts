// Fully synthesized audio – no files. One master gain makes mute instant and click-free.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const setMuted = (m: boolean): void => {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
};

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.07, delay = 0, slideTo?: number): void {
  if (muted) return;
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

let noiseBuf: AudioBuffer | null = null;
function noise(): AudioBuffer {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export const sfx = {
  tap: () => tone(520, 0.08, 'triangle', 0.05),
  pick: () => {
    tone(440, 0.09, 'triangle');
    tone(660, 0.14, 'triangle', 0.07, 0.08);
  },
  coin: () => {
    tone(880, 0.1, 'square', 0.04);
    tone(1175, 0.18, 'square', 0.04, 0.09);
    tone(1568, 0.25, 'square', 0.035, 0.18);
  },
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.1)),
  bump: () => tone(120, 0.12, 'sawtooth', 0.05, 0, 60),
  crash: () => {
    tone(160, 0.35, 'sawtooth', 0.09, 0, 40);
    tone(90, 0.4, 'square', 0.06, 0.02, 35);
  },
  buy: () => {
    tone(600, 0.08, 'triangle');
    tone(900, 0.16, 'triangle', 0.07, 0.07);
  },
  /** Bus air-brake: a short filtered noise burst. */
  hiss: () => {
    if (muted) return;
    try {
      const c = ac();
      const t0 = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noise();
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2200;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      src.connect(f).connect(g).connect(master!);
      src.start(t0);
      src.stop(t0 + 0.6);
    } catch {
      /* audio unavailable */
    }
  },
  horn: () => {
    tone(349, 0.32, 'square', 0.035);
    tone(440, 0.32, 'square', 0.035);
  },
};

// ---- continuous layers ----
let engine: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;
let rainNode: { g: GainNode } | null = null;
let moodNight = 0;
let musicTimer = 0;
let beat = 0;

const DAY = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
const NIGHT = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]];

function note(freq: number, dur: number, type: OscillatorType, vol: number, attack = 0.02): void {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function tick(): void {
  const set = moodNight > 0.5 ? NIGHT : DAY;
  const chord = set[Math.floor(beat / 8) % 4];
  if (beat % 8 === 0) chord.forEach((f) => note(f / 2, 4.4, 'sine', 0.014, 1.2)); // soft pad
  if (beat % 2 === 0) note(chord[(beat / 2) % 3] * (beat % 4 === 0 ? 2 : 1), 1.1, 'triangle', moodNight > 0.5 ? 0.012 : 0.016); // arpeggio
  beat++;
}

export const audio = {
  suspend() {
    void ctx?.suspend();
  },
  resume() {
    if (ctx) void ctx.resume();
  },
  unlock() {
    try {
      ac();
    } catch {
      /* ignore */
    }
  },
  /** Starts the generative score (safe to call more than once). */
  music() {
    if (musicTimer || !ctx) return;
    musicTimer = window.setInterval(tick, 520);
  },
  mood(night: number) {
    moodNight = night;
  },
  /** Engine pitch/volume follows speed (0..1). */
  engine(norm: number, on: boolean) {
    if (muted || !ctx) return;
    if (!engine) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o1.type = 'sawtooth';
      o2.type = 'square';
      f.type = 'lowpass';
      f.frequency.value = 420;
      g.gain.value = 0;
      o1.connect(f);
      o2.connect(f);
      f.connect(g).connect(master!);
      o1.start();
      o2.start();
      engine = { o1, o2, g };
    }
    const t = ctx.currentTime;
    const f1 = 46 + norm * 120;
    engine.o1.frequency.setTargetAtTime(f1, t, 0.08);
    engine.o2.frequency.setTargetAtTime(f1 / 2, t, 0.08);
    engine.g.gain.setTargetAtTime(on ? 0.018 + norm * 0.03 : 0, t, 0.12);
  },
  /** Rain bed, 0..1. */
  rain(i: number) {
    if (!ctx) return;
    if (!rainNode) {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      f.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(master!);
      src.start();
      rainNode = { g };
    }
    rainNode.g.gain.setTargetAtTime(i * 0.07, ctx.currentTime, 0.4);
  },
  thunder() {
    if (muted || !ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t0);
    f.frequency.exponentialRampToValueAtTime(70, t0 + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.28, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    src.connect(f).connect(g).connect(master!);
    src.start(t0);
    src.stop(t0 + 2.5);
  },
  /** Ignition rev for the Start button. */
  rev() {
    tone(60, 0.9, 'sawtooth', 0.07, 0, 190);
    tone(30, 0.9, 'square', 0.05, 0, 95);
  },
};
