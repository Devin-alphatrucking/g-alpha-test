export type Weather = 'clear' | 'rain' | 'fog';

interface Drop {
  x: number;
  y: number;
  l: number;
  v: number;
}

/** Screen-space weather overlay: rain streaks on a canvas, fog + lightning as DOM layers. */
export class WeatherFx {
  rain = 0;
  fog = 0;
  private rainT = 0;
  private fogT = 0;
  private cv = document.getElementById('rain') as HTMLCanvasElement;
  private ctx = this.cv.getContext('2d')!;
  private fogEl = document.getElementById('fog') as HTMLElement;
  private flashEl = document.getElementById('flash') as HTMLElement;
  private drops: Drop[] = [];
  private nextBolt = 6;
  onThunder: () => void = () => {};

  constructor() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = window.innerWidth * dpr;
    this.cv.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drops = Array.from({ length: 340 }, () => this.newDrop(true));
  }

  private newDrop(anywhere: boolean): Drop {
    return { x: Math.random() * (window.innerWidth + 200) - 100, y: anywhere ? Math.random() * window.innerHeight : -30, l: 14 + Math.random() * 14, v: 900 + Math.random() * 500 };
  }

  set(w: Weather) {
    this.rainT = w === 'rain' ? 1 : 0;
    this.fogT = w === 'fog' ? 1 : 0;
  }

  get kind(): Weather {
    return this.rainT ? 'rain' : this.fogT ? 'fog' : 'clear';
  }

  update(s: number) {
    this.rain += (this.rainT - this.rain) * Math.min(1, s * 0.5);
    this.fog += (this.fogT - this.fog) * Math.min(1, s * 0.35);
    this.fogEl.style.opacity = String(this.fog.toFixed(2));

    const { width: W, height: H } = { width: window.innerWidth, height: window.innerHeight };
    this.ctx.clearRect(0, 0, W, H);
    if (this.rain > 0.02) {
      const n = Math.floor(this.drops.length * this.rain);
      this.ctx.strokeStyle = 'rgba(205,225,255,.5)';
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        d.y += d.v * s;
        d.x -= d.v * s * 0.22;
        if (d.y > H + 30 || d.x < -120) Object.assign(d, this.newDrop(false));
        this.ctx.moveTo(d.x, d.y);
        this.ctx.lineTo(d.x + d.l * 0.22, d.y - d.l);
      }
      this.ctx.stroke();
    }

    // thunderstorms only when the rain is properly heavy
    if (this.rain > 0.8) {
      this.nextBolt -= s;
      if (this.nextBolt <= 0) {
        this.nextBolt = 9 + Math.random() * 14;
        this.flashEl.classList.remove('go');
        void this.flashEl.offsetWidth;
        this.flashEl.classList.add('go');
        window.setTimeout(() => this.onThunder(), 350 + Math.random() * 700);
      }
    }
  }
}
