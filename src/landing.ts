import './fonts';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { avatarURL } from './avatars';
import { audio, setMuted } from './sfx';
import { STORY } from './story';
import { SKINS } from './skins';
import { renderCard } from './share';
import { initAnalytics, track } from './analytics';
import type { Save } from './state';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) Object.assign(window, { __gsap: gsap, __ST: ScrollTrigger }); // dev-only: lets tests fast-forward animations

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/* ---------- returning players ---------- */
try {
  const s = JSON.parse(localStorage.getItem('dvn-haul-save-v1') ?? 'null');
  if (s && s.deliveries > 0) ['#startBtn', '#startBtn2'].forEach((id) => ($(id).textContent = 'Continue driving'));
  if (s?.muted) setMuted(true);
} catch {
  /* no save yet */
}

void initAnalytics();

/* ---------- invited to a Play Room (?room=ABCD) ---------- */
const invitedRoom = new URLSearchParams(location.search).get('room');
if (invitedRoom && /^[A-Za-z]{4}$/.test(invitedRoom)) {
  const inv = $('#invite');
  inv.innerHTML = `You're invited to room <b>${invitedRoom.toUpperCase()}</b>`;
  inv.hidden = false;
  track('Invite Landing');
  ['#startBtn', '#startBtn2'].forEach((id) => ($(id).textContent = 'Join your friends'));
}

/* ---------- content built from the game's own data ---------- */
const CAST = [
  { id: 'maple', name: 'Granny Maple', role: 'Baker', quote: "Bless you, dear! Still warm from the oven, and you're early." },
  { id: 'rex', name: 'Rex the Builder', role: 'Foreman', quote: 'Brilliant! Now we can finish the wall before the rain!' },
  { id: 'pixel', name: 'Pixel', role: 'Streamer', quote: 'No way, that was so smooth. Chat is going to lose it.' },
  { id: 'doc', name: 'Dr. Whiskers', role: 'Vet', quote: "Purr-fect delivery. You're the cat's pajamas!" },
  { id: 'cap', name: 'Captain Nemo', role: 'Sea captain', quote: "Smooth sailing, mate. Reminds me of a storm off Darwin in '78." },
];
$('#cards').innerHTML = CAST.map((c) => `<article class="card"><img alt="${c.name}, ${c.role.toLowerCase()} in DVN Haul" width="96" height="96" loading="lazy" src="${avatarURL(c.id, 192)}"><h3>${c.name}</h3><div class="role">${c.role}</div><blockquote>${c.quote}</blockquote></article>`).join('');

// the story-scene card: the actual first beat of Granny Maple's arc
{
  const beat = STORY.maple[0];
  ($('#mkFace') as HTMLImageElement).src = avatarURL('maple', 128);
  $('#mkStory').textContent = `STORY · ${beat.title.toUpperCase()}`;
  $('#mkText').textContent = beat.lines[0].text;
  $('#mkChoices').innerHTML = beat.choice.options.map((o, i) => `<span><kbd>${i + 1}</kbd>${esc(o.text)}</span>`).join('');
}
$('#swatches').innerHTML = SKINS.map((s) => `<div><span class="chipc" style="background:linear-gradient(${s.trailer[0]},${s.trailer[1]})"><i style="background:${s.stripe}"></i><b style="background:${s.cab[0]}"></b></span>${esc(s.name)}</div>`).join('');
$('#qlist').innerHTML = [
  { t: 'Complete 5 deliveries', p: 100, w: '✓', d: true },
  { t: 'Earn 3 stars 2 times', p: 50, w: '+110', d: false },
  { t: 'Deliver at night once', p: 0, w: '+120', d: false },
].map((q) => `<div class="qr${q.d ? ' done' : ''}"><div class="qt">${q.t}</div><div class="qb"><i style="width:${q.p}%"></i></div><div class="qw">${q.w}</div></div>`).join('');
void (document.fonts?.ready ?? Promise.resolve()).then(() => {
  const demo: Save = {
    coins: 0, xp: 700, engine: 0, contract: 0, streak: 5, lastPlayDay: '', deliveries: 42, muted: false, tutorial: true,
    rel: {
      maple: { aff: 46, met: 9, fast: 4, late: 0, crashes: 0, rain: 1, night: 2, beats: 2, tags: [] },
      rex: { aff: 22, met: 5, fast: 2, late: 1, crashes: 0, rain: 0, night: 0, beats: 1, tags: [] },
      pixel: { aff: 14, met: 4, fast: 1, late: 1, crashes: 0, rain: 0, night: 1, beats: 1, tags: [] },
      doc: { aff: 31, met: 6, fast: 2, late: 0, crashes: 0, rain: 1, night: 0, beats: 1, tags: [] },
      cap: { aff: 66, met: 10, fast: 5, late: 0, crashes: 0, rain: 0, night: 1, beats: 3, tags: [] },
    },
    keepsakes: [], epilogue: false, paidRooms: [], ageBand: '', skin: 'classic', owned: [], quests: null,
  };
  const cv = renderCard(demo);
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Example progress card');
  $('#cardHost').appendChild(cv);
});

