// Play Rooms client. Talks to api/room.php by polling (~6 Hz), so it works on any PHP host.
export interface Driver {
  id: string;
  name: string;
  x: number;
  y: number;
  a: number;
  v: number;
  skin: string;
  del: number;
}
export interface RoomEvent {
  seq: number;
  id: string;
  e: string;
}
export interface Me {
  x: number;
  y: number;
  a: number;
  v: number;
  skin: string;
  del: number;
}
export const EMOTES: Record<string, string> = { hi: 'Hi!', gg: 'GG!', wait: 'Wait for me!', thanks: 'Thanks!', go: "Let's go!" };

const API = '/api/room.php';

async function call(a: string, body: unknown): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${API}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const d = await r.json().catch(() => ({ error: 'bad response' }));
    if (!r.ok) throw new Error(d.error || 'error');
    return d;
  } finally {
    clearTimeout(t);
  }
}

export class RoomClient {
  code = '';
  id = '';
  name = '';
  team = 0;
  goal = 20;
  count = 1;
  drivers: Driver[] = [];
  rewarded = false;
  online = false;
  getMe: () => Me = () => ({ x: 0, y: 0, a: 0, v: 0, skin: 'classic', del: 0 });
  onChange: () => void = () => {};
  onEvent: (e: RoomEvent) => void = () => {};
  onLost: () => void = () => {};
  private token = '';
  private since = 0;
  private timer = 0;
  private busy = false;
  private fails = 0;

  async create(skin: string): Promise<string> {
    const { code } = await call('create', {});
    await this.join(code, skin);
    return code;
  }

  async join(code: string, skin: string): Promise<void> {
    const d = await call('join', { code: code.toUpperCase().trim(), skin });
    this.code = d.code;
    this.id = d.id;
    this.token = d.token;
    this.name = d.name;
    this.goal = d.goal;
    this.since = d.seq; // don't replay history
    this.team = 0;
    this.count = 1;
    this.drivers = [];
    this.online = true;
    this.fails = 0;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => void this.tick(), 170);
    this.onChange();
  }

  private async tick() {
    if (this.busy || !this.online) return;
    this.busy = true;
    try {
      const me = this.getMe();
      const d = await call('sync', { code: this.code, id: this.id, token: this.token, since: this.since, ...me });
      this.fails = 0;
      this.drivers = d.players;
      this.team = d.team;
      this.goal = d.goal;
      this.count = d.count;
      this.rewarded = d.rewarded;
      this.since = d.seq;
      d.events.filter((e: RoomEvent) => e.id !== this.id || e.e === 'goal').forEach((e: RoomEvent) => this.onEvent(e));
      this.onChange();
    } catch {
      if (++this.fails > 18) {
        // ~3s of failures: the room is gone or we're offline
        this.stop();
        this.onLost();
      }
    } finally {
      this.busy = false;
    }
  }

  async emote(e: string): Promise<void> {
    if (!this.online) return;
    try {
      await call('emote', { code: this.code, id: this.id, token: this.token, e });
    } catch {
      /* ignore */
    }
  }

  stop() {
    window.clearInterval(this.timer);
    this.online = false;
    this.drivers = [];
    this.onChange();
  }

  leave() {
    if (this.online) {
      const body = JSON.stringify({ code: this.code, id: this.id, token: this.token });
      // sendBeacon survives tab close; fall back to fetch
      if (!navigator.sendBeacon?.(`${API}?a=leave`, new Blob([body], { type: 'application/json' }))) void call('leave', JSON.parse(body)).catch(() => {});
    }
    this.stop();
  }

  inviteLink(): string {
    return `${location.origin}${location.pathname}?room=${this.code}`;
  }
}
