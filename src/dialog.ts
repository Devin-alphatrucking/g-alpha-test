import { avatarURL } from './avatars';
import { sfx } from './sfx';
import type { Beat, Line } from './story';

const el = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let open = false;
/** True while a scene is on screen; the game uses it to freeze driving and the horn. */
export const isDialogOpen = (): boolean => open;

interface Speaker {
  id: string;
  name: string;
}

/**
 * Plays a story beat: lines → one choice → the character's reply → closing lines.
 * Click / Space / Enter advances, 1 and 2 pick an option, Esc skips ahead. Resolves with the chosen option index.
 */
export async function playScene(sp: Speaker, beat: Beat): Promise<number> {
  const root = el('dialog');
  open = true;
  let skipping = false;
  let advance: (() => void) | null = null;

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      advance?.();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      skipping = true;
      advance?.();
    } else if (e.code === 'Digit1' || e.code === 'Digit2') {
      choose?.(e.code === 'Digit1' ? 0 : 1);
    }
  };
  let choose: ((i: number) => void) | null = null;
  window.addEventListener('keydown', onKey, true);
  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    advance?.();
  };

  el('dgKick').textContent = `STORY · ${beat.title}`;
  root.classList.add('on');
  await new Promise((r) => setTimeout(r, 320));

  const say = async (l: Line) => {
    const you = l.who === 'you';
    (el('dgFace') as HTMLImageElement).src = you ? avatarURL('depot', 160) : avatarURL(sp.id, 160);
    el('dgName').textContent = you ? 'You' : sp.name;
    el('dgChoices').innerHTML = '';
    el('dgNext').style.visibility = 'hidden';
    const text = el('dgText');
    text.classList.toggle('note', l.who === 'note');
    text.textContent = '';
    await new Promise<void>((res) => {
      let i = 0;
      const t = window.setInterval(() => {
        i += skipping ? 99 : 1;
        text.textContent = l.text.slice(0, i);
        if (i % 3 === 0) sfx.tap();
        if (i >= l.text.length) {
          window.clearInterval(t);
          res();
        }
      }, 22);
      advance = () => {
        window.clearInterval(t);
        text.textContent = l.text; // first press completes the line…
        res();
      };
    });
    el('dgNext').style.visibility = 'visible';
    if (skipping) return;
    await new Promise<void>((res) => (advance = res)); // …second press moves on
  };

  for (const l of beat.lines) await say(l);

  skipping = false; // a choice must always be made by the player
  const idx = await new Promise<number>((res) => {
    el('dgText').textContent = beat.choice.prompt;
    el('dgText').classList.remove('note');
    el('dgNext').style.visibility = 'hidden';
    el('dgChoices').innerHTML = beat.choice.options.map((o, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd> ${esc(o.text)}</button>`).join('');
    choose = res;
    el('dgChoices').querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => res(Number(b.dataset.i))));
  });
  choose = null;
  sfx.buy();
  await say({ who: 'npc', text: beat.choice.options[idx].reply });
  for (const l of beat.after) await say(l);

  window.removeEventListener('keydown', onKey, true);
  root.onclick = null;
  root.classList.remove('on');
  await new Promise((r) => setTimeout(r, 300));
  open = false;
  return idx;
}
