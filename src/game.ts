import Phaser from 'phaser';
import { CUSTOMERS, customerSays, greeting, type Customer } from './ai';
import { load, persist, levelOf, levelProgress, speedOf, rewardMul, upgradeCost, touchStreak, relOf, totalBeats, type Save } from './state';
import { STORY, NEED, KEEPSAKE, CHAPTERS, TAG_MEM, chapterOf, type Beat } from './story';
import { playScene, isDialogOpen } from './dialog';
import { SKINS, skinById, skinOwned } from './skins';
import { ensureQuests, recordDelivery, describe } from './quests';
import { shareCard } from './share';
import { sfx, audio, setMuted } from './sfx';
import { buildWorld, DEPOT, DEPOT_RECT, HOUSES, ROADS_H, ROADS_V, ROAD_W, WORLD_H, WORLD_W, type Rect, type Light } from './world';
import { avatarURL, addAvatarTextures } from './avatars';
import { WeatherFx, type Weather } from './weather';

const FONT = 'Fredoka, system-ui, sans-serif';
const el = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const STAR = (on: boolean) => `<svg class="${on ? '' : 'off'}" viewBox="0 0 24 24" width="42" height="42"><path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" fill="${on ? '#ffc233' : '#8c93ad'}" stroke="${on ? '#c78f00' : '#5d647f'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const ICON = {
  engine: '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffc233" stroke="#c78f00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  contract: '<svg viewBox="0 0 24 24" width="28" height="28"><ellipse cx="12" cy="7" rx="7" ry="3" fill="#ffc233" stroke="#c78f00"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="none" stroke="#c78f00" stroke-width="1.2"/></svg>',
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Optional real-world feed (public/data/live.json via api/live.php). Off unless the site owner enables it. */
interface Live {
  deliveries: number;
  onTimePct: number;
}
async function loadLive(): Promise<Live | null> {
  try {
    const r = await fetch('/api/live.php', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return d.enabled && Number.isFinite(d.deliveries) ? { deliveries: d.deliveries, onTimePct: Number(d.onTimePct) || 0 } : null;
  } catch {
    return null;
  }
}

const save: Save = load();
const streakBonus = touchStreak(save);
setMuted(save.muted);

/* ---------- time of day ---------- */
const DAY_LEN = 300; // seconds per full day
const KEYS: [number, number][] = [
  [0.0, 0x5d69a0], [0.2, 0x626ba2], [0.27, 0xffd9b8], [0.34, 0xffffff],
  [0.6, 0xffffff], [0.7, 0xffeed8], [0.76, 0xffd2a8], [0.84, 0x9484bf], [0.93, 0x5d69a0], [1.0, 0x5d69a0],
];
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a: number, b: number, t: number) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return (Math.round(r1 + (r2 - r1) * t) << 16) | (Math.round(g1 + (g2 - g1) * t) << 8) | Math.round(b1 + (b2 - b1) * t);
};
function ambientAt(t: number): number {
  for (let i = 1; i < KEYS.length; i++) {
    if (t <= KEYS[i][0]) {
      const [t0, c0] = KEYS[i - 1];
      const [t1, c1] = KEYS[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return KEYS[KEYS.length - 1][1];
}
const luminance = (c: number) => {
  const [r, g, b] = rgb(c);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
};

interface Job {
  to: Customer;
  limit: number;
  base: number;
  d: number;
  story?: Beat; // a story delivery: plays a scene on arrival
}

const HEART = (on: boolean) => `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1.1 4.2 2.4h3.6C14.6 6.1 16 5 18 5c3.3 0 5.1 3.400 3.600 6.800C19.500 16.400 12 21 12 21z" fill="${on ? '#ff5d73' : 'rgba(255,255,255,.16)'}"/></svg>`;
type Phase = 'idle' | 'toDepot' | 'toCust' | 'result';
type Axis = 'h' | 'v';
interface PedNode {
  x: number;
  y: number;
  n: { to: number; cross: boolean }[];
}
interface Ped {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  from: number;
  to: number;
  prev: number;
  t: number; // 0..1 along the current edge
  cross: boolean; // current edge is a zebra crossing
  speed: number;
  wait: number;
  seed: number;
  x: number;
  y: number;
}
interface Car {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image;
  x: number;
  y: number;
  angle: number;
  speed: number;
  top: number;
  axis: Axis;
  fixed: number;
  dir: 1 | -1;
  prev: number;
  wait: number;
  ignore: number;
  stun: number;
  bus: boolean; // longer, slower, stops at bus stops before intersections
  dwell: number; // seconds left standing at a bus stop
}

const LANE = 30;
const laneOff = (axis: Axis, dir: number) => (axis === 'h' ? (dir > 0 ? -LANE : LANE) : dir > 0 ? LANE : -LANE); // drive on the left, Aussie style

class HaulScene extends Phaser.Scene {
  private truck!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Image;
  private brake!: Phaser.GameObjects.Image;
  private fx!: Phaser.GameObjects.Graphics;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coins!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ambient!: Phaser.GameObjects.Rectangle;
  private lightSprites: { img: Phaser.GameObjects.Image; k: number }[] = [];
  private cars: Car[] = [];
  private obstacles: Rect[] = [];
  private keys!: { up: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[]; left: Phaser.Input.Keyboard.Key[]; right: Phaser.Input.Keyboard.Key[] };
  private pad = { up: false, down: false, left: false, right: false };
  private angle_ = -Math.PI / 2;
  private speed = 0;
  private dustT = 0;
  private bumpT = 0;
  private crashT = 0;

  private tod = 0.69; // golden hour
  private night = 0;
  private wfx!: WeatherFx;
  private wTimer = 45;
  private zoomMul = 1;
  private intro = true;
  private introTween: Phaser.Tweens.Tween | null = null;

  private phase: Phase = 'idle';
  private job: Job | null = null;
  private timeLeft = 0;
  private combo = 0;
  private session = 0;
  private bubble: Phaser.GameObjects.Container | null = null;
  private typer: Phaser.Time.TimerEvent | null = null;
  private badges = new Map<string, Phaser.GameObjects.Container>(); // "!" over customers with a story ready
  private tripCrashes = 0;
  private paused = false;
  private live: Live | null = null;
  private nodes: PedNode[] = [];
  private peds: Ped[] = [];
  private pedT = 0;
  private miniBase!: HTMLCanvasElement;

  constructor() {
    super('haul');
  }

  create() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    this.makeTextures();
    addAvatarTextures(this);
    const world = buildWorld(this);
    this.obstacles = world.obstacles;
    this.addPins();

    const skinKey = `truck_${skinOwned(save, skinById(save.skin)) ? save.skin : 'classic'}`;
    this.shadow = this.add.image(0, 0, skinKey).setScale(0.5).setTint(0x000000).setAlpha(0.3).setDepth(9);
    this.truck = this.add.image(DEPOT.x, DEPOT.y + 130, skinKey).setScale(0.5).setDepth(10).setRotation(this.angle_);
    this.spawnTraffic();
    this.buildPedGraph();
    this.spawnPeds();

