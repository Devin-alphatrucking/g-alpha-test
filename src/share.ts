import { CUSTOMERS } from './ai';
import { drawAvatar } from './avatars';
import { levelOf, relOf, totalBeats, type Save } from './state';
import { CHAPTERS, chapterOf } from './story';

const W = 1080;
const H = 1350;

/** Renders a shareable progress card (no personal data: just game stats). */
export function renderCard(save: Save): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const F = (w: string, s: number) => `${w} ${s}px Fredoka, system-ui, sans-serif`;

  // golden-hour sky
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2a1f5e');
  sky.addColorStop(0.35, '#7a3a7e');
  sky.addColorStop(0.62, '#e8627a');
  sky.addColorStop(1, '#ffb066');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(W / 2, 560, 10, W / 2, 560, 380);
  sun.addColorStop(0, 'rgba(255,246,201,.95)');
  sun.addColorStop(0.45, 'rgba(255,210,122,.5)');
  sun.addColorStop(1, 'rgba(255,150,90,0)');
  c.fillStyle = sun;
  c.fillRect(0, 150, W, 800);
  c.fillStyle = '#3d1f4a';
  c.beginPath();
  c.moveTo(0, 1010);
  c.quadraticCurveTo(300, 930, 600, 1000);
  c.quadraticCurveTo(850, 1050, W, 980);
  c.lineTo(W, H);
  c.lineTo(0, H);
  c.fill();

  // title
  c.textAlign = 'center';
  c.fillStyle = '#fff';
  c.font = F('700', 150);
  c.fillText('DVN', W / 2, 250);
  c.fillStyle = '#ffc233';
  c.fillText('HAUL', W / 2, 390);

  // stat tiles
  const stats: [string, string][] = [
    [String(save.deliveries), 'deliveries'],
    [`Lv ${levelOf(save.xp)}`, 'driver level'],
    [`${save.streak}d`, 'daily streak'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 90 + i * 300;
    c.fillStyle = 'rgba(18,13,36,.55)';
    c.beginPath();
    c.roundRect(x, 470, 270, 190, 30);
    c.fill();
    c.fillStyle = '#fff';
    c.font = F('700', 70);
    c.fillText(v, x + 135, 565);
    c.fillStyle = '#d9cffc';
    c.font = F('500', 30);
    c.fillText(l, x + 135, 618);
  });

  // chapter + stories
  const ch = CHAPTERS[chapterOf(totalBeats(save))];
  c.fillStyle = '#ffc233';
  c.font = F('600', 30);
  c.fillText(ch.k, W / 2, 735);
  c.fillStyle = '#fff';
  c.font = F('700', 62);
  c.fillText(ch.t, W / 2, 800);
  c.fillStyle = '#e8dcff';
  c.font = F('500', 32);
  c.fillText(`${totalBeats(save)} of 15 stories told`, W / 2, 850);

  // friends with hearts
  CUSTOMERS.forEach((cu, i) => {
    const cx = 150 + i * 195;
    c.save();
    c.translate(cx - 70, 905);
    drawAvatar(c, cu.id, 140);
    c.restore();
    const hearts = Math.min(5, Math.floor((relOf(save, cu.id).aff + 10) / 20));
    c.font = F('700', 32);
    c.fillStyle = '#ff5d73';
    c.fillText('♥'.repeat(hearts) + '♡'.repeat(5 - hearts), cx, 1090);
  });

  c.fillStyle = '#fff';
  c.font = F('600', 40);
  c.fillText('Every delivery has a story.', W / 2, 1230);
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.font = F('500', 30);
  c.fillText('A DVN Alpha Trucking game', W / 2, 1285);
  return cv;
}

/** Shares the card via the native share sheet when possible, otherwise downloads the PNG. */
export async function shareCard(save: Save): Promise<'shared' | 'downloaded'> {
  const cv = renderCard(save);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('no blob'))), 'image/png'));
  const file = new File([blob], 'dvn-haul-progress.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'DVN Haul', text: `I've made ${save.deliveries} deliveries in DVN Haul!` });
      return 'shared';
    } catch {
      /* cancelled: fall through to download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dvn-haul-progress.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