/* ---------- nav + anchors ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href')!) as HTMLElement | null;
    if (!t) return;
    e.preventDefault();
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (t.id === 'world' ? 0 : 64), behavior: reduced ? 'auto' : 'smooth' });
  }),
);

/* ---------- the one pinned scene ---------- */
const fmt = (h: number) => `${((Math.floor(h) + 11) % 12) + 1}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}`;

if (reduced) {
  // no pinning or motion: stacked sections, each with its own still of the game
  $('#landing').classList.add('reduced');
  $$('.panel').forEach((p) => p.style.setProperty('--bg', `url(${p.dataset.bg})`));
} else {
  const panels = $$('.panel');
  const dots = $$('#rail i');
  gsap.set(['#p1', '#p2', '#p3'], { opacity: 0, y: 50 });

  // load-in: headline lines rise, supporting copy follows
  gsap
    .timeline({ defaults: { ease: 'power4.out' } })
    .from('.h1 .ln > span', { yPercent: 115, duration: 1.2, stagger: 0.14 }, 0.1)
    .from(['.eyebrow', '.sub', '#invite', '.ctas', '.facts'], { opacity: 0, y: 26, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0.5)
    .from('.wclock', { opacity: 0, y: -16, duration: 0.8 }, 0.9)
    .from('.scroll-cue', { opacity: 0, duration: 0.8 }, 1.4);

  const clock = { h: 14.4 };
  const setClock = () => {
    $('#wtime').textContent = fmt(clock.h);
    $('#wwx').textContent = tl.time() > 6.6 ? 'Rain' : 'Clear';
  };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#world',
      start: 'top top',
      end: '+=4600',
      scrub: 0.8,
      pin: true,
      anticipatePin: 1,
      onUpdate: () => {
        const t = tl.time();
        const idx = t < 1.2 ? 0 : t < 4.0 ? 1 : t < 6.9 ? 2 : 3;
        panels.forEach((p, i) => p.classList.toggle('on', i === idx));
        dots.forEach((d, i) => d.classList.toggle('on', i === idx));
        $('#cue').style.opacity = t > 0.5 ? '0' : '';
        setClock();
      },
    },
  });
  // one view, five moments of the same evening, plus a slow push-in
  tl.fromTo('#shots', { scale: 1.0 }, { scale: 1.12, duration: 10 }, 0)
    .to('#s-golden', { opacity: 1, duration: 1.4 }, 1.0)
    .to('#s-dusk', { opacity: 1, duration: 1.4 }, 3.0)
    .to('#s-night', { opacity: 1, duration: 1.4 }, 4.8)
    .to('#s-rain', { opacity: 1, duration: 1.4 }, 6.6)
    .to(clock, { h: 17.3, duration: 1.4 }, 1.0)
    .to(clock, { h: 19.7, duration: 1.4 }, 3.0)
    .to(clock, { h: 22.8, duration: 1.4 }, 4.8);
  const swap = (out: string, inn: string, t: number) => {
    tl.to(out, { opacity: 0, y: -50, duration: 0.7, ease: 'power2.in' }, t - 0.4).fromTo(inn, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, t);
  };
  swap('#p0', '#p1', 1.5);
  swap('#p1', '#p2', 4.4);
  swap('#p2', '#p3', 7.2);
  tl.to({}, { duration: 2.0 }, 8.0); // hold the last panel before the pin releases

  // reveals below the pin
  gsap.from('.card', { opacity: 0, y: 70, rotate: 2, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '#cast .cards', start: 'top 85%' } });
  gsap.from('#cast .sect-k, #cast h2, #cast .lead', { opacity: 0, y: 50, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#cast', start: 'top 72%' } });
  gsap.from('#features .sect-k, #features h2, #features .lead', { opacity: 0, y: 50, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#features', start: 'top 72%' } });
  gsap.from('.feat', { opacity: 0, y: 80, duration: 1, stagger: 0.14, ease: 'power3.out', scrollTrigger: { trigger: '.fgrid', start: 'top 85%' } });
  gsap.from('#finale > div > *', { opacity: 0, y: 50, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#finale', start: 'top 65%' } });

  if (fine) {
    const sx = gsap.quickTo('#shots', 'x', { duration: 1.1, ease: 'power3' });
    const sy = gsap.quickTo('#shots', 'y', { duration: 1.1, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      sx(-(e.clientX / window.innerWidth - 0.5) * 36);
      sy(-(e.clientY / window.innerHeight - 0.5) * 24);
    });
    const glow = $('#glow');
    const gx = gsap.quickTo(glow, 'x', { duration: 0.4, ease: 'power3' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.4, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      glow.style.opacity = '1';
      gx(e.clientX);
      gy(e.clientY);
    });
    document.addEventListener('pointerleave', () => (glow.style.opacity = '0'));
  }
}

/* ---------- start: curtain wipe → lazy-load the game → hand over ---------- */
let starting = false;
const loadGame = () => import('./game');
const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
(idle ? idle : (f: () => void) => setTimeout(f, 2500))(() => void loadGame()); // prefetch so Start is instant

async function start(e?: Event) {
  if (starting) return;
  starting = true;
  const m = e as MouseEvent | undefined;
  const x = m && 'clientX' in m && m.clientX ? m.clientX : window.innerWidth / 2;
  const y = m && 'clientY' in m && m.clientY ? m.clientY : window.innerHeight / 2;
  track('Start Game', { from: new URLSearchParams(location.search).has('play') ? 'deeplink' : 'landing' });
  audio.unlock();
  audio.rev();
  const curtain = $('#curtain');
  curtain.classList.add('on');
  const logo = curtain.querySelector('svg') as SVGElement;
  const modP = loadGame();

  await new Promise<void>((res) => {
    gsap.fromTo(curtain, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(150% at ${x}px ${y}px)`, duration: reduced ? 0.01 : 0.9, ease: 'power3.in', onComplete: () => res() });
    gsap.to(logo, { opacity: 1, scale: 1.05, duration: 0.7, delay: 0.3 });
  });

  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.documentElement.classList.add('playing');
  window.scrollTo(0, 0);
  const mod = await modP;
  await mod.startGame();

  await new Promise((r) => setTimeout(r, reduced ? 0 : 600)); // let the first frames render behind the curtain
  gsap.to(curtain, { opacity: 0, duration: reduced ? 0.01 : 0.8, ease: 'power2.out', onComplete: () => curtain.remove() });
}
$$('[data-start]').forEach((b) => b.addEventListener('click', (e) => void start(e)));
if (new URLSearchParams(location.search).has('play')) void start(); // deep link straight into the game