    // lighting: multiply overlay for ambient colour, additive sprites for lamps/headlights
    this.ambient = this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff).setOrigin(0).setDepth(30).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.buildLights(world.lights);
    this.beam = this.add.image(0, 0, 'cone').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setDisplaySize(330, 190).setTint(0xfff1c8).setAlpha(0);
    this.brake = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setDisplaySize(70, 70).setTint(0xff3b3b).setAlpha(0);

    this.fx = this.add.graphics().setDepth(50);
    this.dust = this.add.particles(0, 0, 'dot', { lifespan: 520, speed: { min: 8, max: 40 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.55, end: 0 }, tint: 0xf1ecdc, emitting: false }).setDepth(8);
    this.coins = this.add.particles(0, 0, 'coin', { lifespan: 1000, speed: { min: 140, max: 360 }, gravityY: 420, scale: { start: 1, end: 0.3 }, rotate: { start: 0, end: 360 }, emitting: false }).setDepth(60);

    cam.startFollow(this.truck, true, 0.09, 0.09);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    kb.on('keydown-SPACE', () => (this.intro ? this.finishIntro() : isDialogOpen() ? undefined : sfx.horn()));
    this.input.on('pointerdown', () => this.intro && this.finishIntro());
    this.bindPad();

    // pause: P / Esc, and automatically when the tab is hidden
    window.addEventListener('keydown', (e) => {
      if (isDialogOpen()) return;
      if (e.code === 'Escape') {
        if (this.modalOpen()) this.closeModals();
        else this.togglePause();
      } else if (e.code === 'KeyP') this.togglePause();
    });
    document.addEventListener('visibilitychange', () => document.hidden && this.togglePause(true));
    el('resumeBtn').onclick = () => this.togglePause(false);
    void loadLive().then((l) => {
      this.live = l;
      el('livePill').hidden = !l;
      if (l) el('liveTxt').textContent = `Alpha today: ${l.deliveries} deliveries${l.onTimePct ? ` · ${Math.round(l.onTimePct)}% on time` : ''}`;
      if (this.phase === 'idle') this.offerJobs();
    });

    this.wfx = new WeatherFx();
    this.wfx.onThunder = () => audio.thunder();
    if (import.meta.env.DEV) (window as unknown as { __haul: HaulScene }).__haul = this; // dev-only test hook
    ensureQuests(save); // today's three quests
    this.miniBase = this.buildMiniBase();
    this.bindUi();
    this.time.addEvent({ delay: 90, loop: true, callback: () => this.hudTick() });
    this.refreshProfile();
    this.startIntro();
  }

  /* ---------- accessibility helpers ---------- */

  private fxShake(ms: number, intensity: number) {
    if (!reduceMotion) this.cameras.main.shake(ms, intensity);
  }

  private fxFlash(ms: number, r: number, g: number, b: number) {
    if (!reduceMotion) this.cameras.main.flash(ms, r, g, b, false);
  }

  private modalOpen(): boolean {
    return !!document.querySelector('#garage.on, #journal.on, #quests.on, #epilogue.on');
  }

  private closeModals() {
    document.querySelectorAll('#garage.on, #journal.on, #quests.on, #epilogue.on').forEach((m) => m.classList.remove('on'));
  }

  togglePause(force?: boolean) {
    if (this.intro || isDialogOpen()) return;
    const p = force ?? !this.paused;
    if (p === this.paused) return;
    this.paused = p;
    el('pause').classList.toggle('on', p);
    if (p) {
      this.scene.pause();
      audio.suspend();
      el('resumeBtn').focus();
    } else {
      this.scene.resume();
      audio.resume();
    }
  }

  /** Extra coins when the real Alpha Trucking day is busy (+1% per 4 real deliveries, max 25%). */
  private liveBonus(): number {
    return this.live ? Math.min(25, Math.floor(this.live.deliveries / 4)) / 100 : 0;
  }

  /* ---------- cinematic intro ---------- */

  private startIntro() {
    const cam = this.cameras.main;
    this.intro = true;
    if (reduceMotion) {
      // no camera sweep: show the chapter title briefly, then start
      el('ui').classList.add('intro');
      const c = el('chapter');
      const ch = CHAPTERS[chapterOf(totalBeats(save))];
      c.querySelector('.k')!.textContent = ch.k;
      c.querySelector('.t')!.textContent = ch.t;
      c.classList.add('show');
      this.time.delayedCall(1400, () => this.finishIntro());
      audio.music();
      return;
    }
    this.zoomMul = 0.5;
    cam.setRotation(0.1);
    this.applyZoom();
    el('ui').classList.add('intro');
    const card = el('chapter');
    const ch = CHAPTERS[chapterOf(totalBeats(save))]; // returning players resume at their current chapter
    card.querySelector('.k')!.textContent = ch.k;
    card.querySelector('.t')!.textContent = ch.t;
    card.querySelector('.s')!.textContent = 'Press space to skip';
    card.classList.add('show');
    this.introTween = this.tweens.add({
      targets: this,
      zoomMul: 1,
      duration: 3600,
      ease: 'Cubic.inOut',
      onUpdate: () => this.applyZoom(),
    });
    this.tweens.add({ targets: cam, rotation: 0, duration: 3600, ease: 'Cubic.inOut' });
    this.time.delayedCall(3900, () => this.finishIntro());
    audio.music();
  }

  finishIntro() {
    if (!this.intro) return;
    this.intro = false;
    this.introTween?.stop();
    this.zoomMul = 1;
    this.cameras.main.setRotation(0);
    this.applyZoom();
    el('chapter').classList.remove('show');
    el('ui').classList.remove('intro');
    if (streakBonus) this.toast(`${save.streak}-day streak! +${streakBonus} coins`);
    // the character who likes you most says hello
    const fav = CUSTOMERS.filter((c) => relOf(save, c.id).met > 0).sort((a, b) => relOf(save, b.id).aff - relOf(save, a.id).aff)[0];
    if (fav) window.setTimeout(() => this.toast(`<img class="mini" alt="" src="${avatarURL(fav.id, 48)}"> ${esc(fav.name)}: “${esc(greeting(fav))}”`, 3600), streakBonus ? 2800 : 600);
    this.offerJobs();
    if (!save.tutorial) el('coach').style.display = 'block';
  }

  /* ---------- setup helpers ---------- */

  private canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    const t = this.textures.createCanvas(key, w, h)!;
    draw(t.getContext());
    t.refresh();
  }

  private makeTextures() {
    const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) => {
      c.fillStyle = fill;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    };
    // Trucks (face right), one texture per paint job, drawn at 2x
    SKINS.forEach((sk) =>
      this.canvasTex(`truck_${sk.id}`, 192, 112, (c) => {
        c.scale(2, 2);
        [[12, 3], [12, 47], [70, 5], [70, 45]].forEach(([x, y]) => rr(c, x, y, 14, 6, 2, '#161b30'));
        const tg = c.createLinearGradient(0, 7, 0, 49);
        tg.addColorStop(0, sk.trailer[0]);
        tg.addColorStop(1, sk.trailer[1]);
        c.fillStyle = tg;
        c.beginPath();
        c.roundRect(3, 7, 61, 42, 5);
        c.fill();
        rr(c, 7, 11, 53, 34, 3, sk.panel);
        rr(c, 6, 24, 55, 8, 2, sk.stripe);
        c.fillStyle = sk.ink;
        c.font = '700 13px Fredoka, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('DVN', 33.5, 17.5);
        c.fillText('HAUL', 33.5, 38.5);
        [[14, 13], [46, 13], [14, 43], [46, 43]].forEach(([x, y]) => rr(c, x, y - 2, 7, 3, 1, 'rgba(0,0,0,.18)'));
        rr(c, 66, 10, 27, 36, 6, sk.cab[0]);
        rr(c, 68, 12, 14, 32, 4, sk.cab[1]);
        rr(c, 80, 14, 9, 28, 3, '#8fd3ff');
        rr(c, 81, 15, 3, 26, 1.5, 'rgba(255,255,255,.55)');
        rr(c, 92, 13, 3, 6, 1, '#ffe08a');
        rr(c, 92, 37, 3, 6, 1, '#ffe08a');
        rr(c, 2, 12, 2, 6, 1, '#ff5d73');
        rr(c, 2, 38, 2, 6, 1, '#ff5d73');
      }),
    );
    // Cars in 5 colours
    ['#e5605a', '#3fa7d6', '#f2b84b', '#6bbf8a', '#9b7fd1'].forEach((col, i) => {
      this.canvasTex(`car${i}`, 112, 60, (c) => {
        c.scale(2, 2);
        [[8, 1], [8, 25], [34, 1], [34, 25]].forEach(([x, y]) => rr(c, x, y, 12, 4, 1.5, '#161b30'));
        rr(c, 2, 4, 52, 22, 7, col);
        rr(c, 22, 6, 22, 18, 4, 'rgba(0,0,0,.22)');
        rr(c, 24, 7, 18, 16, 3, col);
        rr(c, 40, 7, 8, 16, 3, '#8fd3ff');
        rr(c, 18, 7, 5, 16, 2, '#6aa6c9');
        rr(c, 52, 6, 3, 5, 1, '#fff3b0');
        rr(c, 52, 19, 3, 5, 1, '#fff3b0');
        rr(c, 1, 7, 2, 4, 1, '#ff5d5d');
        rr(c, 1, 19, 2, 4, 1, '#ff5d5d');
      });
    });
    // Pedestrians (top-down, walking right): shoulders + head, 5 outfits
    [['#e5605a', '#f1c9a5'], ['#3fa7d6', '#d9a273'], ['#f2b84b', '#f0c4a8'], ['#6bbf8a', '#8d5a3b'], ['#9b7fd1', '#e3b58f']].forEach(([shirt, skin], i) => {
      this.canvasTex(`ped${i}`, 32, 32, (c) => {
        c.scale(2, 2);
        c.fillStyle = shirt;
        c.beginPath();
        c.ellipse(8, 8, 3.2, 6.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = skin;
        c.beginPath();
        c.arc(8.6, 8, 3.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(40,25,20,.75)';
        c.beginPath();
        c.arc(8, 8, 3.2, Math.PI * 0.55, Math.PI * 1.45); // hair on the back of the head
        c.fill();
      });
    });
    // City bus (faces right): long body, window band, roof vents, DVN Transit stripe
    this.canvasTex('bus', 200, 68, (c) => {
      c.scale(2, 2);
      [[14, 1], [14, 29], [72, 1], [72, 29]].forEach(([x, y]) => rr(c, x, y, 14, 4, 1.5, '#161b30'));
      rr(c, 2, 3, 96, 28, 7, '#e9eef8');
      rr(c, 2, 3, 96, 28, 7, 'rgba(0,0,0,.06)');
      rr(c, 4, 5, 92, 24, 5, '#f6f8fd');
      rr(c, 4, 14, 92, 6, 1, '#2ee6c5');
      for (let i = 0; i < 6; i++) rr(c, 8 + i * 14, 7, 11, 5, 1.5, '#8fd3ff');
      for (let i = 0; i < 6; i++) rr(c, 8 + i * 14, 22, 11, 5, 1.5, '#8fd3ff');
      rr(c, 12, 11, 6, 12, 2, '#d3dbea');
      rr(c, 40, 10, 8, 14, 2, '#d3dbea');
      rr(c, 86, 6, 10, 22, 4, '#8fd3ff');
      rr(c, 96, 6, 3, 5, 1, '#ffe08a');
      rr(c, 96, 23, 3, 5, 1, '#ffe08a');
      rr(c, 1, 7, 2, 5, 1, '#ff5d73');
      rr(c, 1, 22, 2, 5, 1, '#ff5d73');
    });
    this.canvasTex('dot', 16, 16, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(8, 8, 8, 0, Math.PI * 2);
      c.fill();
    });
    this.canvasTex('coin', 18, 18, (c) => {
      c.fillStyle = '#c78f00';
      c.beginPath();
      c.arc(9, 9, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffc233';
      c.beginPath();
      c.arc(9, 9, 7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff3b0';
      c.beginPath();
      c.arc(7, 7, 3, 0, Math.PI * 2);
      c.fill();
    });
    this.canvasTex('glow', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,.85)');
      g.addColorStop(0.35, 'rgba(255,255,255,.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    this.canvasTex('cone', 256, 128, (c) => {
      const g = c.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, 'rgba(255,255,255,.8)');
      g.addColorStop(0.5, 'rgba(255,255,255,.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.filter = 'blur(5px)';
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 56);
      c.lineTo(250, 6);
      c.lineTo(250, 122);
      c.lineTo(0, 72);
      c.closePath();
      c.fill();
    });
  }

  private buildLights(lights: Light[]) {
    lights.forEach((l) => {
      const img = this.add.image(l.x, l.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setDisplaySize(l.r * 2, l.r * 2).setTint(l.color).setAlpha(0);
      this.lightSprites.push({ img, k: 0.5 });
    });
  }

  private txt(x: number, y: number, s: string, size: number, color = '#ffffff', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra }).setResolution(2).setOrigin(0.5);
  }

  private addPins() {
    const pin = (x: number, y: number, id: string, name: string) => {
      const c = this.add.container(x, y).setDepth(35);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.28).fillEllipse(3, 44, 42, 12);
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, 33).fillTriangle(-9, 28, 9, 28, 0, 42);
      const face = this.add.image(0, 0, `av_${id}`).setDisplaySize(56, 56);
      const tag = this.txt(0, 56, name, 14, '#ffffff', { backgroundColor: '#121a33dd', padding: { x: 9, y: 3 }, fontStyle: '600' });
      c.add([g, face, tag]);
      this.tweens.add({ targets: c, y: y - 6, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return c;
    };
    CUSTOMERS.forEach((cu) => {
      const h = HOUSES[cu.id].rect;
      const c = pin(h.x + h.w / 2, h.y - 26, cu.id, cu.name);
      // story marker: gold "!" badge
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.25).fillCircle(2, 3, 15).fillStyle(0xffffff, 1).fillCircle(0, 0, 15).fillStyle(0xffc233, 1).fillCircle(0, 0, 12);
      const bang = this.txt(0, 1, '!', 20, '#121a33', { fontStyle: '700' });
      const badge = this.add.container(30, -30, [bg, bang]).setVisible(false);
      this.tweens.add({ targets: badge, scale: 1.2, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      c.add(badge);
      this.badges.set(cu.id, badge);
    });
    pin(DEPOT_RECT.x + DEPOT_RECT.w / 2, DEPOT_RECT.y - 26, 'depot', 'DVN Depot');
  }

  private applyZoom() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(w / 1000, h / 640), 0.62, 1.3) * this.zoomMul);
  }

  /** On-screen D-pad for touch devices. */
  private bindPad() {
    document.querySelectorAll<HTMLButtonElement>('#pad button').forEach((b) => {
      const dir = b.dataset.dir as keyof typeof this.pad;
      const set = (v: boolean) => (e: Event) => {
        e.preventDefault();
        this.pad[dir] = v;
        b.classList.toggle('down', v);
      };
      b.addEventListener('pointerdown', set(true));
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, set(false)));
    });
  }

  private dismissCoach() {
    if (save.tutorial) return;
    save.tutorial = true;
    persist(save);
    el('coach').style.display = 'none';
  }

  private buildMiniBase(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 280;
    c.height = 186;
    const x = c.getContext('2d')!;
    const s = 280 / WORLD_W;
    x.fillStyle = '#7d8f4c';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#4a444f';
    ROADS_V.forEach((rx) => x.fillRect((rx - ROAD_W / 2) * s, 0, ROAD_W * s, c.height));
    ROADS_H.forEach((ry) => x.fillRect(0, (ry - ROAD_W / 2) * s, c.width, ROAD_W * s));
    return c;
  }

  /* ---------- traffic (left-hand drive) ---------- */

  private spawnTraffic() {
    for (let i = 0; i < 13; i++) {
      const bus = i >= 10; // 10 cars + 3 buses
      const axis: Axis = i % 2 ? 'h' : 'v';
      const roads = axis === 'h' ? ROADS_H : ROADS_V;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const fixed = roads[Math.floor(Math.random() * roads.length)];
      let pos = 0;
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 60; tries++) {
        pos = 80 + Math.random() * ((axis === 'h' ? WORLD_W : WORLD_H) - 160);
        x = axis === 'h' ? pos : fixed + laneOff(axis, dir);
        y = axis === 'h' ? fixed + laneOff(axis, dir) : pos;
        // never spawn near the truck (that was the "traffic appears on top of me" bug) or on top of another vehicle
        if (dist({ x, y }, this.truck) > 520 && this.cars.every((o) => dist({ x, y }, o) > 150)) break;
      }
      const key = bus ? 'bus' : `car${i % 5}`;
      const angle = axis === 'h' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const sc = bus ? 0.6 : 0.5; // buses are bigger than cars
      const shadow = this.add.image(x, y, key).setScale(sc).setTint(0x000000).setAlpha(0.28).setDepth(8);
      const img = this.add.image(x, y, key).setScale(sc).setDepth(bus ? 9.5 : 9);
      const beam = this.add.image(x, y, 'cone').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setDisplaySize(bus ? 220 : 170, bus ? 120 : 100).setTint(0xfff1c8).setAlpha(0);
      this.cars.push({ img, shadow, beam, x, y, angle, speed: 0, top: bus ? 70 + Math.random() * 25 : 95 + Math.random() * 55, axis, fixed, dir, prev: pos, wait: 0, ignore: 0, stun: 0, bus, dwell: 0 });
    }
  }

  private updateCar(c: Car, s: number) {
    const heading = c.axis === 'h' ? (c.dir > 0 ? 0 : Math.PI) : c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    c.angle += Phaser.Math.Angle.Wrap(heading - c.angle) * Math.min(1, 6 * s);

    const look = c.bus ? 88 : 64;
    const ax = c.x + Math.cos(c.angle) * look;
    const ay = c.y + Math.sin(c.angle) * look;
    let block = c.stun > 0 || c.dwell > 0; // dwell = standing at a bus stop
    c.stun -= s;
    c.dwell -= s;
    if (!block && c.ignore <= 0) {
      block = dist({ x: ax, y: ay }, this.truck) < (c.bus ? 54 : 44) || this.cars.some((o) => o !== c && dist({ x: ax, y: ay }, o) < (o.bus ? 54 : 38));
      // also yield to anything inside a forward cone, so cross traffic at intersections stops for us instead of ramming
      if (!block) {
        const fx = Math.cos(c.angle);
        const fy = Math.sin(c.angle);
        const inCone = (o: { x: number; y: number }, r: number) => {
          const dx = o.x - c.x;
          const dy = o.y - c.y;
          const d = Math.hypot(dx, dy);
          return d < r && (dx * fx + dy * fy) / (d || 1) > 0.55;
        };
        block = inCone(this.truck, c.bus ? 120 : 96) || this.cars.some((o) => o !== c && inCone(o, 70));
      }
    }
    // pedestrians on a zebra crossing always have right of way, even when the deadlock-breaker is active
    if (!block) {
      const fx = Math.cos(c.angle);
      const fy = Math.sin(c.angle);
      block = this.peds.some((p) => {
        if (!this.pedCrossing(p)) return false;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.hypot(dx, dy);
        return d < 36 || (d < 120 && (dx * fx + dy * fy) / (d || 1) > 0.5);
      });
    }
    c.ignore -= s;
    const target = block ? 0 : c.top * (1 - 0.2 * this.wfx.rain);
    c.speed += Phaser.Math.Clamp(target - c.speed, -430 * s, 150 * s);
    if (block && c.speed < 8) {
      c.wait += s;
      if (c.wait > 1.8) {
        c.ignore = 1.6; // break deadlocks at intersections
        c.wait = 0;
      }
    } else c.wait = 0;

    c.x += Math.cos(c.angle) * c.speed * s;
    c.y += Math.sin(c.angle) * c.speed * s;
    if (c.axis === 'h') c.y += (c.fixed + laneOff('h', c.dir) - c.y) * Math.min(1, 5 * s);
    else c.x += (c.fixed + laneOff('v', c.dir) - c.x) * Math.min(1, 5 * s);

    let along = c.axis === 'h' ? c.x : c.y;
    if (c.bus) {
      // bus stop: halt for a few seconds on the approach to each intersection (before the crosswalk)
      for (const r of c.axis === 'h' ? ROADS_V : ROADS_H) {
        const stop = r - c.dir * 150;
        if ((c.prev - stop) * (along - stop) <= 0 && c.prev !== along) {
          c.dwell = 2.2 + Math.random() * 1.6;
          if (dist(c, this.truck) < 480) sfx.hiss(); // only audible when the bus is near
        }
      }
    }
    for (const r of c.axis === 'h' ? ROADS_V : ROADS_H) {
      if ((c.prev - r) * (along - r) <= 0 && c.prev !== along && Math.random() < (c.bus ? 0.2 : 0.35)) {
        c.axis = c.axis === 'h' ? 'v' : 'h';
        c.fixed = r;
        c.dir = Math.random() < 0.5 ? 1 : -1;
        along = c.axis === 'h' ? c.x : c.y;
        break;
      }
    }
    c.prev = along;
    if (c.x < -90) c.x = WORLD_W + 90;
    else if (c.x > WORLD_W + 90) c.x = -90;
    if (c.y < -90) c.y = WORLD_H + 90;
    else if (c.y > WORLD_H + 90) c.y = -90;

    c.img.setPosition(c.x, c.y).setRotation(c.angle);
    c.shadow.setPosition(c.x + 5, c.y + 7).setRotation(c.angle);
    const nose = c.bus ? 46 : 26;
    c.beam.setPosition(c.x + Math.cos(c.angle) * nose, c.y + Math.sin(c.angle) * nose).setRotation(c.angle).setAlpha(this.night * 0.5);

    if (dist(c, this.truck) < (c.bus ? 62 : 46) && this.time.now > this.crashT) this.crash(c);
  }

  private crash(c: Car) {
    const atFault = Math.abs(this.speed) > 40; // a parked or crawling truck is never blamed
    this.crashT = this.time.now + 1300;
    // separate the two vehicles so they don't stay overlapped: shove the car away, bounce the truck back
    const away = Phaser.Math.Angle.Between(this.truck.x, this.truck.y, c.x, c.y);
    const cx = c.x + Math.cos(away) * 34;
    const cy = c.y + Math.sin(away) * 34;
    if (!this.blocked(cx, cy)) {
      c.x = cx;
      c.y = cy;
    }
    const tx = this.truck.x - Math.cos(away) * 16;
    const ty = this.truck.y - Math.sin(away) * 16;
    if (!this.blocked(tx, ty)) this.truck.setPosition(tx, ty);
    c.speed = 0;
    c.ignore = 0;
    c.wait = 0;
    c.stun = atFault ? 1.6 : 2.4; // the car waits it out instead of driving through us
    if (!atFault) {
      sfx.bump();
      return;
    }
    this.speed = -Math.abs(this.speed) * 0.35;
    this.combo = 0;
    this.tripCrashes++;
    sfx.crash();
    navigator.vibrate?.(60);
    this.fxShake(220, 0.009);
    this.floatText(this.truck.x, this.truck.y - 40, this.phase === 'toCust' ? 'Crash! -3s' : 'Crash!', '#ff8a8a');
    if (this.phase === 'toCust') this.timeLeft -= 3;
  }

  /* ---------- pedestrians ---------- */

  /** Sidewalk graph: 4 corner nodes per intersection, joined by sidewalks and zebra crossings. */
  private buildPedGraph() {
    const idx = (i: number, j: number, sx: number, sy: number) => (i * 3 + j) * 4 + (sx > 0 ? 2 : 0) + (sy > 0 ? 1 : 0);
    this.nodes = Array.from({ length: ROADS_V.length * ROADS_H.length * 4 }, () => ({ x: 0, y: 0, n: [] }));
    ROADS_V.forEach((cx, i) =>
      ROADS_H.forEach((cy, j) => {
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const node = this.nodes[idx(i, j, sx, sy)];
            node.x = cx + sx * 68;
            node.y = cy + sy * 68;
            node.n.push({ to: idx(i, j, -sx, sy), cross: true }, { to: idx(i, j, sx, -sy), cross: true });
            if (sx > 0 && i < ROADS_V.length - 1) node.n.push({ to: idx(i + 1, j, -1, sy), cross: false });
            if (sx < 0 && i > 0) node.n.push({ to: idx(i - 1, j, 1, sy), cross: false });
            if (sy > 0 && j < ROADS_H.length - 1) node.n.push({ to: idx(i, j + 1, sx, -1), cross: false });
            if (sy < 0 && j > 0) node.n.push({ to: idx(i, j - 1, sx, 1), cross: false });
          }
        }
      }),
    );
  }

  private spawnPeds() {
    for (let i = 0; i < 16; i++) {
      const from = Math.floor(Math.random() * this.nodes.length);
      const pick = Phaser.Utils.Array.GetRandom(this.nodes[from].n);
      const key = `ped${i % 5}`;
      const shadow = this.add.image(0, 0, key).setScale(0.64).setTint(0x000000).setAlpha(0.28).setDepth(6);
      const img = this.add.image(0, 0, key).setScale(0.64).setDepth(7);
      this.peds.push({ img, shadow, from, to: pick.to, prev: -1, t: Math.random() * 0.9, cross: pick.cross, speed: 30 + Math.random() * 14, wait: Math.random() * 2, seed: Math.random() * 6, x: 0, y: 0 });
    }
  }

  private pedCrossing(p: Ped): boolean {
    return p.cross && p.t > 0.02 && p.t < 0.98;
  }

  /** True while vehicles are close to the zebra crossing between A and B and still moving. */
  private crossBusy(a: PedNode, b: PedNode): boolean {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return this.cars.some((c) => c.speed > 18 && dist(c, mid) < 150) || (Math.abs(this.speed) > 30 && dist(this.truck, mid) < 150);
  }

  private updatePeds(s: number) {
    for (const p of this.peds) {
      let a = this.nodes[p.from];
      let b = this.nodes[p.to];
      if (p.wait > 0) p.wait -= s;
      else if (p.t === 0 && p.cross && this.crossBusy(a, b)) p.wait = 0.35; // wait at the curb for a gap
      else {
        p.t += (p.speed * s) / Math.max(1, dist(a, b));
        if (p.t >= 1) {
          const opts = this.nodes[p.to].n.filter((o) => o.to !== p.from);
          const pick = Phaser.Utils.Array.GetRandom(opts.length ? opts : this.nodes[p.to].n);
          p.prev = p.from;
          p.from = p.to;
          p.to = pick.to;
          p.cross = pick.cross;
          p.t = 0;
          a = this.nodes[p.from];
          b = this.nodes[p.to];
        }
      }
      p.x = a.x + (b.x - a.x) * p.t;
      p.y = a.y + (b.y - a.y) * p.t;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const bob = 0.64 * (1 + 0.07 * Math.sin(this.time.now * 0.016 + p.seed));
      p.img.setPosition(p.x, p.y).setRotation(ang).setScale(bob);
      p.shadow.setPosition(p.x + 3, p.y + 4).setRotation(ang).setScale(bob);

      // running someone over is just like a crash: combo reset and a time penalty
      if (this.pedCrossing(p) && Math.abs(this.speed) > 25 && dist(this.truck, p) < 30 && this.time.now > this.pedT) {
        this.pedT = this.time.now + 2000;
        p.wait = 1.4;
        this.combo = 0;
        this.speed *= 0.3;
        sfx.bump();
        this.floatText(this.truck.x, this.truck.y - 40, this.phase === 'toCust' ? 'Careful! -2s' : 'Careful!', '#ffb38a');
        if (this.phase === 'toCust') this.timeLeft -= 2;
      }
    }
  }

  /* ---------- UI ---------- */

  private bindUi() {
    el('garageBtn').onclick = () => {
      sfx.tap();
      this.openGarage();
    };
    el('garageClose').onclick = () => el('garage').classList.remove('on');
    el('journalBtn').onclick = () => {
      sfx.tap();
      this.openJournal();
    };
    el('journalClose').onclick = () => el('journal').classList.remove('on');
    el('questsBtn').onclick = () => {
      sfx.tap();
      this.openQuests();
    };
    el('questsClose').onclick = () => el('quests').classList.remove('on');
    el('shareBtn').onclick = async () => {
      sfx.tap();
      el('shareBtn').textContent = 'Making your card…';
      try {
        const r = await shareCard(save);
        this.toast(r === 'shared' ? 'Shared!' : 'Card saved to your downloads');
      } catch {
        this.toast('Could not make the card');
      }
      el('shareBtn').textContent = 'Share my progress';
    };
    el('epilogueClose').onclick = () => el('epilogue').classList.remove('on');
    const syncSound = () => {
      el('soundBtn').textContent = save.muted ? 'Off' : 'On';
      el('soundBtn').setAttribute('aria-pressed', String(!save.muted));
    };
    syncSound();
    el('soundBtn').onclick = () => {
      save.muted = !save.muted;
      setMuted(save.muted);
      persist(save);
      syncSound();
      sfx.tap();
    };
    el('objCancel').onclick = () => {
      if (this.phase !== 'toDepot' && this.phase !== 'toCust') return;
      this.combo = 0;
      this.job = null;
      this.setPhase('idle');
      this.offerJobs();
    };
  }

  private toast(html: string, ms = 2400) {
    const t = el('toast');
    t.innerHTML = html;
    t.classList.add('on');
    window.setTimeout(() => t.classList.remove('on'), ms);
  }

  private refreshProfile() {
    el('coinTxt').textContent = save.coins.toLocaleString();
    el('lvl').textContent = String(levelOf(save.xp));
    el('ring').style.setProperty('--p', String(Math.round(levelProgress(save.xp) * 100)));
    el('sub').textContent = `${save.streak}-day streak · ${save.deliveries} deliveries`;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    el('objective').classList.toggle('on', p === 'toDepot' || p === 'toCust');
    el('sheet').classList.toggle('on', p === 'idle' || p === 'result');
    if (p === 'toDepot' && this.job) {
      el('objTitle').innerHTML = `Pick up ${this.job.story ? `the <b>${esc(this.job.story.item)}</b>` : 'cargo'} at the <b>DVN Depot</b>`;
      el('objBar').style.visibility = 'hidden';
    } else if (p === 'toCust' && this.job) {
      el('objTitle').innerHTML = `${this.job.story ? `Take the ${esc(this.job.story.item)} to` : 'Deliver to'} <img class="mini" alt="" src="${avatarURL(this.job.to.id, 48)}"> <b>${esc(this.job.to.name)}</b>`;
      el('objBar').style.visibility = 'visible';
    }
  }

  /** Characters whose next story beat is unlocked by their friendship level. */
  private storyReady(): Customer[] {
    return CUSTOMERS.filter((c) => {
      const r = relOf(save, c.id);
      return r.beats < 3 && r.aff >= NEED[r.beats];
    });
  }

  private updateBadges() {
    const ready = new Set(this.storyReady().map((c) => c.id));
    this.badges.forEach((b, id) => b.setVisible(ready.has(id)));
    el('journalBtn').classList.toggle('dot', ready.size > 0);
  }

  private offerJobs() {
    const spd = speedOf(save);
    const mk = (to: Customer, story?: Beat): Job => {
      const d = dist(DEPOT, to) * 1.25;
      const limit = Math.round(d / (spd * 0.72)) + 9;
      return { to, d, story, limit: story ? Math.round(limit * 1.6) + 6 : limit, base: story ? story.reward : Math.round(20 + d / 14) };
    };
    const ready = this.storyReady();
    const sc = ready.length ? Phaser.Utils.Array.GetRandom(ready) : null; // one story job per offer
    const jobs: Job[] = Phaser.Utils.Array.Shuffle(CUSTOMERS.filter((c) => c !== sc))
      .slice(0, sc ? 2 : 3)
      .map((c) => mk(c))
      .sort((a, b) => a.d - b.d);
    if (sc) jobs.unshift(mk(sc, STORY[sc.id][relOf(save, sc.id).beats]));
    this.updateBadges();
    const sheet = el('sheet');
    sheet.innerHTML = `<h3>CHOOSE YOUR NEXT JOB${this.combo >= 2 ? ` · combo x${this.combo}` : ''}</h3><div class="jobs">${jobs
      .map((j, i) => {
        const len = j.d < 700 ? 'Short' : j.d < 1100 ? 'Medium' : 'Long';
        const pay = Math.round(j.base * rewardMul(save) * (1 + this.liveBonus()));
        const face = `<img class="face" alt="" src="${avatarURL(j.to.id, 80)}">`;
        if (j.story) return `<button class="job story" data-i="${i}"><span class="badge">STORY</span><div class="who">${face}${esc(j.to.name)}</div><div class="st">${esc(j.story.title)}</div><div class="item">Carry: ${esc(j.story.item)}</div><div class="meta"><span>${j.limit}s</span><span class="pay">${pay} coins</span></div></button>`;
        return `<button class="job" data-i="${i}"><div class="who">${face}${esc(j.to.name)}</div><span class="tag ${len}">${len}</span><div class="meta"><span>${j.limit}s</span><span class="pay">~${pay} coins</span></div></button>`;
      })
      .join('')}</div>`;
    sheet.querySelectorAll<HTMLButtonElement>('.job').forEach((b) => {
      b.onclick = () => {
        sfx.tap();
        el('coach').style.display = 'none';
        this.job = jobs[Number(b.dataset.i)];
        this.setPhase('toDepot');
      };
    });
    this.clearBubble();
    this.setPhase('idle');
  }

  /** The Town Journal: friendship, story progress, keepsakes and what each character remembers. */
  private openJournal() {
    const ch = CHAPTERS[chapterOf(totalBeats(save))];
    el('jChapterK').textContent = ch.k;
    el('jChapterT').textContent = ch.t;
    el('jProg').textContent = `${totalBeats(save)} / 15 stories told`;
    const readyIds = new Set(this.storyReady().map((c) => c.id));
    el('jRows').innerHTML = CUSTOMERS.map((c) => {
      const r = relOf(save, c.id);
      const hearts = Array.from({ length: 5 }, (_, i) => HEART(r.aff >= (i + 1) * 20 - 10)).join('');
      const status = r.beats >= 3 ? '<span class="pill done">STORY COMPLETE</span>' : readyIds.has(c.id) ? '<span class="pill ready">STORY READY</span>' : `<span class="pill locked">Next story at ${NEED[r.beats]} friendship</span>`;
      const mem: string[] = [];
      if (r.met) mem.push(`${r.met} ${r.met === 1 ? 'delivery' : 'deliveries'} together`);
      if (r.fast) mem.push(`${r.fast} speedy ${r.fast === 1 ? 'run' : 'runs'}`);
      if (r.late) mem.push(`Late ${r.late}×`);
      if (r.crashes) mem.push(`You bumped a car on the way to them ${r.crashes}×`);
      if (r.rain) mem.push(`You braved the rain for them ${r.rain}×`);
      if (r.night) mem.push(`${r.night} night ${r.night === 1 ? 'delivery' : 'deliveries'}`);
      r.tags.forEach((t) => TAG_MEM[t] && mem.push(TAG_MEM[t]));
      const keep = r.beats >= 3 ? `<div class="keep">Keepsake: ${esc(KEEPSAKE[c.id])}</div>` : '';
      return `<div class="jr"><img alt="" src="${avatarURL(c.id, 128)}"><div><div class="nm">${esc(c.name)} ${status}</div><div class="hearts">${hearts}</div><div class="arc">Story <i class="${r.beats > 0 ? 'on' : ''}"></i><i class="${r.beats > 1 ? 'on' : ''}"></i><i class="${r.beats > 2 ? 'on' : ''}"></i></div>${keep}<ul class="mem">${mem.length ? mem.map((m) => `<li>${esc(m)}</li>`).join('') : '<li>You have not met yet. Deliver to them to get started.</li>'}</ul></div></div>`;
    }).join('');
    el('journal').classList.add('on');
    el('journalClose').focus();
  }

  private equipSkin(id: string) {
    save.skin = id;
    persist(save);
    this.truck.setTexture(`truck_${id}`);
    this.shadow.setTexture(`truck_${id}`);
    sfx.tap();
  }

  /** Daily quests panel. Rewards are paid automatically the moment a quest completes. */
  private openQuests() {
    const list = ensureQuests(save);
    el('qRows').innerHTML = list
      .map((q) => {
        const pct = Math.min(100, Math.round((q.prog / q.goal) * 100));
        return `<div class="qr${q.done ? ' done' : ''}"><div class="qt">${esc(describe(q))}</div><div class="qp"><div class="qbar"><i style="width:${pct}%"></i></div><span>${q.done ? 'Done' : `${q.prog}/${q.goal}`}</span></div><div class="qrw">${q.done ? '✓' : `+${q.reward}`}</div></div>`;
      })
      .join('');
    el('qDone').textContent = `${list.filter((q) => q.done).length} of ${list.length} complete today`;
    el('quests').classList.add('on');
    el('questsClose').focus();
  }

  private openGarage() {
    const body = el('garageBody');
    const items: { key: 'engine' | 'contract'; nm: string; ds: string }[] = [
      { key: 'engine', nm: 'Turbo Engine', ds: '+12% top speed per level' },
      { key: 'contract', nm: 'Better Contracts', ds: '+10% coins per level' },
    ];
    body.innerHTML = '';
    items.forEach((it) => {
      const lvl = save[it.key];
      const cost = upgradeCost(lvl);
      const row = document.createElement('div');
      row.className = 'up';
      row.innerHTML = `<div class="ic">${ICON[it.key]}</div><div class="info"><div class="nm">${it.nm} · Lv ${lvl}</div><div class="ds">${it.ds}</div><div class="pips">${Array.from({ length: 8 }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const b = document.createElement('button');
      b.textContent = String(cost);
      b.disabled = save.coins < cost;
      b.onclick = () => {
        if (save.coins < cost) return;
        save.coins -= cost;
        save[it.key]++;
        persist(save);
        sfx.buy();
        this.refreshProfile();
        this.openGarage();
      };
      row.appendChild(b);
      body.appendChild(row);
    });
    // paint shop: bought with coins, or unlocked by finishing a character's story
    const paint = document.createElement('div');
    paint.className = 'paint';
    paint.innerHTML = '<div class="nm">Paint shop</div>';
    const grid = document.createElement('div');
    grid.className = 'swatches';
    SKINS.forEach((sk) => {
      const owned = skinOwned(save, sk);
      const on = save.skin === sk.id;
      const afford = !!sk.price && save.coins >= sk.price;
      const b = document.createElement('button');
      b.className = `sw${on ? ' on' : ''}`;
      b.disabled = !owned && !afford;
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="chipc" style="background:linear-gradient(${sk.trailer[0]},${sk.trailer[1]})"><i style="background:${sk.stripe}"></i><b style="background:${sk.cab[0]}"></b></span><span class="swn">${esc(sk.name)}</span><span class="sws">${on ? 'Equipped' : owned ? 'Equip' : sk.price ? `${sk.price} coins` : esc(sk.hint ?? 'Locked')}</span>`;
      b.onclick = () => {
        if (!owned) {
          if (!sk.price || save.coins < sk.price) return;
          save.coins -= sk.price;
          save.owned.push(sk.id);
          sfx.buy();
          this.refreshProfile();
        }
        this.equipSkin(sk.id);
        this.openGarage();
      };
      grid.appendChild(b);
    });
    paint.appendChild(grid);
    body.appendChild(paint);
    el('garageStats').innerHTML = `<div class="chip">${save.coins.toLocaleString()} coins</div><div class="chip">${save.deliveries} deliveries</div><div class="chip">${save.streak}d streak</div>`;
    el('garage').classList.add('on');
    el('garageClose').focus();
  }

  private clock(): string {
    const h = (this.tod * 24) % 24;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  }

  private hudTick() {
    el('clock').textContent = this.clock();
    el('wx').textContent = { clear: this.night > 0.5 ? 'Clear night' : 'Clear', rain: 'Rain', fog: 'Fog' }[this.wfx.kind];

    const cv = el('minimap') as HTMLCanvasElement;
    const x = cv.getContext('2d')!;
    const s = cv.width / WORLD_W;
    x.drawImage(this.miniBase, 0, 0);
    const dot = (px: number, py: number, r: number, col: string) => {
      x.fillStyle = col;
      x.beginPath();
      x.arc(px * s, py * s, r, 0, Math.PI * 2);
      x.fill();
    };
    dot(DEPOT.x, DEPOT.y, 6, '#ffc233');
    this.cars.forEach((c) => (c.bus ? dot(c.x, c.y, 3.8, '#2ee6c5') : dot(c.x, c.y, 2.4, 'rgba(255,255,255,.55)')));
    const tgt = this.targetPoint();
    if (tgt) {
      x.strokeStyle = this.phase === 'toDepot' ? '#ffc233' : '#2ee6c5';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(tgt.x * s, tgt.y * s, 8 + Math.sin(this.time.now / 200) * 3, 0, Math.PI * 2);
      x.stroke();
    }
    x.save();
    x.translate(this.truck.x * s, this.truck.y * s);
    x.rotate(this.angle_);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.moveTo(9, 0);
    x.lineTo(-6, -6);
    x.lineTo(-6, 6);
    x.closePath();
    x.fill();
    x.restore();

    if (this.phase === 'toDepot' || this.phase === 'toCust') {
      const p = this.targetPoint()!;
      el('objDist').textContent = `${Math.round(dist(this.truck, p) / 10)} m`;
      if (this.phase === 'toCust' && this.job) {
        const late = this.timeLeft <= 0;
        el('objTime').textContent = late ? 'Late!' : `${Math.ceil(this.timeLeft)}s`;
        el('objBar').classList.toggle('late', late);
        (el('objBar').firstElementChild as HTMLElement).style.width = `${Math.max(0, (this.timeLeft / this.job.limit) * 100)}%`;
      } else el('objTime').textContent = '';
    }
  }

  private targetPoint(): { x: number; y: number } | null {
    if (this.phase === 'toDepot') return DEPOT;
    if (this.phase === 'toCust' && this.job) return this.job.to;
    return null;
  }

  /* ---------- gameplay ---------- */

  private floatText(x: number, y: number, s: string, color = '#ffc233') {
    const t = this.txt(x, y, s, 28, color, { fontStyle: '700', stroke: '#121a33', strokeThickness: 5 }).setDepth(70);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private clearBubble() {
    this.typer?.remove(false); // stop the typewriter before its text object disappears
    this.typer = null;
    this.bubble?.destroy();
    this.bubble = null;
  }

  private showBubble(c: Customer, text: string) {
    this.clearBubble();
    const h = HOUSES[c.id].rect;
    const t = this.txt(0, 0, '', 17, '#1c2340', { wordWrap: { width: 230 }, align: 'center', fontStyle: '500' });
    t.setText(text);
    const w = t.width + 28;
    const hh = t.height + 20;
    t.setText('');
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2 + 3, -hh / 2 + 5, w, hh, 14);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -hh / 2, w, hh, 14).fillTriangle(-9, hh / 2 - 1, 9, hh / 2 - 1, 0, hh / 2 + 12);
    const box = this.add.container(h.x + h.w / 2, h.y - 104 - hh / 2, [g, t]).setDepth(80).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 280, ease: 'Back.out' });
    let i = 0;
    this.typer = this.time.addEvent({ delay: 22, repeat: text.length - 1, callback: () => t.active && t.setText(text.slice(0, ++i)) });
    this.bubble = box;
  }

  private pickup() {
    if (!this.job) return;
    sfx.pick();
    this.tripCrashes = 0; // only collisions on the way to the customer count
    this.floatText(this.truck.x, this.truck.y - 40, 'Loaded!', '#ffffff');
    this.timeLeft = this.job.limit;
    this.setPhase('toCust');
  }

  private async deliver() {
    const job = this.job;
    if (!job) return;
    this.phase = 'result'; // lock before awaiting
    this.speed *= 0.2;
    const ratio = this.timeLeft / job.limit;
    const stars = ratio > 0.45 ? 3 : ratio > 0 ? 2 : 1;
    this.combo = stars >= 2 ? this.combo + 1 : 0;
    const comboMul = 1 + 0.1 * Math.min(Math.max(this.combo - 1, 0), 4); // +10% per streak step, max +40%
    const starMul = [0, 0.8, 1.2, 1.5][stars];
    const story = job.story;
    const live = 1 + this.liveBonus();
    const reward = story ? Math.round(job.base * rewardMul(save) * live) : Math.round(job.base * rewardMul(save) * starMul * comboMul * live);
    const xp = story ? 40 : 8 + stars * 6;
    const lvBefore = levelOf(save.xp);
    save.coins += reward;
    save.xp += xp;
    save.deliveries++;
    this.session++;

    // what this character will remember about the trip
    const rel = relOf(save, job.to.id);
    const readyBefore = new Set(this.storyReady().map((c) => c.id));
    const rainy = this.wfx.rain > 0.4;
    const nightly = this.night > 0.5;
    const crashed = this.tripCrashes > 0;
    rel.met++;
    if (stars === 3) rel.fast++;
    if (stars === 1) rel.late++;
    if (rainy) rel.rain++;
    if (nightly) rel.night++;
    rel.crashes += this.tripCrashes;
    const gain = Math.max(0, [0, 1, 3, 5][stars] + (rainy || nightly ? 2 : 0) - (crashed ? 1 : 0));
    rel.aff = Math.min(100, rel.aff + gain);
    this.tripCrashes = 0;
    persist(save);
    this.refreshProfile();
    if (gain) this.floatText(this.truck.x, this.truck.y - 66, `+${gain} friendship`, '#ff9fb5');
    const unlocked = this.storyReady().filter((c) => !readyBefore.has(c.id));
    const doneQuests = recordDelivery(save, { stars, crashed, night: nightly, customer: job.to.id });
    if (doneQuests.length) {
      this.refreshProfile();
      window.setTimeout(() => {
        sfx.levelUp();
        this.toast(`Daily quest done: ${esc(describe(doneQuests[0]))} · +${doneQuests[0].reward} coins`, 3000);
      }, 1800);
    }

    this.coins.emitParticleAt(this.truck.x, this.truck.y, 16 + stars * 6);
    this.floatText(this.truck.x, this.truck.y - 30, `+${reward}`);
    sfx.coin();
    navigator.vibrate?.(25);
    this.fxFlash(180, 255, 244, 190);
    if (levelOf(save.xp) > lvBefore) {
      window.setTimeout(() => {
        sfx.levelUp();
        this.toast(`Level ${levelOf(save.xp)}!`);
      }, 500);
    }
    this.setPhase('result');
    const sheet = el('sheet');
    const next = () => {
      el('nextJob').onclick = () => {
        sfx.tap();
        this.job = null;
        this.offerJobs();
      };
    };

    if (story) {
      sheet.classList.remove('on'); // the scene takes the stage
      const chapterBefore = chapterOf(totalBeats(save));
      const idx = await playScene({ id: job.to.id, name: job.to.name }, story);
      const opt = story.choice.options[idx];
      rel.aff = Math.min(100, rel.aff + opt.aff);
      rel.tags.push(opt.tag);
      rel.beats++;
      const done = rel.beats >= 3;
      if (done && !save.keepsakes.includes(KEEPSAKE[job.to.id])) save.keepsakes.push(KEEPSAKE[job.to.id]);
      persist(save);
      this.updateBadges();
      this.floatText(this.truck.x, this.truck.y - 66, `+${opt.aff} friendship`, '#ff9fb5');
      sheet.innerHTML = `<div class="result"><div class="big">Story complete</div><div class="st" style="font-size:18px;margin-top:2px">${esc(story.title)}</div><div class="chips"><span class="chip">+${reward} coins</span><span class="chip">+${xp} XP</span>${done ? `<span class="chip">Keepsake: ${esc(KEEPSAKE[job.to.id])}</span>` : ''}</div><button id="nextJob">Next job →</button></div>`;
      sheet.classList.add('on');
      next();
      const chapterNow = chapterOf(totalBeats(save));
      if (chapterNow > chapterBefore) this.chapterCard(chapterNow);
      if (totalBeats(save) >= 15 && !save.epilogue) {
        save.epilogue = true;
        persist(save);
        window.setTimeout(() => this.finale(), chapterNow > chapterBefore ? 4200 : 800);
      }
      return;
    }

    void customerSays(job.to, { stars, session: this.session, rel, weather: this.wfx.kind, night: nightly, crashed }).then((line) => {
      if (this.job === job && this.phase === 'result') this.showBubble(job.to, line); // ignore replies that arrive after "Next job"
    });
    sheet.innerHTML = `<div class="result"><div class="stars">${[1, 2, 3].map((n) => `<span>${STAR(n <= stars)}</span>`).join('')}</div><div class="big">+${reward} coins</div><div class="chips"><span class="chip">${stars === 3 ? 'Speedy!' : stars === 2 ? 'Good run' : 'A bit late'}</span>${this.combo >= 2 ? `<span class="chip">Combo x${this.combo}</span>` : ''}${live > 1 ? `<span class="chip">Live bonus +${Math.round((live - 1) * 100)}%</span>` : ''}<span class="chip">+${xp} XP</span></div><button id="nextJob">Next job →</button></div>`;
    next();
    if (unlocked.length) {
      window.setTimeout(() => {
        sfx.levelUp();
        this.toast(`${unlocked[0].name} has a story for you!`);
        this.updateBadges();
      }, 900);
    }
  }

  /** Full-screen chapter title (also used for the very first one). */
  private chapterCard(i: number) {
    el('chapter').querySelector('.k')!.textContent = CHAPTERS[i].k;
    el('chapter').querySelector('.t')!.textContent = CHAPTERS[i].t;
    el('chapter').querySelector('.s')!.textContent = '';
    el('chapter').classList.add('show');
    sfx.levelUp();
    window.setTimeout(() => el('chapter').classList.remove('show'), 3400);
  }

  /** All five stories done: the town festival. */
  private finale() {
    this.coins.emitParticleAt(this.truck.x, this.truck.y - 20, 80);
    this.fxFlash(500, 255, 233, 170);
    sfx.levelUp();
    el('epilogue').classList.add('on');
  }

  /** Dev/test helper. */
  setWeather(w: Weather) {
    this.wfx.set(w);
  }

  update(_t: number, dt: number) {
    const s = Math.min(dt, 50) / 1000;
    const cam = this.cameras.main;

    // --- time of day, weather, lighting ---
    this.tod = (this.tod + s / DAY_LEN) % 1;
    this.wTimer -= s;
    if (this.wTimer <= 0) {
      this.wTimer = 50 + Math.random() * 50;
      const r = Math.random();
      this.wfx.set(r < 0.55 ? 'clear' : r < 0.85 ? 'rain' : 'fog');
    }
    this.wfx.update(s);
    let amb = ambientAt(this.tod);
    amb = mix(amb, 0x8e9bb4, 0.38 * this.wfx.rain);
    amb = mix(amb, 0xd2d6df, 0.2 * this.wfx.fog);
    this.ambient.setFillStyle(amb);
    this.night = Phaser.Math.Clamp((0.8 - luminance(ambientAt(this.tod))) * 3.5, 0, 1);
    const lightK = this.night * (1 - 0.3 * this.wfx.fog) + 0.25 * this.wfx.rain * (1 - this.night) * 0.4;
    this.lightSprites.forEach((l) => l.img.setAlpha(lightK * l.k));
    audio.mood(this.night);
    audio.rain(this.wfx.rain);

    // --- driving ---
    const down = (ks: Phaser.Input.Keyboard.Key[], padOn: boolean) => padOn || ks.some((k) => k.isDown);
    const ctl = !this.intro && !isDialogOpen() && !this.modalOpen();
    const up = ctl && down(this.keys.up, this.pad.up);
    const back = ctl && down(this.keys.down, this.pad.down);
    const left = ctl && down(this.keys.left, this.pad.left);
    const right = ctl && down(this.keys.right, this.pad.right);
    if (up || back || left || right) this.dismissCoach();

    const wet = 1 - 0.14 * this.wfx.rain;
    const max = speedOf(save) * wet;
    if (this.phase === 'result') this.speed *= 0.9;
    else if (up) this.speed = Math.min(max, this.speed + (this.speed < 0 ? 700 : 340) * wet * s);
    else if (back) this.speed = Math.max(-max * 0.4, this.speed - (this.speed > 0 ? 640 : 260) * s);
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 300 * s);

    const grip = Phaser.Math.Clamp(Math.abs(this.speed) / 130, 0, 1);
    this.angle_ += ((right ? 1 : 0) - (left ? 1 : 0)) * 2.7 * grip * Math.sign(this.speed) * s * (1 - 0.18 * this.wfx.rain);

    const dx = Math.cos(this.angle_) * this.speed * s;
    const dy = Math.sin(this.angle_) * this.speed * s;
    let hit = false;
    const nx = Phaser.Math.Clamp(this.truck.x + dx, 30, WORLD_W - 30);
    if (!this.blocked(nx, this.truck.y)) this.truck.x = nx;
    else hit = true;
    const ny = Phaser.Math.Clamp(this.truck.y + dy, 30, WORLD_H - 30);
    if (!this.blocked(this.truck.x, ny)) this.truck.y = ny;
    else hit = true;
    if (hit && this.speed > 90 && this.time.now > this.bumpT) {
      this.bumpT = this.time.now + 400;
      sfx.bump();
      this.fxShake(120, 0.004);
    }
    if (hit) this.speed *= 0.6;
    this.truck.setRotation(this.angle_);
    this.shadow.setPosition(this.truck.x + 6, this.truck.y + 8).setRotation(this.angle_);

    // headlights + brake light
    this.beam.setPosition(this.truck.x + Math.cos(this.angle_) * 44, this.truck.y + Math.sin(this.angle_) * 44).setRotation(this.angle_).setAlpha(Math.max(this.night, this.wfx.rain * 0.5, this.wfx.fog * 0.6) * 0.6);
    this.brake.setPosition(this.truck.x - Math.cos(this.angle_) * 48, this.truck.y - Math.sin(this.angle_) * 48).setAlpha(back && this.speed > 20 ? 0.9 : 0);

    this.dustT -= s;
    if (Math.abs(this.speed) > 70 && this.dustT <= 0) {
      this.dustT = 0.05;
      this.dust.emitParticleAt(this.truck.x - Math.cos(this.angle_) * 44, this.truck.y - Math.sin(this.angle_) * 44, 1);
    }
    audio.engine(Math.min(1, Math.abs(this.speed) / speedOf(save)), !this.intro);

    this.cars.forEach((c) => this.updateCar(c, s));
    this.updatePeds(s);
    this.drawFx();

    const tp = this.targetPoint();
    if (!tp) return;
    if (this.phase === 'toCust') this.timeLeft -= s;
    if (this.phase === 'toDepot' && dist(this.truck, DEPOT) < 80) this.pickup();
    else if (this.phase === 'toCust' && dist(this.truck, tp) < 78) void this.deliver();
  }

  private blocked(x: number, y: number): boolean {
    const m = 20;
    return this.obstacles.some((o) => x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m);
  }

  private drawFx() {
    const g = this.fx;
    g.clear();
    const tp = this.targetPoint();
    if (!tp) return;
    const col = this.phase === 'toDepot' ? 0xffc233 : 0x2ee6c5;
    const pulse = (Math.sin(this.time.now / 240) + 1) / 2;
    g.fillStyle(col, 0.18).fillCircle(tp.x, tp.y, 46);
    g.lineStyle(5, col, 0.95).strokeCircle(tp.x, tp.y, 46 + pulse * 8);
    const by = tp.y - 78 - pulse * 10;
    g.fillStyle(col, 1).fillTriangle(tp.x - 14, by - 12, tp.x + 14, by - 12, tp.x, by + 8);
    if (dist(this.truck, tp) > 260) {
      const a = Phaser.Math.Angle.Between(this.truck.x, this.truck.y, tp.x, tp.y);
      const ax = this.truck.x + Math.cos(a) * 92;
      const ay = this.truck.y + Math.sin(a) * 92;
      const pt = [[0, -13], [22, 0], [0, 13]].map(([px, py]) => ({ x: ax + px * Math.cos(a) - py * Math.sin(a), y: ay + px * Math.sin(a) + py * Math.cos(a) }));
      g.fillStyle(0x121a33, 0.55).fillTriangle(pt[0].x + 2, pt[0].y + 3, pt[1].x + 2, pt[1].y + 3, pt[2].x + 2, pt[2].y + 3);
      g.fillStyle(col, 1).fillTriangle(pt[0].x, pt[0].y, pt[1].x, pt[1].y, pt[2].x, pt[2].y);
    }
  }
}

let game: Phaser.Game | null = null;

/** Boots Phaser (once). Called from the landing page after the transition curtain closes. */
export async function startGame(): Promise<void> {
  if (game) return;
  try {
    await Promise.race([document.fonts.load('600 18px Fredoka'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* font optional */
  }
  el('ui').classList.add('intro');
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#121a33',
    // Fall back to a sane size if the tab loads hidden (0x0), which would break the WebGL framebuffer.
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth || 960, height: window.innerHeight || 600 },
    scene: HaulScene,
    render: { antialias: true, roundPixels: false },
  });
}
