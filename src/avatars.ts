// Hand-drawn (procedural) character portraits. One drawing routine feeds both the
// Phaser textures and the DOM (as data URLs), so the art stays consistent everywhere.
type Ctx = CanvasRenderingContext2D;

export const AVATAR_IDS = ['maple', 'rex', 'pixel', 'doc', 'cap', 'depot'] as const;

const BG: Record<string, string> = { maple: '#ff8fab', rex: '#ffa94d', pixel: '#b197fc', doc: '#63e6be', cap: '#74c0fc', depot: '#1b2547' };

const circle = (c: Ctx, x: number, y: number, r: number, fill: string) => {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) => {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
};
const tri = (c: Ctx, pts: number[], fill: string) => {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  c.lineTo(pts[2], pts[3]);
  c.lineTo(pts[4], pts[5]);
  c.closePath();
  c.fill();
};
const stroke = (c: Ctx, col: string, w: number, fn: () => void) => {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.beginPath();
  fn();
  c.stroke();
};
const dome = (c: Ctx, x: number, y: number, r: number, fill: string) => {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, Math.PI, Math.PI * 2);
  c.closePath();
  c.fill();
};

function face(c: Ctx, skin: string, eyeY = 46) {
  circle(c, 50, 46, 22, skin);
  circle(c, 41, eyeY, 2.8, '#2a2233');
  circle(c, 59, eyeY, 2.8, '#2a2233');
  circle(c, 42, eyeY - 1, 0.9, '#fff');
  circle(c, 60, eyeY - 1, 0.9, '#fff');
  circle(c, 35, 54, 4.2, 'rgba(255,110,110,.35)');
  circle(c, 65, 54, 4.2, 'rgba(255,110,110,.35)');
  stroke(c, '#7a3b2e', 2.2, () => c.arc(50, 52, 6, 0.2 * Math.PI, 0.8 * Math.PI));
}

