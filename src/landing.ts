import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { avatarURL } from './avatars';
import { audio, setMuted } from './sfx';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap; // dev-only: lets tests fast-forward animations

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;

/* ---------- returning players ---------- */
try {
  const s = JSON.parse(localStorage.getItem('dvn-haul-save-v1') ?? 'null');
  if (s && s.deliveries > 0) ['#startBtn', '#startBtn2'].forEach((id) => ($(id).textContent = 'Continue driving'));
  if (s?.muted) setMuted(true);
} catch {
  /* no save yet */
}

/* ---------- title: split letters ---------- */
$$('.title .ln').forEach((ln) => {
  const text = ln.textContent ?? '';
  ln.textContent = '';
  [...text].forEach((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    ln.appendChild(s);
  });
});

/* ---------- stars ---------- */
const stars = (host: HTMLElement, n: number) => {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'star';
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 3}s`;
    const z = 1 + Math.random() * 1.6;
    s.style.width = s.style.height = `${z}px`;
    host.appendChild(s);
  }
};
stars($('#stars-h'), 60);
stars($('#stars-s'), 110);

/* ---------- character cards ---------- */
const CAST = [
  { id: 'maple', name: 'Granny Maple', role: 'Baker', quote: "Bless you, dear! Still warm from the oven, and you're early." },
  { id: 'rex', name: 'Rex the Builder', role: 'Foreman', quote: 'Brilliant! Now we can finish the wall before the rain!' },
  { id: 'pixel', name: 'Pixel', role: 'Streamer', quote: 'No way, that was so smooth. Chat is going to lose it.' },
  { id: 'doc', name: 'Dr. Whiskers', role: 'Vet', quote: "Purr-fect delivery. You're the cat's pajamas!" },
  { id: 'cap', name: 'Captain Nemo', role: 'Sea captain', quote: "Smooth sailing, mate. Reminds me of a storm off Darwin in '78." },
];
$('#cards').innerHTML = CAST.map((c) => `<article class="card"><img alt="" width="96" height="96" src="${avatarURL(c.id, 192)}"><h3>${c.name}</h3><div class="role">${c.role}</div><blockquote>${c.quote}</blockquote></article>`).join('');

/* ---------- entrance ---------- */
const hero = $('#hero');
if (!reduced) {
  gsap.set('.title .ch', { yPercent: 115, rotate: 6 });
  gsap.set(['.tag', '#startBtn'], { opacity: 0, y: 24 });
  gsap.set('#truck-h', { xPercent: -170 });
  gsap.set('#sun', { yPercent: 40, opacity: 0.2 });
  gsap.set('.layer', { opacity: 0 });
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .to('.layer', { opacity: 1, duration: 1.6, stagger: 0.12 }, 0)
    .to('#sun', { yPercent: 0, opacity: 1, duration: 2.4, ease: 'power2.out' }, 0.1)
    .to('.title .ch', { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.07 }, 0.5)
    .to('#truck-h', { xPercent: -50, duration: 2.6, ease: 'power3.out' }, 0.6)
    .to('#beam', { opacity: 1, duration: 1.2 }, 2)
    .to(['.tag', '#startBtn'], { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, 1.5);
  // idle engine bob
  gsap.to('#truck-h svg', { y: -2.5, duration: 0.11, yoyo: true, repeat: -1, ease: 'sine.inOut' });
} else {
  gsap.set('#truck-h', { xPercent: -50 });
  gsap.set('#beam', { opacity: 1 });
}

/* ---------- hero parallax: mouse + scroll ---------- */
if (!reduced && fine) {
  const layers = $$('#hero .layer');
  const movers = layers.map((l) => ({ d: Number(l.dataset.d), x: gsap.quickTo(l, 'x', { duration: 0.9, ease: 'power3' }), y: gsap.quickTo(l, 'y', { duration: 0.9, ease: 'power3' }) }));
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX - window.innerWidth / 2;
    const ny = e.clientY - window.innerHeight / 2;
    movers.forEach((m) => {
      m.x(-nx * m.d);
      m.y(-ny * m.d * 0.6);
    });
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
if (!reduced) {
  gsap.to('.hero-copy', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('#sun', { yPercent: 55, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
}

/* ---------- the pinned scroll story: the sun sets as you scroll ---------- */
const clockEl = $('#sclock');
const fmt = (h: number) => `${((Math.floor(h) + 11) % 12) + 1}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}`;
if (!reduced) {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#story', start: 'top top', end: '+=3400', scrub: 0.7, pin: true, anticipatePin: 1 },
  });
  const clock = { h: 17.2 };
  tl.fromTo('#truck-s', { x: '-30vw' }, { x: '112vw', duration: 12 }, 0)
    .to('#far', { x: -120, duration: 12 }, 0)
    .to('#orb', { y: '48vh', scale: 1.25, duration: 5 }, 0)
    .to('#sky-dusk', { opacity: 1, duration: 3.2 }, 1.2)
    .to('#sky-night', { opacity: 1, duration: 3.2 }, 4.4)
    .to('#stars-s', { opacity: 1, duration: 3 }, 5)
    .to('#moon', { opacity: 1, y: 0, duration: 4 }, 5.2)
    .to('#beam-s', { opacity: 1, duration: 1.4 }, 3.2)
    .to('#srain', { opacity: 0.85, duration: 1.6 }, 4.4)
    .to('#srain', { opacity: 0, duration: 1.6 }, 9)
    .to(clock, { h: 22.6, duration: 12, onUpdate: () => (clockEl.textContent = fmt(clock.h)) }, 0);
  const chapters = ['#ch1', '#ch2', '#ch3'];
  chapters.forEach((c, i) => {
    const t = 0.4 + i * 3.9;
    tl.fromTo(c, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, t);
    if (i < chapters.length - 1) tl.to(c, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, t + 3);
  });
  gsap.from('.card', { opacity: 0, y: 70, rotate: 2, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '#cast .cards', start: 'top 85%' } });
  gsap.from('#cast h2, #cast .lead', { opacity: 0, y: 50, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#cast', start: 'top 70%' } });
  gsap.from('#finale > div > *', { opacity: 0, y: 50, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#finale', start: 'top 65%' } });
} else {
  // reduced motion: static, readable chapters instead of a pinned animation
  $('#story').style.cssText = 'height:auto;min-height:100svh;padding:120px 0 40px';
  $$('.chap').forEach((c) => (c.style.cssText = 'position:relative;opacity:1;left:auto;top:auto;margin:0 clamp(20px,6vw,110px) 48px'));
  $('#truck-s').style.display = 'none';
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