export function drawAvatar(c: Ctx, id: string, s: number): void {
  c.save();
  c.scale(s / 100, s / 100);
  c.beginPath();
  c.arc(50, 50, 50, 0, Math.PI * 2);
  c.clip();
  const g = c.createRadialGradient(35, 25, 5, 50, 50, 70);
  g.addColorStop(0, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(0,0,0,.12)');
  c.fillStyle = BG[id] ?? '#888';
  c.fillRect(0, 0, 100, 100);
  c.fillStyle = g;
  c.fillRect(0, 0, 100, 100);

  switch (id) {
    case 'maple': {
      ell(c, 50, 104, 36, 28, '#e56f93');
      tri(c, [38, 78, 50, 92, 44, 78], '#fff');
      tri(c, [62, 78, 50, 92, 56, 78], '#fff');
      circle(c, 50, 68, 8, '#f3cfa8');
      ell(c, 50, 42, 27, 25, '#dfe3ec');
      circle(c, 50, 17, 10, '#dfe3ec');
      face(c, '#f3cfa8');
      dome(c, 50, 44, 23, '#dfe3ec');
      stroke(c, '#6b4a3a', 2, () => c.arc(41, 46, 7.5, 0, Math.PI * 2));
      stroke(c, '#6b4a3a', 2, () => c.arc(59, 46, 7.5, 0, Math.PI * 2));
      stroke(c, '#6b4a3a', 2, () => (c.moveTo(48.5, 46), c.lineTo(51.5, 46)));
      break;
    }
    case 'rex': {
      ell(c, 50, 104, 36, 28, '#ff8a3d');
      c.fillStyle = '#f4f1c9';
      c.fillRect(36, 76, 5, 30);
      c.fillRect(59, 76, 5, 30);
      circle(c, 50, 68, 8, '#d9a273');
      face(c, '#d9a273');
      stroke(c, '#5a3a22', 2.4, () => (c.moveTo(35, 40), c.lineTo(45, 38)));
      stroke(c, '#5a3a22', 2.4, () => (c.moveTo(65, 40), c.lineTo(55, 38)));
      dome(c, 50, 38, 25, '#ffc233');
      c.fillStyle = '#f0a800';
      c.beginPath();
      c.roundRect(22, 35, 56, 7, 3);
      c.fill();
      c.fillStyle = '#ffe08a';
      c.fillRect(47, 14, 6, 22);
      break;
    }
    case 'pixel': {
      ell(c, 50, 104, 36, 28, '#3b3f6b');
      stroke(c, '#2ee6c5', 2, () => (c.moveTo(44, 78), c.lineTo(44, 92)));
      stroke(c, '#2ee6c5', 2, () => (c.moveTo(56, 78), c.lineTo(56, 92)));
      circle(c, 50, 68, 8, '#f0c4a8');
      face(c, '#f0c4a8');
      dome(c, 50, 44, 24, '#8b5cf6');
      ell(c, 66, 36, 12, 9, '#8b5cf6');
      stroke(c, '#2ee6c5', 5, () => c.arc(50, 46, 28, Math.PI * 1.06, Math.PI * 1.94));
      c.fillStyle = '#2ee6c5';
      c.beginPath();
      c.roundRect(19, 40, 10, 17, 4);
      c.roundRect(71, 40, 10, 17, 4);
      c.fill();
      break;
    }
    case 'doc': {
      ell(c, 50, 104, 36, 28, '#ffffff');
      stroke(c, '#2ee6c5', 3, () => c.arc(50, 82, 11, 0.1 * Math.PI, 0.9 * Math.PI));
      circle(c, 50, 94, 4, '#2ee6c5');
      tri(c, [28, 36, 30, 8, 47, 26], '#f5b66b');
      tri(c, [72, 36, 70, 8, 53, 26], '#f5b66b');
      tri(c, [33, 32, 34, 15, 44, 27], '#ff9eb5');
      tri(c, [67, 32, 66, 15, 56, 27], '#ff9eb5');
      circle(c, 50, 46, 24, '#f5b66b');
      ell(c, 50, 56, 13, 10, '#fff0d6');
      ell(c, 40, 44, 3.4, 4.2, '#2a2233');
      ell(c, 60, 44, 3.4, 4.2, '#2a2233');
      circle(c, 41, 42.5, 1.1, '#fff');
      circle(c, 61, 42.5, 1.1, '#fff');
      tri(c, [46, 51, 54, 51, 50, 56], '#ff7d9c');
      stroke(c, '#7a3b2e', 1.8, () => (c.moveTo(50, 56), c.lineTo(50, 59), c.moveTo(44, 61), c.quadraticCurveTo(50, 64, 56, 61)));
      [-1, 1].forEach((d) => {
        stroke(c, 'rgba(90,60,40,.6)', 1.4, () => (c.moveTo(50 + d * 8, 56), c.lineTo(50 + d * 26, 53), c.moveTo(50 + d * 8, 59), c.lineTo(50 + d * 26, 61)));
      });
      break;
    }
    case 'cap': {
      ell(c, 50, 104, 36, 28, '#1d3557');
      circle(c, 40, 86, 2.4, '#ffc233');
      circle(c, 60, 86, 2.4, '#ffc233');
      circle(c, 50, 68, 8, '#e3b58f');
      face(c, '#e3b58f');
      ell(c, 50, 60, 19, 15, '#f4f4f4');
      ell(c, 50, 53, 9, 3.4, '#f4f4f4');
      stroke(c, '#c9ced8', 1.6, () => c.arc(50, 56, 4, 0.1 * Math.PI, 0.9 * Math.PI));
      stroke(c, '#f4f4f4', 3, () => (c.moveTo(34, 40), c.lineTo(45, 38)));
      stroke(c, '#f4f4f4', 3, () => (c.moveTo(66, 40), c.lineTo(55, 38)));
      dome(c, 50, 34, 24, '#1d3557');
      c.fillStyle = '#fff';
      c.fillRect(26, 31, 48, 5);
      ell(c, 50, 38, 27, 5, '#101a2e');
      circle(c, 50, 22, 4.5, '#ffc233');
      break;
    }
    default: {
      c.fillStyle = '#ffc233';
      c.fillRect(0, 58, 100, 9);
      c.fillStyle = '#ffc233';
      c.font = '700 33px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('DVN', 50, 36);
      c.fillStyle = '#fff';
      c.font = '600 14px Fredoka, system-ui, sans-serif';
      c.fillText('HAUL', 50, 82);
    }
  }
  c.restore();
}

const cache = new Map<string, string>();
/** Data URL for use in <img> tags. */
export function avatarURL(id: string, size = 96): string {
  const key = `${id}@${size}`;
  let u = cache.get(key);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    drawAvatar(cv.getContext('2d')!, id, size);
    u = cv.toDataURL('image/png');
    cache.set(key, u);
  }
  return u;
}

/** Registers a Phaser texture `av_<id>` for every character. */
export function addAvatarTextures(scene: Phaser.Scene): void {
  AVATAR_IDS.forEach((id) => {
    if (scene.textures.exists(`av_${id}`)) return;
    const t = scene.textures.createCanvas(`av_${id}`, 128, 128);
    if (!t) return;
    drawAvatar(t.getContext(), id, 128);
    t.refresh();
  });
}
